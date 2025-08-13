import { ConnectionPool } from '../utils/connection-pool.js';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class SynapseOperations {
  constructor(
    private connectionPool: ConnectionPool,
    private tenantManager: TenantManager
  ) {}

  async executeSqlQuery(params: {
    workspace: string;
    database: string;
    query: string;
    poolType?: 'dedicated' | 'serverless';
    tenant?: string;
  }) {
    const { workspace, database, query, poolType = 'serverless', tenant } = params;
    
    try {
      // Get connection string for the tenant and pool type
      const connectionString = this.tenantManager.getConnectionString(tenant, poolType);
      if (!connectionString) {
        throw new Error(`No ${poolType} pool configured for tenant: ${tenant || 'default'}`);
      }

      // Get or create connection
      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        poolType
      );

      // Execute query
      const results = await this.connectionPool.executeQuery(connection, query);
      
      logger.info(`Query executed successfully on ${workspace}/${database} (${poolType})`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              rowCount: results.length,
              data: results,
              metadata: {
                workspace,
                database,
                poolType,
                executionTime: new Date().toISOString(),
                tenant: tenant || 'default'
              }
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Query execution failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: this.getErrorHint(error),
              metadata: {
                workspace,
                database,
                poolType,
                tenant: tenant || 'default'
              }
            }, null, 2)
          }
        ]
      };
    }
  }

  async analyzeTableSchema(params: {
    workspace: string;
    database: string;
    schema?: string;
    tableName: string;
    includeStats?: boolean;
    tenant?: string;
  }) {
    const { workspace, database, schema = 'dbo', tableName, includeStats = true, tenant } = params;
    
    // Query to get column information
    const schemaQuery = `
      SELECT 
        c.column_id,
        c.name AS column_name,
        t.name AS data_type,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        ISNULL(pk.is_primary_key, 0) AS is_primary_key,
        ISNULL(fk.referenced_table, '') AS foreign_key_reference,
        ISNULL(idx.index_count, 0) AS index_count,
        ISNULL(cc.definition, '') AS check_constraint,
        ISNULL(dc.definition, '') AS default_constraint
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      INNER JOIN sys.tables tb ON c.object_id = tb.object_id
      INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
      LEFT JOIN (
        SELECT 
          ic.column_id,
          1 AS is_primary_key
        FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id 
          AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
          AND ic.object_id = OBJECT_ID('${schema}.${tableName}')
      ) pk ON c.column_id = pk.column_id
      LEFT JOIN (
        SELECT 
          fkc.parent_column_id AS column_id,
          OBJECT_SCHEMA_NAME(fkc.referenced_object_id) + '.' + 
          OBJECT_NAME(fkc.referenced_object_id) + '.' +
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_table
        FROM sys.foreign_key_columns fkc
        WHERE fkc.parent_object_id = OBJECT_ID('${schema}.${tableName}')
      ) fk ON c.column_id = fk.column_id
      LEFT JOIN (
        SELECT 
          column_id,
          COUNT(*) AS index_count
        FROM sys.index_columns
        WHERE object_id = OBJECT_ID('${schema}.${tableName}')
        GROUP BY column_id
      ) idx ON c.column_id = idx.column_id
      LEFT JOIN sys.check_constraints cc 
        ON cc.parent_object_id = tb.object_id 
        AND cc.parent_column_id = c.column_id
      LEFT JOIN sys.default_constraints dc 
        ON dc.parent_object_id = tb.object_id 
        AND dc.parent_column_id = c.column_id
      WHERE s.name = '${schema}' 
        AND tb.name = '${tableName}'
      ORDER BY c.column_id`;
    
    const schemaResult = await this.executeSqlQuery({
      workspace,
      database,
      query: schemaQuery,
      poolType: 'dedicated',
      tenant
    });

    // If includeStats is true, get table statistics
    if (includeStats) {
      const statsQuery = `
        SELECT 
          p.rows AS row_count,
          SUM(a.total_pages) * 8 AS total_space_kb,
          SUM(a.used_pages) * 8 AS used_space_kb,
          (SUM(a.total_pages) - SUM(a.used_pages)) * 8 AS unused_space_kb,
          STATS_DATE(i.object_id, i.index_id) AS stats_updated_date
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        INNER JOIN sys.indexes i ON t.object_id = i.object_id
        INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
        WHERE s.name = '${schema}' 
          AND t.name = '${tableName}'
          AND i.index_id <= 1
        GROUP BY p.rows, i.object_id, i.index_id`;
      
      const statsResult = await this.executeSqlQuery({
        workspace,
        database,
        query: statsQuery,
        poolType: 'dedicated',
        tenant
      });

      // Combine schema and stats results
      const schemaData = JSON.parse(schemaResult.content[0].text);
      const statsData = JSON.parse(statsResult.content[0].text);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              table: `${schema}.${tableName}`,
              columns: schemaData.data,
              statistics: statsData.data[0] || {},
              metadata: {
                workspace,
                database,
                tenant: tenant || 'default'
              }
            }, null, 2)
          }
        ]
      };
    }
    
    return schemaResult;
  }

  async dataMigrationHelper(params: {
    workspace: string;
    sourceDatabase: string;
    targetDatabase: string;
    tables?: string[];
    schema?: string;
    migrationMode?: 'schema-only' | 'data-only' | 'full';
    tenant?: string;
  }) {
    const { 
      workspace, 
      sourceDatabase, 
      targetDatabase, 
      tables, 
      schema = 'dbo', 
      migrationMode = 'full',
      tenant 
    } = params;
    
    try {
      // Get list of tables to migrate
      let tablesToMigrate = tables || [];
      if (!tables) {
        const listTablesQuery = `
          SELECT 
            s.name AS schema_name,
            t.name AS table_name
          FROM sys.tables t
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE s.name = '${schema}'
          ORDER BY t.name`;
        
        const tablesResult = await this.executeSqlQuery({
          workspace,
          database: sourceDatabase,
          query: listTablesQuery,
          poolType: 'dedicated',
          tenant
        });
        
        const tablesData = JSON.parse(tablesResult.content[0].text);
        tablesToMigrate = tablesData.data.map((t: any) => t.table_name);
      }
      
      const migrationScripts: string[] = [];
      
      for (const table of tablesToMigrate) {
        // Generate CREATE TABLE script if needed
        if (migrationMode === 'schema-only' || migrationMode === 'full') {
          const createTableScript = await this.generateCreateTableScript(
            workspace,
            sourceDatabase,
            schema,
            table,
            targetDatabase,
            tenant
          );
          migrationScripts.push(createTableScript);
        }
        
        // Generate INSERT script if needed
        if (migrationMode === 'data-only' || migrationMode === 'full') {
          const insertScript = `
-- Copy data from ${sourceDatabase}.${schema}.${table} to ${targetDatabase}.${schema}.${table}
INSERT INTO ${targetDatabase}.${schema}.${table}
SELECT * FROM ${sourceDatabase}.${schema}.${table};
`;
          migrationScripts.push(insertScript);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              migrationMode,
              sourceDatabase,
              targetDatabase,
              tablesCount: tablesToMigrate.length,
              tables: tablesToMigrate,
              scripts: migrationScripts,
              instructions: [
                '1. Review the generated scripts',
                '2. Execute them in the target database',
                '3. Verify data integrity after migration',
                '4. Update any dependent objects (views, procedures, etc.)'
              ]
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Ensure both source and target databases are accessible'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async generateCreateTableScript(
    workspace: string,
    database: string,
    schema: string,
    table: string,
    targetDatabase: string,
    tenant?: string
  ): Promise<string> {
    // Get table definition
    const tableDefQuery = `
      SELECT 
        'CREATE TABLE ' + '${targetDatabase}.${schema}.${table}' + ' (' AS script
      UNION ALL
      SELECT 
        '    ' + c.name + ' ' + 
        t.name + 
        CASE 
          WHEN t.name IN ('varchar', 'char', 'nvarchar', 'nchar') 
          THEN '(' + CAST(c.max_length AS VARCHAR) + ')'
          WHEN t.name IN ('decimal', 'numeric')
          THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
          ELSE ''
        END +
        CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END +
        CASE WHEN c.is_identity = 1 THEN ' IDENTITY(1,1)' ELSE '' END + ','
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      INNER JOIN sys.tables tb ON c.object_id = tb.object_id
      INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
      WHERE s.name = '${schema}' AND tb.name = '${table}'
      ORDER BY c.column_id`;
    
    const result = await this.executeSqlQuery({
      workspace,
      database,
      query: tableDefQuery,
      poolType: 'dedicated',
      tenant
    });
    
    const data = JSON.parse(result.content[0].text);
    let script = data.data.map((row: any) => row.script).join('\n');
    
    // Remove last comma and add closing parenthesis
    script = script.replace(/,$/, '') + '\n);';
    
    return script;
  }

  private getErrorHint(error: any): string {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('login failed')) {
      return 'Check your authentication credentials and ensure the user has access to the database';
    }
    if (errorMessage.includes('cannot open database')) {
      return 'Database does not exist or user lacks permission to access it';
    }
    if (errorMessage.includes('syntax')) {
      return 'SQL syntax error - review your query for typos or invalid SQL constructs';
    }
    if (errorMessage.includes('timeout')) {
      return 'Query took too long to execute - consider optimizing or increasing timeout';
    }
    if (errorMessage.includes('connection')) {
      return 'Connection issue - verify network connectivity and firewall settings';
    }
    
    return 'Check Azure Synapse workspace settings and ensure proper permissions';
  }
}

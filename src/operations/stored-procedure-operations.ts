import { ConnectionPool } from '../utils/connection-pool.js';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class StoredProcedureOperations {
  constructor(
    private connectionPool: ConnectionPool,
    private tenantManager: TenantManager
  ) {}

  async manageStoredProcedures(params: {
    workspace: string;
    database: string;
    action: 'create' | 'update' | 'get' | 'list' | 'execute' | 'analyze';
    schema?: string;
    procedureName?: string;
    procedureBody?: string;
    parameters?: Record<string, any>;
    tenant?: string;
  }) {
    const { workspace, database, action, schema = 'dbo', procedureName, procedureBody, parameters, tenant } = params;

    switch (action) {
      case 'create':
        return await this.createProcedure(workspace, database, schema, procedureName!, procedureBody!, tenant);
      
      case 'update':
        return await this.updateProcedure(workspace, database, schema, procedureName!, procedureBody!, tenant);
      
      case 'get':
        return await this.getProcedure(workspace, database, schema, procedureName!, tenant);
      
      case 'list':
        return await this.listProcedures(workspace, database, schema, tenant);
      
      case 'execute':
        return await this.executeProcedure(workspace, database, schema, procedureName!, parameters, tenant);
      
      case 'analyze':
        return await this.analyzeProcedure(workspace, database, schema, procedureName!, tenant);
      
      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Unknown action: ${action}`
              }, null, 2)
            }
          ]
        };
    }
  }

  private async createProcedure(
    workspace: string,
    database: string,
    schema: string,
    procedureName: string,
    procedureBody: string,
    tenant?: string
  ) {
    const createQuery = `
      CREATE PROCEDURE [${schema}].[${procedureName}]
      ${procedureBody}
    `;

    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      await this.connectionPool.executeQuery(connection, createQuery);
      
      logger.info(`Stored procedure created: ${schema}.${procedureName}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Stored procedure ${schema}.${procedureName} created successfully`,
              workspace,
              database
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to create stored procedure:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check if procedure already exists or syntax is correct'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async updateProcedure(
    workspace: string,
    database: string,
    schema: string,
    procedureName: string,
    procedureBody: string,
    tenant?: string
  ) {
    const alterQuery = `
      ALTER PROCEDURE [${schema}].[${procedureName}]
      ${procedureBody}
    `;

    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      await this.connectionPool.executeQuery(connection, alterQuery);
      
      logger.info(`Stored procedure updated: ${schema}.${procedureName}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Stored procedure ${schema}.${procedureName} updated successfully`,
              workspace,
              database
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to update stored procedure:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check if procedure exists and syntax is correct'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async getProcedure(
    workspace: string,
    database: string,
    schema: string,
    procedureName: string,
    tenant?: string
  ) {
    const getQuery = `
      SELECT 
        OBJECT_NAME(object_id) AS procedure_name,
        OBJECT_DEFINITION(object_id) AS definition,
        create_date,
        modify_date
      FROM sys.procedures
      WHERE SCHEMA_NAME(schema_id) = '${schema}' 
        AND name = '${procedureName}'
    `;

    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      const results = await this.connectionPool.executeQuery(connection, getQuery);
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Stored procedure ${schema}.${procedureName} not found`
              }, null, 2)
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              procedure: results[0],
              workspace,
              database
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to get stored procedure:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  private async listProcedures(
    workspace: string,
    database: string,
    schema: string,
    tenant?: string
  ) {
    const listQuery = `
      SELECT 
        SCHEMA_NAME(schema_id) AS schema_name,
        name AS procedure_name,
        create_date,
        modify_date,
        (SELECT COUNT(*) 
         FROM sys.parameters 
         WHERE object_id = p.object_id) AS parameter_count
      FROM sys.procedures p
      WHERE SCHEMA_NAME(schema_id) = '${schema}'
      ORDER BY name
    `;

    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      const results = await this.connectionPool.executeQuery(connection, listQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              procedures: results,
              count: results.length,
              workspace,
              database,
              schema
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to list stored procedures:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  private async executeProcedure(
    workspace: string,
    database: string,
    schema: string,
    procedureName: string,
    parameters?: Record<string, any>,
    tenant?: string
  ) {
    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      // Build EXEC statement
      let execQuery = `EXEC [${schema}].[${procedureName}]`;
      
      if (parameters && Object.keys(parameters).length > 0) {
        const paramList = Object.entries(parameters)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `@${key} = '${value.replace(/'/g, "''")}'`;
            } else if (value === null) {
              return `@${key} = NULL`;
            } else {
              return `@${key} = ${value}`;
            }
          })
          .join(', ');
        
        execQuery += ` ${paramList}`;
      }

      const results = await this.connectionPool.executeQuery(connection, execQuery);
      
      logger.info(`Executed stored procedure: ${schema}.${procedureName}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Stored procedure ${schema}.${procedureName} executed successfully`,
              results,
              rowCount: results.length,
              workspace,
              database
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to execute stored procedure:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check procedure parameters and permissions'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async analyzeProcedure(
    workspace: string,
    database: string,
    schema: string,
    procedureName: string,
    tenant?: string
  ) {
    const analysisQuery = `
      -- Get procedure information and parameters
      SELECT 
        p.object_id,
        p.name AS procedure_name,
        SCHEMA_NAME(p.schema_id) AS schema_name,
        p.create_date,
        p.modify_date,
        LEN(OBJECT_DEFINITION(p.object_id)) AS definition_length
      FROM sys.procedures p
      WHERE SCHEMA_NAME(p.schema_id) = '${schema}' 
        AND p.name = '${procedureName}';

      -- Get parameters
      SELECT 
        par.name AS parameter_name,
        t.name AS data_type,
        par.max_length,
        par.precision,
        par.scale,
        par.is_output,
        par.has_default_value
      FROM sys.parameters par
      INNER JOIN sys.types t ON par.user_type_id = t.user_type_id
      INNER JOIN sys.procedures p ON par.object_id = p.object_id
      WHERE SCHEMA_NAME(p.schema_id) = '${schema}' 
        AND p.name = '${procedureName}'
      ORDER BY par.parameter_id;

      -- Get dependencies
      SELECT DISTINCT
        OBJECT_SCHEMA_NAME(d.referenced_major_id) AS referenced_schema,
        OBJECT_NAME(d.referenced_major_id) AS referenced_object,
        o.type_desc AS object_type
      FROM sys.sql_dependencies d
      INNER JOIN sys.objects o ON d.referenced_major_id = o.object_id
      INNER JOIN sys.procedures p ON d.object_id = p.object_id
      WHERE SCHEMA_NAME(p.schema_id) = '${schema}' 
        AND p.name = '${procedureName}';
    `;

    try {
      const connectionString = this.tenantManager.getConnectionString(tenant, 'dedicated');
      if (!connectionString) {
        throw new Error(`No dedicated pool configured for tenant: ${tenant || 'default'}`);
      }

      const connection = await this.connectionPool.getConnection(
        connectionString,
        workspace,
        database,
        'dedicated'
      );

      // Execute the multi-statement query
      const results = await this.connectionPool.executeQuery(connection, analysisQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              analysis: {
                procedure: `${schema}.${procedureName}`,
                metadata: results[0] || {},
                parameters: results.filter((r: any) => r.parameter_name),
                dependencies: results.filter((r: any) => r.referenced_object),
                recommendations: this.generateProcedureRecommendations(results)
              },
              workspace,
              database
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to analyze stored procedure:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  private generateProcedureRecommendations(analysisResults: any[]): string[] {
    const recommendations: string[] = [];
    
    // Check for large procedure
    const metadata = analysisResults[0];
    if (metadata && metadata.definition_length > 5000) {
      recommendations.push('Consider breaking down this large procedure into smaller, more manageable procedures');
    }
    
    // Check for output parameters
    const hasOutputParams = analysisResults.some((r: any) => r.is_output);
    if (!hasOutputParams) {
      recommendations.push('Consider using output parameters for returning scalar values instead of result sets');
    }
    
    // Check for dependencies
    const dependencies = analysisResults.filter((r: any) => r.referenced_object);
    if (dependencies.length > 10) {
      recommendations.push('High number of dependencies detected - consider reviewing for tight coupling');
    }
    
    return recommendations;
  }
}

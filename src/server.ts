import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SynapseOperations } from './operations/synapse-operations.js';
import { PipelineOperations } from './operations/pipeline-operations.js';
import { StoredProcedureOperations } from './operations/stored-procedure-operations.js';
import { DataFlowOperations } from './operations/dataflow-operations.js';
import { SparkNotebookOperations } from './operations/spark-notebook-operations.js';
import { LinkedServiceOperations } from './operations/linked-service-operations.js';
import { logger } from './utils/logger.js';
import { TenantManager } from './utils/tenant-manager.js';
import { ConnectionPool } from './utils/connection-pool.js';

// Tool input schemas
const ExecuteSqlQuerySchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  database: z.string().describe('Database name'),
  query: z.string().describe('SQL query to execute'),
  poolType: z.enum(['dedicated', 'serverless']).optional().default('serverless'),
  tenant: z.string().optional().describe('Tenant/client identifier')
});

const ListPipelinesSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

const TriggerPipelineSchema = z.object({
  workspace: z.string(),
  pipelineName: z.string(),
  parameters: z.record(z.any()).optional(),
  tenant: z.string().optional()
});

const GetPipelineStatusSchema = z.object({
  workspace: z.string(),
  pipelineName: z.string(),
  runId: z.string().optional(),
  tenant: z.string().optional()
});

const ManageStoredProcedureSchema = z.object({
  workspace: z.string(),
  database: z.string(),
  action: z.enum(['create', 'update', 'get', 'list', 'execute', 'analyze']),
  schema: z.string().optional().default('dbo'),
  procedureName: z.string().optional(),
  procedureBody: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  tenant: z.string().optional()
});

const AnalyzeTableSchemaSchema = z.object({
  workspace: z.string(),
  database: z.string(),
  schema: z.string().optional().default('dbo'),
  tableName: z.string(),
  includeStats: z.boolean().optional().default(true),
  tenant: z.string().optional()
});

const MonitorDataFlowsSchema = z.object({
  workspace: z.string(),
  dataflowName: z.string().optional(),
  timeRange: z.enum(['1hour', '6hours', '24hours', '7days']).optional().default('24hours'),
  tenant: z.string().optional()
});

const DataMigrationSchema = z.object({
  workspace: z.string(),
  sourceDatabase: z.string(),
  targetDatabase: z.string(),
  tables: z.array(z.string()).optional(),
  schema: z.string().optional().default('dbo'),
  migrationMode: z.enum(['schema-only', 'data-only', 'full']).default('full'),
  tenant: z.string().optional()
});

// Spark Notebook Schemas
const ListNotebooksSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

const CreateNotebookSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  notebookName: z.string().describe('Name for the new notebook'),
  language: z.enum(['pyspark', 'scala', 'csharp', 'sql']).optional().default('pyspark'),
  sparkPoolName: z.string().optional().describe('Spark pool to attach to'),
  initialContent: z.string().optional().describe('Initial code content'),
  tenant: z.string().optional()
});

const GetNotebookSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  notebookName: z.string().describe('Name of the notebook'),
  tenant: z.string().optional()
});

const DeleteNotebookSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  notebookName: z.string().describe('Name of the notebook to delete'),
  tenant: z.string().optional()
});

const ListSparkPoolsSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

// Linked Service Schemas
const ListLinkedServicesSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

const GetLinkedServiceSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  linkedServiceName: z.string().describe('Name of the linked service'),
  tenant: z.string().optional()
});

const ListDatasetsSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

const GetDatasetSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  datasetName: z.string().describe('Name of the dataset'),
  tenant: z.string().optional()
});

const ListIntegrationRuntimesSchema = z.object({
  workspace: z.string().describe('Synapse workspace name'),
  tenant: z.string().optional()
});

export class AzureSynapseMCPServer {
  private server: Server;
  private synapseOps: SynapseOperations;
  private pipelineOps: PipelineOperations;
  private storedProcOps: StoredProcedureOperations;
  private dataflowOps: DataFlowOperations;
  private sparkNotebookOps: SparkNotebookOperations;
  private linkedServiceOps: LinkedServiceOperations;
  private tenantManager: TenantManager;
  private connectionPool: ConnectionPool;

  constructor() {
    this.server = new Server(
      {
        name: 'azure-synapse-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize operation handlers
    this.tenantManager = new TenantManager();
    this.connectionPool = new ConnectionPool();
    this.synapseOps = new SynapseOperations(this.connectionPool, this.tenantManager);
    this.pipelineOps = new PipelineOperations(this.tenantManager);
    this.storedProcOps = new StoredProcedureOperations(this.connectionPool, this.tenantManager);
    this.dataflowOps = new DataFlowOperations(this.tenantManager);
    this.sparkNotebookOps = new SparkNotebookOperations(this.tenantManager);
    this.linkedServiceOps = new LinkedServiceOperations(this.tenantManager);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_sql_query',
          description: 'Execute SQL query on Synapse SQL Pool (dedicated or serverless)',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              database: { type: 'string', description: 'Database name' },
              query: { type: 'string', description: 'SQL query to execute' },
              poolType: { 
                type: 'string', 
                enum: ['dedicated', 'serverless'],
                description: 'SQL pool type (default: serverless)'
              },
              tenant: { type: 'string', description: 'Optional tenant/client identifier' }
            },
            required: ['workspace', 'database', 'query']
          }
        },
        {
          name: 'list_pipelines',
          description: 'List all pipelines in Synapse workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'trigger_pipeline',
          description: 'Trigger a Synapse pipeline run',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              pipelineName: { type: 'string' },
              parameters: { type: 'object', description: 'Pipeline parameters' },
              tenant: { type: 'string' }
            },
            required: ['workspace', 'pipelineName']
          }
        },
        {
          name: 'get_pipeline_status',
          description: 'Get status of pipeline runs',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              pipelineName: { type: 'string' },
              runId: { type: 'string', description: 'Optional specific run ID' },
              tenant: { type: 'string' }
            },
            required: ['workspace', 'pipelineName']
          }
        },
        {
          name: 'manage_stored_procedures',
          description: 'Create, update, get, list, execute, or analyze stored procedures',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              database: { type: 'string' },
              action: { 
                type: 'string', 
                enum: ['create', 'update', 'get', 'list', 'execute', 'analyze'],
                description: 'Action to perform'
              },
              schema: { type: 'string', description: 'Schema name (default: dbo)' },
              procedureName: { type: 'string', description: 'Procedure name (required for most actions)' },
              procedureBody: { type: 'string', description: 'SQL body for create/update' },
              parameters: { type: 'object', description: 'Parameters for execute' },
              tenant: { type: 'string' }
            },
            required: ['workspace', 'database', 'action']
          }
        },
        {
          name: 'analyze_table_schema',
          description: 'Get detailed schema information and statistics for tables',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              database: { type: 'string' },
              schema: { type: 'string', description: 'Schema name (default: dbo)' },
              tableName: { type: 'string' },
              includeStats: { type: 'boolean', description: 'Include table statistics' },
              tenant: { type: 'string' }
            },
            required: ['workspace', 'database', 'tableName']
          }
        },
        {
          name: 'monitor_data_flows',
          description: 'Monitor data flow activities and performance',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              dataflowName: { type: 'string', description: 'Optional specific dataflow' },
              timeRange: { 
                type: 'string', 
                enum: ['1hour', '6hours', '24hours', '7days'],
                description: 'Time range for monitoring'
              },
              tenant: { type: 'string' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'data_migration_helper',
          description: 'Helper tool for data migration between databases',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              sourceDatabase: { type: 'string' },
              targetDatabase: { type: 'string' },
              tables: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Specific tables to migrate (optional)'
              },
              schema: { type: 'string', description: 'Schema name (default: dbo)' },
              migrationMode: { 
                type: 'string',
                enum: ['schema-only', 'data-only', 'full'],
                description: 'Migration mode'
              },
              tenant: { type: 'string' }
            },
            required: ['workspace', 'sourceDatabase', 'targetDatabase']
          }
        },
        {
          name: 'list_notebooks',
          description: 'List all Spark notebooks in the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'create_notebook',
          description: 'Create a new Spark notebook',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              notebookName: { type: 'string', description: 'Name for the new notebook' },
              language: { 
                type: 'string', 
                enum: ['pyspark', 'scala', 'csharp', 'sql'],
                description: 'Programming language (default: pyspark)'
              },
              sparkPoolName: { type: 'string', description: 'Spark pool to attach to' },
              initialContent: { type: 'string', description: 'Initial code content' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace', 'notebookName']
          }
        },
        {
          name: 'get_notebook',
          description: 'Get details of a specific notebook',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              notebookName: { type: 'string', description: 'Name of the notebook' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace', 'notebookName']
          }
        },
        {
          name: 'delete_notebook',
          description: 'Delete a Spark notebook',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              notebookName: { type: 'string', description: 'Name of the notebook to delete' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace', 'notebookName']
          }
        },
        {
          name: 'list_spark_pools',
          description: 'List all Spark pools in the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'list_linked_services',
          description: 'List all linked services in the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'get_linked_service',
          description: 'Get details of a specific linked service',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              linkedServiceName: { type: 'string', description: 'Name of the linked service' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace', 'linkedServiceName']
          }
        },
        {
          name: 'list_datasets',
          description: 'List all integration datasets in the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        },
        {
          name: 'get_dataset',
          description: 'Get details of a specific dataset',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              datasetName: { type: 'string', description: 'Name of the dataset' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace', 'datasetName']
          }
        },
        {
          name: 'list_integration_runtimes',
          description: 'List all integration runtimes in the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Synapse workspace name' },
              tenant: { type: 'string', description: 'Optional tenant identifier' }
            },
            required: ['workspace']
          }
        }
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate workspace restriction if configured
        const allowedWorkspace = process.env.AZURE_SYNAPSE_ALLOWED_WORKSPACE;
        if (allowedWorkspace && args && typeof args === 'object' && 'workspace' in args) {
          const requestedWorkspace = (args as any).workspace;
          if (requestedWorkspace !== allowedWorkspace) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Access denied. This server is restricted to workspace '${allowedWorkspace}'. Requested workspace: '${requestedWorkspace}'`
            );
          }
        }

        switch (name) {
          case 'execute_sql_query': {
            const params = ExecuteSqlQuerySchema.parse(args);
            return await this.synapseOps.executeSqlQuery(params);
          }

          case 'list_pipelines': {
            const params = ListPipelinesSchema.parse(args);
            return await this.pipelineOps.listPipelines(params);
          }

          case 'trigger_pipeline': {
            const params = TriggerPipelineSchema.parse(args);
            return await this.pipelineOps.triggerPipeline(params);
          }

          case 'get_pipeline_status': {
            const params = GetPipelineStatusSchema.parse(args);
            return await this.pipelineOps.getPipelineStatus(params);
          }

          case 'manage_stored_procedures': {
            const params = ManageStoredProcedureSchema.parse(args);
            return await this.storedProcOps.manageStoredProcedures(params);
          }

          case 'analyze_table_schema': {
            const params = AnalyzeTableSchemaSchema.parse(args);
            return await this.synapseOps.analyzeTableSchema(params);
          }

          case 'monitor_data_flows': {
            const params = MonitorDataFlowsSchema.parse(args);
            return await this.dataflowOps.monitorDataFlows(params);
          }

          case 'data_migration_helper': {
            const params = DataMigrationSchema.parse(args);
            return await this.synapseOps.dataMigrationHelper(params);
          }

          // Spark Notebook Operations
          case 'list_notebooks': {
            const params = ListNotebooksSchema.parse(args);
            return await this.sparkNotebookOps.listNotebooks(params);
          }

          case 'create_notebook': {
            const params = CreateNotebookSchema.parse(args);
            return await this.sparkNotebookOps.createNotebook(params);
          }

          case 'get_notebook': {
            const params = GetNotebookSchema.parse(args);
            return await this.sparkNotebookOps.getNotebook(params);
          }

          case 'delete_notebook': {
            const params = DeleteNotebookSchema.parse(args);
            return await this.sparkNotebookOps.deleteNotebook(params);
          }

          case 'list_spark_pools': {
            const params = ListSparkPoolsSchema.parse(args);
            return await this.sparkNotebookOps.listSparkPools(params);
          }

          // Linked Service Operations
          case 'list_linked_services': {
            const params = ListLinkedServicesSchema.parse(args);
            return await this.linkedServiceOps.listLinkedServices(params);
          }

          case 'get_linked_service': {
            const params = GetLinkedServiceSchema.parse(args);
            return await this.linkedServiceOps.getLinkedService(params);
          }

          case 'list_datasets': {
            const params = ListDatasetsSchema.parse(args);
            return await this.linkedServiceOps.listDatasets(params);
          }

          case 'get_dataset': {
            const params = GetDatasetSchema.parse(args);
            return await this.linkedServiceOps.getDataset(params);
          }

          case 'list_integration_runtimes': {
            const params = ListIntegrationRuntimesSchema.parse(args);
            return await this.linkedServiceOps.listIntegrationRuntimes(params);
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    });
  }

  async connect(transport: any) {
    await this.server.connect(transport);
    logger.info('MCP Server connected to transport');
  }

  async close() {
    await this.connectionPool.closeAll();
    await this.server.close();
    logger.info('MCP Server closed');
  }
}

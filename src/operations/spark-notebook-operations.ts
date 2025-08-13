import { ArtifactsClient } from '@azure/synapse-artifacts';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class SparkNotebookOperations {
  constructor(private tenantManager: TenantManager) {}

  async listNotebooks(params: {
    workspace: string;
    tenant?: string;
  }) {
    const { workspace, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const notebooks = [];
      const iterator = client.notebookOperations.listNotebooksByWorkspace();
      
      for await (const notebook of iterator) {
        notebooks.push({
          name: notebook.name,
          id: notebook.id,
          type: notebook.type,
          etag: notebook.etag,
          language: notebook.properties?.metadata?.language_info?.name || 'Unknown'
        });
      }
      
      logger.info(`Listed ${notebooks.length} notebooks in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              notebooks,
              count: notebooks.length,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error listing notebooks:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async createNotebook(params: {
    workspace: string;
    notebookName: string;
    language?: 'pyspark' | 'scala' | 'csharp' | 'sql';
    sparkPoolName?: string;
    initialContent?: string;
    tenant?: string;
  }) {
    const { 
      workspace, 
      notebookName, 
      language = 'pyspark', 
      sparkPoolName,
      initialContent,
      tenant 
    } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);

      // Create notebook definition
      const notebookResource = {
        name: notebookName,
        properties: {
          metadata: {
            language_info: {
              name: language
            },
            kernelspec: {
              name: `synapse_${language}`,
              displayName: language.charAt(0).toUpperCase() + language.slice(1)
            }
          },
          sessionProperties: {
            driverMemory: '28g',
            driverCores: 4,
            executorMemory: '28g',
            executorCores: 4,
            numExecutors: 2,
            conf: {
              'spark.dynamicAllocation.enabled': 'false',
              'spark.dynamicAllocation.minExecutors': '2',
              'spark.dynamicAllocation.maxExecutors': '2'
            }
          },
          cells: [
            {
              cellType: 'code',
              source: [
                initialContent || this.getDefaultCellContent(language)
              ],
              metadata: {
                collapsed: false
              },
              outputs: [],
              executionCount: null
            }
          ],
          nbformat: 4,
          nbformatMinor: 2
        }
      };

      const poller = await client.notebookOperations.beginCreateOrUpdateNotebook(
        notebookName,
        notebookResource
      );
      
      const result = await poller.pollUntilDone();
      
      logger.info(`Created notebook ${notebookName} in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              notebook: {
                name: result.name,
                id: result.id,
                type: result.type,
                language,
                sparkPoolName,
                etag: result.etag
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error creating notebook:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              notebookName,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async getNotebook(params: {
    workspace: string;
    notebookName: string;
    tenant?: string;
  }) {
    const { workspace, notebookName, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const notebook = await client.notebookOperations.getNotebook(notebookName);
      
      logger.info(`Retrieved notebook ${notebookName} from workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              notebook: {
                name: notebook.name,
                id: notebook.id,
                type: notebook.type,
                language: notebook.properties?.metadata?.language_info?.name,
                cellCount: notebook.properties?.cells?.length || 0,
                sparkPoolName: 'Not available via API',
                etag: notebook.etag
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error getting notebook:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              notebookName,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async deleteNotebook(params: {
    workspace: string;
    notebookName: string;
    tenant?: string;
  }) {
    const { workspace, notebookName, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const poller = await client.notebookOperations.beginDeleteNotebook(notebookName);
      await poller.pollUntilDone();
      
      logger.info(`Deleted notebook ${notebookName} from workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Notebook '${notebookName}' deleted successfully`,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error deleting notebook:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              notebookName,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async listSparkPools(params: {
    workspace: string;
    tenant?: string;
  }) {
    const { workspace, tenant } = params;
    
    try {
      // Note: Spark pools are typically managed at the workspace level via ARM APIs
      // The ArtifactsClient doesn't have direct access to BigData pools
      logger.info(`Spark pools listing requested for workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Spark pools listing requires ARM management APIs. Use Azure portal or ARM REST APIs to manage Spark pools.',
              workspace,
              tenant: tenant || 'default',
              note: 'This feature requires additional ARM API integration'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error listing Spark pools:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  private getDefaultCellContent(language: string): string {
    switch (language) {
      case 'pyspark':
        return 'print("Hello from PySpark!")\\n\\n# Your PySpark code here\\ndf = spark.read.option("header", "true").csv("your_data_source")\\ndf.show()';
      case 'scala':
        return 'println("Hello from Scala!")\\n\\n// Your Scala code here\\nval df = spark.read.option("header", "true").csv("your_data_source")\\ndf.show()';
      case 'csharp':
        return 'Console.WriteLine("Hello from C#!");\\n\\n// Your C# code here\\nvar df = spark.Read().Option("header", "true").Csv("your_data_source");\\ndf.Show();';
      case 'sql':
        return '-- Hello from SQL!\\n\\n-- Your SQL code here\\nSELECT * FROM your_table LIMIT 10;';
      default:
        return 'print("Hello from Synapse Notebook!")';
    }
  }
}
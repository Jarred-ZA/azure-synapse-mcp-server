import { ArtifactsClient } from '@azure/synapse-artifacts';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class LinkedServiceOperations {
  constructor(private tenantManager: TenantManager) {}

  async listLinkedServices(params: {
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
      
      const linkedServices = [];
      const iterator = client.linkedServiceOperations.listLinkedServicesByWorkspace();
      
      for await (const service of iterator) {
        linkedServices.push({
          name: service.name,
          id: service.id,
          type: service.type,
          serviceType: service.properties?.type,
          description: service.properties?.description,
          etag: service.etag
        });
      }
      
      logger.info(`Listed ${linkedServices.length} linked services in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              linkedServices,
              count: linkedServices.length,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error listing linked services:', error);
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

  async getLinkedService(params: {
    workspace: string;
    linkedServiceName: string;
    tenant?: string;
  }) {
    const { workspace, linkedServiceName, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const linkedService = await client.linkedServiceOperations.getLinkedService(linkedServiceName);
      
      // Extract connection details (without exposing secrets)
      const connectionInfo = this.extractConnectionInfo(linkedService.properties);
      
      logger.info(`Retrieved linked service ${linkedServiceName} from workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              linkedService: {
                name: linkedService.name,
                id: linkedService.id,
                type: linkedService.type,
                serviceType: linkedService.properties?.type,
                description: linkedService.properties?.description,
                connectionInfo,
                etag: linkedService.etag
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error getting linked service:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              linkedServiceName,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async listDatasets(params: {
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
      
      const datasets = [];
      const iterator = client.datasetOperations.listDatasetsByWorkspace();
      
      for await (const dataset of iterator) {
        datasets.push({
          name: dataset.name,
          id: dataset.id,
          type: dataset.type,
          datasetType: dataset.properties?.type,
          linkedServiceName: dataset.properties?.linkedServiceName?.referenceName,
          description: dataset.properties?.description,
          etag: dataset.etag
        });
      }
      
      logger.info(`Listed ${datasets.length} datasets in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              datasets,
              count: datasets.length,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error listing datasets:', error);
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

  async getDataset(params: {
    workspace: string;
    datasetName: string;
    tenant?: string;
  }) {
    const { workspace, datasetName, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const dataset = await client.datasetOperations.getDataset(datasetName);
      
      // Extract dataset structure (without exposing sensitive data)
      const structure = this.extractDatasetStructure(dataset.properties);
      
      logger.info(`Retrieved dataset ${datasetName} from workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dataset: {
                name: dataset.name,
                id: dataset.id,
                type: dataset.type,
                datasetType: dataset.properties?.type,
                linkedServiceName: dataset.properties?.linkedServiceName?.referenceName,
                description: dataset.properties?.description,
                structure,
                etag: dataset.etag
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error getting dataset:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              datasetName,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    }
  }

  async listIntegrationRuntimes(params: {
    workspace: string;
    tenant?: string;
  }) {
    const { workspace, tenant } = params;
    
    try {
      // Note: Integration runtimes listing via Artifacts API may not be directly available
      logger.info(`Integration runtimes listing requested for workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Integration runtimes listing requires ARM management APIs or may not be available via Artifacts API.',
              workspace,
              tenant: tenant || 'default',
              note: 'This feature may require additional ARM API integration'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Error listing integration runtimes:', error);
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

  private extractConnectionInfo(properties: any): any {
    if (!properties) return {};

    // Extract non-sensitive connection information
    const info: any = {
      type: properties.type
    };

    // Add type-specific information without exposing secrets
    switch (properties.type) {
      case 'AzureSqlDatabase':
        if (properties.typeProperties?.connectionString) {
          // Extract server name without password
          const connStr = properties.typeProperties.connectionString;
          const serverMatch = connStr.match(/Server=([^;]+)/i);
          const dbMatch = connStr.match(/Database=([^;]+)/i);
          if (serverMatch) info.server = serverMatch[1];
          if (dbMatch) info.database = dbMatch[1];
        }
        break;
      case 'AzureBlobStorage':
        if (properties.typeProperties?.connectionString) {
          const connStr = properties.typeProperties.connectionString;
          const accountMatch = connStr.match(/AccountName=([^;]+)/i);
          if (accountMatch) info.accountName = accountMatch[1];
        }
        break;
      case 'AzureDataLakeStoreGen2':
        if (properties.typeProperties?.url) {
          info.url = properties.typeProperties.url;
        }
        break;
      default:
        // For other types, just include the type
        break;
    }

    return info;
  }

  private extractDatasetStructure(properties: any): any {
    if (!properties) return {};

    const structure: any = {
      type: properties.type
    };

    // Add type-specific structure information
    if (properties.structure) {
      structure.columns = properties.structure.map((col: any) => ({
        name: col.name,
        type: col.type
      }));
    }

    if (properties.schema) {
      structure.schema = properties.schema;
    }

    if (properties.typeProperties) {
      // Extract non-sensitive type properties
      const typeProps = { ...properties.typeProperties };
      
      // Remove sensitive information
      delete typeProps.password;
      delete typeProps.connectionString;
      delete typeProps.sasUri;
      delete typeProps.accountKey;
      
      structure.typeProperties = typeProps;
    }

    return structure;
  }
}
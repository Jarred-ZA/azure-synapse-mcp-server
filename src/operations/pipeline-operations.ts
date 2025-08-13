import { ArtifactsClient } from '@azure/synapse-artifacts';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class PipelineOperations {
  constructor(private tenantManager: TenantManager) {}

  async listPipelines(params: {
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
      
      const pipelines = [];
      const iterator = client.pipelineOperations.listPipelinesByWorkspace();
      
      for await (const pipeline of iterator) {
        pipelines.push({
          name: pipeline.name,
          id: pipeline.id,
          type: pipeline.type,
          etag: pipeline.etag
        });
      }
      
      logger.info(`Listed ${pipelines.length} pipelines in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              pipelines,
              count: pipelines.length,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to list pipelines:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check workspace name and permissions'
            }, null, 2)
          }
        ]
      };
    }
  }

  async triggerPipeline(params: {
    workspace: string;
    pipelineName: string;
    parameters?: Record<string, any>;
    tenant?: string;
  }) {
    const { workspace, pipelineName, parameters, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      // Create pipeline run
      const run = await client.pipelineOperations.createPipelineRun(
        pipelineName,
        {
          parameters: parameters || {}
        }
      );
      
      logger.info(`Triggered pipeline ${pipelineName} with run ID: ${run.runId}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              runId: run.runId,
              pipelineName,
              workspace,
              parameters,
              message: `Pipeline ${pipelineName} triggered successfully`,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to trigger pipeline:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check pipeline name and parameters'
            }, null, 2)
          }
        ]
      };
    }
  }

  async getPipelineStatus(params: {
    workspace: string;
    pipelineName: string;
    runId?: string;
    tenant?: string;
  }) {
    const { workspace, pipelineName, runId, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      if (runId) {
        // Get specific run status
        const run = await client.pipelineRunOperations.getPipelineRun(
          runId
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                run: {
                  runId: run.runId,
                  pipelineName: run.pipelineName,
                  status: run.status,
                  message: run.message,
                  runStart: run.runStart,
                  runEnd: run.runEnd,
                  durationInMs: run.durationInMs,
                  parameters: run.parameters
                },
                workspace,
                tenant: tenant || 'default'
              }, null, 2)
            }
          ]
        };
      } else {
        // Get recent runs for the pipeline
        const runs = [];
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        
        const response = await client.pipelineRunOperations.queryPipelineRunsByWorkspace({
          filters: [
            {
              operand: 'PipelineName',
              operator: 'Equals',
              values: [pipelineName]
            }
          ],
          lastUpdatedAfter: startTime,
          lastUpdatedBefore: endTime
        });
        
        for (const run of response.value || []) {
          runs.push({
            runId: run.runId,
            status: run.status,
            runStart: run.runStart,
            runEnd: run.runEnd,
            durationInMs: run.durationInMs,
            message: run.message
          });
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                pipelineName,
                runs,
                count: runs.length,
                timeRange: {
                  start: startTime.toISOString(),
                  end: endTime.toISOString()
                },
                workspace,
                tenant: tenant || 'default'
              }, null, 2)
            }
          ]
        };
      }
    } catch (error: any) {
      logger.error('Failed to get pipeline status:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check pipeline name and run ID'
            }, null, 2)
          }
        ]
      };
    }
  }

  async cancelPipelineRun(params: {
    workspace: string;
    runId: string;
    tenant?: string;
  }) {
    const { workspace, runId, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      await client.pipelineRunOperations.cancelPipelineRun(
        runId
      );
      
      logger.info(`Cancelled pipeline run: ${runId}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Pipeline run ${runId} cancelled successfully`,
              runId,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to cancel pipeline run:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check run ID and permissions'
            }, null, 2)
          }
        ]
      };
    }
  }
}

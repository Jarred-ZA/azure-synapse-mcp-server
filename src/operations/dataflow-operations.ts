import { ArtifactsClient } from '@azure/synapse-artifacts';
import { TenantManager } from '../utils/tenant-manager.js';
import { logger } from '../utils/logger.js';

export class DataFlowOperations {
  constructor(private tenantManager: TenantManager) {}

  async monitorDataFlows(params: {
    workspace: string;
    dataflowName?: string;
    timeRange?: '1hour' | '6hours' | '24hours' | '7days';
    tenant?: string;
  }) {
    const { workspace, dataflowName, timeRange = '24hours', tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      // Calculate time range
      const endTime = new Date();
      const startTime = new Date();
      switch (timeRange) {
        case '1hour':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '6hours':
          startTime.setHours(startTime.getHours() - 6);
          break;
        case '24hours':
          startTime.setDate(startTime.getDate() - 1);
          break;
        case '7days':
          startTime.setDate(startTime.getDate() - 7);
          break;
      }
      
      // Get dataflow runs
      const filters: any[] = [];
      if (dataflowName) {
        filters.push({
          operand: 'ActivityName',
          operator: 'Equals',
          values: [dataflowName]
        });
      }
      filters.push({
        operand: 'ActivityType',
        operator: 'Equals',
        values: ['ExecuteDataFlow']
      });
      
      // Note: For data flow monitoring, we need to query pipeline runs that contain data flow activities
      // This requires a different approach than the previous implementation
      const runs = [];
      const pipelineRunsResponse = await client.pipelineRunOperations.queryPipelineRunsByWorkspace({
        filters,
        lastUpdatedAfter: startTime,
        lastUpdatedBefore: endTime
      });
      
      // We'll collect activity runs from pipeline runs
      for (const pipelineRun of pipelineRunsResponse.value || []) {
        if (pipelineRun.runId) {
          try {
            const activityRunsResponse = await client.pipelineRunOperations.queryActivityRuns(
              pipelineRun.pipelineName || '',
              pipelineRun.runId,
              {
                filters: [{
                  operand: 'ActivityType',
                  operator: 'Equals',
                  values: ['ExecuteDataFlow']
                }],
                lastUpdatedAfter: startTime,
                lastUpdatedBefore: endTime
              }
            );
            
            for (const activityRun of activityRunsResponse.value || []) {
              if (!dataflowName || activityRun.activityName === dataflowName) {
                runs.push(activityRun);
              }
            }
          } catch (err) {
            // Skip pipeline runs that might not have data flow activities
            logger.debug(`Skipping pipeline run ${pipelineRun.runId}: ${err}`);
          }
        }
      }
      
      // Calculate statistics
      const stats = this.calculateDataFlowStats(runs);
      
      logger.info(`Retrieved ${runs.length} dataflow runs from ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dataflowName: dataflowName || 'all',
              runs,
              count: runs.length,
              statistics: stats,
              timeRange: {
                range: timeRange,
                start: startTime.toISOString(),
                end: endTime.toISOString()
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to monitor dataflows:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check workspace name and dataflow configuration'
            }, null, 2)
          }
        ]
      };
    }
  }

  async listDataFlows(params: {
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
      
      const dataFlows = [];
      const iterator = client.dataFlowOperations.listDataFlowsByWorkspace();
      
      for await (const dataFlow of iterator) {
        dataFlows.push({
          name: dataFlow.name,
          id: dataFlow.id,
          type: dataFlow.type,
          etag: dataFlow.etag,
          properties: {
            type: dataFlow.properties?.type,
            description: dataFlow.properties?.description,
            annotations: dataFlow.properties?.annotations
          }
        });
      }
      
      logger.info(`Listed ${dataFlows.length} data flows in workspace ${workspace}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dataFlows,
              count: dataFlows.length,
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to list data flows:', error);
      
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

  async getDataFlowDetails(params: {
    workspace: string;
    dataflowName: string;
    tenant?: string;
  }) {
    const { workspace, dataflowName, tenant } = params;
    
    try {
      const tenantConfig = this.tenantManager.getTenant(tenant);
      if (!tenantConfig) {
        throw new Error(`Tenant not found: ${tenant || 'default'}`);
      }
      
      const credential = this.tenantManager.getCredential(tenant);
      const endpoint = `https://${workspace}.dev.azuresynapse.net`;
      const client = new ArtifactsClient(credential, endpoint);
      
      const dataFlow = await client.dataFlowOperations.getDataFlow(
        dataflowName
      );
      
      // Parse data flow definition
      const definition = dataFlow.properties as any;
      const sources = definition?.sources || [];
      const sinks = definition?.sinks || [];
      const transformations = definition?.transformations || [];
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              dataFlow: {
                name: dataFlow.name,
                type: dataFlow.type,
                description: definition?.description,
                sources: sources.map((s: any) => ({
                  name: s.name,
                  dataset: s.dataset?.referenceName,
                  linkedService: s.linkedService?.referenceName
                })),
                sinks: sinks.map((s: any) => ({
                  name: s.name,
                  dataset: s.dataset?.referenceName,
                  linkedService: s.linkedService?.referenceName
                })),
                transformations: transformations.map((t: any) => ({
                  name: t.name,
                  type: t.type
                })),
                annotations: definition?.annotations
              },
              workspace,
              tenant: tenant || 'default'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error('Failed to get data flow details:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Check data flow name and permissions'
            }, null, 2)
          }
        ]
      };
    }
  }

  private calculateDataFlowStats(runs: any[]) {
    if (runs.length === 0) {
      return {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDuration: 0,
        successRate: 0
      };
    }
    
    const successfulRuns = runs.filter(r => r.status === 'Succeeded');
    const failedRuns = runs.filter(r => r.status === 'Failed');
    const durations = runs
      .filter(r => r.durationInMs)
      .map(r => r.durationInMs);
    
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    return {
      totalRuns: runs.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      inProgressRuns: runs.filter(r => r.status === 'InProgress').length,
      averageDurationMs: Math.round(averageDuration),
      averageDurationMinutes: Math.round(averageDuration / 60000 * 10) / 10,
      successRate: Math.round((successfulRuns.length / runs.length) * 100),
      byDataFlow: this.groupRunsByDataFlow(runs)
    };
  }

  private groupRunsByDataFlow(runs: any[]) {
    const grouped: Record<string, any> = {};
    
    for (const run of runs) {
      const name = run.activityName;
      if (!grouped[name]) {
        grouped[name] = {
          totalRuns: 0,
          successful: 0,
          failed: 0,
          averageDurationMs: 0,
          durations: []
        };
      }
      
      grouped[name].totalRuns++;
      if (run.status === 'Succeeded') grouped[name].successful++;
      if (run.status === 'Failed') grouped[name].failed++;
      if (run.durationInMs) grouped[name].durations.push(run.durationInMs);
    }
    
    // Calculate averages
    for (const name in grouped) {
      const durations = grouped[name].durations;
      if (durations.length > 0) {
        grouped[name].averageDurationMs = Math.round(
          durations.reduce((a: number, b: number) => a + b, 0) / durations.length
        );
      }
      delete grouped[name].durations;
    }
    
    return grouped;
  }
}

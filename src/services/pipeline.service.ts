import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { azureAuthService } from './azure-auth.service.js';
import config from '../config/config.js';
import { logger, loggerHelpers } from '../utils/logger.js';
import { 
  SynapseApiError, 
  retryOperation, 
  extractErrorMessage 
} from '../utils/error-handler.js';
import {
  Pipeline,
  PipelineRun,
  ActivityRun,
  CreatePipelineRunRequest,
  PipelineRunsQueryRequest,
  ListResponse,
  SynapseResponse,
  ListPipelinesOptions,
  RunPipelineOptions,
  SynapseErrorResponse
} from '../types/synapse.types.js';

export class PipelineService {
  private httpClient: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${config.workspaceUrl}`;
    this.httpClient = this.createHttpClient();
  }

  private createHttpClient(): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      timeout: config.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `${config.serverName}/${config.serverVersion}`
      }
    });
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    data?: any
  ): Promise<SynapseResponse<T>> {
    return retryOperation(async () => {
      const startTime = Date.now();
      
      try {
        const authHeader = await azureAuthService.getAuthorizationHeader();
        
        const response: AxiosResponse<T> = await this.httpClient.request({
          method: method as any,
          url,
          data,
          headers: {
            'Authorization': authHeader
          }
        });

        const duration = Date.now() - startTime;
        loggerHelpers.logApiCall(method, url, response.status, duration);

        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>
        };

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        if (error.response) {
          const statusCode = error.response.status;
          const errorData = error.response.data as SynapseErrorResponse;
          
          loggerHelpers.logApiError(method, url, error, statusCode);
          
          throw new SynapseApiError(
            extractErrorMessage(errorData) || error.message,
            statusCode,
            errorData?.error,
            error.response.headers['x-ms-request-id']
          );
        } else {
          loggerHelpers.logApiError(method, url, error);
          throw error;
        }
      }
    });
  }

  // Pipeline CRUD Operations

  /**
   * Creates or updates a pipeline
   */
  async createOrUpdatePipeline(pipelineName: string, pipeline: Partial<Pipeline>): Promise<Pipeline> {
    logger.info(`Creating/updating pipeline: ${pipelineName}`);
    
    const response = await this.makeRequest<Pipeline>(
      'PUT',
      `/pipelines/${encodeURIComponent(pipelineName)}?api-version=2020-12-01`,
      pipeline
    );
    
    logger.info(`Pipeline ${pipelineName} created/updated successfully`);
    return response.data;
  }

  /**
   * Gets a pipeline by name
   */
  async getPipeline(pipelineName: string): Promise<Pipeline> {
    logger.info(`Getting pipeline: ${pipelineName}`);
    
    const response = await this.makeRequest<Pipeline>(
      'GET',
      `/pipelines/${encodeURIComponent(pipelineName)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists all pipelines in the workspace
   */
  async listPipelines(options?: ListPipelinesOptions): Promise<Pipeline[]> {
    logger.info('Listing pipelines');
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    
    if (options?.skip) {
      queryParams.append('skip', options.skip.toString());
    }
    if (options?.top) {
      queryParams.append('top', options.top.toString());
    }
    
    const response = await this.makeRequest<ListResponse<Pipeline>>(
      'GET',
      `/pipelines?${queryParams.toString()}`
    );
    
    logger.info(`Found ${response.data.value.length} pipelines`);
    return response.data.value;
  }

  /**
   * Deletes a pipeline
   */
  async deletePipeline(pipelineName: string): Promise<void> {
    logger.info(`Deleting pipeline: ${pipelineName}`);
    
    await this.makeRequest<void>(
      'DELETE',
      `/pipelines/${encodeURIComponent(pipelineName)}?api-version=2020-12-01`
    );
    
    logger.info(`Pipeline ${pipelineName} deleted successfully`);
  }

  // Pipeline Execution Operations

  /**
   * Runs a pipeline
   */
  async runPipeline(pipelineName: string, options?: RunPipelineOptions): Promise<PipelineRun> {
    logger.info(`Running pipeline: ${pipelineName}`);
    
    const requestBody: CreatePipelineRunRequest = {
      referenceName: options?.referenceName,
      startActivityName: options?.startActivityName,
      startFromFailure: options?.startFromFailure,
      parameters: options?.parameters
    };
    
    const response = await this.makeRequest<PipelineRun>(
      'POST',
      `/pipelines/${encodeURIComponent(pipelineName)}/createRun?api-version=2020-12-01`,
      requestBody
    );
    
    logger.info(`Pipeline ${pipelineName} started with run ID: ${response.data.runId}`);
    return response.data;
  }

  /**
   * Cancels a pipeline run
   */
  async cancelPipelineRun(runId: string): Promise<void> {
    logger.info(`Cancelling pipeline run: ${runId}`);
    
    await this.makeRequest<void>(
      'POST',
      `/pipelineRuns/${encodeURIComponent(runId)}/cancel?api-version=2020-12-01`
    );
    
    logger.info(`Pipeline run ${runId} cancelled successfully`);
  }

  // Pipeline Monitoring Operations

  /**
   * Gets a pipeline run by ID
   */
  async getPipelineRun(runId: string): Promise<PipelineRun> {
    logger.info(`Getting pipeline run: ${runId}`);
    
    const response = await this.makeRequest<PipelineRun>(
      'GET',
      `/pipelineRuns/${encodeURIComponent(runId)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists pipeline runs with optional filtering
   */
  async listPipelineRuns(queryRequest?: PipelineRunsQueryRequest): Promise<PipelineRun[]> {
    logger.info('Listing pipeline runs');
    
    const response = await this.makeRequest<ListResponse<PipelineRun>>(
      'POST',
      `/queryPipelineRuns?api-version=2020-12-01`,
      queryRequest || {}
    );
    
    logger.info(`Found ${response.data.value.length} pipeline runs`);
    return response.data.value;
  }

  /**
   * Lists currently active pipeline runs
   */
  async listActivePipelineRuns(): Promise<PipelineRun[]> {
    logger.info('Getting active pipeline runs');
    
    const queryRequest: PipelineRunsQueryRequest = {
      filters: [
        {
          operand: 'status',
          operator: 'In',
          values: ['InProgress', 'Queued', 'Cancelling']
        }
      ]
    };
    
    return this.listPipelineRuns(queryRequest);
  }

  /**
   * Gets activity runs for a pipeline run
   */
  async getActivityRuns(
    pipelineName: string,
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ActivityRun[]> {
    logger.info(`Getting activity runs for pipeline ${pipelineName}, run ${runId}`);
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    queryParams.append('startTime', startTime);
    queryParams.append('endTime', endTime);
    
    const response = await this.makeRequest<ListResponse<ActivityRun>>(
      'POST',
      `/pipelineRuns/${encodeURIComponent(runId)}/queryActivityRuns?${queryParams.toString()}`,
      {}
    );
    
    logger.info(`Found ${response.data.value.length} activity runs`);
    return response.data.value;
  }

  /**
   * Gets pipeline runs for a specific pipeline
   */
  async getPipelineRunsByPipeline(pipelineName: string, limit: number = 10): Promise<PipelineRun[]> {
    logger.info(`Getting runs for pipeline: ${pipelineName}`);
    
    const queryRequest: PipelineRunsQueryRequest = {
      filters: [
        {
          operand: 'pipelineName',
          operator: 'Equals',
          values: [pipelineName]
        }
      ],
      orderBy: [
        {
          orderBy: 'runStart',
          order: 'DESC'
        }
      ]
    };
    
    const runs = await this.listPipelineRuns(queryRequest);
    return runs.slice(0, limit);
  }

  /**
   * Gets recent failed pipeline runs
   */
  async getRecentFailedRuns(hours: number = 24): Promise<PipelineRun[]> {
    logger.info(`Getting failed pipeline runs from last ${hours} hours`);
    
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
    
    const queryRequest: PipelineRunsQueryRequest = {
      lastUpdatedAfter: startTime,
      filters: [
        {
          operand: 'status',
          operator: 'Equals',
          values: ['Failed']
        }
      ],
      orderBy: [
        {
          orderBy: 'lastUpdated',
          order: 'DESC'
        }
      ]
    };
    
    return this.listPipelineRuns(queryRequest);
  }

  /**
   * Gets pipeline run metrics and statistics
   */
  async getPipelineMetrics(pipelineName?: string, days: number = 7): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageDurationMs: number;
    successRate: number;
  }> {
    logger.info(`Getting pipeline metrics for ${days} days`);
    
    const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    
    const queryRequest: PipelineRunsQueryRequest = {
      lastUpdatedAfter: startTime,
      filters: pipelineName ? [
        {
          operand: 'pipelineName',
          operator: 'Equals',
          values: [pipelineName]
        }
      ] : undefined
    };
    
    const runs = await this.listPipelineRuns(queryRequest);
    
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(r => r.status === 'Succeeded').length;
    const failedRuns = runs.filter(r => r.status === 'Failed').length;
    const completedRuns = runs.filter(r => r.durationInMs);
    
    const averageDurationMs = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.durationInMs || 0), 0) / completedRuns.length
      : 0;
    
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    
    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      averageDurationMs,
      successRate
    };
  }
}

// Create singleton instance
export const pipelineService = new PipelineService();

export default pipelineService;

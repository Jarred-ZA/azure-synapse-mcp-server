import axios, { AxiosInstance } from 'axios';
import { azureAuthService } from './azure-auth.service.js';
import config from '../config/config.js';
import { logger, loggerHelpers } from '../utils/logger.js';
import { 
  SynapseApiError, 
  retryOperation, 
  extractErrorMessage 
} from '../utils/error-handler.js';
import {
  Notebook,
  SqlScript,
  Dataset,
  LinkedService,
  ListResponse,
  SynapseResponse,
  ListNotebooksOptions,
  ListSqlScriptsOptions,
  ListDatasetsOptions,
  ListLinkedServicesOptions,
  SynapseErrorResponse
} from '../types/synapse.types.js';

export class ArtifactService {
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
        
        const response = await this.httpClient.request({
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

  // Notebook Operations

  /**
   * Creates or updates a notebook
   */
  async createOrUpdateNotebook(notebookName: string, notebook: Partial<Notebook>): Promise<Notebook> {
    logger.info(`Creating/updating notebook: ${notebookName}`);
    
    const response = await this.makeRequest<Notebook>(
      'PUT',
      `/notebooks/${encodeURIComponent(notebookName)}?api-version=2020-12-01`,
      notebook
    );
    
    logger.info(`Notebook ${notebookName} created/updated successfully`);
    return response.data;
  }

  /**
   * Gets a notebook by name
   */
  async getNotebook(notebookName: string): Promise<Notebook> {
    logger.info(`Getting notebook: ${notebookName}`);
    
    const response = await this.makeRequest<Notebook>(
      'GET',
      `/notebooks/${encodeURIComponent(notebookName)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists all notebooks in the workspace
   */
  async listNotebooks(options?: ListNotebooksOptions): Promise<Notebook[]> {
    logger.info('Listing notebooks');
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    
    if (options?.skip) {
      queryParams.append('skip', options.skip.toString());
    }
    if (options?.top) {
      queryParams.append('top', options.top.toString());
    }
    
    const response = await this.makeRequest<ListResponse<Notebook>>(
      'GET',
      `/notebooks?${queryParams.toString()}`
    );
    
    logger.info(`Found ${response.data.value.length} notebooks`);
    return response.data.value;
  }

  /**
   * Deletes a notebook
   */
  async deleteNotebook(notebookName: string): Promise<void> {
    logger.info(`Deleting notebook: ${notebookName}`);
    
    await this.makeRequest<void>(
      'DELETE',
      `/notebooks/${encodeURIComponent(notebookName)}?api-version=2020-12-01`
    );
    
    logger.info(`Notebook ${notebookName} deleted successfully`);
  }

  // SQL Script Operations

  /**
   * Creates or updates a SQL script
   */
  async createOrUpdateSqlScript(scriptName: string, sqlScript: Partial<SqlScript>): Promise<SqlScript> {
    logger.info(`Creating/updating SQL script: ${scriptName}`);
    
    const response = await this.makeRequest<SqlScript>(
      'PUT',
      `/sqlScripts/${encodeURIComponent(scriptName)}?api-version=2020-12-01`,
      sqlScript
    );
    
    logger.info(`SQL script ${scriptName} created/updated successfully`);
    return response.data;
  }

  /**
   * Gets a SQL script by name
   */
  async getSqlScript(scriptName: string): Promise<SqlScript> {
    logger.info(`Getting SQL script: ${scriptName}`);
    
    const response = await this.makeRequest<SqlScript>(
      'GET',
      `/sqlScripts/${encodeURIComponent(scriptName)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists all SQL scripts in the workspace
   */
  async listSqlScripts(options?: ListSqlScriptsOptions): Promise<SqlScript[]> {
    logger.info('Listing SQL scripts');
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    
    if (options?.skip) {
      queryParams.append('skip', options.skip.toString());
    }
    if (options?.top) {
      queryParams.append('top', options.top.toString());
    }
    
    const response = await this.makeRequest<ListResponse<SqlScript>>(
      'GET',
      `/sqlScripts?${queryParams.toString()}`
    );
    
    logger.info(`Found ${response.data.value.length} SQL scripts`);
    return response.data.value;
  }

  /**
   * Deletes a SQL script
   */
  async deleteSqlScript(scriptName: string): Promise<void> {
    logger.info(`Deleting SQL script: ${scriptName}`);
    
    await this.makeRequest<void>(
      'DELETE',
      `/sqlScripts/${encodeURIComponent(scriptName)}?api-version=2020-12-01`
    );
    
    logger.info(`SQL script ${scriptName} deleted successfully`);
  }

  // Dataset Operations

  /**
   * Creates or updates a dataset
   */
  async createOrUpdateDataset(datasetName: string, dataset: Partial<Dataset>): Promise<Dataset> {
    logger.info(`Creating/updating dataset: ${datasetName}`);
    
    const response = await this.makeRequest<Dataset>(
      'PUT',
      `/datasets/${encodeURIComponent(datasetName)}?api-version=2020-12-01`,
      dataset
    );
    
    logger.info(`Dataset ${datasetName} created/updated successfully`);
    return response.data;
  }

  /**
   * Gets a dataset by name
   */
  async getDataset(datasetName: string): Promise<Dataset> {
    logger.info(`Getting dataset: ${datasetName}`);
    
    const response = await this.makeRequest<Dataset>(
      'GET',
      `/datasets/${encodeURIComponent(datasetName)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists all datasets in the workspace
   */
  async listDatasets(options?: ListDatasetsOptions): Promise<Dataset[]> {
    logger.info('Listing datasets');
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    
    if (options?.skip) {
      queryParams.append('skip', options.skip.toString());
    }
    if (options?.top) {
      queryParams.append('top', options.top.toString());
    }
    
    const response = await this.makeRequest<ListResponse<Dataset>>(
      'GET',
      `/datasets?${queryParams.toString()}`
    );
    
    logger.info(`Found ${response.data.value.length} datasets`);
    return response.data.value;
  }

  /**
   * Deletes a dataset
   */
  async deleteDataset(datasetName: string): Promise<void> {
    logger.info(`Deleting dataset: ${datasetName}`);
    
    await this.makeRequest<void>(
      'DELETE',
      `/datasets/${encodeURIComponent(datasetName)}?api-version=2020-12-01`
    );
    
    logger.info(`Dataset ${datasetName} deleted successfully`);
  }

  // Linked Service Operations

  /**
   * Creates or updates a linked service
   */
  async createOrUpdateLinkedService(serviceName: string, linkedService: Partial<LinkedService>): Promise<LinkedService> {
    logger.info(`Creating/updating linked service: ${serviceName}`);
    
    const response = await this.makeRequest<LinkedService>(
      'PUT',
      `/linkedServices/${encodeURIComponent(serviceName)}?api-version=2020-12-01`,
      linkedService
    );
    
    logger.info(`Linked service ${serviceName} created/updated successfully`);
    return response.data;
  }

  /**
   * Gets a linked service by name
   */
  async getLinkedService(serviceName: string): Promise<LinkedService> {
    logger.info(`Getting linked service: ${serviceName}`);
    
    const response = await this.makeRequest<LinkedService>(
      'GET',
      `/linkedServices/${encodeURIComponent(serviceName)}?api-version=2020-12-01`
    );
    
    return response.data;
  }

  /**
   * Lists all linked services in the workspace
   */
  async listLinkedServices(options?: ListLinkedServicesOptions): Promise<LinkedService[]> {
    logger.info('Listing linked services');
    
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '2020-12-01');
    
    if (options?.skip) {
      queryParams.append('skip', options.skip.toString());
    }
    if (options?.top) {
      queryParams.append('top', options.top.toString());
    }
    
    const response = await this.makeRequest<ListResponse<LinkedService>>(
      'GET',
      `/linkedServices?${queryParams.toString()}`
    );
    
    logger.info(`Found ${response.data.value.length} linked services`);
    return response.data.value;
  }

  /**
   * Deletes a linked service
   */
  async deleteLinkedService(serviceName: string): Promise<void> {
    logger.info(`Deleting linked service: ${serviceName}`);
    
    await this.makeRequest<void>(
      'DELETE',
      `/linkedServices/${encodeURIComponent(serviceName)}?api-version=2020-12-01`
    );
    
    logger.info(`Linked service ${serviceName} deleted successfully`);
  }

  // Utility Operations

  /**
   * Gets artifacts by type
   */
  async getArtifactsByType(type: 'notebooks' | 'sqlScripts' | 'datasets' | 'linkedServices'): Promise<any[]> {
    logger.info(`Getting artifacts of type: ${type}`);
    
    switch (type) {
      case 'notebooks':
        return this.listNotebooks();
      case 'sqlScripts':
        return this.listSqlScripts();
      case 'datasets':
        return this.listDatasets();
      case 'linkedServices':
        return this.listLinkedServices();
      default:
        throw new Error(`Unsupported artifact type: ${type}`);
    }
  }

  /**
   * Gets artifact count by type
   */
  async getArtifactCount(): Promise<{
    notebooks: number;
    sqlScripts: number;
    datasets: number;
    linkedServices: number;
    total: number;
  }> {
    logger.info('Getting artifact count');
    
    const [notebooks, sqlScripts, datasets, linkedServices] = await Promise.all([
      this.listNotebooks(),
      this.listSqlScripts(),
      this.listDatasets(),
      this.listLinkedServices()
    ]);
    
    const counts = {
      notebooks: notebooks.length,
      sqlScripts: sqlScripts.length,
      datasets: datasets.length,
      linkedServices: linkedServices.length,
      total: notebooks.length + sqlScripts.length + datasets.length + linkedServices.length
    };
    
    logger.info('Artifact counts retrieved', counts);
    return counts;
  }

  /**
   * Searches for artifacts by name pattern
   */
  async searchArtifacts(pattern: string, types?: ('notebooks' | 'sqlScripts' | 'datasets' | 'linkedServices')[]): Promise<{
    notebooks: Notebook[];
    sqlScripts: SqlScript[];
    datasets: Dataset[];
    linkedServices: LinkedService[];
  }> {
    logger.info(`Searching artifacts with pattern: ${pattern}`);
    
    const searchTypes = types || ['notebooks', 'sqlScripts', 'datasets', 'linkedServices'];
    const results = {
      notebooks: [] as Notebook[],
      sqlScripts: [] as SqlScript[],
      datasets: [] as Dataset[],
      linkedServices: [] as LinkedService[]
    };
    
    const regex = new RegExp(pattern, 'i');
    
    if (searchTypes.includes('notebooks')) {
      const notebooks = await this.listNotebooks();
      results.notebooks = notebooks.filter(n => regex.test(n.name));
    }
    
    if (searchTypes.includes('sqlScripts')) {
      const sqlScripts = await this.listSqlScripts();
      results.sqlScripts = sqlScripts.filter(s => regex.test(s.name));
    }
    
    if (searchTypes.includes('datasets')) {
      const datasets = await this.listDatasets();
      results.datasets = datasets.filter(d => regex.test(d.name));
    }
    
    if (searchTypes.includes('linkedServices')) {
      const linkedServices = await this.listLinkedServices();
      results.linkedServices = linkedServices.filter(l => regex.test(l.name));
    }
    
    const totalFound = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    logger.info(`Search completed, found ${totalFound} artifacts matching pattern: ${pattern}`);
    
    return results;
  }

  /**
   * Creates a simple notebook with sample code
   */
  async createSimpleNotebook(
    notebookName: string,
    language: 'pyspark' | 'scala' | 'csharp' | 'sql' = 'pyspark',
    sparkPoolName?: string
  ): Promise<Notebook> {
    logger.info(`Creating simple notebook: ${notebookName} (${language})`);
    
    const sampleCells = this.getSampleCells(language);
    
    const notebook: Partial<Notebook> = {
      name: notebookName,
      properties: {
        nbformat: 4,
        nbformat_minor: 2,
        bigDataPool: sparkPoolName ? {
          type: 'BigDataPoolReference',
          referenceName: sparkPoolName
        } : undefined,
        sessionProperties: {
          driverMemory: '28g',
          driverCores: 4,
          executorMemory: '28g',
          executorCores: 4,
          numExecutors: 2
        },
        metadata: {
          kernelspec: {
            name: language === 'pyspark' ? 'synapse_pyspark' : language,
            display_name: language === 'pyspark' ? 'Python (Synapse Spark)' : language
          },
          language_info: {
            name: language === 'pyspark' ? 'python' : language
          }
        },
        cells: sampleCells
      }
    };
    
    return this.createOrUpdateNotebook(notebookName, notebook);
  }

  /**
   * Creates a simple SQL script
   */
  async createSimpleSqlScript(
    scriptName: string,
    sqlQuery: string,
    description?: string
  ): Promise<SqlScript> {
    logger.info(`Creating simple SQL script: ${scriptName}`);
    
    const sqlScript: Partial<SqlScript> = {
      name: scriptName,
      properties: {
        description,
        type: 'SqlQuery',
        content: {
          query: sqlQuery,
          metadata: {
            language: 'sql'
          }
        }
      }
    };
    
    return this.createOrUpdateSqlScript(scriptName, sqlScript);
  }

  private getSampleCells(language: string) {
    switch (language) {
      case 'pyspark':
        return [
          {
            cell_type: 'markdown',
            metadata: {},
            source: [
              '# Sample PySpark Notebook\n',
              '\n',
              'This notebook demonstrates basic PySpark operations in Azure Synapse Analytics.'
            ]
          },
          {
            cell_type: 'code',
            metadata: {},
            source: [
              '# Import necessary libraries\n',
              'from pyspark.sql import SparkSession\n',
              'from pyspark.sql.functions import *\n',
              '\n',
              '# Create sample data\n',
              'data = [(1, "John", 25), (2, "Jane", 30), (3, "Bob", 35)]\n',
              'columns = ["id", "name", "age"]\n',
              '\n',
              'df = spark.createDataFrame(data, columns)\n',
              'df.show()'
            ],
            outputs: [],
            execution_count: null
          }
        ];
      
      case 'scala':
        return [
          {
            cell_type: 'markdown',
            metadata: {},
            source: [
              '# Sample Scala Notebook\n',
              '\n',
              'This notebook demonstrates basic Scala operations in Azure Synapse Analytics.'
            ]
          },
          {
            cell_type: 'code',
            metadata: {},
            source: [
              '// Import necessary libraries\n',
              'import org.apache.spark.sql.functions._\n',
              '\n',
              '// Create sample data\n',
              'val data = Seq((1, "John", 25), (2, "Jane", 30), (3, "Bob", 35))\n',
              'val df = data.toDF("id", "name", "age")\n',
              '\n',
              'df.show()'
            ],
            outputs: [],
            execution_count: null
          }
        ];
      
      default:
        return [
          {
            cell_type: 'markdown',
            metadata: {},
            source: [
              `# Sample ${language} Notebook\n`,
              '\n',
              `This notebook demonstrates basic ${language} operations in Azure Synapse Analytics.`
            ]
          },
          {
            cell_type: 'code',
            metadata: {},
            source: [
              '// Add your code here'
            ],
            outputs: [],
            execution_count: null
          }
        ];
    }
  }
}

// Create singleton instance
export const artifactService = new ArtifactService();

export default artifactService;

// Azure Synapse Analytics Type Definitions

export interface SynapseError {
  code: string;
  message: string;
  target?: string;
  details?: SynapseError[];
}

export interface SynapseErrorResponse {
  error: SynapseError;
}

// Pipeline Types
export interface Pipeline {
  id: string;
  name: string;
  type: string;
  properties: PipelineProperties;
  etag?: string;
}

export interface PipelineProperties {
  description?: string;
  activities: Activity[];
  parameters?: Record<string, ParameterSpecification>;
  variables?: Record<string, VariableSpecification>;
  concurrency?: number;
  annotations?: any[];
  runDimensions?: Record<string, any>;
  folder?: Folder;
  policy?: PipelinePolicy;
}

export interface Activity {
  name: string;
  type: string;
  description?: string;
  dependsOn?: ActivityDependency[];
  userProperties?: UserProperty[];
  policy?: ActivityPolicy;
  [key: string]: any;
}

export interface ActivityDependency {
  activity: string;
  dependencyConditions: string[];
  annotations?: any[];
}

export interface UserProperty {
  name: string;
  value: any;
}

export interface ActivityPolicy {
  timeout?: any;
  retry?: any;
  retryIntervalInSeconds?: number;
  secureInput?: boolean;
  secureOutput?: boolean;
}

export interface ParameterSpecification {
  type: 'String' | 'Int' | 'Float' | 'Bool' | 'Array' | 'Object' | 'SecureString';
  defaultValue?: any;
}

export interface VariableSpecification {
  type: 'String' | 'Bool' | 'Array';
  defaultValue?: any;
}

export interface Folder {
  name?: string;
}

export interface PipelinePolicy {
  elapsedTimeMetric?: ElapsedTimeMetric;
}

export interface ElapsedTimeMetric {
  duration?: any;
}

// Pipeline Run Types
export interface PipelineRun {
  runId: string;
  runGroupId?: string;
  pipelineName: string;
  parameters?: Record<string, any>;
  runStart?: string;
  runEnd?: string;
  durationInMs?: number;
  status: PipelineRunStatus;
  message?: string;
  lastUpdated?: string;
  annotations?: any[];
  runDimension?: Record<string, any>;
  isLatest?: boolean;
}

export type PipelineRunStatus = 
  | 'InProgress' 
  | 'Succeeded' 
  | 'Failed' 
  | 'Cancelled' 
  | 'Queued' 
  | 'Cancelling';

export interface CreatePipelineRunRequest {
  referenceName?: string;
  startActivityName?: string;
  startFromFailure?: boolean;
  parameters?: Record<string, any>;
}

export interface PipelineRunsQueryRequest {
  continuationToken?: string;
  lastUpdatedAfter?: string;
  lastUpdatedBefore?: string;
  orderBy?: OrderBy[];
  filters?: RunQueryFilter[];
}

export interface OrderBy {
  orderBy: string;
  order: 'ASC' | 'DESC';
}

export interface RunQueryFilter {
  operand: string;
  operator: 'Equals' | 'NotEquals' | 'In' | 'NotIn';
  values: string[];
}

// Activity Run Types
export interface ActivityRun {
  pipelineName: string;
  pipelineRunId: string;
  activityName: string;
  activityType: string;
  activityRunId: string;
  linkedServiceName?: string;
  status: ActivityRunStatus;
  activityRunStart?: string;
  activityRunEnd?: string;
  durationInMs?: number;
  input?: any;
  output?: any;
  error?: any;
  [key: string]: any;
}

export type ActivityRunStatus = 
  | 'InProgress' 
  | 'Succeeded' 
  | 'Failed' 
  | 'Cancelled' 
  | 'Skipped';

// Notebook Types
export interface Notebook {
  id: string;
  name: string;
  type: string;
  properties: NotebookProperties;
  etag?: string;
}

export interface NotebookProperties {
  description?: string;
  bigDataPool?: BigDataPoolReference;
  sessionProperties?: NotebookSessionProperties;
  metadata?: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
  folder?: Folder;
  kernelspec?: NotebookKernelSpec;
  language_info?: NotebookLanguageInfo;
}

export interface BigDataPoolReference {
  type: string;
  referenceName: string;
}

export interface NotebookSessionProperties {
  driverMemory: string;
  driverCores: number;
  executorMemory: string;
  executorCores: number;
  numExecutors: number;
}

export interface NotebookMetadata {
  kernelspec?: NotebookKernelSpec;
  language_info?: NotebookLanguageInfo;
  [key: string]: any;
}

export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  metadata?: Record<string, any>;
  source: string[];
  outputs?: any[];
  execution_count?: number;
}

export interface NotebookKernelSpec {
  name: string;
  display_name: string;
}

export interface NotebookLanguageInfo {
  name: string;
  version?: string;
}

// SQL Script Types
export interface SqlScript {
  id: string;
  name: string;
  type: string;
  properties: SqlScriptProperties;
  etag?: string;
}

export interface SqlScriptProperties {
  description?: string;
  type: 'SqlQuery';
  content: SqlScriptContent;
  folder?: Folder;
}

export interface SqlScriptContent {
  query: string;
  currentConnection?: SqlConnection;
  metadata?: SqlScriptMetadata;
}

export interface SqlConnection {
  poolName?: string;
  databaseName?: string;
  type: 'SqlPool' | 'SqlOnDemand';
}

export interface SqlScriptMetadata {
  language: string;
}

// Dataset Types
export interface Dataset {
  id: string;
  name: string;
  type: string;
  properties: DatasetProperties;
  etag?: string;
}

export interface DatasetProperties {
  description?: string;
  structure?: DatasetDataElement[];
  schema?: any;
  linkedServiceName: LinkedServiceReference;
  parameters?: Record<string, ParameterSpecification>;
  annotations?: any[];
  folder?: Folder;
  type: string;
  typeProperties?: any;
}

export interface DatasetDataElement {
  name?: string;
  type?: string;
}

export interface LinkedServiceReference {
  type: string;
  referenceName: string;
  parameters?: Record<string, any>;
}

// Linked Service Types
export interface LinkedService {
  id: string;
  name: string;
  type: string;
  properties: LinkedServiceProperties;
  etag?: string;
}

export interface LinkedServiceProperties {
  description?: string;
  annotations?: any[];
  type: string;
  typeProperties: any;
  connectVia?: IntegrationRuntimeReference;
  parameters?: Record<string, ParameterSpecification>;
}

export interface IntegrationRuntimeReference {
  type: string;
  referenceName: string;
  parameters?: Record<string, any>;
}

// Workspace Types
export interface Workspace {
  id: string;
  name: string;
  type: string;
  location: string;
  properties: WorkspaceProperties;
}

export interface WorkspaceProperties {
  defaultDataLakeStorage?: DataLakeStorageAccountDetails;
  sqlAdministratorLogin?: string;
  managedResourceGroupName?: string;
  provisioningState?: string;
  workspaceUID?: string;
  extraProperties?: Record<string, any>;
}

export interface DataLakeStorageAccountDetails {
  accountUrl?: string;
  filesystem?: string;
  resourceId?: string;
  createManagedPrivateEndpoint?: boolean;
}

// Pool Types
export interface BigDataPoolInfo {
  id: string;
  name: string;
  type: string;
  location: string;
  properties: BigDataPoolResourceProperties;
}

export interface BigDataPoolResourceProperties {
  provisioningState?: string;
  autoScale?: AutoScaleProperties;
  creationDate?: string;
  autoPause?: AutoPauseProperties;
  sparkVersion?: string;
  nodeCount?: number;
  nodeSize?: 'None' | 'Small' | 'Medium' | 'Large' | 'XLarge' | 'XXLarge' | 'XXXLarge';
  nodeSizeFamily?: 'None' | 'MemoryOptimized' | 'HardwareAcceleratedFPGA' | 'HardwareAcceleratedGPU';
  lastSucceededTimestamp?: string;
  sparkEventsFolder?: string;
  sparkConfigProperties?: SparkConfigProperties;
  sparkLogFolder?: string;
  sessionLevelPackagesEnabled?: boolean;
  cacheSize?: number;
  dynamicExecutorAllocation?: DynamicExecutorAllocation;
  isComputeIsolationEnabled?: boolean;
  isAutotuneEnabled?: boolean;
  customLibraries?: LibraryInfo[];
}

export interface AutoScaleProperties {
  minNodeCount?: number;
  enabled?: boolean;
  maxNodeCount?: number;
}

export interface AutoPauseProperties {
  delayInMinutes?: number;
  enabled?: boolean;
}

export interface SparkConfigProperties {
  time?: string;
  content?: string;
  filename?: string;
  configurationType?: 'File' | 'Artifact';
}

export interface DynamicExecutorAllocation {
  enabled?: boolean;
  minExecutors?: number;
  maxExecutors?: number;
}

export interface LibraryInfo {
  name?: string;
  path?: string;
  containerName?: string;
  uploadedTimestamp?: string;
  type?: string;
  provisioningStatus?: string;
  creatorId?: string;
}

export interface SqlPool {
  id: string;
  name: string;
  type: string;
  location: string;
  sku?: Sku;
  properties: SqlPoolResourceProperties;
}

export interface Sku {
  name?: string;
  tier?: string;
  capacity?: number;
}

export interface SqlPoolResourceProperties {
  maxSizeBytes?: number;
  collation?: string;
  sourceDatabaseId?: string;
  recoveryDatabaseId?: string;
  provisioningState?: string;
  status?: string;
  restorePointInTime?: string;
  createMode?: string;
  creationDate?: string;
  storageAccountType?: 'GRS' | 'LRS' | 'ZRS';
}

// Integration Runtime Types
export interface IntegrationRuntime {
  id: string;
  name: string;
  type: string;
  properties: IntegrationRuntimeProperties;
  etag?: string;
}

export interface IntegrationRuntimeProperties {
  type: 'Managed' | 'SelfHosted';
  description?: string;
  state?: 'Initial' | 'Stopped' | 'Started' | 'Starting' | 'Stopping' | 'NeedRegistration' | 'Online' | 'Limited' | 'Offline' | 'AccessDenied';
}

// Trigger Types
export interface Trigger {
  id: string;
  name: string;
  type: string;
  properties: TriggerProperties;
  etag?: string;
}

export interface TriggerProperties {
  description?: string;
  type: string;
  runtimeState?: 'Started' | 'Stopped' | 'Disabled';
  annotations?: any[];
  pipelines?: TriggerPipelineReference[];
}

export interface TriggerPipelineReference {
  pipelineReference: PipelineReference;
  parameters?: Record<string, any>;
}

export interface PipelineReference {
  type: string;
  referenceName: string;
}

export interface TriggerRun {
  triggerRunId: string;
  triggerName: string;
  triggerType: string;
  triggerRunTimestamp?: string;
  status: TriggerRunStatus;
  message?: string;
  properties?: Record<string, string>;
  triggeredPipelines?: Record<string, string>;
  runDimension?: Record<string, string>;
  dependencyStatus?: Record<string, any>;
}

export type TriggerRunStatus = 
  | 'Succeeded' 
  | 'Failed' 
  | 'Inprogress';

// Response wrapper types
export interface ListResponse<T> {
  value: T[];
  nextLink?: string;
}

export interface SynapseResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Request parameter types
export interface ListPipelinesOptions {
  skip?: number;
  top?: number;
}

export interface ListNotebooksOptions {
  skip?: number;
  top?: number;
}

export interface ListSqlScriptsOptions {
  skip?: number;
  top?: number;
}

export interface ListDatasetsOptions {
  skip?: number;
  top?: number;
}

export interface ListLinkedServicesOptions {
  skip?: number;
  top?: number;
}

export interface RunPipelineOptions {
  parameters?: Record<string, any>;
  referenceName?: string;
  startActivityName?: string;
  startFromFailure?: boolean;
}

// MCP Tool Result Types
export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface McpErrorResult extends McpToolResult {
  isError: true;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

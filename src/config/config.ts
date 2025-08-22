import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AzureSynapseConfig {
  // Azure Authentication
  tenantId: string;
  clientId: string;
  clientSecret: string;
  
  // Azure Synapse Workspace
  workspaceName: string;
  workspaceUrl: string;
  subscriptionId: string;
  resourceGroup: string;
  
  // MCP Server Configuration
  serverName: string;
  serverVersion: string;
  logLevel: string;
  
  // Optional Configuration
  authMethod: 'client_credentials' | 'managed_identity' | 'azure_cli';
  requestTimeout: number;
  debugMode: boolean;
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config: AzureSynapseConfig = {
  // Azure Authentication
  tenantId: getRequiredEnvVar('AZURE_TENANT_ID'),
  clientId: getRequiredEnvVar('AZURE_CLIENT_ID'),
  clientSecret: getRequiredEnvVar('AZURE_CLIENT_SECRET'),
  
  // Azure Synapse Workspace
  workspaceName: getRequiredEnvVar('SYNAPSE_WORKSPACE_NAME'),
  workspaceUrl: getRequiredEnvVar('SYNAPSE_WORKSPACE_URL'),
  subscriptionId: getRequiredEnvVar('AZURE_SUBSCRIPTION_ID'),
  resourceGroup: getRequiredEnvVar('AZURE_RESOURCE_GROUP'),
  
  // MCP Server Configuration
  serverName: getOptionalEnvVar('MCP_SERVER_NAME', 'azure-synapse-mcp-server'),
  serverVersion: getOptionalEnvVar('MCP_SERVER_VERSION', '1.0.0'),
  logLevel: getOptionalEnvVar('LOG_LEVEL', 'info'),
  
  // Optional Configuration
  authMethod: (getOptionalEnvVar('AZURE_AUTH_METHOD', 'client_credentials') as any),
  requestTimeout: parseInt(getOptionalEnvVar('REQUEST_TIMEOUT', '30000'), 10),
  debugMode: getOptionalEnvVar('DEBUG_MODE', 'false').toLowerCase() === 'true',
};

// Validate configuration
export function validateConfig(): void {
  const requiredFields = [
    'tenantId', 'clientId', 'clientSecret',
    'workspaceName', 'workspaceUrl', 'subscriptionId', 'resourceGroup'
  ];
  
  for (const field of requiredFields) {
    if (!config[field as keyof AzureSynapseConfig]) {
      throw new Error(`Configuration error: ${field} is required`);
    }
  }
  
  // Validate workspace URL format
  const urlPattern = /^https:\/\/[a-zA-Z0-9-]+\.dev\.azuresynapse\.net$/;
  if (!urlPattern.test(config.workspaceUrl)) {
    throw new Error('Configuration error: workspaceUrl must be in format https://workspace-name.dev.azuresynapse.net');
  }
  
  // Validate auth method
  const validAuthMethods = ['client_credentials', 'managed_identity', 'azure_cli'];
  if (!validAuthMethods.includes(config.authMethod)) {
    throw new Error(`Configuration error: authMethod must be one of ${validAuthMethods.join(', ')}`);
  }
  
  // Validate timeout
  if (config.requestTimeout < 1000 || config.requestTimeout > 300000) {
    throw new Error('Configuration error: requestTimeout must be between 1000 and 300000 milliseconds');
  }
}

export default config;

import { DefaultAzureCredential, ClientSecretCredential, ManagedIdentityCredential } from '@azure/identity';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

export interface TenantConfig {
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  workspaceName: string;
  sqlPools: {
    name: string;
    type: 'dedicated' | 'serverless';
    connectionString: string;
  }[];
  credentials: {
    type: 'service_principal' | 'managed_identity' | 'default';
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  region?: string;
  tags?: Record<string, string>;
}

export class TenantManager {
  private tenants: Map<string, TenantConfig> = new Map();
  private credentials: Map<string, any> = new Map();
  private defaultTenant: string | null = null;

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    // Try to load from config file
    const configPath = process.env.SYNAPSE_CONFIG_PATH || './config/tenants.json';
    
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        for (const tenant of config.tenants || []) {
          this.addTenant(tenant.name, tenant);
        }
        
        this.defaultTenant = config.defaultTenant || null;
        logger.info(`Loaded ${this.tenants.size} tenant configurations`);
      } catch (error) {
        logger.error('Failed to load tenant configuration:', error);
      }
    }
    
    // Load from environment variables (for single tenant)
    if (process.env.AZURE_SYNAPSE_WORKSPACE) {
      const envTenant: TenantConfig = {
        name: 'default',
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
        resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
        workspaceName: process.env.AZURE_SYNAPSE_WORKSPACE,
        sqlPools: this.parseSqlPoolsFromEnv(),
        credentials: {
          type: 'default',
          tenantId: process.env.AZURE_TENANT_ID,
          clientId: process.env.AZURE_CLIENT_ID,
          clientSecret: process.env.AZURE_CLIENT_SECRET
        }
      };
      
      this.addTenant('default', envTenant);
      if (!this.defaultTenant) {
        this.defaultTenant = 'default';
      }
    }
  }

  private parseSqlPoolsFromEnv() {
    const pools = [];
    
    if (process.env.SYNAPSE_DEDICATED_POOL) {
      pools.push({
        name: process.env.SYNAPSE_DEDICATED_POOL,
        type: 'dedicated' as const,
        connectionString: process.env.SYNAPSE_DEDICATED_CONNECTION || ''
      });
    }
    
    if (process.env.SYNAPSE_SERVERLESS_ENDPOINT) {
      pools.push({
        name: 'serverless',
        type: 'serverless' as const,
        connectionString: process.env.SYNAPSE_SERVERLESS_CONNECTION || ''
      });
    }
    
    return pools;
  }

  addTenant(name: string, config: TenantConfig) {
    this.tenants.set(name, config);
    
    // Create appropriate credential
    let credential;
    switch (config.credentials.type) {
      case 'service_principal':
        if (config.credentials.tenantId && config.credentials.clientId && config.credentials.clientSecret) {
          credential = new ClientSecretCredential(
            config.credentials.tenantId,
            config.credentials.clientId,
            config.credentials.clientSecret
          );
        }
        break;
        
      case 'managed_identity':
        if (config.credentials.clientId) {
          credential = new ManagedIdentityCredential(config.credentials.clientId);
        } else {
          credential = new ManagedIdentityCredential();
        }
        break;
        
      default:
        credential = new DefaultAzureCredential();
    }
    
    this.credentials.set(name, credential);
    logger.info(`Added tenant configuration: ${name}`);
  }

  getTenant(name?: string): TenantConfig | undefined {
    const tenantName = name || this.defaultTenant || 'default';
    return this.tenants.get(tenantName);
  }

  getCredential(name?: string) {
    const tenantName = name || this.defaultTenant || 'default';
    return this.credentials.get(tenantName) || new DefaultAzureCredential();
  }

  getConnectionString(tenantName?: string, poolType: 'dedicated' | 'serverless' = 'serverless'): string | undefined {
    const tenant = this.getTenant(tenantName);
    if (!tenant) return undefined;
    
    const pool = tenant.sqlPools.find(p => p.type === poolType);
    return pool?.connectionString;
  }

  listTenants(): string[] {
    return Array.from(this.tenants.keys());
  }

  setDefaultTenant(name: string) {
    if (this.tenants.has(name)) {
      this.defaultTenant = name;
      logger.info(`Set default tenant to: ${name}`);
    } else {
      throw new Error(`Tenant not found: ${name}`);
    }
  }

  removeTenant(name: string) {
    this.tenants.delete(name);
    this.credentials.delete(name);
    
    if (this.defaultTenant === name) {
      this.defaultTenant = null;
    }
    
    logger.info(`Removed tenant: ${name}`);
  }

  saveConfiguration(filePath?: string) {
    const configPath = filePath || process.env.SYNAPSE_CONFIG_PATH || './config/tenants.json';
    const config = {
      defaultTenant: this.defaultTenant,
      tenants: Array.from(this.tenants.values())
    };
    
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save configuration
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.info(`Saved tenant configuration to: ${configPath}`);
  }
}

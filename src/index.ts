#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AzureSynapseMCPServer } from './server.js';
import { logger } from './utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info('Starting Azure Synapse MCP Server...');
    
    // Validate environment variables
    const requiredEnvVars = [
      'AZURE_TENANT_ID',
      'AZURE_SUBSCRIPTION_ID',
      'AZURE_RESOURCE_GROUP'
    ];
    
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
      logger.info('Some features may be limited without proper Azure credentials');
    }
    
    // Create and start the server
    const server = new AzureSynapseMCPServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    logger.info('Azure Synapse MCP Server is running');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Azure Synapse MCP Server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

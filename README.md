# Azure Synapse MCP Server

A Model Context Protocol (MCP) server that provides secure access to Azure Synapse Analytics workspaces, enabling SQL query execution, data exploration, and pipeline management through Claude Desktop or any MCP-compatible client.

## Features

- Execute SQL queries on Synapse dedicated and serverless SQL pools
- List and describe databases, schemas, tables, and views
- Manage Synapse pipelines (list, describe, trigger, monitor)
- Stored procedure management (create, update, execute, analyze)
- Data flow monitoring and performance analysis
- Multi-tenant support with isolated configurations
- Connection pooling and query caching
- Workspace-level access restrictions
- Read-only mode for safe exploration

## Prerequisites

- Node.js 18 or higher
- Azure Synapse Analytics workspace
- Azure AD authentication configured
- Valid Azure credentials (see Authentication section)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/azure-synapse-mcp-server.git
cd azure-synapse-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure environment variables (see Configuration section)

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Azure Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_SYNAPSE_WORKSPACE=your-workspace-name

# Optional: Restrict to specific workspace
AZURE_SYNAPSE_ALLOWED_WORKSPACE=specific-workspace-name

# Connection Settings
SYNAPSE_SERVERLESS_ENDPOINT=your-workspace-ondemand.sql.azuresynapse.net
SYNAPSE_DEDICATED_ENDPOINT=your-workspace.sql.azuresynapse.net

# Authentication (see Authentication section for options)
AZURE_AUTH_METHOD=cli  # Options: cli, managedidentity, serviceprincipal, password

# Optional settings
READONLY_MODE=true
LOG_LEVEL=error
MAX_RESULTS=1000
DEFAULT_SCHEMA=dbo
QUERY_TIMEOUT_SECONDS=300
CACHE_TTL=300  # Query cache TTL in seconds
```

### Multi-Tenant Configuration

For managing multiple workspaces, create `config/tenants.example.json` and copy to `config/tenants.json`:

```json
{
  "defaultTenant": "tenant1",
  "tenants": [
    {
      "id": "tenant1",
      "name": "Production Workspace",
      "subscriptionId": "subscription-id",
      "resourceGroup": "resource-group",
      "workspaceName": "workspace-name",
      "serverlessEndpoint": "workspace-ondemand.sql.azuresynapse.net",
      "dedicatedPools": [
        {
          "name": "DedicatedPool1",
          "endpoint": "workspace.sql.azuresynapse.net",
          "database": "DatabaseName"
        }
      ],
      "authMethod": "cli"
    }
  ]
}
```

## Authentication Methods

### 1. Azure CLI Authentication (Recommended for Development)

The simplest authentication method using Azure CLI credentials:

```bash
# First, login to Azure CLI
az login

# Set the active subscription
az account set --subscription "your-subscription-id"

# Configure the MCP server
AZURE_AUTH_METHOD=cli
```

### 2. Managed Identity (Recommended for Production)

For Azure-hosted environments with managed identity enabled:

```bash
AZURE_AUTH_METHOD=managedidentity
# Optional: Specify client ID for user-assigned managed identity
AZURE_CLIENT_ID=your-managed-identity-client-id
```

### 3. Service Principal

Using Azure AD service principal:

```bash
AZURE_AUTH_METHOD=serviceprincipal
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

### 4. SQL Authentication (Not Recommended)

For environments requiring SQL authentication:

```bash
AZURE_AUTH_METHOD=password
SYNAPSE_USERNAME=your-username
SYNAPSE_PASSWORD=your-password
```

## Claude Desktop Integration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "azure-synapse": {
      "command": "node",
      "args": ["/path/to/azure-synapse-mcp-server/dist/index.js"],
      "env": {
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id",
        "AZURE_RESOURCE_GROUP": "your-resource-group",
        "AZURE_SYNAPSE_WORKSPACE": "your-workspace-name",
        "AZURE_AUTH_METHOD": "cli",
        "READONLY_MODE": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

## Available Tools

### Query Execution
- `execute_sql_query` - Execute SQL queries on Synapse pools
- `list_query_results` - Retrieve paginated query results

### Database Exploration
- `list_databases` - List available databases
- `list_schemas` - List schemas in a database
- `list_tables` - List tables in a schema
- `describe_table` - Get table schema and statistics
- `list_views` - List views in a schema
- `describe_view` - Get view definition

### Pipeline Management
- `list_pipelines` - List Synapse pipelines
- `describe_pipeline` - Get pipeline details
- `trigger_pipeline` - Start a pipeline run
- `get_pipeline_run_status` - Check pipeline execution status
- `cancel_pipeline_run` - Cancel a running pipeline

### Stored Procedures
- `manage_stored_procedures` - Create, update, delete, execute, and analyze stored procedures
- `get_procedure_recommendations` - Get optimization recommendations

### Data Flow Monitoring
- `monitor_data_flows` - Monitor data flow execution and performance
- `list_data_flows` - List available data flows

### Data Migration
- `data_migration_helper` - Generate migration scripts between databases

## Security Best Practices

1. **Authentication**
   - Use Azure CLI or Managed Identity authentication
   - Avoid password authentication in production
   - Rotate service principal credentials regularly

2. **Access Control**
   - Enable read-only mode for exploration: `READONLY_MODE=true`
   - Restrict to specific workspace: `AZURE_SYNAPSE_ALLOWED_WORKSPACE=workspace-name`
   - Apply principle of least privilege for service accounts

3. **Secrets Management**
   - Never commit credentials to version control
   - Use environment variables or Azure Key Vault
   - Keep `.env` files out of repositories

4. **Monitoring**
   - Enable audit logging in Azure Synapse
   - Monitor query execution and resource usage
   - Set appropriate query timeouts

## Workspace Restriction

To limit the MCP server to a specific workspace:

```bash
# In your .env or Claude Desktop config
AZURE_SYNAPSE_ALLOWED_WORKSPACE=production-workspace
```

This ensures all operations are restricted to the specified workspace, preventing accidental access to other environments.

## Development

### Running Tests
```bash
npm test
```

### Building from Source
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Linting
```bash
npm run lint
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Ensure Azure CLI is logged in: `az login`
   - Verify subscription: `az account show`
   - Check tenant ID and subscription ID match

2. **Connection Timeouts**
   - Verify firewall rules in Azure Synapse
   - Check network connectivity
   - Increase `QUERY_TIMEOUT_SECONDS`

3. **Permission Errors**
   - Verify user has appropriate Synapse RBAC roles
   - Check database-level permissions
   - Ensure workspace access is configured

4. **MCP Protocol Errors**
   - Set `LOG_LEVEL=error` to reduce log output
   - Ensure only JSON is output to stdout
   - Check Claude Desktop logs for details

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug
```

Log files (production mode):
- Error logs: `azure-synapse-mcp-error.log`
- Combined logs: `azure-synapse-mcp-combined.log`

## Project Structure

```
azure-synapse-mcp-server/
├── src/
│   ├── index.ts                 # Entry point
│   ├── server.ts                # MCP server implementation
│   ├── operations/              # Operation handlers
│   │   ├── synapse-operations.ts
│   │   ├── pipeline-operations.ts
│   │   ├── stored-procedure-operations.ts
│   │   └── dataflow-operations.ts
│   └── utils/                   # Utilities
│       ├── logger.ts
│       ├── tenant-manager.ts
│       └── connection-pool.ts
├── config/                      # Configuration files
├── dist/                        # Compiled JavaScript
└── package.json
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## Support

For issues and feature requests, please use the GitHub issue tracker.
# Azure Synapse MCP Server

A comprehensive Model Context Protocol (MCP) server for Azure Synapse Analytics workspace management. This server enables AI agents to interact with Azure Synapse workspaces through a standardized protocol, providing capabilities for pipeline management, artifact development, monitoring, and debugging.

## Features

### 🚀 Pipeline Management
- **Create, Update, Delete Pipelines**: Full lifecycle management of Synapse pipelines
- **Run Pipelines**: Execute pipelines with custom parameters
- **Pipeline Monitoring**: Real-time monitoring of pipeline execution status
- **Debug Runs**: Support for debugging pipeline runs with detailed logging

### 📝 Artifact Management
- **Notebooks**: Create, update, delete, and manage Synapse notebooks
- **SQL Scripts**: Manage SQL scripts and stored procedures
- **Datasets**: Configure and manage dataset definitions
- **Linked Services**: Handle connections to external data sources
- **Data Flows**: Manage data transformation flows

### 📊 Monitoring & Debugging
- **Pipeline Run Monitoring**: Track pipeline execution status and performance
- **Activity Run Details**: Monitor individual activity execution within pipelines
- **Trigger Monitoring**: Monitor scheduled and event-based triggers
- **Error Analysis**: Detailed error reporting and troubleshooting capabilities

### 🏢 Workspace Operations
- **Pool Management**: Manage Spark pools and SQL pools
- **Integration Runtime**: Monitor and manage integration runtimes
- **Access Control**: View and manage workspace permissions
- **Resource Monitoring**: Track workspace resource usage

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- Azure Synapse Analytics workspace
- Azure service principal with appropriate permissions

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/azure-synapse-mcp-server.git
   cd azure-synapse-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Azure Synapse configuration
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Azure Authentication
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here

# Azure Synapse Workspace
SYNAPSE_WORKSPACE_NAME=your-workspace-name
SYNAPSE_WORKSPACE_URL=https://your-workspace-name.dev.azuresynapse.net
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group

# MCP Server Configuration
MCP_SERVER_NAME=azure-synapse-mcp-server
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info
```

### Azure Service Principal Setup

1. **Create a service principal**:
   ```bash
   az ad sp create-for-rbac --name "synapse-mcp-server" --role "Contributor" --scopes "/subscriptions/{subscription-id}/resourceGroups/{resource-group}"
   ```

2. **Assign Synapse permissions**:
   - Navigate to your Synapse workspace in Azure Portal
   - Go to Access Control (IAM)
   - Add role assignment: "Synapse Contributor" or "Synapse Administrator"

## Usage

### Running the Server

**Local development**:
```bash
npm run dev
```

**Production**:
```bash
npm start
```

**With MCP Inspector** (for testing):
```bash
npm run inspector
```

### Claude Desktop Integration

Add the server to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "azure-synapse": {
      "command": "node",
      "args": ["/path/to/azure-synapse-mcp-server/dist/index.js"],
      "env": {
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_CLIENT_ID": "your-client-id",
        "AZURE_CLIENT_SECRET": "your-client-secret",
        "SYNAPSE_WORKSPACE_NAME": "your-workspace-name",
        "SYNAPSE_WORKSPACE_URL": "https://your-workspace-name.dev.azuresynapse.net",
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id",
        "AZURE_RESOURCE_GROUP": "your-resource-group"
      }
    }
  }
}
```

## Available Tools

### Pipeline Operations
- `create_pipeline` - Create a new pipeline
- `update_pipeline` - Update an existing pipeline
- `delete_pipeline` - Delete a pipeline
- `get_pipeline` - Retrieve pipeline definition
- `list_pipelines` - List all pipelines in workspace
- `run_pipeline` - Execute a pipeline
- `get_pipeline_run` - Get pipeline run details
- `list_pipeline_runs` - List pipeline execution history
- `cancel_pipeline_run` - Cancel a running pipeline

### Artifact Management
- `create_notebook` - Create a new notebook
- `update_notebook` - Update notebook content
- `delete_notebook` - Delete a notebook
- `get_notebook` - Retrieve notebook definition
- `list_notebooks` - List all notebooks
- `create_sql_script` - Create a SQL script
- `update_sql_script` - Update SQL script content
- `delete_sql_script` - Delete a SQL script
- `get_sql_script` - Retrieve SQL script
- `list_sql_scripts` - List all SQL scripts
- `create_dataset` - Create a dataset definition
- `update_dataset` - Update dataset configuration
- `delete_dataset` - Delete a dataset
- `get_dataset` - Retrieve dataset definition
- `list_datasets` - List all datasets
- `create_linked_service` - Create a linked service
- `update_linked_service` - Update linked service configuration
- `delete_linked_service` - Delete a linked service
- `get_linked_service` - Retrieve linked service definition
- `list_linked_services` - List all linked services

### Monitoring Tools
- `get_activity_runs` - Get activity run details for a pipeline
- `get_trigger_runs` - Monitor trigger executions
- `list_active_pipeline_runs` - List currently running pipelines
- `get_pipeline_metrics` - Get pipeline performance metrics
- `get_workspace_status` - Get overall workspace health status

### Workspace Management
- `list_spark_pools` - List Spark pools
- `get_spark_pool` - Get Spark pool details
- `list_sql_pools` - List SQL pools
- `get_sql_pool` - Get SQL pool details
- `list_integration_runtimes` - List integration runtimes
- `get_integration_runtime` - Get integration runtime details

## Example Usage

### Creating and Running a Pipeline

```typescript
// Ask Claude in Desktop:
"Create a simple copy pipeline in Azure Synapse that copies data from a blob storage source to a SQL sink, then run it"

// The MCP server will:
// 1. Use create_pipeline to define the pipeline
// 2. Use run_pipeline to execute it
// 3. Use get_pipeline_run to monitor progress
```

### Monitoring Pipeline Execution

```typescript
// Ask Claude:
"Show me the status of all running pipelines and any failed runs from the last 24 hours"

// The MCP server will:
// 1. Use list_active_pipeline_runs to get current executions
// 2. Use list_pipeline_runs with filters for failed runs
// 3. Use get_activity_runs for detailed failure analysis
```

### Managing Notebooks

```typescript
// Ask Claude:
"Create a new Synapse notebook for data exploration with sample Spark code for reading from a data lake"

// The MCP server will:
// 1. Use create_notebook to create the notebook
// 2. Include sample PySpark code for data lake access
```

## Development

### Project Structure

```
src/
├── index.ts                 # Entry point
├── server.ts               # Main MCP server setup
├── config/
│   └── config.ts           # Configuration management
├── handlers/
│   ├── pipeline.handler.ts # Pipeline operation handlers
│   ├── artifact.handler.ts # Artifact operation handlers
│   ├── monitoring.handler.ts # Monitoring handlers
│   └── workspace.handler.ts # Workspace management handlers
├── services/
│   ├── azure-auth.service.ts # Azure authentication
│   ├── pipeline.service.ts  # Pipeline API calls
│   ├── artifact.service.ts  # Artifact API calls
│   ├── monitoring.service.ts # Monitoring API calls
│   └── workspace.service.ts # Workspace API calls
├── types/
│   ├── index.ts            # Exported types
│   └── synapse.types.ts    # Azure Synapse type definitions
└── utils/
    ├── logger.ts           # Logging utility
    └── error-handler.ts    # Error handling utility
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run watch` - Watch for changes and rebuild
- `npm run start` - Start the MCP server
- `npm run dev` - Build and start in development mode
- `npm run inspector` - Start with MCP inspector for testing
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run test` - Run tests
- `npm run clean` - Clean build artifacts

### Adding New Tools

1. Define the tool schema in the appropriate handler
2. Implement the tool logic in the corresponding service
3. Add proper error handling and logging
4. Update this README with tool documentation

## Authentication

### Supported Authentication Methods

1. **Service Principal** (recommended for production)
2. **Managed Identity** (for Azure-hosted scenarios)
3. **Azure CLI** (for development)

### Required Permissions

The service principal needs the following permissions:

**Azure RBAC:**
- `Contributor` or `Reader` on the resource group
- `Storage Blob Data Contributor` (if accessing storage)

**Synapse RBAC:**
- `Synapse Contributor` or `Synapse Administrator`
- `Synapse Artifact Publisher` (for creating/updating artifacts)
- `Synapse Artifact User` (for reading artifacts)

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify service principal credentials
   - Check Azure AD token expiration
   - Ensure proper RBAC assignments

2. **Pipeline Run Failed**
   - Check activity run details using `get_activity_runs`
   - Verify linked service connections
   - Review integration runtime status

3. **Artifact Not Found**
   - Verify artifact name spelling
   - Check workspace permissions
   - Ensure artifact exists in the specified workspace

### Debug Mode

Enable detailed logging by setting `DEBUG_MODE=true` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review Azure Synapse documentation

## Related Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Azure Synapse Analytics Documentation](https://docs.microsoft.com/en-us/azure/synapse-analytics/)
- [Azure Synapse REST API Reference](https://docs.microsoft.com/en-us/rest/api/synapse/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

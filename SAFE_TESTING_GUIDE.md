# 🔒 SAFE Testing Guide - Azure Synapse MCP Server

## ⚠️  CRITICAL: Testing Safety Rules

### NEVER run these during testing:
- ❌ NO pipeline triggers: `trigger_pipeline`
- ❌ NO data modifications: INSERT, UPDATE, DELETE queries
- ❌ NO stored procedure execution that modifies data
- ❌ NO data migration operations
- ❌ NO CREATE/ALTER/DROP operations

### ✅ SAFE test operations only:
- ✓ SELECT queries with LIMIT/TOP clauses
- ✓ List operations (list_pipelines, list_procedures)
- ✓ Schema analysis (read-only)
- ✓ Get operations that only read metadata

## Safe Test Commands After Setup

### 1. Test Authentication Only
```bash
node test-auth-only.js
```
This ONLY checks if credentials are set, no Azure connections.

### 2. Test Server Startup
```bash
node test-startup.js
```
This verifies the server binary works without connecting to Azure.

### 3. First Safe Query in Claude
Once added to Claude Desktop, test with:
"Can you check if the Azure Synapse MCP server is connected?"

Then try a safe read-only query:
"List the available pipelines in workspace dev-synapse"
(This only LISTS, doesn't run anything)

### 4. Safe Schema Check
"Show me the schema of the sys.tables table"
(This is a system table, read-only, always safe)

## Environment Variables Check

Run this to verify your configuration:
```bash
node -e "
require('dotenv').config();
const vars = ['AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID', 'AZURE_CLIENT_ID'];
vars.forEach(v => console.log(v + ':', process.env[v] ? '✓ Set' : '✗ Missing'));
"
```

## Claude Desktop Config Safety

1. Your original config is backed up at:
   - `~/Library/Application Support/Claude/claude_desktop_config.json.SAFE_BACKUP`
   - Plus timestamped backups

2. To restore if needed:
   ```bash
   cp ~/Library/Application Support/Claude/claude_desktop_config.json.SAFE_BACKUP ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

3. The new config to add is in: `claude_config_to_add.json`

## Troubleshooting Without Risk

If something doesn't work:
1. Check logs: `LOG_LEVEL=debug npm start`
2. Verify credentials: `node test-auth-only.js`
3. Review .env file (but don't share secrets)
4. Check firewall rules in Azure Portal (read-only)

Remember: When in doubt, READ don't WRITE!
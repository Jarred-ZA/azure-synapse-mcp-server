# Safe Read-Only Queries for Testing

## Use these queries to test without risk:

### 1. List System Tables (Always Safe)
```sql
SELECT TOP 10 name, type_desc, create_date 
FROM sys.tables 
ORDER BY create_date DESC
```

### 2. Check Database Size (Metadata Only)
```sql
SELECT 
    DB_NAME() as database_name,
    SUM(size * 8 / 1024) as size_mb
FROM sys.master_files
WHERE DB_ID() = database_id
GROUP BY database_id
```

### 3. List Schemas (Read-Only)
```sql
SELECT schema_id, name as schema_name
FROM sys.schemas
WHERE principal_id = 1
```

### 4. View Current Sessions (No Modifications)
```sql
SELECT TOP 5
    session_id,
    login_name,
    status,
    host_name,
    program_name
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
```

### 5. Check Stored Procedures (List Only)
```sql
SELECT TOP 10
    SCHEMA_NAME(schema_id) as schema_name,
    name as procedure_name,
    create_date,
    modify_date
FROM sys.procedures
ORDER BY modify_date DESC
```

## Safe MCP Commands to Test:

1. `list_pipelines` - Only lists, doesn't run
2. `analyze_table_schema` with system tables
3. `manage_stored_procedures` with action='list'
4. `execute_sql_query` with SELECT statements only

## NEVER Test These Commands:
- ❌ `trigger_pipeline`
- ❌ `data_migration_helper`
- ❌ `manage_stored_procedures` with action='execute'
- ❌ Any query with INSERT, UPDATE, DELETE, CREATE, ALTER, DROP
# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this project, please report it by creating a private security advisory on GitHub or by emailing the maintainers directly. Do not create public issues for security vulnerabilities.

## Security Best Practices

### Authentication

1. **Use Azure CLI Authentication for Development**
   ```bash
   AZURE_AUTH_METHOD=cli
   ```

2. **Use Managed Identity for Production**
   ```bash
   AZURE_AUTH_METHOD=managedidentity
   ```

3. **Rotate Service Principal Credentials**
   - Rotate service principal secrets at least every 90 days
   - Use Azure Key Vault for secret management

### Access Control

1. **Enable Read-Only Mode**
   ```bash
   READONLY_MODE=true
   ```

2. **Restrict Workspace Access**
   ```bash
   AZURE_SYNAPSE_ALLOWED_WORKSPACE=production-workspace
   ```

3. **Apply Least Privilege**
   - Grant minimum required permissions
   - Use separate service principals for different environments

### Configuration Security

1. **Never Commit Secrets**
   - Use `.env` files (excluded from git)
   - Use environment variables
   - Use Azure Key Vault

2. **Secure Configuration Files**
   ```bash
   # Set restrictive permissions
   chmod 600 .env
   chmod 600 config/tenants.json
   ```

### Network Security

1. **Configure Firewall Rules**
   - Restrict access to known IP ranges
   - Use private endpoints when possible

2. **Enable TLS/SSL**
   - Ensure all connections use encryption
   - Verify certificate validity

### Monitoring and Auditing

1. **Enable Audit Logging**
   - Enable Azure Synapse audit logs
   - Monitor query execution
   - Track authentication attempts

2. **Set Up Alerts**
   - Failed authentication attempts
   - Unusual query patterns
   - High resource usage

### Dependency Management

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm update
   ```

2. **Review Dependencies**
   - Audit third-party packages
   - Use tools like Snyk or Dependabot

## Security Checklist

Before deploying to production:

- [ ] All secrets are stored securely (not in code)
- [ ] Authentication method is appropriate for environment
- [ ] Workspace restrictions are configured
- [ ] Read-only mode is enabled where appropriate
- [ ] Firewall rules are configured
- [ ] Audit logging is enabled
- [ ] Service principal has minimal permissions
- [ ] Dependencies are up to date
- [ ] Configuration files have restrictive permissions
- [ ] Error messages don't expose sensitive information

## Compliance

This project follows security best practices aligned with:
- Azure Security Baseline
- OWASP Top 10
- CIS Azure Foundations Benchmark

For additional security guidance, refer to the [Azure Synapse Analytics security documentation](https://docs.microsoft.com/en-us/azure/synapse-analytics/security/).
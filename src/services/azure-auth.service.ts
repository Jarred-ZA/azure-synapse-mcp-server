import { DefaultAzureCredential, ClientSecretCredential, ChainedTokenCredential } from '@azure/identity';
import { AccessToken, TokenCredential } from '@azure/core-auth';
import config from '../config/config.js';
import { logger, loggerHelpers } from '../utils/logger.js';
import { AuthenticationError } from '../utils/error-handler.js';

export class AzureAuthService {
  private credential: TokenCredential;
  private cachedToken: AccessToken | null = null;
  private tokenExpirationBuffer = 5 * 60 * 1000; // 5 minutes buffer

  constructor() {
    this.credential = this.createCredential();
  }

  /**
   * Creates the appropriate Azure credential based on configuration
   */
  private createCredential(): TokenCredential {
    const credentials: TokenCredential[] = [];

    // Add configured authentication method first
    switch (config.authMethod) {
      case 'client_credentials':
        if (config.clientId && config.clientSecret && config.tenantId) {
          logger.debug('Using Client Secret Credential');
          credentials.push(new ClientSecretCredential(
            config.tenantId,
            config.clientId,
            config.clientSecret
          ));
        } else {
          throw new AuthenticationError(
            'Client credentials authentication requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET'
          );
        }
        break;

      case 'managed_identity':
        logger.debug('Using Managed Identity');
        // DefaultAzureCredential will handle managed identity
        break;

      case 'azure_cli':
        logger.debug('Using Azure CLI authentication');
        // DefaultAzureCredential will handle Azure CLI
        break;

      default:
        throw new AuthenticationError(`Unsupported authentication method: ${config.authMethod}`);
    }

    // Always add DefaultAzureCredential as fallback (handles managed identity, CLI, etc.)
    credentials.push(new DefaultAzureCredential({
      tenantId: config.tenantId
    }));

    // Return chained credential or single credential
    if (credentials.length === 1) {
      return credentials[0];
    }

    return new ChainedTokenCredential(...credentials);
  }

  /**
   * Gets a valid access token for Azure Synapse
   */
  async getAccessToken(): Promise<string> {
    try {
      // Check if cached token is still valid
      if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
        logger.debug('Using cached access token');
        return this.cachedToken.token;
      }

      logger.debug('Acquiring new access token');
      const startTime = Date.now();

      // Get new token
      const tokenResponse = await this.credential.getToken([
        'https://dev.azuresynapse.net/.default'
      ]);

      if (!tokenResponse) {
        throw new AuthenticationError('Failed to acquire access token');
      }

      this.cachedToken = tokenResponse;
      const duration = Date.now() - startTime;

      loggerHelpers.logAuthentication(config.authMethod, true);
      logger.debug('Access token acquired successfully', {
        duration: `${duration}ms`,
        expiresOn: tokenResponse.expiresOnTimestamp
      });

      return tokenResponse.token;

    } catch (error) {
      this.cachedToken = null;
      loggerHelpers.logAuthentication(config.authMethod, false, error);
      
      if (error instanceof Error) {
        throw new AuthenticationError(`Failed to acquire access token: ${error.message}`);
      }
      
      throw new AuthenticationError('Failed to acquire access token: Unknown error');
    }
  }

  /**
   * Checks if the cached token is still valid
   */
  private isTokenValid(token: AccessToken): boolean {
    if (!token.expiresOnTimestamp) {
      return false;
    }

    const now = Date.now();
    const expirationTime = token.expiresOnTimestamp;
    const timeUntilExpiration = expirationTime - now;

    return timeUntilExpiration > this.tokenExpirationBuffer;
  }

  /**
   * Forces refresh of the cached token
   */
  async refreshToken(): Promise<string> {
    logger.debug('Forcing token refresh');
    this.cachedToken = null;
    return this.getAccessToken();
  }

  /**
   * Gets the authorization header value
   */
  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  /**
   * Validates that the current credential can acquire tokens
   */
  async validateCredential(): Promise<void> {
    try {
      await this.getAccessToken();
      logger.info('Azure credential validation successful');
    } catch (error) {
      logger.error('Azure credential validation failed:', error);
      throw error;
    }
  }

  /**
   * Gets token information for debugging
   */
  async getTokenInfo(): Promise<{
    hasToken: boolean;
    expiresOn?: Date;
    timeUntilExpiration?: number;
    isValid?: boolean;
  }> {
    if (!this.cachedToken) {
      return { hasToken: false };
    }

    const expiresOn = this.cachedToken.expiresOnTimestamp 
      ? new Date(this.cachedToken.expiresOnTimestamp)
      : undefined;
    
    const timeUntilExpiration = this.cachedToken.expiresOnTimestamp 
      ? this.cachedToken.expiresOnTimestamp - Date.now()
      : undefined;

    return {
      hasToken: true,
      expiresOn,
      timeUntilExpiration,
      isValid: this.isTokenValid(this.cachedToken)
    };
  }

  /**
   * Clears the cached token
   */
  clearCache(): void {
    logger.debug('Clearing token cache');
    this.cachedToken = null;
  }
}

// Create singleton instance
export const azureAuthService = new AzureAuthService();

export default azureAuthService;

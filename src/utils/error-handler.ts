import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SynapseError, McpErrorResult } from '../types/synapse.types.js';
import { logger } from './logger.js';

/**
 * Custom error class for Azure Synapse specific errors
 */
export class SynapseApiError extends Error {
  public readonly statusCode: number;
  public readonly synapseError?: SynapseError;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    synapseError?: SynapseError,
    requestId?: string
  ) {
    super(message);
    this.name = 'SynapseApiError';
    this.statusCode = statusCode;
    this.synapseError = synapseError;
    this.requestId = requestId;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, SynapseApiError.prototype);
  }
}

/**
 * Custom error class for configuration errors
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Maps HTTP status codes to appropriate MCP error codes
 */
function mapHttpStatusToMcpError(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCode.InvalidRequest;
    case 401:
      return ErrorCode.InvalidRequest; // Authentication issues
    case 403:
      return ErrorCode.InvalidRequest; // Authorization issues
    case 404:
      return ErrorCode.InvalidRequest; // Resource not found
    case 429:
      return ErrorCode.InvalidRequest; // Rate limiting
    case 500:
    case 502:
    case 503:
    case 504:
      return ErrorCode.InternalError;
    default:
      return ErrorCode.InternalError;
  }
}

/**
 * Handles Azure Synapse API errors and converts them to MCP errors
 */
export function handleSynapseApiError(error: any, context: string): McpError {
  logger.error(`Synapse API error in ${context}:`, error);

  if (error instanceof SynapseApiError) {
    const mcpErrorCode = mapHttpStatusToMcpError(error.statusCode);
    
    let message = `Synapse API error: ${error.message}`;
    if (error.synapseError) {
      message += ` (Code: ${error.synapseError.code})`;
      if (error.synapseError.details && error.synapseError.details.length > 0) {
        const details = error.synapseError.details.map(d => d.message).join(', ');
        message += ` Details: ${details}`;
      }
    }
    if (error.requestId) {
      message += ` (Request ID: ${error.requestId})`;
    }

    return new McpError(mcpErrorCode, message);
  }

  if (error instanceof AuthenticationError) {
    return new McpError(
      ErrorCode.InvalidRequest,
      `Authentication failed: ${error.message}`
    );
  }

  if (error instanceof ConfigurationError) {
    return new McpError(
      ErrorCode.InvalidRequest,
      `Configuration error: ${error.message}`
    );
  }

  // Handle network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new McpError(
      ErrorCode.InternalError,
      `Network error: Unable to connect to Azure Synapse. Please check your workspace URL and network connectivity.`
    );
  }

  // Handle timeout errors
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return new McpError(
      ErrorCode.InternalError,
      `Request timeout: The operation took too long to complete. Please try again.`
    );
  }

  // Generic error handling
  const message = error.message || 'Unknown error occurred';
  return new McpError(ErrorCode.InternalError, `${context}: ${message}`);
}

/**
 * Creates an MCP error result for tool responses
 */
export function createErrorResult(error: any, context: string): McpErrorResult {
  logger.error(`Error in ${context}:`, error);

  let errorMessage = 'An error occurred';
  
  if (error instanceof SynapseApiError) {
    errorMessage = `Azure Synapse API error: ${error.message}`;
    if (error.synapseError) {
      errorMessage += ` (Code: ${error.synapseError.code})`;
    }
  } else if (error instanceof AuthenticationError) {
    errorMessage = `Authentication error: ${error.message}`;
  } else if (error instanceof ConfigurationError) {
    errorMessage = `Configuration error: ${error.message}`;
  } else if (error.message) {
    errorMessage = error.message;
  }

  return {
    isError: true,
    content: [{
      type: 'text',
      text: `Error in ${context}: ${errorMessage}`
    }]
  };
}

/**
 * Validates that required parameters are present
 */
export function validateRequiredParameters(
  parameters: Record<string, any>,
  required: string[]
): void {
  const missing = required.filter(param => 
    parameters[param] === undefined || 
    parameters[param] === null || 
    parameters[param] === ''
  );

  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
}

/**
 * Safely parses JSON and handles errors
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('Failed to parse JSON:', { jsonString, error: error.message });
    return defaultValue;
  }
}

/**
 * Truncates long strings for logging
 */
export function truncateString(str: string, maxLength: number = 1000): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '... (truncated)';
}

/**
 * Extracts error message from various error types
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  
  return 'Unknown error occurred';
}

/**
 * Retries an async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      if (error instanceof SynapseApiError) {
        // Don't retry client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          break;
        }
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, {
        error: extractErrorMessage(error),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export default {
  SynapseApiError,
  ConfigurationError,
  AuthenticationError,
  handleSynapseApiError,
  createErrorResult,
  validateRequiredParameters,
  safeJsonParse,
  truncateString,
  extractErrorMessage,
  retryOperation
};

import winston from 'winston';
import config from '../config/config.js';

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: config.serverName,
    version: config.serverVersion
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
          
          // Add additional metadata if present
          const metaKeys = Object.keys(meta).filter(key => key !== 'timestamp' && key !== 'level' && key !== 'message' && key !== 'service');
          if (metaKeys.length > 0) {
            const metaString = metaKeys.map(key => `${key}=${JSON.stringify(meta[key])}`).join(' ');
            logMessage += ` ${metaString}`;
          }
          
          return logMessage;
        })
      )
    })
  ]
});

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

// Add debug logging if debug mode is enabled
if (config.debugMode) {
  logger.level = 'debug';
  logger.debug('Debug mode enabled');
}

// Helper functions for structured logging
export const loggerHelpers = {
  logApiCall: (method: string, url: string, statusCode?: number, duration?: number) => {
    logger.info('API call', {
      method,
      url,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
      type: 'api_call'
    });
  },

  logApiError: (method: string, url: string, error: any, statusCode?: number) => {
    logger.error('API call failed', {
      method,
      url,
      statusCode,
      error: error.message || error,
      stack: error.stack,
      type: 'api_error'
    });
  },

  logToolCall: (toolName: string, parameters: any) => {
    logger.info('MCP tool called', {
      toolName,
      parameters: config.debugMode ? parameters : '[hidden]',
      type: 'tool_call'
    });
  },

  logToolResult: (toolName: string, success: boolean, error?: any) => {
    if (success) {
      logger.info('MCP tool completed successfully', {
        toolName,
        type: 'tool_result'
      });
    } else {
      logger.error('MCP tool failed', {
        toolName,
        error: error?.message || error,
        stack: error?.stack,
        type: 'tool_error'
      });
    }
  },

  logAuthentication: (method: string, success: boolean, error?: any) => {
    if (success) {
      logger.info('Authentication successful', {
        method,
        type: 'auth_success'
      });
    } else {
      logger.error('Authentication failed', {
        method,
        error: error?.message || error,
        type: 'auth_error'
      });
    }
  }
};

export default logger;

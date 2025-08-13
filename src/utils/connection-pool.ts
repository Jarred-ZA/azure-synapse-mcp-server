import { Connection, ConnectionConfig, Request, TYPES } from 'tedious';
import NodeCache from 'node-cache';
import { logger } from './logger.js';

export interface ConnectionOptions {
  server: string;
  database: string;
  authentication: {
    type: string;
    options?: {
      userName?: string;
      password?: string;
      token?: string;
    };
  };
  options: {
    encrypt: boolean;
    trustServerCertificate?: boolean;
    connectTimeout?: number;
    requestTimeout?: number;
    port?: number;
  };
}

export class ConnectionPool {
  private connections: Map<string, Connection> = new Map();
  private cache: NodeCache;
  private connectionPromises: Map<string, Promise<Connection>> = new Map();

  constructor() {
    // Cache for query results (TTL: 5 minutes by default)
    this.cache = new NodeCache({ 
      stdTTL: parseInt(process.env.CACHE_TTL || '300'),
      checkperiod: 60 
    });
  }

  private getConnectionKey(workspace: string, database: string, poolType: string): string {
    return `${workspace}-${database}-${poolType}`;
  }

  async getConnection(
    connectionString: string,
    workspace: string,
    database: string,
    poolType: string
  ): Promise<Connection> {
    const key = this.getConnectionKey(workspace, database, poolType);
    
    // Check if connection exists and is healthy
    const existingConnection = this.connections.get(key);
    if (existingConnection && (existingConnection as any).state === (existingConnection as any).STATE?.LOGGED_IN) {
      return existingConnection;
    }

    // Check if a connection is already being created
    const existingPromise = this.connectionPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new connection
    const connectionPromise = this.createConnection(connectionString, key);
    this.connectionPromises.set(key, connectionPromise);

    try {
      const connection = await connectionPromise;
      this.connections.set(key, connection);
      this.connectionPromises.delete(key);
      return connection;
    } catch (error) {
      this.connectionPromises.delete(key);
      throw error;
    }
  }

  private async createConnection(connectionString: string, key: string): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const config = this.parseConnectionString(connectionString);
      const connection = new Connection(config);

      connection.on('connect', (err) => {
        if (err) {
          logger.error(`Failed to connect to database (${key}):`, err);
          reject(err);
        } else {
          logger.info(`Connected to database: ${key}`);
          resolve(connection);
        }
      });

      connection.on('error', (err) => {
        logger.error(`Connection error (${key}):`, err);
        this.connections.delete(key);
      });

      connection.on('end', () => {
        logger.info(`Connection closed: ${key}`);
        this.connections.delete(key);
      });

      connection.connect();
    });
  }

  private parseConnectionString(connectionString: string): ConnectionConfig {
    // Parse connection string format:
    // Server=tcp:workspace.sql.azuresynapse.net,1433;Database=db;Authentication=Active Directory Password;User ID=user;Password=pass;
    
    const params = new Map<string, string>();
    connectionString.split(';').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        params.set(key.toLowerCase().trim(), value.trim());
      }
    });

    const server = params.get('server')?.replace('tcp:', '').split(',')[0] || '';
    const port = parseInt(params.get('server')?.split(',')[1] || '1433');
    const database = params.get('database') || params.get('initial catalog') || '';
    const authType = params.get('authentication') || 'default';
    
    const config: ConnectionConfig = {
      server,
      authentication: {
        type: authType === 'Active Directory Password' ? 'azure-active-directory-password' : 'default',
        options: {
          userName: params.get('user id') || params.get('uid'),
          password: params.get('password') || params.get('pwd')
        }
      },
      options: {
        database,
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000,
        requestTimeout: 30000,
        port
      }
    };

    return config;
  }

  async executeQuery(
    connection: Connection,
    query: string,
    parameters?: Record<string, any>
  ): Promise<any[]> {
    // Check cache first
    const cacheKey = `${query}-${JSON.stringify(parameters || {})}`;
    const cachedResult = this.cache.get<any[]>(cacheKey);
    if (cachedResult) {
      logger.debug('Returning cached query result');
      return cachedResult;
    }

    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      const request = new Request(query, (err, rowCount) => {
        if (err) {
          logger.error('Query execution error:', err);
          reject(err);
        } else {
          logger.debug(`Query completed. Rows: ${rowCount}`);
          // Cache the result
          this.cache.set(cacheKey, results);
          resolve(results);
        }
      });

      // Add parameters if provided
      if (parameters) {
        for (const [name, value] of Object.entries(parameters)) {
          const type = this.getParameterType(value);
          request.addParameter(name, type, value);
        }
      }

      // Collect rows
      request.on('row', (columns) => {
        const row: any = {};
        columns.forEach((column) => {
          row[column.metadata.colName] = column.value;
        });
        results.push(row);
      });

      connection.execSql(request);
    });
  }

  private getParameterType(value: any) {
    if (typeof value === 'string') return TYPES.NVarChar;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? TYPES.Int : TYPES.Float;
    }
    if (typeof value === 'boolean') return TYPES.Bit;
    if (value instanceof Date) return TYPES.DateTime;
    return TYPES.NVarChar;
  }

  async closeConnection(workspace: string, database: string, poolType: string) {
    const key = this.getConnectionKey(workspace, database, poolType);
    const connection = this.connections.get(key);
    
    if (connection) {
      connection.close();
      this.connections.delete(key);
      logger.info(`Closed connection: ${key}`);
    }
  }

  async closeAll() {
    const closePromises = Array.from(this.connections.values()).map(connection => {
      return new Promise<void>((resolve) => {
        connection.on('end', resolve);
        connection.close();
      });
    });

    await Promise.all(closePromises);
    this.connections.clear();
    this.cache.flushAll();
    logger.info('All connections closed');
  }

  clearCache() {
    this.cache.flushAll();
    logger.info('Query cache cleared');
  }

  getConnectionStats() {
    return {
      activeConnections: this.connections.size,
      cachedQueries: this.cache.keys().length,
      connections: Array.from(this.connections.keys())
    };
  }
}

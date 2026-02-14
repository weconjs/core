/**
 * @weconjs/core - Database Connection
 *
 * Manages MongoDB/Mongoose database connections with:
 * - URI builder from config parts
 * - Global plugin registration
 * - Retry logic with exponential backoff
 *
 * @example
 * ```typescript
 * import { createDatabaseConnection, buildMongoUri } from '@weconjs/core';
 *
 * // Build URI from parts
 * const uri = buildMongoUri({
 *   protocol: 'mongodb',
 *   host: 'localhost',
 *   port: 27017,
 *   database: 'myapp',
 * });
 *
 * // Create connection
 * const db = await createDatabaseConnection({
 *   uri,
 *   plugins: [myPlugin],
 * });
 *
 * await db.connect();
 * ```
 */

import type { DatabaseConfig } from "../types.js";

/**
 * MongoDB URI parts for building connection string
 */
export interface MongoUriParts {
  protocol?: string;
  host?: string;
  port?: number;
  database?: string;
  auth?: {
    username?: string;
    password?: string;
  };
  options?: Record<string, string>;
}

/**
 * Database connection options
 */
export interface DatabaseOptions {
  /**
   * Direct MongoDB connection URI
   * If provided, takes precedence over config parts
   */
  uri?: string;

  /**
   * Build URI from config parts (alternative to uri)
   */
  config?: MongoUriParts;

  /**
   * Database name (can override config.database)
   */
  name?: string;

  /**
   * Mongoose connection options
   */
  options?: Record<string, unknown>;

  /**
   * Global Mongoose plugins to register
   */
  plugins?: Array<{
    plugin: (schema: unknown, options?: unknown) => void;
    options?: unknown;
  }>;

  /**
   * Enable debug logging for Mongoose
   */
  debug?: boolean;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  };
}

/**
 * Database connection instance
 */
export interface DatabaseConnection {
  /**
   * Connect to the database
   */
  connect: () => Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect: () => Promise<void>;

  /**
   * Check if connected
   */
  isConnected: () => boolean;

  /**
   * Get the Mongoose instance (if available)
   */
  mongoose?: unknown;
}

/**
 * Build a MongoDB URI from parts
 *
 * @param parts - URI parts
 * @returns MongoDB connection string
 *
 * @example
 * ```typescript
 * buildMongoUri({
 *   protocol: 'mongodb+srv',
 *   host: 'cluster0.abc123.mongodb.net',
 *   database: 'myapp',
 *   auth: { username: 'user', password: 'pass' }
 * });
 * // => 'mongodb+srv://user:pass@cluster0.abc123.mongodb.net/myapp'
 * ```
 */
export function buildMongoUri(parts: MongoUriParts): string {
  const {
    protocol = "mongodb",
    host = "localhost",
    port,
    database = "test",
    auth,
    options,
  } = parts;

  // Build auth string
  let authStr = "";
  if (auth?.username && auth?.password) {
    authStr = `${encodeURIComponent(auth.username)}:${encodeURIComponent(auth.password)}@`;
  }

  // Build host with port
  const hostStr = port && protocol === "mongodb" ? `${host}:${port}` : host;

  // Build query string from options
  let queryStr = "";
  if (options && Object.keys(options).length > 0) {
    queryStr = "?" + Object.entries(options)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  }

  return `${protocol}://${authStr}${hostStr}/${database}${queryStr}`;
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a MongoDB database connection
 *
 * @param options - Database options
 * @returns Database connection instance
 */
export async function createDatabaseConnection(
  options: DatabaseOptions
): Promise<DatabaseConnection> {
  let connected = false;
  let mongooseInstance: typeof import("mongoose") | null = null;

  // Resolve URI
  const uri = options.uri ?? (options.config ? buildMongoUri(options.config) : null);

  if (!uri) {
    throw new Error(
      "[Wecon] Database connection requires either uri or config. " +
        "Provide options.uri or options.config with host/database."
    );
  }

  // Retry configuration
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
  } = options.retry ?? {};

  return {
    async connect() {
      // Dynamic import mongoose
      const mongoose = await import("mongoose");
      mongooseInstance = mongoose;

      // Register global plugins
      if (options.plugins?.length) {
        for (const { plugin, options: pluginOpts } of options.plugins) {
          mongoose.default.plugin(plugin as any, pluginOpts);
        }
        console.log(`[Wecon] Registered ${options.plugins.length} Mongoose plugin(s)`);
      }

      // Enable debug mode if requested
      if (options.debug) {
        mongoose.default.set("debug", true);
      }

      // Connect with retry logic
      let lastError: Error | null = null;
      let currentDelay = delayMs;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await mongoose.default.connect(uri, options.options as any);
          connected = true;
          return;
        } catch (err) {
          lastError = err as Error;
          console.warn(
            `[Wecon] Database connection attempt ${attempt}/${maxAttempts} failed:`,
            (err as Error).message
          );

          if (attempt < maxAttempts) {
            console.log(`[Wecon] Retrying in ${currentDelay}ms...`);
            await sleep(currentDelay);
            currentDelay *= backoffMultiplier;
          }
        }
      }

      throw new Error(
        `[Wecon] Database connection failed after ${maxAttempts} attempts: ${lastError?.message}`
      );
    },

    async disconnect() {
      if (connected && mongooseInstance) {
        await mongooseInstance.default.disconnect();
        connected = false;
        console.log("[Wecon] Database disconnected");
      }
    },

    isConnected() {
      return connected;
    },

    get mongoose() {
      return mongooseInstance?.default;
    },
  };
}

/**
 * Build URI from DatabaseConfig (convenience wrapper)
 *
 * @param config - DatabaseConfig from wecon.config.ts
 * @returns MongoDB connection string
 */
export function buildUriFromConfig(config: DatabaseConfig): string {
  if (!config.mongoose) {
    throw new Error("[Wecon] config.database.mongoose is required to build URI");
  }

  return buildMongoUri({
    protocol: config.mongoose.protocol,
    host: config.mongoose.host,
    port: config.mongoose.port,
    database: config.mongoose.database,
    auth: config.mongoose.auth,
  });
}

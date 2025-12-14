/**
 * @weconjs/core - Database Connection
 *
 * Manages database connections based on configuration.
 */

/**
 * Database connection options
 */
export interface DatabaseOptions {
  /**
   * MongoDB connection URI
   */
  uri: string;

  /**
   * Database name
   */
  name?: string;

  /**
   * Connection options
   */
  options?: Record<string, unknown>;
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

  // Dynamic import mongoose to avoid bundling issues
  const mongoose = await import("mongoose");

  return {
    async connect() {
      try {
        await mongoose.default.connect(options.uri, options.options as any);
        connected = true;
        console.log("[Wecon] Database connected successfully");
      } catch (err) {
        console.error("[Wecon] Database connection failed:", err);
        throw err;
      }
    },

    async disconnect() {
      if (connected) {
        await mongoose.default.disconnect();
        connected = false;
        console.log("[Wecon] Database disconnected");
      }
    },

    isConnected() {
      return connected;
    },
  };
}

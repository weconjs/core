/**
 * Database Module Tests
 *
 * Tests for createDatabaseConnection and buildMongoUri in @weconjs/core
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock mongoose
vi.mock("mongoose", () => ({
  default: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    plugin: vi.fn(),
    set: vi.fn(),
  },
}));

import {
  createDatabaseConnection,
  buildMongoUri,
  buildUriFromConfig,
} from "../src/database/index.js";

describe("Database Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMongoUri", () => {
    it("should build basic URI with defaults", () => {
      const uri = buildMongoUri({});
      expect(uri).toBe("mongodb://localhost/test");
    });

    it("should build URI with host and database", () => {
      const uri = buildMongoUri({
        host: "db.example.com",
        database: "myapp",
      });
      expect(uri).toBe("mongodb://db.example.com/myapp");
    });

    it("should include port for mongodb protocol", () => {
      const uri = buildMongoUri({
        host: "localhost",
        port: 27018,
        database: "myapp",
      });
      expect(uri).toBe("mongodb://localhost:27018/myapp");
    });

    it("should not include port for mongodb+srv protocol", () => {
      const uri = buildMongoUri({
        protocol: "mongodb+srv",
        host: "cluster.mongodb.net",
        port: 27017, // Should be ignored
        database: "myapp",
      });
      expect(uri).toBe("mongodb+srv://cluster.mongodb.net/myapp");
    });

    it("should include authentication", () => {
      const uri = buildMongoUri({
        host: "localhost",
        database: "myapp",
        auth: {
          username: "admin",
          password: "secret123",
        },
      });
      expect(uri).toBe("mongodb://admin:secret123@localhost/myapp");
    });

    it("should URL-encode special characters in credentials", () => {
      const uri = buildMongoUri({
        host: "localhost",
        database: "myapp",
        auth: {
          username: "user@domain",
          password: "pass/word#1",
        },
      });
      expect(uri).toContain("user%40domain");
      expect(uri).toContain("pass%2Fword%231");
    });

    it("should include query options", () => {
      const uri = buildMongoUri({
        host: "localhost",
        database: "myapp",
        options: {
          retryWrites: "true",
          w: "majority",
        },
      });
      expect(uri).toContain("?");
      expect(uri).toContain("retryWrites=true");
      expect(uri).toContain("w=majority");
    });
  });

  describe("buildUriFromConfig", () => {
    it("should build URI from DatabaseConfig", () => {
      const uri = buildUriFromConfig({
        mongoose: {
          protocol: "mongodb",
          host: "localhost",
          port: 27017,
          database: "testdb",
        },
      });
      expect(uri).toBe("mongodb://localhost:27017/testdb");
    });

    it("should throw if mongoose config is missing", () => {
      expect(() => buildUriFromConfig({})).toThrow(
        "config.database.mongoose is required"
      );
    });
  });

  describe("createDatabaseConnection", () => {
    it("should create a database connection instance", async () => {
      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      expect(db).toBeDefined();
      expect(typeof db.connect).toBe("function");
      expect(typeof db.disconnect).toBe("function");
      expect(typeof db.isConnected).toBe("function");
    });

    it("should throw if neither uri nor config is provided", async () => {
      await expect(createDatabaseConnection({})).rejects.toThrow(
        "requires either uri or config"
      );
    });

    it("should build URI from config when uri is not provided", async () => {
      const mongoose = await import("mongoose");

      const db = await createDatabaseConnection({
        config: {
          host: "localhost",
          port: 27017,
          database: "testdb",
        },
      });

      await db.connect();

      expect(mongoose.default.connect).toHaveBeenCalledWith(
        "mongodb://localhost:27017/testdb",
        undefined
      );
    });

    it("should connect to database", async () => {
      const mongoose = await import("mongoose");

      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      await db.connect();

      expect(mongoose.default.connect).toHaveBeenCalledWith(
        "mongodb://localhost/test",
        undefined
      );
      expect(db.isConnected()).toBe(true);
    });

    it("should disconnect from database", async () => {
      const mongoose = await import("mongoose");

      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      await db.connect();
      await db.disconnect();

      expect(mongoose.default.disconnect).toHaveBeenCalled();
      expect(db.isConnected()).toBe(false);
    });

    it("should pass connection options to mongoose", async () => {
      const mongoose = await import("mongoose");

      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
        options: { maxPoolSize: 10 },
      });

      await db.connect();

      expect(mongoose.default.connect).toHaveBeenCalledWith(
        "mongodb://localhost/test",
        { maxPoolSize: 10 }
      );
    });

    it("should register plugins", async () => {
      const mongoose = await import("mongoose");
      const mockPlugin = vi.fn();

      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
        plugins: [{ plugin: mockPlugin, options: { option1: true } }],
      });

      await db.connect();

      expect(mongoose.default.plugin).toHaveBeenCalledWith(mockPlugin, {
        option1: true,
      });
    });

    it("should enable debug mode when requested", async () => {
      const mongoose = await import("mongoose");

      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
        debug: true,
      });

      await db.connect();

      expect(mongoose.default.set).toHaveBeenCalledWith("debug", true);
    });

    it("should report not connected before connect is called", async () => {
      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      expect(db.isConnected()).toBe(false);
    });

    it("should expose mongoose instance after connection", async () => {
      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      await db.connect();

      expect(db.mongoose).toBeDefined();
    });
  });
});


/**
 * Database Module Tests
 *
 * Tests for createDatabaseConnection in @weconjs/core
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock mongoose
vi.mock("mongoose", () => ({
  default: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createDatabaseConnection } from "../src/database/index.js";

describe("Database Module", () => {
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

    it("should report not connected before connect is called", async () => {
      const db = await createDatabaseConnection({
        uri: "mongodb://localhost/test",
      });

      expect(db.isConnected()).toBe(false);
    });
  });
});

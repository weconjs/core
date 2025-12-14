/**
 * Socket Module Tests
 *
 * Tests for Socket.IO integration in @weconjs/core
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";

// Import socket functions
import {
  discoverSocketHandlers,
  discoverSocketMiddleware,
  initializeSocket,
} from "../src/socket/index.js";

// Mock socket.io
vi.mock("socket.io", () => ({
  Server: vi.fn().mockImplementation(() => ({
    use: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe("Socket Module", () => {
  const testDir = join(__dirname, "temp-socket-test");
  const modulesDir = join(testDir, "modules");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(join(modulesDir, "chat", "socket"), { recursive: true });
    mkdirSync(join(modulesDir, "notifications", "socket"), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("discoverSocketHandlers", () => {
    it("should return empty array when no handlers exist", async () => {
      const handlers = await discoverSocketHandlers(modulesDir);
      expect(handlers).toEqual([]);
    });

    it("should discover socket handlers from module directories", async () => {
      // Create a mock socket handler file
      const handlerCode = `
        export default function chatHandler(io, socket) {
          socket.on('message', (data) => io.emit('message', data));
        }
      `;
      writeFileSync(
        join(modulesDir, "chat", "socket", "chat.socket.js"),
        handlerCode
      );

      const handlers = await discoverSocketHandlers(modulesDir);
      
      // Should find the handler
      expect(handlers.length).toBe(1);
      expect(handlers[0].name).toBe("chat");
      expect(handlers[0].namespace).toBe("chat");
      expect(typeof handlers[0].handler).toBe("function");
    });
  });

  describe("discoverSocketMiddleware", () => {
    it("should return empty array when no middleware exists", async () => {
      const middleware = await discoverSocketMiddleware(modulesDir);
      expect(middleware).toEqual([]);
    });

    it("should discover middleware from module directories", async () => {
      // Create a mock middleware file
      const middlewareCode = `
        export default function authMiddleware(socket, next) {
          next();
        }
      `;
      writeFileSync(
        join(modulesDir, "chat", "socket", "socket.middleware.js"),
        middlewareCode
      );

      const middleware = await discoverSocketMiddleware(modulesDir);
      
      expect(middleware.length).toBe(1);
      expect(typeof middleware[0]).toBe("function");
    });

    it("should handle middleware exported as array", async () => {
      const middlewareCode = `
        const mw1 = (socket, next) => next();
        const mw2 = (socket, next) => next();
        export default [mw1, mw2];
      `;
      writeFileSync(
        join(modulesDir, "notifications", "socket", "socket.middleware.js"),
        middlewareCode
      );

      const middleware = await discoverSocketMiddleware(modulesDir);
      
      expect(middleware.length).toBe(2);
    });
  });

  describe("initializeSocket", () => {
    it("should apply middleware to socket server", () => {
      const mockIo = {
        use: vi.fn(),
        on: vi.fn(),
      };

      const mockMiddleware = [vi.fn(), vi.fn()];

      initializeSocket(mockIo as any, [], mockMiddleware);

      expect(mockIo.use).toHaveBeenCalledTimes(2);
      expect(mockIo.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    it("should set up connection handler", () => {
      const mockIo = {
        use: vi.fn(),
        on: vi.fn(),
      };

      const mockHandler = vi.fn();
      const handlers = [
        { name: "test", namespace: "test", handler: mockHandler },
      ];

      initializeSocket(mockIo as any, handlers, []);

      expect(mockIo.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });
  });
});

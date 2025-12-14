/**
 * Server Module Tests
 *
 * Tests for createWecon factory function in @weconjs/core
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock express before importing
vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn((port, callback) => {
      callback?.();
      return { close: vi.fn((cb) => cb?.()) };
    }),
  };
  
  const express = vi.fn(() => mockApp);
  (express as any).json = vi.fn(() => vi.fn());
  (express as any).urlencoded = vi.fn(() => vi.fn());
  
  return { default: express };
});

import { createWecon } from "../src/server/index.js";

describe("Server Module", () => {
  describe("createWecon", () => {
    const mockConfig = {
      mode: "development",
      app: {
        name: "test-app",
        version: "1.0.0",
      },
      port: 3000,
      logging: {
        level: "info",
        enableConsole: true,
        enableFile: false,
      },
      database: {},
      https: {},
      features: {},
      modules: [],
    };

    it("should create a WeconApp instance", async () => {
      const app = await createWecon({
        config: mockConfig as any,
        modules: [],
      });

      expect(app).toBeDefined();
      expect(app.app).toBeDefined();
      expect(typeof app.start).toBe("function");
      expect(typeof app.shutdown).toBe("function");
    });

    it("should apply custom middleware", async () => {
      const mockMiddleware = vi.fn((req, res, next) => next());

      const weconApp = await createWecon({
        config: mockConfig as any,
        modules: [],
        middleware: [mockMiddleware],
      });

      expect(weconApp.app.use).toHaveBeenCalled();
    });

    it("should call onBoot hook when starting", async () => {
      const onBoot = vi.fn();

      const weconApp = await createWecon({
        config: mockConfig as any,
        modules: [],
        hooks: { onBoot },
      });

      await weconApp.start(3001);

      expect(onBoot).toHaveBeenCalled();
    });

    it("should call onShutdown hook when shutting down", async () => {
      const onShutdown = vi.fn();

      const weconApp = await createWecon({
        config: mockConfig as any,
        modules: [],
        hooks: { onShutdown },
      });

      // Call shutdown directly without starting the server
      await weconApp.shutdown();

      expect(onShutdown).toHaveBeenCalled();
    });

    it("should call module onInit hooks", async () => {
      const moduleOnInit = vi.fn();
      const mockModule = {
        name: "test-module",
        namespace: "test",
        routes: null,
        imports: [],
        exports: [],
        onInit: moduleOnInit,
      };

      await createWecon({
        config: mockConfig as any,
        modules: [mockModule as any],
      });

      expect(moduleOnInit).toHaveBeenCalled();
    });

    it("should call onModuleInit hook for each module", async () => {
      const onModuleInit = vi.fn();
      const mockModule = {
        name: "test-module",
        namespace: "test",
        routes: null,
        imports: [],
        exports: [],
      };

      await createWecon({
        config: mockConfig as any,
        modules: [mockModule as any],
        hooks: { onModuleInit },
      });

      expect(onModuleInit).toHaveBeenCalledWith(mockModule, expect.any(Object));
    });

    it("should set up health check endpoint", async () => {
      const weconApp = await createWecon({
        config: mockConfig as any,
        modules: [],
      });

      expect(weconApp.app.get).toHaveBeenCalledWith(
        "/health",
        expect.any(Function)
      );
    });
  });
});

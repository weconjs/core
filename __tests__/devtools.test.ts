/**
 * @wecon/core - DevTools Tests
 *
 * Tests for the DevTools REST API module.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Application } from "express";
import { createWecon } from "../src/server/index.js";
import { defineModule } from "../src/module.js";
import type { ResolvedConfig, WeconModule } from "../src/types.js";

// Suppress Winston logs in tests
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    add: vi.fn(),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
    json: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
}));

const testConfig: ResolvedConfig = {
  app: { name: "devtools-test", version: "1.0.0" },
  mode: "development",
  port: 3099,
  database: {},
  logging: { level: "debug" },
  https: {},
  features: {},
  modules: [],
  moduleConfigs: {
    "test-mod": { greeting: "hello" },
  },
};

const testModule = defineModule({
  name: "test-mod",
  description: "A test module",
  imports: [],
  exports: ["TestService"],
});

let app: Application;

beforeAll(async () => {
  const wecon = await createWecon({
    config: testConfig,
    modules: [testModule],
    database: { enabled: false },
    devtools: { enabled: true },
    logger: { useWinston: false },
  });
  app = wecon.app;
});

/**
 * Helper to make requests to the Express app
 */
async function request(method: string, path: string, body?: unknown) {
  // Use supertest-like approach with native fetch on express listener
  const { default: express } = await import("express");

  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    // Create a one-off server
    const http = require("http");
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const url = `http://localhost:${port}/dev/devtools${path}`;

      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      fetch(url, options)
        .then(async (res) => {
          const json = await res.json();
          server.close();
          resolve({ status: res.status, body: json as Record<string, unknown> });
        })
        .catch((err) => {
          server.close();
          resolve({ status: 500, body: { error: err.message } });
        });
    });
  });
}

describe("DevTools API", () => {
  describe("GET /modules", () => {
    it("should list all modules", async () => {
      const res = await request("GET", "/modules");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data as Array<Record<string, unknown>>;
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("test-mod");
      expect(data[0].description).toBe("A test module");
      expect(data[0].exports).toEqual(["TestService"]);
    });
  });

  describe("GET /modules/:name", () => {
    it("should return module detail", async () => {
      const res = await request("GET", "/modules/test-mod");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data as Record<string, unknown>;
      expect(data.name).toBe("test-mod");
    });

    it("should return 404 for unknown module", async () => {
      const res = await request("GET", "/modules/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /config", () => {
    it("should return the full resolved config", async () => {
      const res = await request("GET", "/config");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data as Record<string, unknown>;
      const appConfig = data.app as Record<string, unknown>;
      expect(appConfig.name).toBe("devtools-test");
    });
  });

  describe("PUT /config", () => {
    it("should update a config value by dot path", async () => {
      const res = await request("PUT", "/config", {
        path: "logging.level",
        value: "warn",
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject immutable paths", async () => {
      const res = await request("PUT", "/config", {
        path: "app.name",
        value: "hacked",
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject missing path", async () => {
      const res = await request("PUT", "/config", { value: "test" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /config/:moduleName", () => {
    it("should return module config", async () => {
      const res = await request("GET", "/config/test-mod");
      expect(res.status).toBe(200);

      const data = res.body.data as Record<string, unknown>;
      expect(data.moduleName).toBe("test-mod");
      expect(data.config).toEqual({ greeting: "hello" });
    });

    it("should return 404 for unknown module config", async () => {
      const res = await request("GET", "/config/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /routes", () => {
    it("should return empty array when no wecon instance", async () => {
      const res = await request("GET", "/routes");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});

describe("DevTools Auth", () => {
  let protectedApp: Application;

  beforeAll(async () => {
    const wecon = await createWecon({
      config: { ...testConfig, port: 3098 },
      modules: [],
      database: { enabled: false },
      devtools: { enabled: true, auth: { token: "secret-token" } },
      logger: { useWinston: false },
    });
    protectedApp = wecon.app;
  });

  async function authRequest(path: string, token?: string) {
    const http = require("http");
    const server = http.createServer(protectedApp);

    return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        const url = `http://localhost:${port}/dev/devtools${path}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        fetch(url, { headers })
          .then(async (res) => {
            const json = await res.json();
            server.close();
            resolve({ status: res.status, body: json as Record<string, unknown> });
          })
          .catch((err) => {
            server.close();
            resolve({ status: 500, body: { error: err.message } });
          });
      });
    });
  }

  it("should reject requests without token", async () => {
    const res = await authRequest("/modules");
    expect(res.status).toBe(401);
  });

  it("should reject requests with wrong token", async () => {
    const res = await authRequest("/modules", "wrong-token");
    expect(res.status).toBe(403);
  });

  it("should accept requests with correct token", async () => {
    const res = await authRequest("/modules", "secret-token");
    expect(res.status).toBe(200);
  });
});

describe("DevTools disabled in production", () => {
  it("should not mount devtools in production mode", async () => {
    const prodConfig: ResolvedConfig = {
      ...testConfig,
      mode: "production",
      port: 3097,
    };

    const wecon = await createWecon({
      config: prodConfig,
      modules: [],
      database: { enabled: false },
      logger: { useWinston: false },
    });

    // DevTools should not be mounted — request should 404
    const http = require("http");
    const server = http.createServer(wecon.app);

    const res = await new Promise<{ status: number }>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        fetch(`http://localhost:${port}/dev/devtools/modules`)
          .then((r) => {
            server.close();
            resolve({ status: r.status });
          })
          .catch(() => {
            server.close();
            resolve({ status: 500 });
          });
      });
    });

    expect(res.status).toBe(404);
  });
});

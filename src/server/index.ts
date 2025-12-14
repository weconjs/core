/**
 * @weconjs/core - Server Factory
 *
 * Creates and configures the Express application with all framework features.
 * This is the main entry point for the Wecon framework.
 */

import type { Application, Request, Response, NextFunction } from "express";
import type { WeconConfig, ResolvedConfig, WeconModule } from "../types.js";

/**
 * Options for creating a Wecon application
 */
export interface CreateWeconOptions {
  /**
   * Resolved configuration from wecon.config.ts
   */
  config: ResolvedConfig;

  /**
   * Registered modules
   */
  modules: WeconModule[];

  /**
   * Custom middleware to apply
   */
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;

  /**
   * Lifecycle hooks
   */
  hooks?: {
    /**
     * Called before server starts
     */
    onBoot?: () => Promise<void> | void;

    /**
     * Called when server is shutting down
     */
    onShutdown?: () => Promise<void> | void;

    /**
     * Called after each module is initialized
     */
    onModuleInit?: (module: WeconModule) => Promise<void> | void;
  };
}

/**
 * Wecon application instance
 */
export interface WeconApp {
  /**
   * The underlying Express application
   */
  app: Application;

  /**
   * Start the server
   */
  start: (port?: number) => Promise<void>;

  /**
   * Gracefully shutdown the server
   */
  shutdown: () => Promise<void>;
}

/**
 * Create a Wecon application
 *
 * This factory function sets up Express with all Wecon features:
 * - Database connection
 * - i18n initialization
 * - Module loading
 * - Error handling
 *
 * @param options - Configuration options
 * @returns Wecon application instance
 */
export async function createWecon(options: CreateWeconOptions): Promise<WeconApp> {
  // Dynamic import to avoid bundling issues
  const express = (await import("express")).default;

  const app = express();
  const { config, modules, middleware = [], hooks = {} } = options;

  // Apply default middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Apply custom middleware
  for (const mw of middleware) {
    app.use(mw);
  }

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.mode,
      app: config.app.name,
      version: config.app.version,
    });
  });

  // Initialize modules
  for (const mod of modules) {
    if (mod.onInit) {
      await mod.onInit({} as any); // Context will be passed properly
    }
    if (hooks.onModuleInit) {
      await hooks.onModuleInit(mod);
    }
  }

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Wecon] Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  });

  let server: any = null;

  return {
    app,

    async start(port?: number) {
      const serverPort = port ?? config.port ?? 3000;

      // Call onBoot hook
      if (hooks.onBoot) {
        await hooks.onBoot();
      }

      return new Promise<void>((resolve) => {
        server = app.listen(serverPort, () => {
          console.log(`\n[Wecon] ${config.app.name} v${config.app.version}`);
          console.log(`[Wecon] Running on http://localhost:${serverPort}`);
          console.log(`[Wecon] Mode: ${config.mode}\n`);
          resolve();
        });
      });
    },

    async shutdown() {
      // Call onShutdown hook
      if (hooks.onShutdown) {
        await hooks.onShutdown();
      }

      // Destroy modules
      for (const mod of modules) {
        if (mod.onDestroy) {
          await mod.onDestroy({} as any);
        }
      }

      // Close server
      if (server) {
        return new Promise<void>((resolve) => {
          server.close(() => {
            console.log("[Wecon] Server shut down gracefully");
            resolve();
          });
        });
      }
    },
  };
}

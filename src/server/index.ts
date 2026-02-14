/**
 * @weconjs/core - Server Factory
 *
 * Creates and configures the Express application with all framework features.
 * This is the main entry point for the Wecon framework.
 *
 * @example
 * ```typescript
 * import { createWecon, loadConfig } from '@weconjs/core';
 *
 * const config = await loadConfig('./wecon.config.ts');
 *
 * const app = await createWecon({
 *   config,
 *   modules: [authModule, usersModule],
 *   database: { enabled: true },
 *   plugins: { fieldShield: true },
 * });
 *
 * await app.start();
 * ```
 */

import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import type { Application, Request, Response, NextFunction, RequestHandler } from "express";
import type { z } from "zod";
import type { ResolvedConfig, WeconModule, WeconLogger, WeconContext } from "../types.js";
import type Wecon from "../routing/Wecon.js";
import { createWinstonLogger, createConsoleLogger } from "../logger/index.js";
import { createDatabaseConnection, buildUriFromConfig, type DatabaseConnection } from "../database/index.js";
import { initializeI18n, i18nNamespaceMiddleware } from "../i18n/index.js";
import { createContext } from "../context.js";
import { resolveAllModuleDeps } from "../module/index.js";
import { createDevToolsRouter, type DevToolsOptions } from "../devtools/index.js";
import { printBanner } from "./banner.js";

/**
 * API Error format
 */
export interface ApiError {
  code: string;
  message: string;
  field?: string;
  params?: Record<string, unknown>;
}

/**
 * Standard API Response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  errors: ApiError[] | null;
  meta: Record<string, unknown> | null;
}

/**
 * Response options for res.respond()
 */
export interface RespondOptions<T = unknown> {
  data?: T;
  errors?: ApiError[];
  meta?: Record<string, unknown>;
}

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
   * The Wecon routing instance (for route handling).
   * If provided, wecon.handler() is mounted automatically.
   */
  wecon?: Wecon;

  /**
   * API prefix shown in the startup banner (e.g. "/api/v1")
   */
  apiPrefix?: string;

  /**
   * Custom middlewares to apply before routes
   */
  middlewares?: RequestHandler[];

  /**
   * Database options
   */
  database?: {
    /**
     * Enable database connection
     */
    enabled?: boolean;

    /**
     * Direct MongoDB URI (overrides config)
     */
    uri?: string;

    /**
     * Mongoose plugins to register
     */
    plugins?: Array<{
      plugin: (schema: unknown, options?: unknown) => void;
      options?: unknown;
    }>;
  };

  /**
   * i18n options
   */
  i18n?: {
    /**
     * Enable i18n middleware
     * @default true if config.features.i18n.enabled
     */
    enabled?: boolean;

    /**
     * Path to modules directory for translation discovery
     */
    modulesDir?: string;
  };

  /**
   * Logger options
   */
  logger?: {
    /**
     * Use Winston logger (requires winston package)
     * @default true
     */
    useWinston?: boolean;

    /**
     * Enable file logging
     * @default false
     */
    enableFile?: boolean;

    /**
     * Log directory
     * @default 'logs'
     */
    logDir?: string;
  };

  /**
   * Module dependency options
   */
  moduleDeps?: {
    /**
     * Auto-install missing module dependencies
     * @default true in development, false in production
     */
    autoInstall?: boolean;

    /**
     * Root directory for resolving module paths and node_modules
     * @default process.cwd()
     */
    rootDir?: string;

    /**
     * Module paths (keyed by module name) for dependency checking.
     * If not provided, dependency checking is skipped.
     */
    paths?: Record<string, string>;
  };

  /**
   * DevTools REST API options
   */
  devtools?: DevToolsOptions;

  /**
   * Lifecycle hooks
   */
  hooks?: {
    /**
     * Called before server starts (after middlewares setup)
     */
    onBoot?: (ctx: WeconContext) => Promise<void> | void;

    /**
     * Called when server is shutting down
     */
    onShutdown?: (ctx: WeconContext) => Promise<void> | void;

    /**
     * Called after each module is initialized
     */
    onModuleInit?: (module: WeconModule, ctx: WeconContext) => Promise<void> | void;
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
   * The application context
   */
  ctx: WeconContext;

  /**
   * Database connection (if enabled)
   */
  db?: DatabaseConnection;

  /**
   * Start the server
   */
  start: (port?: number) => Promise<http.Server | https.Server>;

  /**
   * Gracefully shutdown the server
   */
  shutdown: () => Promise<void>;
}

/**
 * Install respond helper on Express Response prototype
 */
function installRespond(): void {
  // Dynamic import to get express.response
  import("express").then((express) => {
    const response = express.default.response as Response & {
      respond?: <T>(options?: RespondOptions<T>) => Response;
    };

    // Only install if response prototype exists (not in mock environments)
    if (response && !response.respond) {
      response.respond = function <T = unknown>(
        this: Response,
        options: RespondOptions<T> = {}
      ): Response {
        const { data, errors, meta } = options;
        const hasErrors = errors && errors.length > 0;

        const apiResponse: ApiResponse<T> = {
          success: !hasErrors,
          data: hasErrors ? null : ((data ?? null) as T | null),
          errors: hasErrors ? errors : null,
          meta: meta ?? null,
        };

        return this.json(apiResponse);
      };
    }
  }).catch(() => {
    // Express not available yet, will be installed later
  });
}

/**
 * Create HTTPS server if SSL certificates are available
 */
function createHttpsServer(
  app: Application,
  config: ResolvedConfig,
  logger: WeconLogger
): https.Server | null {
  try {
    const httpsConfig = config.https;

    if (!httpsConfig?.enabled) {
      return null;
    }

    const keyPath = path.resolve(httpsConfig.keyPath ?? "");
    const certPath = path.resolve(httpsConfig.certPath ?? "");

    // Check if certificate files exist
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      logger.warn("SSL certificates not found, falling back to HTTP", {
        keyPath,
        certPath,
      });
      return null;
    }

    const httpsOptions: https.ServerOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    return https.createServer(httpsOptions, app);
  } catch (error) {
    logger.warn("Error creating HTTPS server, falling back to HTTP", {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Create graceful shutdown handler
 */
function createGracefulShutdown(
  server: http.Server | https.Server,
  ctx: WeconContext,
  db: DatabaseConnection | undefined,
  onShutdown?: (ctx: WeconContext) => Promise<void> | void
) {
  let isShuttingDown = false;

  return async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    ctx.logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Call shutdown hook
    if (onShutdown) {
      try {
        await onShutdown(ctx);
      } catch (err) {
        ctx.logger.error("Error in onShutdown hook", {
          error: (err as Error).message,
        });
      }
    }

    // Close database connection
    if (db) {
      try {
        await db.disconnect();
      } catch (err) {
        ctx.logger.error("Error closing database", {
          error: (err as Error).message,
        });
      }
    }

    // Close server
    server.close((err) => {
      if (err) {
        ctx.logger.error("Error during server shutdown", {
          error: err.message,
        });
        process.exit(1);
      }

      ctx.logger.info("Server closed successfully");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      ctx.logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };
}

/**
 * Create a Wecon application
 *
 * This factory function sets up Express with all Wecon features:
 * - Database connection
 * - i18n initialization
 * - Module loading
 * - Logging
 * - HTTPS support
 * - Graceful shutdown
 *
 * @param options - Configuration options
 * @returns Wecon application instance
 */
export async function createWecon(options: CreateWeconOptions): Promise<WeconApp> {
  const { config, modules, wecon, middlewares = [], hooks = {} } = options;

  // Install respond helper (wrapped in try-catch as express may not be available yet)
  try {
    installRespond();
  } catch {
    // Will be installed when express is imported
  }

  // Create logger with defensive fallbacks
  let logger: WeconLogger;
  const loggerOptions = {
    level: config.logging?.level ?? "info",
    appName: config.app?.name ?? "wecon",
    enableFile: options.logger?.enableFile ?? config.logging?.enableFile ?? false,
    logDir: options.logger?.logDir ?? "logs",
  };

  if (options.logger?.useWinston !== false) {
    try {
      logger = await createWinstonLogger(loggerOptions);
    } catch {
      logger = createConsoleLogger(loggerOptions);
    }
  } else {
    logger = createConsoleLogger(loggerOptions);
  }

  // Dynamic import Express
  const express = (await import("express")).default;
  const app = express();

  // Validate and inject module configs
  const moduleSchemas = new Map<string, z.ZodType>();

  if (!config.moduleConfigs) {
    config.moduleConfigs = {};
  }

  for (const mod of modules) {
    if (mod.config?.schema) {
      moduleSchemas.set(mod.name, mod.config.schema);

      // If no user-provided config, try module's load() function
      let userConfig = config.moduleConfigs[mod.name];
      if (userConfig === undefined && mod.config.load) {
        userConfig = await mod.config.load();
      }

      // Merge defaults with loaded/user-provided config, then validate
      const merged = { ...(mod.config.defaults ?? {}), ...((userConfig ?? {}) as object) };
      const result = mod.config.schema.safeParse(merged);

      if (!result.success) {
        throw new Error(
          `[Wecon] Invalid config for module "${mod.name}": ${result.error.message}`
        );
      }

      config.moduleConfigs[mod.name] = result.data;
    }
  }

  // Create context with module schemas for runtime validation
  const ctx = createContext({
    config,
    app,
    logger,
    moduleSchemas,
  });

  // Inject WeconContext into every request (enables req.ctx in handlers/middlewares)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).ctx = ctx;
    next();
  });

  // Connect database if enabled
  let db: DatabaseConnection | undefined;
  const shouldConnectDb = options.database?.enabled ?? (config.database?.mongoose?.host !== undefined);

  if (shouldConnectDb) {
    try {
      const uri = options.database?.uri ?? buildUriFromConfig(config.database);

      db = await createDatabaseConnection({
        uri,
        plugins: options.database?.plugins,
        debug: config.database.debug,
      });

      await db.connect();
    } catch (err) {
      logger.error("Failed to connect to database", {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  // Initialize i18n if enabled
  const i18nEnabled = options.i18n?.enabled ?? config.features?.i18n?.enabled;
  if (i18nEnabled) {
    try {
      const modulesDir = options.i18n?.modulesDir ?? "./src/modules";
      const defaultLocale = config.features?.i18n?.defaultLocale ?? "en";
      const i18nMiddleware = await initializeI18n(modulesDir, defaultLocale);
      app.use(i18nMiddleware);
      app.use(i18nNamespaceMiddleware);
    } catch (err) {
      logger.warn("Failed to initialize i18n", {
        error: (err as Error).message,
      });
    }
  }

  // Apply custom middlewares
  for (const mw of middlewares) {
    app.use(mw);
  }

  // Health check endpoint
  app.get("/health", (_req, res) => {
    const response = (res as Response & { respond?: (opts: RespondOptions) => Response }).respond;
    if (response) {
      response.call(res, {
        data: {
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: config.mode,
          app: config.app.name,
          version: config.app.version,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: config.mode,
          app: config.app.name,
          version: config.app.version,
        },
      });
    }
  });

  // Mount DevTools before Wecon RBAC routes (bypasses role checks)
  const devToolsRouter = createDevToolsRouter(ctx, modules, options.devtools, wecon);
  if (devToolsRouter) {
    const prefix = options.devtools?.prefix ?? "/dev/devtools";
    app.use(prefix, devToolsRouter);
  }

  // Mount Wecon router if provided
  if (wecon) {
    app.use(wecon.handler());
  }

  // Check and install module dependencies
  if (options.moduleDeps?.paths) {
    const rootDir = options.moduleDeps.rootDir ?? process.cwd();
    const isDev = config.mode !== "production";
    const autoInstall = options.moduleDeps.autoInstall ?? isDev;

    const modulePaths = Object.entries(options.moduleDeps.paths).map(([name, p]) => ({
      name,
      path: p,
    }));

    await resolveAllModuleDeps(modulePaths, rootDir, logger, autoInstall);
  }

  // Initialize modules
  for (const mod of modules) {
    if (mod.onInit) {
      await mod.onInit(ctx);
    }
    if (hooks.onModuleInit) {
      await hooks.onModuleInit(mod, ctx);
    }
    // Module initialized - shown in startup banner
  }

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
    });

    const response = (res as Response & { respond?: (opts: RespondOptions) => Response }).respond;
    if (response) {
      res.status(500);
      response.call(res, {
        errors: [{ code: "INTERNAL_ERROR", message: err.message || "Internal Server Error" }],
      });
    } else {
      res.status(500).json({
        success: false,
        errors: [{ code: "INTERNAL_ERROR", message: err.message || "Internal Server Error" }],
      });
    }
  });

  // Count routes for banner
  let routeCount: number | undefined;
  if (wecon) {
    try {
      const allRoutes = wecon.getRoutes?.();
      if (allRoutes) routeCount = allRoutes.length;
    } catch {
      // getRoutes may not exist or fail
    }
  }

  const devtoolsEnabled = !!devToolsRouter;
  const devtoolsPrefix = options.devtools?.prefix ?? "/dev/devtools";

  let server: http.Server | https.Server | null = null;

  return {
    app,
    ctx,
    db,

    async start(port?: number) {
      const serverPort = port ?? config.port ?? 3000;

      // Call onBoot hook
      if (hooks.onBoot) {
        await hooks.onBoot(ctx);
      }

      // Try HTTPS first
      const httpsServer = createHttpsServer(app, config, logger);

      if (httpsServer) {
        server = httpsServer;
        const httpsPort = config.https.port ?? 443;

        return new Promise<https.Server>((resolve) => {
          server!.listen(httpsPort, async () => {
            await printBanner({
              config,
              modules,
              port: httpsPort,
              protocol: "https",
              dbConnected: !!db,
              i18nEnabled: !!i18nEnabled,
              devtoolsEnabled,
              devtoolsPrefix,
              routeCount,
              apiPrefix: options.apiPrefix,
            });
            resolve(server as https.Server);
          });
        });
      }

      // Fall back to HTTP
      server = http.createServer(app);

      // Setup graceful shutdown
      const gracefulShutdown = createGracefulShutdown(server, ctx, db, hooks.onShutdown);
      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
      process.on("SIGINT", () => gracefulShutdown("SIGINT"));
      process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

      return new Promise<http.Server>((resolve) => {
        server!.listen(serverPort, async () => {
          await printBanner({
            config,
            modules,
            port: serverPort,
            protocol: "http",
            dbConnected: !!db,
            i18nEnabled: !!i18nEnabled,
            devtoolsEnabled,
            devtoolsPrefix,
            routeCount,
            apiPrefix: options.apiPrefix,
          });
          resolve(server as http.Server);
        });
      });
    },

    async shutdown() {
      // Call onShutdown hook
      if (hooks.onShutdown) {
        await hooks.onShutdown(ctx);
      }

      // Close database
      if (db) {
        await db.disconnect();
      }

      // Destroy modules
      for (const mod of modules) {
        if (mod.onDestroy) {
          await mod.onDestroy(ctx);
        }
      }

      // Close server
      if (server) {
        return new Promise<void>((resolve) => {
          server!.close(() => {
            logger.info("Server shut down gracefully");
            resolve();
          });
        });
      }
    },
  };
}

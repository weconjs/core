/**
 * @wecon/core - Context
 *
 * Creates and manages the Wecon application context.
 * The context is passed to handlers, middleware, and hooks.
 */

import type { Application } from "express";
import type { Server } from "socket.io";
import type { z } from "zod";
import type {
  WeconContext,
  ResolvedConfig,
  WeconLogger,
  WeconServices,
} from "./types.js";

const defaultLogger: WeconLogger = {
  debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta ?? ""),
  info: (message, meta) => console.info(`[INFO] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta ?? ""),
};

/**
 * Create a Wecon application context.
 * Includes service registry and typed module config access.
 */
export function createContext(options: {
  config: ResolvedConfig;
  app: Application;
  io?: Server;
  logger?: WeconLogger;
  /** Zod schemas for module configs (used by setModuleConfig validation) */
  moduleSchemas?: Map<string, z.ZodType>;
}): WeconContext {
  const services: WeconServices = {};
  const moduleSchemas = options.moduleSchemas ?? new Map();

  const ctx: WeconContext = {
    config: options.config,
    app: options.app,
    io: options.io,
    logger: options.logger ?? defaultLogger,
    services,

    getService<T>(name: string): T | undefined {
      return services[name] as T | undefined;
    },

    registerService(name: string, service: unknown): void {
      if (services[name]) {
        ctx.logger.warn(`Service "${name}" is being overwritten`);
      }
      services[name] = service;
    },

    getModuleConfig<T>(moduleName: string): T {
      const config = ctx.config.moduleConfigs[moduleName];
      if (config === undefined) {
        throw new Error(`[Wecon] No config registered for module "${moduleName}"`);
      }
      return config as T;
    },

    setModuleConfig(moduleName: string, newConfig: unknown): void {
      const schema = moduleSchemas.get(moduleName);
      if (schema) {
        // Validate against the module's Zod schema before setting
        const result = schema.safeParse(newConfig);
        if (!result.success) {
          throw new Error(
            `[Wecon] Invalid config for module "${moduleName}": ${result.error.message}`
          );
        }
        ctx.config.moduleConfigs[moduleName] = result.data;
      } else {
        ctx.config.moduleConfigs[moduleName] = newConfig;
      }
    },
  };

  return ctx;
}

/**
 * Create a level-aware logger from config.
 */
export function createLogger(
  config: ResolvedConfig,
  customLogger?: WeconLogger
): WeconLogger {
  if (customLogger) return customLogger;

  const level = config.logging.level ?? "info";
  const levels = ["debug", "info", "warn", "error"];
  const minLevel = levels.indexOf(level);

  const shouldLog = (logLevel: string) => levels.indexOf(logLevel) >= minLevel;

  return {
    debug: (message, meta) => {
      if (shouldLog("debug")) console.debug(`[DEBUG] ${message}`, meta ?? "");
    },
    info: (message, meta) => {
      if (shouldLog("info")) console.info(`[INFO] ${message}`, meta ?? "");
    },
    warn: (message, meta) => {
      if (shouldLog("warn")) console.warn(`[WARN] ${message}`, meta ?? "");
    },
    error: (message, meta) => {
      if (shouldLog("error")) console.error(`[ERROR] ${message}`, meta ?? "");
    },
  };
}

/**
 * @wecon/core - Context
 *
 * Creates and manages the Wecon application context.
 * The context is passed to handlers, middleware, and hooks.
 */

import type { Application } from "express";
import type { Server } from "socket.io";
import type {
  WeconContext,
  ResolvedConfig,
  WeconLogger,
  WeconServices,
} from "./types.js";

/**
 * Default logger implementation (console-based)
 */
const defaultLogger: WeconLogger = {
  debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta ?? ""),
  info: (message, meta) => console.info(`[INFO] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta ?? ""),
};

/**
 * Create a Wecon application context
 *
 * @param options - Context options
 * @returns The application context
 */
export function createContext(options: {
  config: ResolvedConfig;
  app: Application;
  io?: Server;
  logger?: WeconLogger;
}): WeconContext {
  const services: WeconServices = {};

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
  };

  return ctx;
}

/**
 * Enhance the logger based on configuration
 *
 * @param config - The resolved configuration
 * @param customLogger - Optional custom logger implementation
 */
export function createLogger(
  config: ResolvedConfig,
  customLogger?: WeconLogger
): WeconLogger {
  if (customLogger) {
    return customLogger;
  }

  const level = config.logging.level ?? "info";
  const levels = ["debug", "info", "warn", "error"];
  const minLevel = levels.indexOf(level);

  const shouldLog = (logLevel: string) => levels.indexOf(logLevel) >= minLevel;

  return {
    debug: (message, meta) => {
      if (shouldLog("debug")) {
        console.debug(`[DEBUG] ${message}`, meta ?? "");
      }
    },
    info: (message, meta) => {
      if (shouldLog("info")) {
        console.info(`[INFO] ${message}`, meta ?? "");
      }
    },
    warn: (message, meta) => {
      if (shouldLog("warn")) {
        console.warn(`[WARN] ${message}`, meta ?? "");
      }
    },
    error: (message, meta) => {
      if (shouldLog("error")) {
        console.error(`[ERROR] ${message}`, meta ?? "");
      }
    },
  };
}

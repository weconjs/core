/**
 * @weconjs/core - Logger Factory
 *
 * Creates Winston-based loggers with optional file rotation.
 * This is the production-ready logger for Wecon applications.
 *
 * @example
 * ```typescript
 * import { createWinstonLogger } from '@weconjs/core';
 *
 * const logger = createWinstonLogger({
 *   level: 'debug',
 *   appName: 'my-app',
 *   enableFile: true,
 *   enableConsole: true,
 * });
 *
 * logger.info('Server started', { port: 3000 });
 * ```
 */

import type { WeconLogger } from "../types.js";

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Log level: 'debug' | 'info' | 'warn' | 'error'
   * @default 'info'
   */
  level?: "debug" | "info" | "warn" | "error";

  /**
   * Application name (used in log prefix)
   */
  appName?: string;

  /**
   * Enable console output
   * @default true
   */
  enableConsole?: boolean;

  /**
   * Enable file output with daily rotation
   * @default false
   */
  enableFile?: boolean;

  /**
   * Directory for log files
   * @default 'logs'
   */
  logDir?: string;

  /**
   * Max file size before rotation (e.g., '20m', '100m')
   * @default '20m'
   */
  maxSize?: string;

  /**
   * Max days to keep logs
   * @default '14d'
   */
  maxFiles?: string;

  /**
   * Use JSON format (for production/log aggregation)
   * @default false (uses pretty format)
   */
  jsonFormat?: boolean;
}

/**
 * Extended logger with Winston instance access
 */
export interface WinstonBasedLogger extends WeconLogger {
  /**
   * Access the underlying Winston logger (if available)
   * This is undefined when Winston is not installed
   */
  winston?: unknown;
}

/**
 * Create a production-ready Winston logger
 *
 * Falls back to console-based logger if winston is not installed.
 *
 * @param options - Logger configuration
 * @returns WeconLogger instance
 */
export async function createWinstonLogger(
  options: LoggerOptions = {}
): Promise<WinstonBasedLogger> {
  const {
    level = "info",
    appName = "wecon",
    enableConsole = true,
    enableFile = false,
    logDir = "logs",
    maxSize = "20m",
    maxFiles = "14d",
    jsonFormat = false,
  } = options;

  try {
    // Dynamic import to avoid bundling issues if winston is not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winston = await import("winston") as any;

    const { combine, timestamp, printf, json, errors, colorize } =
      winston.format;

    // Pretty format for development
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prettyFormat = printf(({ level, message, timestamp, stack, ...meta }: any) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      const logMessage = stack ? `${message}\n${stack}` : message;
      return `${timestamp} [${level.toUpperCase()}] [${appName}]: ${logMessage}${metaStr}`;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transports: any[] = [];

    // Console transport
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          handleExceptions: true,
          format: jsonFormat ? json() : combine(colorize(), prettyFormat),
        })
      );
    }

    // File transports with daily rotation
    if (enableFile) {
      try {
        // Dynamic import for winston-daily-rotate-file
        await import("winston-daily-rotate-file" as string);

        const DailyRotateFile = winston.transports.DailyRotateFile;

        // Application logs
        transports.push(
          new DailyRotateFile({
            filename: `${logDir}/app-%DATE%.log`,
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize,
            maxFiles,
            level: "info",
          })
        );

        // Error logs (separate file)
        transports.push(
          new DailyRotateFile({
            filename: `${logDir}/error-%DATE%.log`,
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize,
            maxFiles: "30d", // Keep error logs longer
            level: "error",
          })
        );
      } catch {
        console.warn(
          "[Wecon] winston-daily-rotate-file not installed. File logging disabled."
        );
      }
    }

    const winstonLogger = winston.createLogger({
      level,
      format: combine(
        errors({ stack: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        jsonFormat ? json() : prettyFormat
      ),
      transports,
      exitOnError: false,
    });

    // Return WeconLogger interface
    return {
      debug: (message, meta) => winstonLogger.debug(message, meta),
      info: (message, meta) => winstonLogger.info(message, meta),
      warn: (message, meta) => winstonLogger.warn(message, meta),
      error: (message, meta) => winstonLogger.error(message, meta),
      winston: winstonLogger,
    };
  } catch {
    // Winston not installed - fall back to console logger
    console.warn(
      "[Wecon] winston not installed. Using console-based logger."
    );
    return createConsoleLogger(options);
  }
}

/**
 * Create a simple console-based logger
 *
 * This is a fallback when Winston is not available.
 *
 * @param options - Logger configuration
 * @returns WeconLogger instance
 */
export function createConsoleLogger(options: LoggerOptions = {}): WinstonBasedLogger {
  const { level = "info", appName = "wecon" } = options;

  const levels = ["debug", "info", "warn", "error"];
  const minLevel = levels.indexOf(level);

  const shouldLog = (logLevel: string) => levels.indexOf(logLevel) >= minLevel;

  const formatMessage = (lvl: string, message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${lvl.toUpperCase()}] [${appName}]: ${message}${metaStr}`;
  };

  return {
    debug: (message, meta) => {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", message, meta));
      }
    },
    info: (message, meta) => {
      if (shouldLog("info")) {
        console.info(formatMessage("info", message, meta));
      }
    },
    warn: (message, meta) => {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", message, meta));
      }
    },
    error: (message, meta) => {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message, meta));
      }
    },
  };
}

/**
 * Default export for convenience
 */
export default { createWinstonLogger, createConsoleLogger };

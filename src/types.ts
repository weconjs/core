/**
 * @wecon/core - Core Types
 *
 * Type definitions for the Wecon framework configuration and modules.
 */

import type { Application, Request, Response, NextFunction } from "express";
import type { Server, Socket } from "socket.io";
import type { z } from "zod";

// =============================================================================
// APP CONFIGURATION
// =============================================================================

/**
 * App metadata configuration
 */
export interface AppConfig {
  name: string;
  version?: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  debug?: boolean;
  mongoose?: {
    protocol?: string;
    host?: string;
    port?: number;
    database?: string;
    auth?: {
      username?: string;
      password?: string;
    };
  };
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level?: "debug" | "info" | "warn" | "error";
  format?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
}

/**
 * HTTPS configuration
 */
export interface HttpsConfig {
  enabled?: boolean;
  port?: number;
  keyPath?: string;
  certPath?: string;
}

/**
 * Socket configuration
 */
export interface SocketConfig {
  enabled?: boolean;
  path?: string;
  cors?: {
    origin?: string | string[];
    methods?: string[];
    credentials?: boolean;
  };
}

/**
 * Feature flags configuration
 */
export interface FeaturesConfig {
  fieldShield?: {
    enabled?: boolean;
    strict?: boolean;
  };
  i18n?: {
    enabled?: boolean;
    defaultLocale?: string;
    supported?: string[];
  };
  swagger?: {
    enabled?: boolean;
    path?: string;
  };
  socket?: SocketConfig;
}

/**
 * Mode-specific configuration
 */
export interface ModeConfig {
  extends?: string;
  port?: number;
  database?: DatabaseConfig;
  logging?: LoggingConfig;
  https?: HttpsConfig;
  [key: string]: unknown;
}

/**
 * Lifecycle hooks
 */
export interface WeconHooks {
  onBoot?: (app: Application, ctx: WeconContext) => Promise<void> | void;
  onShutdown?: (ctx: WeconContext) => Promise<void> | void;
  onModuleInit?: (moduleName: string, ctx: WeconContext) => Promise<void> | void;
}

/**
 * Main Wecon configuration
 */
export interface WeconConfig {
  app: AppConfig;
  modes?: Record<string, ModeConfig>;
  modules?: string[];
  features?: FeaturesConfig;
  hooks?: WeconHooks;
}

/**
 * Resolved configuration (after mode merging)
 */
export interface ResolvedConfig {
  app: Required<AppConfig>;
  mode: string;
  port: number;
  database: DatabaseConfig;
  logging: LoggingConfig;
  https: HttpsConfig;
  features: FeaturesConfig;
  modules: string[];
}

// =============================================================================
// MODULE SYSTEM
// =============================================================================

/**
 * Module-specific configuration with Zod schema
 */
export interface ModuleConfigDefinition<T extends z.ZodType = z.ZodType> {
  schema: T;
  defaults?: Partial<z.infer<T>>;
}

/**
 * Module definition input
 */
export interface ModuleDefinition {
  name: string;
  namespace?: string;
  description?: string;
  config?: ModuleConfigDefinition;
  routes?: unknown; // Will be Routes from @wecon/core routing
  imports?: string[];
  exports?: string[];
  onInit?: (ctx: WeconContext) => Promise<void> | void;
  onDestroy?: (ctx: WeconContext) => Promise<void> | void;
}

/**
 * Registered module (with computed defaults)
 */
export interface WeconModule extends ModuleDefinition {
  namespace: string;
  description: string;
  socketHandlers?: SocketHandler[];
  socketMiddleware?: SocketMiddleware[];
}

// =============================================================================
// SOCKET SYSTEM
// =============================================================================

/**
 * Socket handler function signature
 */
export type SocketHandler = (socket: Socket, ctx: WeconContext) => void;

/**
 * Socket middleware function signature
 */
export type SocketMiddleware = (
  socket: Socket,
  next: (err?: Error) => void,
  ctx: WeconContext
) => void | Promise<void>;

// =============================================================================
// CONTEXT
// =============================================================================

/**
 * Logger interface
 */
export interface WeconLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Services container
 */
export interface WeconServices {
  [key: string]: unknown;
}

/**
 * Application context passed to handlers, middleware, and hooks
 */
export interface WeconContext {
  /** Resolved configuration */
  config: ResolvedConfig;

  /** Logger instance */
  logger: WeconLogger;

  /** Registered services */
  services: WeconServices;

  /** Express application */
  app: Application;

  /** Socket.IO server (if enabled) */
  io?: Server;

  /** Get a specific service */
  getService<T>(name: string): T | undefined;

  /** Register a service */
  registerService(name: string, service: unknown): void;
}

// =============================================================================
// AUTHENTICATION SYSTEM
// =============================================================================

/**
 * Base interface for all authenticable models.
 *
 * Any model that can be used for authentication (User, Admin, ServiceAccount, etc.)
 * must implement this interface.
 *
 * @example
 * ```typescript
 * interface User extends Authenticable {
 *   email: string;
 *   name: { first: string; last: string };
 * }
 *
 * interface Admin extends Authenticable {
 *   permissions: string[];
 *   department: string;
 * }
 * ```
 */
export interface Authenticable {
  /** Unique identifier (MongoDB ObjectId or string) */
  _id: unknown;

  /** Primary role of the user */
  role: string;

  /** All roles assigned to the user */
  roles: string[];

  /** Model name for role-agnostic auth (e.g., 'User', 'Admin') */
  __modelName?: string;
}

/**
 * Authentication configuration for features
 */
export interface AuthConfig {
  /** List of authenticable model names */
  authenticables?: string[];

  /** Default model to use for authentication */
  defaultModel?: string;

  /** JWT configuration */
  jwt?: {
    secret?: string;
    expiresIn?: number;
    algorithm?: string;
  };

  /** Session configuration */
  session?: {
    name?: string;
    maxAge?: number;
    secure?: boolean;
  };
}

// =============================================================================
// EXPRESS EXTENSIONS
// =============================================================================

/**
 * Extended Express Request with Wecon context and typed user.
 *
 * The `TUser` generic parameter allows type-safe access to the authenticated user.
 *
 * @example
 * ```typescript
 * // Single model
 * app.get('/profile', (req: WeconRequest<User>, res) => {
 *   req.user?.email; // ✅ TypeScript knows about email
 * });
 *
 * // Multiple models (union type)
 * type AuthUser = User | Admin;
 * app.get('/dashboard', (req: WeconRequest<AuthUser>, res) => {
 *   if (req.user && 'permissions' in req.user) {
 *     // It's an Admin
 *   }
 * });
 * ```
 */
export interface WeconRequest<TUser extends Authenticable = Authenticable>
  extends Request {
  /** Wecon application context */
  ctx: WeconContext;

  /** Authenticated user (typed based on TUser generic) */
  user?: TUser;

  /** i18n translation function */
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * Extended Express Response with helpers
 */
export interface WeconResponse extends Response {
  respond: (data: {
    data?: unknown;
    message?: string;
    status?: number;
    meta?: Record<string, unknown>;
  }) => void;
}

/**
 * Route handler type with generic user
 */
export type RouteHandler<TUser extends Authenticable = Authenticable> = (
  req: WeconRequest<TUser>,
  res: WeconResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Middleware type with generic user
 */
export type WeconMiddleware<TUser extends Authenticable = Authenticable> = (
  req: WeconRequest<TUser>,
  res: WeconResponse,
  next: NextFunction
) => void | Promise<void>;


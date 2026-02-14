/**
 * @wecon/core - Core Types
 *
 * Type definitions for the Wecon framework: config, modules, routing, and context.
 */

import type { Application, Request, Response, NextFunction, Handler, RequestHandler, CookieOptions } from "express";
import type { Server, Socket } from "socket.io";
import type { z } from "zod";
import type Route from "./routing/Route.js";
import type Routes from "./routing/Routes.js";
import type RoutesParam from "./routing/RoutesParam.js";

// =============================================================================
// ROUTING TYPES (merged from @weconjs/lib)
// =============================================================================

/**
 * Global namespace for role type augmentation.
 * Override Wecon.Roles in your project's wecon.d.ts to get type-safe roles.
 *
 * @example
 * ```typescript
 * declare global {
 *   namespace Wecon {
 *     type Roles = 'admin' | 'user' | 'guest';
 *   }
 * }
 * export {};
 * ```
 */
declare global {
  namespace Wecon {
    type Roles = string;
  }
}

/** Default role type — uses global Wecon.Roles override if available */
export type DefaultRole = Wecon.Roles;

/** Route Access Identifier — unique string key per endpoint */
export type RAI = string;

/** Route configuration input */
export interface RouteConfig<TRole extends string = DefaultRole> {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  middlewares: Handler[] | RequestHandler[] | any[];
  name?: string;
  description?: string;
  rai: RAI;
  roles: TRole[];
  meta?: Record<string, unknown>;
}

/** Routes group configuration input */
export interface RoutesConfig<TRole extends string = DefaultRole> {
  prefix?: string;
  routes: Array<Route<TRole> | Routes<TRole>>;
  params?: RoutesParam[];
  middlewares?: Handler[];
  mergeParams?: boolean;
  module?: string;
  meta?: Record<string, unknown>;
}

/** Error info for ErrorCatcher display */
export type ErrorInfoType = {
  title: string;
  details: string;
  fix: string;
};

/** Error map keyed by error code */
export type PossibleErrosType = Record<string, ErrorInfoType>;

/** Stack trace info captured at config time */
export type ErrorTraceType = {
  file: string;
  line: number;
  column: number;
  function?: string | null;
};

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
  /** Active mode name (defaults to NODE_ENV or 'development') */
  mode?: string;
  /** Server port */
  port?: number;
  /** Database configuration */
  database?: DatabaseConfig;
  /** Logging configuration */
  logging?: LoggingConfig;
  /** HTTPS configuration */
  https?: HttpsConfig;
  modules?: string[];
  features?: FeaturesConfig;
  hooks?: WeconHooks;
  /** Per-module configuration values (keyed by module name) */
  moduleConfigs?: Record<string, unknown>;
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
  /** Validated per-module configs (keyed by module name) */
  moduleConfigs: Record<string, unknown>;
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
  load?: () => unknown | Promise<unknown>;
}

/**
 * Module definition input
 */
export interface ModuleDefinition {
  name: string;
  namespace?: string;
  description?: string;
  /** Absolute path to the module directory (enables per-module package.json) */
  path?: string;
  config?: ModuleConfigDefinition;
  routes?: Routes;
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

  /** Get typed module config (throws if module not registered) */
  getModuleConfig<T>(moduleName: string): T;

  /** Update module config at runtime (validates against Zod schema if available) */
  setModuleConfig(moduleName: string, config: unknown): void;
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
    httpOnly?: boolean;
    secretKey?: string;
    cookie?: CookieOptions;
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


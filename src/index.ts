/**
 * @weconjs/core
 *
 * Core package for the Wecon framework.
 * Provides configuration, module system, routing, and runtime utilities.
 */

// Configuration
export { defineConfig, resolveConfig, loadConfig } from "./config.js";

// Module System
export {
  defineModule,
  loadModule,
  discoverSocketHandlers,
  discoverSocketMiddleware,
  resolveModuleDependencies,
} from "./module.js";

// Module Loader (per-module package.json support)
export {
  readModulePackageJson,
  checkModuleDeps,
  detectPackageManager,
  installModuleDeps,
  resolveAllModuleDeps,
} from "./module/index.js";
export type { ModulePackageJson, DepsCheckResult } from "./module/index.js";

// Context
export { createContext, createLogger } from "./context.js";

// Logger
export {
  createWinstonLogger,
  createConsoleLogger,
} from "./logger/index.js";
export type { LoggerOptions, WinstonBasedLogger } from "./logger/index.js";

// Server
export { createWecon } from "./server/index.js";
export type {
  CreateWeconOptions,
  WeconApp,
  ApiError,
  ApiResponse,
  RespondOptions,
} from "./server/index.js";

// Routing
export {
  Wecon,
  Route,
  Routes,
  RoutesParam,
  RaiMatcher,
  ErrorCatcher,
} from "./routing/index.js";
export type { WeconDevConfig, RaiRoutesList } from "./routing/index.js";

// Errors
export { ConfigError, RequestError } from "./errors/index.js";

// i18n
export { loadI18nResources, createI18nMiddleware, initI18n } from "./i18n/index.js";
export type { I18nResources } from "./i18n/index.js";

// Database
export {
  createDatabaseConnection,
  buildMongoUri,
  buildUriFromConfig,
} from "./database/index.js";
export type {
  DatabaseOptions,
  DatabaseConnection,
  MongoUriParts,
} from "./database/index.js";

// Socket.IO
export {
  createSocketServer,
  discoverSocketHandlers as discoverSocketHandlersFromModules,
  discoverSocketMiddleware as discoverSocketMiddlewareFromModules,
  initializeSocket,
  setupSocketIO,
} from "./socket/index.js";
export type {
  SocketServer,
  SocketInstance,
  SocketHandler as SocketHandlerFn,
  SocketMiddleware as SocketMiddlewareFn,
  DiscoveredSocketHandler,
  SocketOptions,
} from "./socket/index.js";

// DevTools
export { createDevToolsRouter } from "./devtools/index.js";
export type { DevToolsOptions } from "./devtools/index.js";

// Types
export type {
  // Routing types
  RouteConfig,
  RoutesConfig,
  RAI,
  DefaultRole,
  ErrorInfoType,
  ErrorTraceType,
  PossibleErrosType,

  // Config types
  WeconConfig,
  ResolvedConfig,
  AppConfig,
  DatabaseConfig,
  LoggingConfig,
  HttpsConfig,
  SocketConfig,
  FeaturesConfig,
  WeconHooks,

  // Module types
  ModuleDefinition,
  ModuleConfigDefinition,
  WeconModule,

  // Socket types
  SocketHandler,
  SocketMiddleware,

  // Context types
  WeconContext,
  WeconLogger,
  WeconServices,

  // Authentication types
  Authenticable,
  AuthConfig,

  // Express types
  WeconRequest,
  WeconResponse,
  RouteHandler,
  WeconMiddleware,
} from "./types.js";

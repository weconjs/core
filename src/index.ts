/**
 * @weconjs/core
 *
 * Core package for the Wecon framework.
 * Provides configuration, module system, and runtime utilities.
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

// Types
export type {
  // Config types
  WeconConfig,
  ResolvedConfig,
  AppConfig,
  DatabaseConfig,
  LoggingConfig,
  HttpsConfig,
  SocketConfig,
  FeaturesConfig,
  ModeConfig,
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


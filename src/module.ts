/**
 * @wecon/core - defineModule
 *
 * Creates a type-safe module definition for the Wecon framework.
 * Modules are self-contained units with routes, config, and lifecycle hooks.
 *
 * @example
 * ```typescript
 * import { defineModule } from '@wecon/core';
 * import { authRoutes } from './routes';
 * import { authConfig } from './auth.config';
 *
 * export default defineModule({
 *   name: 'auth',
 *   config: authConfig,
 *   routes: authRoutes,
 *   imports: ['users'],
 *   exports: ['AuthService', 'JwtService'],
 *   onInit: async (ctx) => {
 *     ctx.logger.info('Auth module initialized');
 *   },
 * });
 * ```
 */

import type {
  ModuleDefinition,
  WeconModule,
  SocketHandler,
  SocketMiddleware,
} from "./types.js";
import { glob } from "glob";
import { join, basename } from "path";

/**
 * Recursively set namespace in meta for all routes
 * This enables automatic i18n namespace detection.
 *
 * @param routes - Route or Routes instance
 * @param namespace - The module namespace
 */
function setNamespaceMeta(routes: unknown, namespace: string): void {
  if (!routes || typeof routes !== "object") return;

  const routeObj = routes as Record<string, unknown>;

  // Set namespace in meta
  if ("meta" in routeObj) {
    routeObj.meta = { ...(routeObj.meta as object), namespace };
  }

  // Recursively process child routes
  if ("routes" in routeObj && Array.isArray(routeObj.routes)) {
    for (const child of routeObj.routes) {
      setNamespaceMeta(child, namespace);
    }
  }
}

/**
 * Define a Wecon module
 *
 * @param definition - The module definition
 * @returns The validated module with computed defaults
 */
export function defineModule(definition: ModuleDefinition): WeconModule {
  // Validate required fields
  if (!definition.name) {
    throw new Error("[Wecon] Module name is required");
  }

  // Validate name format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z][a-z0-9-]*$/.test(definition.name)) {
    throw new Error(
      `[Wecon] Invalid module name "${definition.name}". Must be lowercase, start with a letter, and contain only alphanumeric characters and hyphens.`
    );
  }

  const namespace = definition.namespace ?? definition.name;

  // Inject namespace into all routes meta for i18n detection
  if (definition.routes) {
    setNamespaceMeta(definition.routes, namespace);
  }

  return {
    name: definition.name,
    namespace,
    description: definition.description ?? "",
    config: definition.config,
    routes: definition.routes,
    imports: definition.imports ?? [],
    exports: definition.exports ?? [],
    onInit: definition.onInit,
    onDestroy: definition.onDestroy,
    socketHandlers: [],
    socketMiddleware: [],
  };
}

/**
 * Discover socket handlers in a module directory
 *
 * Scans the module's `socket/` folder for `*.socket.ts` files and loads them.
 *
 * @param modulePath - Absolute path to the module directory
 * @returns Array of socket handler functions
 */
export async function discoverSocketHandlers(
  modulePath: string
): Promise<{ name: string; handler: SocketHandler }[]> {
  const socketDir = join(modulePath, "socket");
  const handlers: { name: string; handler: SocketHandler }[] = [];

  try {
    // Find all *.socket.ts files
    const files = await glob("*.socket.{ts,js}", {
      cwd: socketDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const module = await import(file);
        const handler = module.default;

        if (typeof handler !== "function") {
          console.warn(
            `[Wecon] Socket file ${basename(file)} must export a default function`
          );
          continue;
        }

        // Extract handler name from filename (e.g., "chat.socket.ts" -> "chat")
        const name = basename(file).replace(/\.socket\.(ts|js)$/, "");
        handlers.push({ name, handler });
      } catch (err) {
        console.error(`[Wecon] Failed to load socket handler ${file}:`, err);
      }
    }
  } catch {
    // Socket directory doesn't exist - that's fine
  }

  return handlers;
}

/**
 * Discover socket middleware in a module directory
 *
 * Loads `socket/socket.middleware.ts` if it exists.
 *
 * @param modulePath - Absolute path to the module directory
 * @returns Array of socket middleware functions
 */
export async function discoverSocketMiddleware(
  modulePath: string
): Promise<SocketMiddleware[]> {
  const middlewarePath = join(modulePath, "socket", "socket.middleware");

  try {
    // Try .ts first, then .js
    let module;
    try {
      module = await import(`${middlewarePath}.ts`);
    } catch {
      module = await import(`${middlewarePath}.js`);
    }

    const middleware = module.default;

    if (Array.isArray(middleware)) {
      return middleware.filter((m) => typeof m === "function");
    }

    if (typeof middleware === "function") {
      return [middleware];
    }

    console.warn(
      `[Wecon] socket.middleware.ts must export an array of middleware functions or a single function`
    );
    return [];
  } catch {
    // Middleware file doesn't exist - that's fine
    return [];
  }
}

/**
 * Load a module from a path and discover its socket handlers
 *
 * @param modulePath - Path to the module (can be relative or package name)
 * @param baseDir - Base directory for resolving relative paths
 */
export async function loadModule(
  modulePath: string,
  baseDir: string
): Promise<WeconModule> {
  let absolutePath: string;

  // Resolve the module path
  if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
    absolutePath = join(baseDir, modulePath);
  } else if (modulePath.startsWith("@wecon/")) {
    // Built-in module - resolve from node_modules
    absolutePath = join(baseDir, "node_modules", modulePath);
  } else {
    absolutePath = modulePath;
  }

  // Load the module definition
  const moduleFile = join(absolutePath, `${basename(absolutePath)}.module`);

  let module: WeconModule;

  try {
    // Try .ts first, then .js
    let moduleExport;
    try {
      moduleExport = await import(`${moduleFile}.ts`);
    } catch {
      moduleExport = await import(`${moduleFile}.js`);
    }

    module = moduleExport.default ?? moduleExport;
  } catch (err) {
    throw new Error(
      `[Wecon] Failed to load module from ${modulePath}: ${
        err instanceof Error ? err.message : err
      }`
    );
  }

  // Discover socket handlers and middleware
  const [socketHandlers, socketMiddleware] = await Promise.all([
    discoverSocketHandlers(absolutePath),
    discoverSocketMiddleware(absolutePath),
  ]);

  return {
    ...module,
    socketHandlers: socketHandlers.map((h) => h.handler),
    socketMiddleware,
  };
}

/**
 * Resolve module dependencies using topological sort
 *
 * @param modules - Map of module name to module
 * @returns Ordered array of modules (dependencies first)
 */
export function resolveModuleDependencies(
  modules: Map<string, WeconModule>
): WeconModule[] {
  const resolved: WeconModule[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (seen.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`[Wecon] Circular module dependency detected: ${name}`);
    }

    const module = modules.get(name);
    if (!module) {
      throw new Error(`[Wecon] Module "${name}" not found`);
    }

    visiting.add(name);

    // Visit dependencies first
    for (const dep of module.imports ?? []) {
      visit(dep);
    }

    visiting.delete(name);
    seen.add(name);
    resolved.push(module);
  }

  for (const name of modules.keys()) {
    visit(name);
  }

  return resolved;
}

/**
 * Resolve module configs by calling each module's load() function
 *
 * Iterates over all modules, calls their config.load() if present,
 * merges with defaults, and validates against the module's Zod schema.
 *
 * @param modules - Array or record of modules
 * @returns Record of validated module configs keyed by module name
 */
export async function resolveModuleConfigs(
  modules: WeconModule[] | Record<string, WeconModule>
): Promise<Record<string, unknown>> {
  const moduleList = Array.isArray(modules) ? modules : Object.values(modules);
  const configs: Record<string, unknown> = {};

  for (const mod of moduleList) {
    if (!mod.config?.schema) continue;

    const rawConfig = mod.config.load ? await mod.config.load() : {};
    const merged = { ...(mod.config.defaults ?? {}), ...(rawConfig as object) };
    const result = mod.config.schema.safeParse(merged);

    if (!result.success) {
      throw new Error(
        `[Wecon] Invalid config for module "${mod.name}": ${result.error.message}`
      );
    }

    configs[mod.name] = result.data;
  }

  return configs;
}

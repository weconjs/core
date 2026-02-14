/**
 * @wecon/core - defineConfig
 *
 * Creates a type-safe Wecon configuration object.
 * Supports feature flags, module configs, and lifecycle hooks.
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@wecon/core';
 *
 * export default defineConfig({
 *   app: { name: 'my-app', version: '1.0.0' },
 *   mode: 'development',
 *   port: 3001,
 *   database: { mongoose: { host: 'localhost', database: 'myapp' } },
 *   logging: { level: 'debug' },
 *   modules: ['./modules/auth', './modules/users'],
 *   features: {
 *     socket: { enabled: true },
 *   },
 * });
 * ```
 */

import type { WeconConfig, ResolvedConfig } from "./types.js";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ResolvedConfig> = {
  port: 3001,
  database: {
    debug: false,
    mongoose: {
      protocol: "mongodb",
      host: "localhost",
      port: 27017,
      database: "wecon-dev",
    },
  },
  logging: {
    level: "info",
    enableConsole: true,
    enableFile: false,
  },
  https: {
    enabled: false,
  },
  features: {
    i18n: { enabled: true, defaultLocale: "en" },
    swagger: { enabled: false },
    socket: { enabled: false },
  },
  modules: [],
};

/**
 * Define a Wecon configuration
 *
 * @param config - The configuration object
 * @returns The validated configuration
 */
export function defineConfig(config: WeconConfig): WeconConfig {
  // Validate required fields
  if (!config.app?.name) {
    throw new Error("[Wecon] app.name is required in wecon.config.ts");
  }

  // Return the config (validation happens at resolve time)
  return {
    app: {
      name: config.app.name,
      version: config.app.version ?? "1.0.0",
    },
    mode: config.mode,
    port: config.port,
    database: config.database,
    logging: config.logging,
    https: config.https,
    modules: config.modules ?? [],
    features: config.features ?? {},
    hooks: config.hooks ?? {},
    moduleConfigs: config.moduleConfigs ?? {},
  };
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Resolve configuration by merging defaults with user-provided values
 *
 * @param config - The Wecon configuration
 * @param mode - Optional mode override
 * @returns The fully resolved configuration
 */
export function resolveConfig(
  config: WeconConfig,
  mode?: string
): ResolvedConfig {
  const targetMode = mode ?? config.mode ?? process.env.NODE_ENV ?? "development";

  // Start with defaults
  let resolved: ResolvedConfig = {
    app: {
      name: config.app.name,
      version: config.app.version ?? "1.0.0",
    },
    mode: targetMode,
    port: DEFAULT_CONFIG.port!,
    database: { ...DEFAULT_CONFIG.database },
    logging: { ...DEFAULT_CONFIG.logging },
    https: { ...DEFAULT_CONFIG.https },
    features: { ...DEFAULT_CONFIG.features },
    modules: [...(config.modules ?? [])],
    moduleConfigs: { ...(config.moduleConfigs ?? {}) },
  };

  // Merge user-provided flat config over defaults
  resolved = deepMerge(resolved, {
    port: config.port,
    database: config.database,
    logging: config.logging,
    https: config.https,
  } as Partial<ResolvedConfig>);

  // Merge features
  if (config.features) {
    resolved.features = deepMerge(resolved.features, config.features);
  }

  return resolved;
}

/**
 * Load and resolve configuration from a file path
 *
 * @param configPath - Path to wecon.config.ts
 * @param mode - Optional mode override
 */
export async function loadConfig(
  configPath: string,
  mode?: string
): Promise<ResolvedConfig> {
  try {
    const configModule = await import(configPath);
    const config: WeconConfig = configModule.default ?? configModule;

    return resolveConfig(config, mode);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`[Wecon] Configuration file not found: ${configPath}`);
    }
    throw error;
  }
}

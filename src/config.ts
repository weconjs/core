/**
 * @wecon/core - defineConfig
 *
 * Creates a type-safe Wecon configuration object.
 * Supports mode inheritance, feature flags, and lifecycle hooks.
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@wecon/core';
 *
 * export default defineConfig({
 *   app: { name: 'my-app', version: '1.0.0' },
 *   modes: {
 *     development: { port: 3001, logging: { level: 'debug' } },
 *     production: { port: 8080, logging: { level: 'warn' } },
 *   },
 *   modules: ['./modules/auth', './modules/users'],
 *   features: {
 *     socket: { enabled: true },
 *     fieldShield: { enabled: true, strict: true },
 *   },
 * });
 * ```
 */

import type { WeconConfig, ResolvedConfig, ModeConfig } from "./types.js";

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
    fieldShield: { enabled: false, strict: false },
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
    modes: config.modes ?? {},
    modules: config.modules ?? [],
    features: config.features ?? {},
    hooks: config.hooks ?? {},
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
 * Resolve a mode configuration with inheritance
 *
 * @param modes - All mode configurations
 * @param modeName - The mode to resolve
 * @param visited - Set of visited modes (for circular detection)
 */
function resolveMode(
  modes: Record<string, ModeConfig>,
  modeName: string,
  visited: Set<string> = new Set()
): ModeConfig {
  if (visited.has(modeName)) {
    throw new Error(
      `[Wecon] Circular mode inheritance detected: ${Array.from(visited).join(
        " -> "
      )} -> ${modeName}`
    );
  }

  const mode = modes[modeName];
  if (!mode) {
    throw new Error(`[Wecon] Mode "${modeName}" not found in configuration`);
  }

  visited.add(modeName);

  // If this mode extends another, resolve the parent first
  if (mode.extends) {
    const parentMode = resolveMode(modes, mode.extends, visited);
    const { extends: _, ...modeWithoutExtends } = mode;
    return deepMerge(parentMode, modeWithoutExtends as Partial<ModeConfig>);
  }

  return mode;
}

/**
 * Resolve configuration for a specific mode
 *
 * @param config - The Wecon configuration
 * @param mode - The mode to resolve (defaults to NODE_ENV or 'development')
 * @returns The fully resolved configuration
 */
export function resolveConfig(
  config: WeconConfig,
  mode?: string
): ResolvedConfig {
  const targetMode = mode ?? process.env.NODE_ENV ?? "development";

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
  };

  // Apply mode-specific configuration if defined
  if (config.modes && config.modes[targetMode]) {
    const modeConfig = resolveMode(config.modes, targetMode);

    resolved = deepMerge(resolved, {
      port: modeConfig.port,
      database: modeConfig.database,
      logging: modeConfig.logging,
      https: modeConfig.https,
    } as Partial<ResolvedConfig>);
  }

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

/**
 * @wecon/core - Module Loader
 *
 * Reads per-module package.json files and manages module-specific dependencies.
 * Supports auto-installation of missing deps in development mode.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import type { WeconLogger } from "../types.js";

/**
 * Parsed module package.json
 */
export interface ModulePackageJson {
  name?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Result of checking module dependencies
 */
export interface DepsCheckResult {
  moduleName: string;
  modulePath: string;
  /** Dependencies declared in module package.json */
  declared: Record<string, string>;
  /** Dependencies missing from root node_modules */
  missing: string[];
  /** Dependencies already installed */
  installed: string[];
}

/**
 * Read a module's package.json if it exists
 */
export function readModulePackageJson(modulePath: string): ModulePackageJson | null {
  const pkgPath = join(modulePath, "package.json");

  if (!existsSync(pkgPath)) {
    return null;
  }

  try {
    const raw = readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as ModulePackageJson;
  } catch {
    return null;
  }
}

/**
 * Check which module dependencies are missing from root node_modules
 */
export function checkModuleDeps(
  modulePath: string,
  rootDir: string,
  moduleName: string
): DepsCheckResult {
  const pkg = readModulePackageJson(modulePath);
  const declared = pkg?.dependencies ?? {};
  const missing: string[] = [];
  const installed: string[] = [];

  const nodeModulesDir = join(rootDir, "node_modules");

  for (const dep of Object.keys(declared)) {
    // Check if the package exists in root node_modules
    const depPath = join(nodeModulesDir, dep);
    if (existsSync(depPath)) {
      installed.push(dep);
    } else {
      missing.push(dep);
    }
  }

  return { moduleName, modulePath, declared, missing, installed };
}

/**
 * Detect which package manager is being used in the project
 */
export function detectPackageManager(rootDir: string): "npm" | "yarn" | "pnpm" {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  return "npm";
}

/**
 * Install missing module dependencies into the root project
 */
export function installModuleDeps(
  missing: string[],
  declared: Record<string, string>,
  rootDir: string,
  logger: WeconLogger
): boolean {
  if (missing.length === 0) return true;

  const pm = detectPackageManager(rootDir);

  // Build install args with version specifiers
  const packages = missing.map((name) => {
    const version = declared[name];
    return version ? `${name}@${version}` : name;
  });

  const installCmd =
    pm === "yarn"
      ? `yarn add ${packages.join(" ")}`
      : pm === "pnpm"
        ? `pnpm add ${packages.join(" ")}`
        : `npm install ${packages.join(" ")}`;

  logger.info(`Installing module dependencies: ${missing.join(", ")}`);

  try {
    execSync(installCmd, { cwd: rootDir, stdio: "pipe" });
    logger.info(`Dependencies installed successfully`);
    return true;
  } catch (err) {
    logger.error("Failed to install module dependencies", {
      error: (err as Error).message,
      packages: missing,
    });
    return false;
  }
}

/**
 * Check and optionally install all module dependencies.
 * Called during createWecon bootstrap.
 *
 * @param modules - Array of { name, path } for each module
 * @param rootDir - Root project directory (where node_modules lives)
 * @param logger - Logger instance
 * @param autoInstall - Whether to auto-install missing deps
 * @returns Array of check results
 */
export async function resolveAllModuleDeps(
  modules: Array<{ name: string; path: string }>,
  rootDir: string,
  logger: WeconLogger,
  autoInstall: boolean = false
): Promise<DepsCheckResult[]> {
  const results: DepsCheckResult[] = [];
  const allMissing: string[] = [];
  const allDeclared: Record<string, string> = {};

  for (const mod of modules) {
    const absolutePath = resolve(rootDir, mod.path);
    const result = checkModuleDeps(absolutePath, rootDir, mod.name);
    results.push(result);

    if (result.missing.length > 0) {
      logger.warn(`Module "${mod.name}" has missing dependencies: ${result.missing.join(", ")}`);
      allMissing.push(...result.missing);
      Object.assign(allDeclared, result.declared);
    }
  }

  // Deduplicate and install all at once
  if (autoInstall && allMissing.length > 0) {
    const unique = [...new Set(allMissing)];
    installModuleDeps(unique, allDeclared, rootDir, logger);
  }

  return results;
}

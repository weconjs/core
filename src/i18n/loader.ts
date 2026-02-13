/**
 * @weconjs/core - i18n Resource Loader
 *
 * Discovers and loads translation files from module i18n/ directories.
 * Output format matches i18next: { [lang]: { [namespace]: translations } }
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { glob } from "glob";

/**
 * i18n resource structure (i18next-compatible)
 *
 * Format: `{ [language]: { [namespace]: Record<string, unknown> } }`
 */
export interface I18nResources {
  [language: string]: {
    [namespace: string]: Record<string, unknown>;
  };
}

/**
 * i18n Resource Loader
 *
 * Scans module directories for `i18n/*.translation.json` files
 * and builds a resource map keyed by language and namespace.
 *
 * @example
 * ```typescript
 * const loader = new I18nLoader("./src/modules");
 * const resources = loader.loadAll();
 * // { en: { auth: { ... }, users: { ... } }, fr: { auth: { ... } } }
 * ```
 */
export class I18nLoader {
  private resources: I18nResources = {};
  private modulesDir: string;

  constructor(modulesDir: string) {
    this.modulesDir = modulesDir;
  }

  /**
   * Load translations from a specific directory into a namespace
   */
  private loadTranslationsFromDir(dir: string, namespace: string): void {
    if (!existsSync(dir)) return;

    const files = readdirSync(dir).filter((f) =>
      f.endsWith(".translation.json")
    );

    for (const file of files) {
      const lang = file.split(".")[0];
      const filePath = join(dir, file);

      try {
        const content = JSON.parse(readFileSync(filePath, "utf-8"));

        if (!this.resources[lang]) {
          this.resources[lang] = {};
        }

        this.resources[lang][namespace] = content;
      } catch (err) {
        console.warn(
          `[Wecon] Failed to load translation file ${filePath}:`,
          err
        );
      }
    }
  }

  /**
   * Load all translations from the modules directory
   *
   * Discovers module directories and scans each for an `i18n/` subdirectory
   * containing `*.translation.json` files.
   */
  loadAll(): I18nResources {
    this.resources = {};

    if (!existsSync(this.modulesDir)) {
      console.warn(`[Wecon] Modules directory not found: ${this.modulesDir}`);
      return this.resources;
    }

    // Scan each subdirectory in modulesDir for i18n/ folders
    const entries = readdirSync(this.modulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const i18nDir = join(this.modulesDir, entry.name, "i18n");
      this.loadTranslationsFromDir(i18nDir, entry.name);
    }

    return this.resources;
  }

  /**
   * Get the loaded resources
   */
  getResources(): I18nResources {
    return this.resources;
  }

  /**
   * Get all supported languages discovered from translation files
   */
  getSupportedLanguages(): string[] {
    return Object.keys(this.resources);
  }

  /**
   * Get all namespaces discovered from module directories
   */
  getNamespaces(): string[] {
    const ns = new Set<string>();
    for (const lang of Object.keys(this.resources)) {
      for (const namespace of Object.keys(this.resources[lang])) {
        ns.add(namespace);
      }
    }
    return Array.from(ns);
  }
}

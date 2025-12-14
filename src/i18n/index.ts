/**
 * @weconjs/core - i18n Loader
 *
 * Auto-discovers and loads translation files from module i18n/ directories.
 */

import { glob } from "glob";
import { join, basename, dirname } from "path";
import { readFileSync } from "fs";

/**
 * i18n resource structure
 */
export interface I18nResources {
  [namespace: string]: {
    [language: string]: Record<string, any>;
  };
}

/**
 * Load translations from all module i18n directories
 *
 * @param modulesDir - Path to the modules directory
 * @returns Loaded translation resources
 */
export async function loadI18nResources(modulesDir: string): Promise<I18nResources> {
  const resources: I18nResources = {};

  try {
    // Find all translation files
    const files = await glob("**/i18n/*.translation.json", {
      cwd: modulesDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        // Extract module name and language
        // e.g., auth/i18n/en.translation.json -> namespace: auth, lang: en
        const fileName = basename(file); // en.translation.json
        const language = fileName.replace(".translation.json", "");
        const moduleDir = dirname(dirname(file)); // auth/
        const namespace = basename(moduleDir);

        // Load translation file
        const content = readFileSync(file, "utf-8");
        const translations = JSON.parse(content);

        // Add to resources
        if (!resources[namespace]) {
          resources[namespace] = {};
        }
        resources[namespace][language] = translations;
      } catch (err) {
        console.warn(`[Wecon] Failed to load translation file ${file}:`, err);
      }
    }
  } catch (err) {
    console.warn("[Wecon] Failed to discover translation files:", err);
  }

  return resources;
}

/**
 * Create i18n middleware for Express
 *
 * @param resources - Loaded translation resources
 * @param defaultLanguage - Default language code
 * @returns Express middleware function
 */
export function createI18nMiddleware(
  resources: I18nResources,
  defaultLanguage: string = "en"
) {
  return (req: any, res: any, next: any) => {
    // Get language from header or query
    const lang = 
      req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ||
      req.query.lang ||
      defaultLanguage;

    // Add translation function to request
    req.t = (key: string, options?: Record<string, any>) => {
      const [namespace, ...keyParts] = key.split(".");
      const actualKey = keyParts.join(".");

      const translations = resources[namespace]?.[lang] || resources[namespace]?.[defaultLanguage];
      if (!translations) {
        return key; // Return key if no translations found
      }

      let value = translations;
      for (const part of actualKey.split(".")) {
        value = value?.[part];
      }

      if (typeof value !== "string") {
        return key;
      }

      // Simple interpolation
      if (options) {
        return (value as string).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(options[k] ?? `{{${k}}}`));
      }

      return value;
    };

    next();
  };
}

/**
 * Initialize i18n for a Wecon application
 *
 * @param modulesDir - Path to modules directory
 * @param defaultLanguage - Default language
 * @returns Express middleware
 */
export async function initI18n(modulesDir: string, defaultLanguage: string = "en") {
  const resources = await loadI18nResources(modulesDir);
  return createI18nMiddleware(resources, defaultLanguage);
}

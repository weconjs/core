/**
 * @weconjs/core - i18n Middleware
 *
 * Initializes i18next with module-based translations and provides
 * namespace-scoped translation middleware for Express routes.
 */

import i18next from "i18next";
import * as i18nextMiddleware from "i18next-http-middleware";
import type { Request, Response, NextFunction, Handler } from "express";
import { I18nLoader } from "./loader.js";

/**
 * Initialize i18next with translations discovered from module directories
 *
 * @param modulesDir - Path to the modules directory
 * @param fallbackLng - Default/fallback language code
 * @returns Express middleware that attaches `req.i18n` and `req.t`
 */
export async function initializeI18n(
  modulesDir: string,
  fallbackLng: string = "en"
): Promise<Handler> {
  const loader = new I18nLoader(modulesDir);
  const resources = loader.loadAll();

  const namespaces = loader.getNamespaces();
  const languages = loader.getSupportedLanguages();

  await i18next.use(i18nextMiddleware.LanguageDetector).init({
    resources,
    fallbackLng,
    preload: languages.length > 0 ? languages : [fallbackLng],
    ns: namespaces,
    defaultNS: "core",
    detection: {
      order: ["header", "querystring", "cookie"],
      lookupHeader: "accept-language",
      lookupQuerystring: "lang",
      lookupCookie: "i18next",
    },
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });

  return i18nextMiddleware.handle(i18next);
}

/**
 * Namespace middleware for i18n
 *
 * Sets `req.t` to a fixed translation function scoped to the route's
 * module namespace (with "core" as fallback).
 *
 * Reads namespace from `req.route_instance?.meta?.namespace`, which is
 * set automatically by `defineModule()`.
 *
 * @example
 * ```typescript
 * // In a controller within the "auth" module:
 * req.t("login.success")           // Uses "auth" namespace
 * req.t("core:errors.NOT_FOUND")   // Explicit "core" namespace
 * ```
 */
export function i18nNamespaceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.i18n) {
    return next();
  }

  const language = req.i18n.language || "en";
  const namespace =
    (req.route_instance?.meta?.namespace as string) || "core";

  // Fixed translation function with module namespace as primary, core as fallback
  req.t = req.i18n.getFixedT(language, [namespace, "core"]);

  next();
}

/**
 * Get the i18next instance
 */
export function getI18n() {
  return i18next;
}

export { i18next };

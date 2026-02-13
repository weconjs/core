/**
 * @weconjs/core - i18n Utilities
 *
 * Helper functions for working with translations in controllers and services.
 */

import type { Request } from "express";

/**
 * Create a translation function from a request object
 *
 * Returns `req.t` if i18n is initialized, otherwise returns
 * a fallback that echoes the key.
 *
 * @example
 * ```typescript
 * const t = translate(req);
 * const message = t("auth:login.success");
 * const error = t("core:errors.UNAUTHORIZED");
 * ```
 */
export function translate(req: Request) {
  return (key: string, options?: Record<string, unknown>) => {
    if (req.t) {
      return req.t(key, options);
    }
    return key;
  };
}

/**
 * Get the current language from the request
 *
 * @returns The detected language code, or "en" as fallback
 */
export function getCurrentLanguage(req: Request): string {
  if (req.i18n) {
    return req.i18n.language;
  }
  return "en";
}

/**
 * Change the language for the current request
 */
export function changeLanguage(req: Request, language: string): void {
  if (req.i18n) {
    req.i18n.changeLanguage(language);
  }
}

/**
 * @weconjs/core - i18n Module
 *
 * Module-based translation system built on i18next.
 * Auto-discovers translations from module i18n/ directories.
 *
 * Usage in controllers:
 *   req.t("auth:login.success")     // auth module namespace
 *   req.t("users:notFound")         // users module namespace
 *   req.t("core:errors.NOT_FOUND")  // core namespace (always available)
 */

// Loader
export { I18nLoader } from "./loader.js";
export type { I18nResources } from "./loader.js";

// Middleware
export {
  initializeI18n,
  i18nNamespaceMiddleware,
  getI18n,
  i18next,
} from "./middleware.js";

// Utilities
export { translate, getCurrentLanguage, changeLanguage } from "./utils.js";

/**
 * Backward-compatible alias for `initializeI18n`
 */
export { initializeI18n as initI18n } from "./middleware.js";

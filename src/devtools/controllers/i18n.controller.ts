/**
 * @wecon/core - DevTools i18n Controller
 *
 * List namespaces, read and update translations.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Request, Response } from "express";
import type { DevToolsContext } from "../types.js";
import { loadI18nResources } from "../../i18n/index.js";

/**
 * GET /i18n - List all namespaces with languages and key counts
 */
export function listNamespaces(dtCtx: DevToolsContext, modulesDir: string) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const resources = await loadI18nResources(modulesDir);

      const namespaces = Object.entries(resources).map(([namespace, langs]) => ({
        namespace,
        languages: Object.keys(langs),
        keyCounts: Object.fromEntries(
          Object.entries(langs).map(([lang, translations]) => [
            lang,
            Object.keys(translations).length,
          ])
        ),
      }));

      res.json({ success: true, data: namespaces });
    } catch (err) {
      res.status(500).json({
        success: false,
        errors: [{ code: "I18N_ERROR", message: (err as Error).message }],
      });
    }
  };
}

/**
 * GET /i18n/:namespace/:lang - Get translations for namespace + language
 */
export function getTranslations(dtCtx: DevToolsContext, modulesDir: string) {
  return (req: Request, res: Response): void => {
    const { namespace, lang } = req.params;
    const filePath = join(modulesDir, namespace, "i18n", `${lang}.translation.json`);

    if (!existsSync(filePath)) {
      res.status(404).json({
        success: false,
        errors: [{
          code: "NOT_FOUND",
          message: `Translation file not found: ${namespace}/${lang}`,
        }],
      });
      return;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const translations = JSON.parse(content);
      res.json({ success: true, data: { namespace, lang, translations } });
    } catch (err) {
      res.status(500).json({
        success: false,
        errors: [{ code: "PARSE_ERROR", message: (err as Error).message }],
      });
    }
  };
}

/**
 * PUT /i18n/:namespace/:lang - Update translations
 *
 * Body: the full translations object
 */
export function updateTranslations(dtCtx: DevToolsContext, modulesDir: string) {
  return (req: Request, res: Response): void => {
    const { namespace, lang } = req.params;
    const filePath = join(modulesDir, namespace, "i18n", `${lang}.translation.json`);

    try {
      // Ensure directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write formatted JSON
      const content = JSON.stringify(req.body, null, 2);
      writeFileSync(filePath, content + "\n", "utf-8");

      dtCtx.ctx.logger.info(`Translations updated: ${namespace}/${lang}`);
      res.json({ success: true, data: { namespace, lang, translations: req.body } });
    } catch (err) {
      res.status(500).json({
        success: false,
        errors: [{ code: "WRITE_ERROR", message: (err as Error).message }],
      });
    }
  };
}

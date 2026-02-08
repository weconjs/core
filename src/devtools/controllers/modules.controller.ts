/**
 * @wecon/core - DevTools Modules Controller
 *
 * List and inspect registered modules.
 */

import type { Request, Response } from "express";
import type { DevToolsContext, ModuleSummary, ModuleDetail } from "../types.js";

/**
 * GET /modules - List all modules
 */
export function listModules(dtCtx: DevToolsContext) {
  return (_req: Request, res: Response): void => {
    const summaries: ModuleSummary[] = dtCtx.modules.map((mod) => ({
      name: mod.name,
      namespace: mod.namespace,
      description: mod.description,
      hasConfig: !!mod.config?.schema,
      hasRoutes: !!mod.routes,
      imports: mod.imports ?? [],
      exports: mod.exports ?? [],
    }));

    res.json({ success: true, data: summaries });
  };
}

/**
 * GET /modules/:name - Get module detail
 */
export function getModule(dtCtx: DevToolsContext) {
  return (req: Request, res: Response): void => {
    const { name } = req.params;
    const mod = dtCtx.modules.find((m) => m.name === name);

    if (!mod) {
      res.status(404).json({
        success: false,
        errors: [{ code: "NOT_FOUND", message: `Module "${name}" not found` }],
      });
      return;
    }

    // Get current config if available
    let currentConfig: unknown = null;
    try {
      currentConfig = dtCtx.ctx.getModuleConfig(name);
    } catch {
      // Module has no config
    }

    // Describe schema if available
    let schemaDescription: string | null = null;
    if (mod.config?.schema) {
      try {
        // Zod schemas have a .describe() or ._def we can inspect
        const def = (mod.config.schema as unknown as Record<string, unknown>)._def;
        schemaDescription = def ? JSON.stringify(def, null, 2) : null;
      } catch {
        schemaDescription = null;
      }
    }

    const detail: ModuleDetail = {
      name: mod.name,
      namespace: mod.namespace,
      description: mod.description,
      hasConfig: !!mod.config?.schema,
      hasRoutes: !!mod.routes,
      imports: mod.imports ?? [],
      exports: mod.exports ?? [],
      config: {
        schema: schemaDescription,
        current: currentConfig,
      },
    };

    res.json({ success: true, data: detail });
  };
}

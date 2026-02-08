/**
 * @wecon/core - DevTools Config Controller
 *
 * Read and update global config and per-module config.
 */

import type { Request, Response } from "express";
import type { DevToolsContext } from "../types.js";

/**
 * GET /config - Get full resolved config
 */
export function getConfig(dtCtx: DevToolsContext) {
  return (_req: Request, res: Response): void => {
    // Return a sanitized copy (exclude sensitive fields)
    const config = { ...dtCtx.ctx.config };
    res.json({ success: true, data: config });
  };
}

/**
 * PUT /config - Update global config values (dot-path notation)
 *
 * Body: { "path": "logging.level", "value": "debug" }
 */
export function updateConfig(dtCtx: DevToolsContext) {
  return (req: Request, res: Response): void => {
    const { path, value } = req.body as { path?: string; value?: unknown };

    if (!path || typeof path !== "string") {
      res.status(400).json({
        success: false,
        errors: [{ code: "INVALID_INPUT", message: "\"path\" is required (dot notation)" }],
      });
      return;
    }

    // Prevent updating immutable fields
    const immutable = ["app.name", "mode"];
    if (immutable.includes(path)) {
      res.status(400).json({
        success: false,
        errors: [{ code: "IMMUTABLE", message: `Cannot update "${path}" at runtime` }],
      });
      return;
    }

    // Navigate to the target and set value
    const parts = path.split(".");
    let target: Record<string, unknown> = dtCtx.ctx.config as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (target[part] === undefined || typeof target[part] !== "object") {
        res.status(400).json({
          success: false,
          errors: [{ code: "INVALID_PATH", message: `Path "${path}" is invalid at "${part}"` }],
        });
        return;
      }
      target = target[part] as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1];
    target[lastKey] = value;

    dtCtx.ctx.logger.info(`Config updated: ${path}`, { value });

    res.json({ success: true, data: { path, value } });
  };
}

/**
 * GET /config/:moduleName - Get module config and schema info
 */
export function getModuleConfig(dtCtx: DevToolsContext) {
  return (req: Request, res: Response): void => {
    const { moduleName } = req.params;

    try {
      const config = dtCtx.ctx.getModuleConfig(moduleName);
      res.json({ success: true, data: { moduleName, config } });
    } catch (err) {
      res.status(404).json({
        success: false,
        errors: [{ code: "NOT_FOUND", message: (err as Error).message }],
      });
    }
  };
}

/**
 * PUT /config/:moduleName - Update module config (Zod-validated)
 *
 * Body: the full new config object
 */
export function updateModuleConfig(dtCtx: DevToolsContext) {
  return (req: Request, res: Response): void => {
    const { moduleName } = req.params;

    try {
      dtCtx.ctx.setModuleConfig(moduleName, req.body);
      const updated = dtCtx.ctx.getModuleConfig(moduleName);
      dtCtx.ctx.logger.info(`Module config updated: ${moduleName}`);
      res.json({ success: true, data: { moduleName, config: updated } });
    } catch (err) {
      res.status(400).json({
        success: false,
        errors: [{ code: "VALIDATION_ERROR", message: (err as Error).message }],
      });
    }
  };
}

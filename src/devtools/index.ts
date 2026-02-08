/**
 * @wecon/core - DevTools Module
 *
 * REST API for inspecting and managing modules, config, i18n, and routes.
 * Includes a built-in web UI served at /ui.
 * Disabled in production by default.
 *
 * @example
 * ```typescript
 * const app = await createWecon({
 *   config,
 *   modules: [authModule],
 *   devtools: {
 *     enabled: true,
 *     auth: { token: process.env.DEVTOOLS_TOKEN },
 *   },
 * });
 * ```
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import type { Router, Request, Response } from "express";
import type { WeconContext, WeconModule } from "../types.js";
import type Wecon from "../routing/Wecon.js";
import type { DevToolsOptions, DevToolsContext } from "./types.js";
import { createDevToolsAuth } from "./middleware.js";
import { listModules, getModule } from "./controllers/modules.controller.js";
import { getConfig, updateConfig, getModuleConfig, updateModuleConfig } from "./controllers/config.controller.js";
import { listNamespaces, getTranslations, updateTranslations } from "./controllers/i18n.controller.js";
import { listRoutes } from "./controllers/routes.controller.js";

export type { DevToolsOptions } from "./types.js";

/**
 * Resolve the path to the built-in client UI directory.
 * Falls back gracefully if the client build is not present.
 */
function resolveClientDir(): string | null {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const clientDir = path.resolve(__dirname, "client");
    if (fs.existsSync(clientDir) && fs.existsSync(path.join(clientDir, "index.html"))) {
      return clientDir;
    }
  } catch {
    // fallback for CJS environments
  }
  return null;
}

/**
 * Create the devtools Express Router
 */
export function createDevToolsRouter(
  ctx: WeconContext,
  modules: WeconModule[],
  options: DevToolsOptions = {},
  wecon?: Wecon
): Router | null {
  // Check if devtools should be enabled
  const isProduction = ctx.config.mode === "production";
  const enabled = options.enabled ?? !isProduction;

  if (!enabled) {
    ctx.logger.debug("DevTools disabled");
    return null;
  }

  // Dynamic import express to get Router
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express");
  const router: Router = express.Router();

  const dtCtx: DevToolsContext = { ctx, modules };
  const modulesDir = options.modulesDir ?? "./src/modules";

  // Optional bearer token auth
  if (options.auth?.token) {
    router.use(createDevToolsAuth(options.auth.token));
  }

  // -- API endpoints --
  router.get("/modules", listModules(dtCtx));
  router.get("/modules/:name", getModule(dtCtx));
  router.get("/config", getConfig(dtCtx));
  router.put("/config", updateConfig(dtCtx));
  router.get("/config/:moduleName", getModuleConfig(dtCtx));
  router.put("/config/:moduleName", updateModuleConfig(dtCtx));
  router.get("/i18n", listNamespaces(dtCtx, modulesDir));
  router.get("/i18n/:namespace/:lang", getTranslations(dtCtx, modulesDir));
  router.put("/i18n/:namespace/:lang", updateTranslations(dtCtx, modulesDir));
  router.get("/routes", listRoutes(dtCtx, wecon));

  // -- Built-in Web UI --
  const clientDir = resolveClientDir();
  if (clientDir) {
    // Serve static assets
    router.use("/ui", express.static(clientDir));

    // SPA fallback: serve index.html for any /ui sub-routes that aren't static files
    router.use("/ui", (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });

    // DevTools with UI - shown in startup banner
  } else {
    // DevTools API only - shown in startup banner
  }

  return router;
}

/**
 * @wecon/core - DevTools Module
 *
 * REST API for inspecting and managing modules, config, i18n, and routes.
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

import type { Router } from "express";
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

  // -- Module endpoints --
  router.get("/modules", listModules(dtCtx));
  router.get("/modules/:name", getModule(dtCtx));

  // -- Config endpoints --
  router.get("/config", getConfig(dtCtx));
  router.put("/config", updateConfig(dtCtx));
  router.get("/config/:moduleName", getModuleConfig(dtCtx));
  router.put("/config/:moduleName", updateModuleConfig(dtCtx));

  // -- i18n endpoints --
  router.get("/i18n", listNamespaces(dtCtx, modulesDir));
  router.get("/i18n/:namespace/:lang", getTranslations(dtCtx, modulesDir));
  router.put("/i18n/:namespace/:lang", updateTranslations(dtCtx, modulesDir));

  // -- Routes endpoint --
  router.get("/routes", listRoutes(dtCtx, wecon));

  ctx.logger.info("DevTools mounted", {
    prefix: options.prefix ?? "/dev/devtools",
    auth: !!options.auth?.token,
    endpoints: 10,
  });

  return router;
}

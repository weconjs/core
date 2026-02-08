/**
 * @wecon/core - DevTools Routes Controller
 *
 * List all registered RAIs with their methods, paths, and roles.
 */

import type { Request, Response } from "express";
import type { DevToolsContext, RouteSummary } from "../types.js";
import type Wecon from "../../routing/Wecon.js";

/**
 * GET /routes - List all registered routes
 */
export function listRoutes(dtCtx: DevToolsContext, wecon?: Wecon) {
  return (_req: Request, res: Response): void => {
    if (!wecon) {
      res.json({ success: true, data: [] });
      return;
    }

    const routes = wecon.getRoutes();
    const summaries: RouteSummary[] = [];

    for (const route of routes) {
      summaries.push({
        rai: route.rai,
        method: route.method,
        path: route.path,
        roles: route.roles,
        module: route.meta?.module as string | undefined,
        name: route.name,
      });
    }

    // Sort by path for readability
    summaries.sort((a, b) => a.path.localeCompare(b.path));

    res.json({ success: true, data: summaries });
  };
}

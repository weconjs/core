/**
 * @wecon/core - DevTools Types
 */

import type { WeconContext, WeconModule } from "../types.js";

/**
 * DevTools configuration options
 */
export interface DevToolsOptions {
  /** Enable devtools (default: true in non-production) */
  enabled?: boolean;

  /** Route prefix (default: "/dev/devtools") */
  prefix?: string;

  /** Optional bearer token for authentication */
  auth?: {
    token?: string;
  };

  /** Path to modules directory for i18n operations */
  modulesDir?: string;
}

/**
 * Module summary returned by the list endpoint
 */
export interface ModuleSummary {
  name: string;
  namespace: string;
  description: string;
  hasConfig: boolean;
  hasRoutes: boolean;
  imports: string[];
  exports: string[];
}

/**
 * Module detail returned by the get endpoint
 */
export interface ModuleDetail extends ModuleSummary {
  config: {
    schema: string | null;
    current: unknown;
  };
}

/**
 * Route summary for the routes list endpoint
 */
export interface RouteSummary {
  rai: string;
  method: string;
  path: string;
  roles: string[];
  module?: string;
  name?: string;
}

/**
 * Internal context passed to devtools controllers
 */
export interface DevToolsContext {
  ctx: WeconContext;
  modules: WeconModule[];
}

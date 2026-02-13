/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RAI } from "../types.js";
import type Route from "../routing/Route.js";
import type { WeconContext } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      /** Route Access Identifier matched by RaiMatcher */
      rai?: RAI;
      /** The Route instance that matched this request */
      route_instance?: Route & { meta?: { namespace?: string; [key: string]: unknown } };
      /** Wecon application context */
      ctx?: WeconContext;
      /** i18next instance (set by i18next-http-middleware) */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      i18n?: any;
      /** i18n translation function */
      t?: (key: string, options?: Record<string, unknown>) => string;
      /** Authenticated user with roles */
      user?: {
        roles: string[];
        [key: string]: any;
      };
    }
  }
}

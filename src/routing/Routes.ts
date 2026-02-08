import type { Handler } from "express";
import Route from "./Route.js";
import type {
  ErrorTraceType,
  PossibleErrosType,
  RoutesConfig,
  DefaultRole,
} from "../types.js";
import RoutesParam from "./RoutesParam.js";
import ErrorCatcher from "./ErrorCatcher.js";
import errors from "../errors/index.js";

/**
 * Hierarchical route group with shared prefix, middleware, and params.
 * Contains Route (endpoints) and/or nested Routes (sub-groups).
 */
class Routes<TRole extends string = DefaultRole> extends ErrorCatcher {
  prefix: string;
  routes: Array<Route<TRole> | Routes<TRole>>;
  params?: RoutesParam[];
  middlewares?: Handler[];
  mergeParams?: boolean = false;
  meta?: Record<string, unknown>;

  constructor(r: RoutesConfig<TRole>) {
    super();

    this.prefix = r.prefix ? r.prefix : "";
    this.routes = r.routes;
    this.params = r.params ? r.params : [];
    this.middlewares = r.middlewares ? r.middlewares : [];
    this.mergeParams = r.mergeParams ? r.mergeParams : false;
    this.meta = r.meta;

    try {
      this.validateRoutes();
    } catch (err) {
      const errInfo = Routes.getCallerInfo();
      this.handleConfigError(err as Error, errInfo);
    }
  }

  private validateRoutes(): void {
    if (this.prefix && typeof this.prefix !== "string") {
      throw new errors.ConfigError("ROUTES_CONFIG:INVALID_PREFIX_TYPE");
    }
    if (!this.routes) {
      throw new errors.ConfigError("ROUTES_CONFIG:MISSING_ROUTES");
    }
    if (!Array.isArray(this.routes)) {
      throw new Error("ROUTES_CONFIG:INVALID_ROUTES_TYPE");
    }
    if (this.middlewares && !Array.isArray(this.middlewares)) {
      throw new errors.ConfigError("ROUTES_CONFIG:INVALID_MIDDLEWARES_TYPE");
    }
    if (this.params && !Array.isArray(this.params)) {
      throw new errors.ConfigError("ROUTES_CONFIG:INVALID_PARAMS_TYPE");
    }
    if (this.mergeParams && typeof this.mergeParams !== "boolean") {
      throw new errors.ConfigError("ROUTES_CONFIG:INVALID_MERGE_PARAMS_TYPE");
    }
  }

  private handleConfigError(err: Error, errInfo: ErrorTraceType): void {
    const POSSIBLE_ERRORS: PossibleErrosType = {
      "ROUTES_CONFIG:INVALID_PREFIX_TYPE": {
        title: "Invalid 'prefix' property type",
        details: "The 'prefix' must be a string, but received: " + typeof this.prefix,
        fix: "Ensure prefix is a string:\n    prefix: '/api' or prefix: ''",
      },
      "ROUTES_CONFIG:MISSING_ROUTES": {
        title: "Missing required 'routes' property",
        details: "The Routes instance requires a 'routes' array",
        fix: "Add a routes array:\n    routes: [new Routes(...), new Route(...)]",
      },
      "ROUTES_CONFIG:INVALID_ROUTES_TYPE": {
        title: "Invalid 'routes' property type",
        details: "The 'routes' must be an array, but received: " + typeof this.routes,
        fix: "Ensure routes is an array:\n    routes: [...]",
      },
      "ROUTES_CONFIG:INVALID_MIDDLEWARES_TYPE": {
        title: "Invalid 'middlewares' property type",
        details: "The 'middlewares' must be an array of express handlers, but received: " + typeof this.middlewares,
        fix: "Provide an array of middleware:\n    middlewares: [middleware1, middleware2]",
      },
      "ROUTES_CONFIG:INVALID_PARAMS_TYPE": {
        title: "Invalid 'params' property type",
        details: "The 'params' must be an array of RoutesParam instances, but received: " + typeof this.params,
        fix: "Provide an array of RoutesParam:\n    params: [new RoutesParam(...)]",
      },
      "ROUTES_CONFIG:INVALID_MERGE_PARAMS_TYPE": {
        title: "Invalid 'mergeParams' property type",
        details: "The 'mergeParams' must be a boolean, but received: " + typeof this.mergeParams,
        fix: "Set mergeParams to a boolean:\n    mergeParams: true",
      },
    };

    const errorConfig = POSSIBLE_ERRORS[err.message] || {
      title: err.message,
      details: "An unexpected error occurred",
      fix: "Please check your Routes configuration",
    };
    ErrorCatcher.logError(errorConfig, errInfo);
  }

  /**
   * Flatten the route tree into a Map<RAI, enriched Route>.
   * Accumulates paths, middlewares, and params from parent groups.
   */
  public groupRoutesByRai(): Map<
    string,
    Route<TRole> & { params: RoutesParam[]; middlewares: Handler[] }
  > {
    const raiMap = new Map<
      string,
      Route<TRole> & { params: RoutesParam[]; middlewares: Handler[] }
    >();

    const traverse = (
      current: Routes<TRole> | Route<TRole>,
      accumulatedPath: string,
      accumulatedParams: RoutesParam[],
      accumulatedMiddlewares: Handler[],
      parentsMergeParams: boolean
    ) => {
      // Handle endpoint
      if (current instanceof Route) {
        const fullPath = accumulatedPath + current.path;

        const finalMiddlewares = [
          ...accumulatedMiddlewares,
          ...(current.middlewares || []),
        ];
        const finalParams = this.deduplicateParams(accumulatedParams);

        if (raiMap.has(current.rai)) {
          const errorConfig = {
            title: "Duplicate 'rai' detected",
            details: "The 'rai' provided is already registered: " + current.rai,
            fix: "Ensure each route has a unique rai:\n    rai: 'users:create'",
          };
          ErrorCatcher.logError(errorConfig, current.debugInfo);
        }

        const extendedRoute = Object.assign(
          Object.create(Object.getPrototypeOf(current)),
          current,
          {
            path: fullPath,
            params: finalParams,
            middlewares: finalMiddlewares,
          }
        );

        raiMap.set(current.rai, extendedRoute);
        return;
      }

      // Handle group
      if (current instanceof Routes) {
        const nextPath = accumulatedPath + current.prefix;
        const nextMiddlewares = [
          ...accumulatedMiddlewares,
          ...(current.middlewares || []),
        ];

        let nextParams: RoutesParam[] = [];
        if (parentsMergeParams) {
          nextParams = [...accumulatedParams, ...(current.params || [])];
        } else {
          nextParams = current.params || [];
        }

        current.routes.forEach((child) => {
          traverse(
            child,
            nextPath,
            nextParams,
            nextMiddlewares,
            current.mergeParams || false
          );
        });
      }
    };

    traverse(this, "", [], [], false);
    return raiMap;
  }

  private deduplicateParams(params: RoutesParam[]): RoutesParam[] {
    const unique = new Map<string, RoutesParam>();
    params.forEach((p) => unique.set(p.path, p));
    return Array.from(unique.values());
  }
}

export default Routes;

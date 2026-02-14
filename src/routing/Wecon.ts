/**
 * Wecon - Express.js routing with built-in RBAC
 *
 * Two-layer request processing:
 * 1. Intelligence Layer: RaiMatcher validates and authorizes requests
 * 2. Execution Layer: Single master Express Router handles the request
 */

import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import type { RAI, DefaultRole } from "../types.js";
import Routes from "./Routes.js";
import Route from "./Route.js";
import errors from "../errors/index.js";
import RaiMatcher from "./RaiMatcher.js";
import PostmanGenerator from "../generators/PostmanGenerator.js";

/** Development mode configuration */
export interface WeconDevConfig {
  /** Enable debug mode with verbose logging */
  debugMode?: boolean;
  /** Provide helpful error suggestions */
  helpfulErrors?: boolean;
  /** Log registered routes on startup */
  logRoutes?: boolean;
}

/**
 * Postman configuration interface
 */
export interface WeconPostmanConfig {
  /** Name of the Postman collection */
  name: string;
  /** Description of the API */
  description?: string;
  /** Base URL for all requests */
  baseUrl?: string;
  /** API version */
  version?: string;
  /** Output file paths */
  output?: {
    /** Path to save the collection JSON file */
    collection?: string;
    /** Path to save the environment JSON file */
    environment?: string;
  };
  /** Auto-generate on build */
  autoGenerate?: boolean;
}

/**
 * Main Wecon class with fluent API.
 * Compiles routes into a single master router with RBAC enforcement.
 */
class Wecon<TRole extends string = DefaultRole> {
  private _routes?: Routes<TRole>;
  private _roles: TRole[] = [];
  private _guestRole: string = "guest";
  private _postman?: WeconPostmanConfig;
  private _onRoutesPrepared?: (routes: Route<TRole>[]) => void | Promise<void>;
  private _dev?: WeconDevConfig;

  private _raiMatcher?: RaiMatcher;
  private _masterRouter?: Router;

  private _built: boolean = false;
  private _raisMap?: Map<RAI, Route<TRole>>;
  private _middleware?: RequestHandler;

  constructor() {}

  /** Set the root routes */
  public routes(routes: Routes<TRole>): this {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    if (!(routes instanceof Routes)) {
      throw new Error("routes() must receive an instance of the Routes class");
    }
    this._routes = routes;
    return this;
  }

  /** Define available roles */
  public roles<T extends string>(roles: readonly T[]): Wecon<T> {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    if (!Array.isArray(roles)) {
      throw new Error("roles() must receive an array of strings");
    }
    (this as unknown as Wecon<T>)._roles = [...roles];
    return this as unknown as Wecon<T>;
  }

  /** Set guest role for unauthenticated users */
  public guestRole(guestRole: string): this {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    if (typeof guestRole !== "string") {
      throw new Error("guestRole() must receive a string");
    }
    this._guestRole = guestRole;
    return this;
  }

  /** Set callback for when routes are compiled */
  public onRoutesPrepared(
    callback: (routes: Route[]) => void | Promise<void>
  ): this {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    if (typeof callback !== "function") {
      throw new Error("onRoutesPrepared() must receive a function");
    }
    this._onRoutesPrepared = callback;
    return this;
  }

  /** Configure development mode options */
  public dev(config: WeconDevConfig): this {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    this._dev = config;
    return this;
  }

  /**
   * Configure Postman collection generation
   * @param config - Postman configuration object
   * @returns this for method chaining
   */
  public postman(config: WeconPostmanConfig): this {
    if (this._built) {
      throw new Error("Cannot modify Wecon after build() has been called");
    }
    this._postman = config;
    return this;
  }

  /**
   * Compile all routes into the middleware.
   * Must be called before using the Wecon instance.
   */
  public build(): this {
    if (this._built) throw new Error("build() can only be called once");
    if (!this._routes) throw new Error("routes() must be called before build()");
    if (this._roles.length === 0) throw new Error("roles() missing");

    this._built = true;
    this._raisMap = this._routes.groupRoutesByRai();

    // 1. Initialize RAI Matcher
    const routesList = Array.from(this._raisMap.values()).map((r) => ({
      path: r.path,
      method: r.method,
      rai: r.rai,
    }));
    this._raiMatcher = new RaiMatcher(routesList);

    // 2. Create master router (dynamic import would be async, so we use require-style)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Router: ExpressRouter } = require("express");
    this._masterRouter = ExpressRouter({ mergeParams: true }) as Router;

    // 3. Sort routes by specificity (static before dynamic)
    const sortedRoutes = Array.from(this._raisMap.values()).sort(
      this.compareRoutes
    );

    // 4. Register all routes on the master router
    sortedRoutes.forEach((route) => {
      // Register param handlers
      route.params?.forEach((param) => {
        this._masterRouter!.param(param.path, param.middleware);

        if (param.validate) {
          this._masterRouter!.param(param.path, (_req, _res, next, val) => {
            if (!param.validateValue(val)) {
              return next(
                new errors.RequestError("Invalid Parameter", {
                  code: "INVALID_PARAM",
                })
              );
            }
            next();
          });
        }
      });

      // Register route by method
      switch (route.method) {
        case "GET":
          this._masterRouter!.get(route.path, ...route.middlewares);
          break;
        case "POST":
          this._masterRouter!.post(route.path, ...route.middlewares);
          break;
        case "PUT":
          this._masterRouter!.put(route.path, ...route.middlewares);
          break;
        case "DELETE":
          this._masterRouter!.delete(route.path, ...route.middlewares);
          break;
      }
    });

    // 5. Create the intelligence layer middleware
    this._middleware = this.createMiddleware();

    // 6. Notify callback
    if (this._onRoutesPrepared) {
      const result = this._onRoutesPrepared(sortedRoutes);
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error("Error in onRoutesPrepared callback:", err);
        });
      }
    }

    // 7. Generate Postman collection if configured
    if (this._postman?.autoGenerate) {
      this.generatePostman().catch((err) => {
        console.error("Error generating Postman collection:", err);
      });
    }

    return this;
  }

  /** Sort routes: static segments before dynamic */
  private compareRoutes(a: Route, b: Route): number {
    const aSegments = a.path.split("/").filter(Boolean);
    const bSegments = b.path.split("/").filter(Boolean);
    const len = Math.max(aSegments.length, bSegments.length);

    for (let i = 0; i < len; i++) {
      const segA = aSegments[i];
      const segB = bSegments[i];

      if (segA === undefined) return 1;
      if (segB === undefined) return -1;

      const aIsDynamic = segA.startsWith(":");
      const bIsDynamic = segB.startsWith(":");

      if (aIsDynamic && !bIsDynamic) return 1;
      if (!aIsDynamic && bIsDynamic) return -1;
    }

    return b.path.length - a.path.length;
  }

  /** Create the main Express middleware (intelligence + execution layers) */
  private createMiddleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intelligence Layer: match RAI and check authorization
        const path = req.path;
        const reqRai = this._raiMatcher!.findRai(path, req.method);

        if (!reqRai) {
          const errorPath = req.originalUrl.split("?")[0];
          res.status(404);
          return next(
            new errors.RequestError(
              this._dev?.helpfulErrors
                ? this.createHelpfulNotFoundError(errorPath, req.method)
                : `Route not found`,
              { code: "RAI_NOT_FOUND" }
            )
          );
        }

        const route = this._raisMap!.get(reqRai)!;
        req.rai = reqRai;
        req.route_instance = route;

        const user = req.user;
        const userRoles: string[] = user?.roles || [this._guestRole];

        if (!route.isAuthorized(userRoles)) {
          const isGuest =
            userRoles.includes(this._guestRole) && userRoles.length === 1;
          res.status(isGuest ? 401 : 403);
          return next(
            new errors.RequestError(
              this._dev?.helpfulErrors
                ? this.createHelpfulUnauthorizedError(route, userRoles)
                : `Unauthorized`,
              { code: "UNAUTHORIZED" }
            )
          );
        }

        // Execution Layer: delegate to master router
        return this._masterRouter!(req, res, next);
      } catch (error) {
        return next(error);
      }
    };
  }

  private createHelpfulNotFoundError(path: string, method: string): string {
    const availableRoutes = Array.from(this._raisMap!.values())
      .filter((r) => r.method === method)
      .map((r) => r.path);

    let message = `No route found for ${method} ${path}`;
    if (availableRoutes.length > 0) {
      message += `\n\nAvailable ${method} routes:\n`;
      availableRoutes.forEach((route) => {
        message += `  - ${route}\n`;
      });
    }
    return message;
  }

  private createHelpfulUnauthorizedError(
    route: Route,
    userRoles: string[]
  ): string {
    const isGuest = userRoles.length === 1 && userRoles[0] === this._guestRole;

    if (isGuest) {
      return `Authentication required to access ${route.method} ${route.path}\n\nThis route requires one of the following roles: ${route.roles.join(", ")}`;
    }

    return `Insufficient permissions to access ${route.method} ${route.path}\n\nRequired roles: ${route.roles.join(", ")}\nYour roles: ${userRoles.join(", ")}`;
  }

  /** Get all registered routes (must call build() first) */
  public getRoutes(): Route[] {
    if (!this._built) {
      throw new Error("Cannot get routes before build() is called");
    }
    return Array.from(this._raisMap!.values());
  }

  /** Get a route by RAI */
  public getRoute(rai: RAI): Route | undefined {
    if (!this._built) {
      throw new Error("Cannot get route before build() is called");
    }
    return this._raisMap!.get(rai);
  }

  /** Get the Express middleware function */
  public handler(): RequestHandler {
    if (!this._built) {
      throw new Error("Cannot get handler before build() is called. Make sure to call build() first.");
    }
    return this._middleware!;
  }

  /**
   * Generate Postman collection and environment files
   */
  public async generatePostman(): Promise<void> {
    if (!this._postman) {
      throw new Error(
        "Postman configuration not provided. Call postman() before generatePostman()"
      );
    }

    if (!this._built) {
      throw new Error(
        "Cannot generate Postman collection before build() is called"
      );
    }

    if (!this._routes) {
      throw new Error(
        "Routes not configured. Cannot generate Postman collection."
      );
    }

    try {
      const { collection, environment } = await PostmanGenerator.generateFromWecon(
        {
          name: this._postman.name,
          description: this._postman.description,
          baseUrl: this._postman.baseUrl,
          version: this._postman.version,
          output: this._postman.output,
        },
        this._routes
      );

      if (this._dev?.logRoutes) {
        console.log(`✓ Generated Postman collection: ${this._postman.name}`);
        console.log(`  - ${collection.item.length} top-level items`);
        console.log(`  - ${environment.values.length} environment variables`);
      }
    } catch (error) {
      console.error("Failed to generate Postman collection:", error);
      throw error;
    }
  }
}

export default Wecon;

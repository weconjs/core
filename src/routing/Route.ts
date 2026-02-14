/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "crypto";
import type { Handler, RequestHandler } from "express";
import type {
  RouteConfig,
  ErrorTraceType,
  PossibleErrosType,
  RAI,
  DefaultRole,
} from "../types.js";
import ErrorCatcher from "./ErrorCatcher.js";
import errors from "../errors/index.js";
import type RoutesParam from "./RoutesParam.js";
import type PostmanRoute from "./PostmanRoute.js";

/**
 * Single API endpoint definition.
 * Carries method, path, RAI, roles, middlewares, and metadata.
 */
class Route<TRole extends string = DefaultRole> extends ErrorCatcher {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: Array<RoutesParam> = [];
  middlewares: Handler[] | RequestHandler[] | any[];
  name: string;
  description: string;
  rai: RAI;
  roles: TRole[];
  postman?: PostmanRoute;
  meta?: Record<string, unknown>;
  public debugInfo: ErrorTraceType;

  constructor(r: RouteConfig<TRole>) {
    super();

    this.id = randomUUID();
    this.method = r.method;
    this.path = r.path;
    this.middlewares = r.middlewares;
    this.name = r.name ? r.name : `[${this.method}] ${this.path}`;
    this.description = r.description ? r.description : "";
    this.rai = r.rai;
    this.roles = r.roles;
    this.postman = r.postman;
    this.meta = r.meta;
    this.debugInfo = Route.getCallerInfo();

    try {
      this.validateRoute();
    } catch (err) {
      this.handleConfigError(err as Error, this.debugInfo);
    }
  }

  private validateRoute(): void {
    if (!this.method) {
      throw new errors.ConfigError("ROUTE_CONFIG:MISSING_METHOD");
    }
    if (!this.path) {
      throw new errors.ConfigError("ROUTE_CONFIG:MISSING_PATH");
    }
    if (!this.rai) {
      throw new errors.ConfigError("ROUTE_CONFIG:MISSING_RAI");
    }
    if (typeof this.rai !== "string") {
      throw new errors.ConfigError("ROUTE_CONFIG:INVALID_RAI_TYPE");
    }
    if (!this.roles) {
      throw new errors.ConfigError("ROUTE_CONFIG:MISSING_ROLES");
    }
    if (!Array.isArray(this.middlewares)) {
      throw new errors.ConfigError("ROUTE_CONFIG:INVALID_MIDDLEWARES_TYPE");
    }
    if (this.middlewares.length === 0) {
      throw new errors.ConfigError("ROUTE_CONFIG:EMPTY_MIDDLEWARES");
    }
  }

  private handleConfigError(err: Error, errInfo: ErrorTraceType): void {
    const POSSIBLE_ERRORS: PossibleErrosType = {
      "ROUTE_CONFIG:MISSING_METHOD": {
        title: "Missing required 'method' property",
        details: "The Route instance requires a 'method' to be defined",
        fix: "Add a method to your route configuration:\n    method: 'GET' | 'POST' | 'PUT' | 'DELETE'",
      },
      "ROUTE_CONFIG:MISSING_PATH": {
        title: "Missing required 'path' property",
        details: "The Route instance requires a 'path' to be defined",
        fix: "Add a path to your route configuration:\n    path: '/users/:id'",
      },
      "ROUTE_CONFIG:MISSING_RAI": {
        title: "Missing required 'rai' property",
        details: "The Route instance requires a unique 'rai' (Route Access Identifier)",
        fix: "Add a rai to your route configuration:\n    rai: 'users:read' // Must be unique across all routes",
      },
      "ROUTE_CONFIG:INVALID_RAI_TYPE": {
        title: "Invalid 'rai' property type",
        details: "The 'rai' property must be a string, but received: " + typeof this.rai,
        fix: "Ensure rai is a string:\n    rai: 'users:read'",
      },
      "ROUTE_CONFIG:DUPLICATE_RAI": {
        title: "Duplicate 'rai' detected",
        details: "The 'rai' provided is already registered: " + this.rai,
        fix: "Ensure each route has a unique rai:\n    rai: 'users:create'",
      },
      "ROUTE_CONFIG:MISSING_ROLES": {
        title: "Missing required 'roles' property",
        details: "The Route instance requires a 'roles' array",
        fix: "Add roles to your route configuration:\n    roles: ['admin', 'user']",
      },
      "ROUTE_CONFIG:INVALID_MIDDLEWARES_TYPE": {
        title: "Invalid 'middlewares' property type",
        details: "The 'middlewares' property must be an array, but received: " + typeof this.middlewares,
        fix: "Ensure middlewares is an array:\n    middlewares: [authMiddleware, validateMiddleware]",
      },
      "ROUTE_CONFIG:EMPTY_MIDDLEWARES": {
        title: "Empty 'middlewares' array",
        details: "The Route instance requires at least one middleware function",
        fix: "Add at least one handler:\n    middlewares: [(req, res) => { res.json({ data: 'example' }) }]",
      },
    };

    const errorConfig = POSSIBLE_ERRORS[err.message] || {
      title: err.message,
      details: "An unexpected error occurred",
      fix: "Please check your Route configuration",
    };

    ErrorCatcher.logError(errorConfig, errInfo);
  }

  /** Check if user roles are authorized to access this route */
  isAuthorized(userRoles: string[]): boolean {
    if (this.roles.length === 0) return false;

    for (const role of userRoles) {
      if ((this.roles as string[]).includes(role)) return true;
    }

    return false;
  }
}

export default Route;

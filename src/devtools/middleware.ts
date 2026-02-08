/**
 * @wecon/core - DevTools Auth Middleware
 *
 * Optional bearer token authentication for devtools endpoints.
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Create bearer token auth middleware for devtools
 */
export function createDevToolsAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        errors: [{ code: "UNAUTHORIZED", message: "Bearer token required" }],
      });
      return;
    }

    const provided = authHeader.slice(7);
    if (provided !== token) {
      res.status(403).json({
        success: false,
        errors: [{ code: "FORBIDDEN", message: "Invalid token" }],
      });
      return;
    }

    next();
  };
}

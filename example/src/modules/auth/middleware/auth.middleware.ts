import type { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model.js";
import { AuthService } from "../services/auth.service.js";
import type { WeconContext } from "@weconjs/core";

let authService: AuthService;

export function initAuthMiddleware(ctx: WeconContext) {
  authService = new AuthService(ctx);
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return next();
    }

    const token = header.slice(7);
    const payload = authService.verifyToken(token);
    const user = await User.findById(payload.userId);

    if (user && user.isActive) {
      (req as unknown as Record<string, unknown>).user = user;
    }
  } catch {
    // Invalid token — continue as guest
  }

  next();
}

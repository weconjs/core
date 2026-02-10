import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import type { WeconContext } from "@weconjs/core";

let authService: AuthService;

export function initAuthController(ctx: WeconContext) {
  authService = new AuthService(ctx);
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400);
      return res.json({
        success: false,
        data: null,
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: "email, password, firstName, and lastName are required",
          },
        ],
        meta: null,
      });
    }

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
    });

    res.status(201);
    return res.json({
      success: true,
      data: result,
      errors: null,
      meta: null,
    });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Email already registered") {
      res.status(409);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "CONFLICT", message: error.message }],
        meta: null,
      });
    }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      return res.json({
        success: false,
        data: null,
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: "email and password are required",
          },
        ],
        meta: null,
      });
    }

    const result = await authService.login({ email, password });

    return res.json({
      success: true,
      data: result,
      errors: null,
      meta: null,
    });
  } catch (err) {
    const error = err as Error;
    if (
      error.message === "Invalid credentials" ||
      error.message === "Account is deactivated"
    ) {
      res.status(401);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "UNAUTHORIZED", message: error.message }],
        meta: null,
      });
    }
    next(err);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as unknown as Record<string, unknown>).user as
      | { _id: string }
      | undefined;

    if (!user) {
      res.status(401);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "UNAUTHORIZED", message: "Not authenticated" }],
        meta: null,
      });
    }

    const profile = await authService.getProfile(String(user._id));

    return res.json({
      success: true,
      data: profile,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

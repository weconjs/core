import type { Request, Response, NextFunction } from "express";
import { UsersService } from "../services/users.service.js";
import type { WeconContext } from "@weconjs/core";

let usersService: UsersService;

export function initUsersController(ctx: WeconContext) {
  usersService = new UsersService(ctx);
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const result = await usersService.findAll(page, limit);

    return res.json({
      success: true,
      data: result.users,
      errors: null,
      meta: { total: result.total, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

export async function findById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await usersService.findById(String(req.params.id));
    if (!user) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "User not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: user,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.update(String(req.params.id), req.body);
    if (!user) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "User not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: user,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await usersService.delete(String(req.params.id));
    if (!deleted) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "User not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: { deleted: true },
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleActive(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await usersService.toggleActive(String(req.params.id));
    if (!user) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "User not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: user,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

import type { Request, Response, NextFunction } from "express";
import { PostsService } from "../services/posts.service.js";
import type { WeconContext } from "@weconjs/core";

let postsService: PostsService;

export function initPostsController(ctx: WeconContext) {
  postsService = new PostsService(ctx);
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;
    const result = await postsService.findAll(page, limit, status);

    return res.json({
      success: true,
      data: result.posts,
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
    const post = await postsService.findById(String(req.params.id));
    if (!post) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "Post not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: post,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function findBySlug(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const post = await postsService.findBySlug(String(req.params.slug));
    if (!post) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "Post not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: post,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
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

    const { title, content, excerpt, tags, status } = req.body;

    if (!title || !content) {
      res.status(400);
      return res.json({
        success: false,
        data: null,
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: "title and content are required",
          },
        ],
        meta: null,
      });
    }

    const post = await postsService.create({
      title,
      content,
      excerpt,
      tags,
      status,
      authorId: String(user._id),
    });

    res.status(201);
    return res.json({
      success: true,
      data: post,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await postsService.update(String(req.params.id), req.body);
    if (!post) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "Post not found" }],
        meta: null,
      });
    }

    return res.json({
      success: true,
      data: post,
      errors: null,
      meta: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await postsService.delete(String(req.params.id));
    if (!deleted) {
      res.status(404);
      return res.json({
        success: false,
        data: null,
        errors: [{ code: "NOT_FOUND", message: "Post not found" }],
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

export async function findByTag(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const tag = String(req.params.tag);
    const result = await postsService.findByTag(tag, page, limit);

    return res.json({
      success: true,
      data: result.posts,
      errors: null,
      meta: { total: result.total, page, limit, tag },
    });
  } catch (err) {
    next(err);
  }
}

import { z } from "zod";
import { defineModule, Routes, Route } from "@weconjs/core";
import {
  register,
  login,
  getProfile,
  initAuthController,
} from "./controllers/auth.controller.js";
import { initAuthMiddleware, authenticate } from "./middleware/auth.middleware.js";

const authRoutes = new Routes({
  prefix: "/auth",
  routes: [
    new Route({
      method: "POST",
      path: "/register",
      rai: "auth:register",
      roles: ["guest", "admin", "user"],
      middlewares: [register],
      name: "Register",
      description: "Create a new user account",
    }),
    new Route({
      method: "POST",
      path: "/login",
      rai: "auth:login",
      roles: ["guest", "admin", "user"],
      middlewares: [login],
      name: "Login",
      description: "Authenticate and receive a JWT",
    }),
    new Route({
      method: "GET",
      path: "/profile",
      rai: "auth:profile",
      roles: ["admin", "user"],
      middlewares: [getProfile],
      name: "Profile",
      description: "Get the authenticated user's profile",
    }),
  ],
});

export default defineModule({
  name: "auth",
  description: "Authentication and authorization module",
  routes: authRoutes,
  exports: ["authService", "authenticate"],
  config: {
    schema: z.object({
      jwtSecret: z.string().min(16),
      jwtExpiresIn: z.number().positive(),
      saltRounds: z.number().int().min(4).max(16),
    }),
    defaults: {
      jwtExpiresIn: 86400,
      saltRounds: 10,
    },
  },
  onInit: async (ctx) => {
    initAuthController(ctx);
    initAuthMiddleware(ctx);

    ctx.registerService("authenticate", authenticate);

    ctx.logger.info("Auth module initialized");
  },
  onDestroy: async (ctx) => {
    ctx.logger.info("Auth module destroyed");
  },
});

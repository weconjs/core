import { defineModule, Routes, Route } from "@weconjs/core";
import {
  findAll,
  findById,
  update,
  remove,
  toggleActive,
  initUsersController,
} from "./controllers/users.controller.js";

const usersRoutes = new Routes({
  prefix: "/users",
  routes: [
    new Route({
      method: "GET",
      path: "/",
      rai: "users:list",
      roles: ["admin"],
      middlewares: [findAll],
      name: "List users",
      description: "Get a paginated list of all users",
    }),
    new Route({
      method: "GET",
      path: "/:id",
      rai: "users:read",
      roles: ["admin", "user"],
      middlewares: [findById],
      name: "Get user",
      description: "Get a single user by ID",
    }),
    new Route({
      method: "PUT",
      path: "/:id",
      rai: "users:update",
      roles: ["admin"],
      middlewares: [update],
      name: "Update user",
      description: "Update a user's details",
    }),
    new Route({
      method: "PUT",
      path: "/:id/toggle-active",
      rai: "users:toggleActive",
      roles: ["admin"],
      middlewares: [toggleActive],
      name: "Toggle active",
      description: "Activate or deactivate a user account",
    }),
    new Route({
      method: "DELETE",
      path: "/:id",
      rai: "users:delete",
      roles: ["admin"],
      middlewares: [remove],
      name: "Delete user",
      description: "Permanently delete a user",
    }),
  ],
});

export default defineModule({
  name: "users",
  description: "User management module",
  routes: usersRoutes,
  imports: ["auth"],
  onInit: async (ctx) => {
    initUsersController(ctx);
    ctx.logger.info("Users module initialized");
  },
});

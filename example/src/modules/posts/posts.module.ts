import { defineModule, Routes, Route } from "@weconjs/core";
import {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  remove,
  findByTag,
  initPostsController,
} from "./controllers/posts.controller.js";

const postsRoutes = new Routes({
  prefix: "/posts",
  routes: [
    new Route({
      method: "GET",
      path: "/",
      rai: "posts:list",
      roles: ["admin", "user", "guest"],
      middlewares: [findAll],
      name: "List posts",
      description: "Get a paginated list of posts",
    }),
    new Route({
      method: "GET",
      path: "/tag/:tag",
      rai: "posts:byTag",
      roles: ["admin", "user", "guest"],
      middlewares: [findByTag],
      name: "Posts by tag",
      description: "Get posts filtered by tag",
    }),
    new Route({
      method: "GET",
      path: "/slug/:slug",
      rai: "posts:readBySlug",
      roles: ["admin", "user", "guest"],
      middlewares: [findBySlug],
      name: "Get post by slug",
      description: "Get a single post by its URL slug",
    }),
    new Route({
      method: "GET",
      path: "/:id",
      rai: "posts:read",
      roles: ["admin", "user", "guest"],
      middlewares: [findById],
      name: "Get post",
      description: "Get a single post by ID",
    }),
    new Route({
      method: "POST",
      path: "/",
      rai: "posts:create",
      roles: ["admin", "user"],
      middlewares: [create],
      name: "Create post",
      description: "Create a new post",
    }),
    new Route({
      method: "PUT",
      path: "/:id",
      rai: "posts:update",
      roles: ["admin", "user"],
      middlewares: [update],
      name: "Update post",
      description: "Update an existing post",
    }),
    new Route({
      method: "DELETE",
      path: "/:id",
      rai: "posts:delete",
      roles: ["admin"],
      middlewares: [remove],
      name: "Delete post",
      description: "Permanently delete a post",
    }),
  ],
});

export default defineModule({
  name: "posts",
  description: "Blog posts module",
  routes: postsRoutes,
  imports: ["auth"],
  onInit: async (ctx) => {
    initPostsController(ctx);
    ctx.logger.info("Posts module initialized");
  },
});

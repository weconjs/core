import { Wecon, Routes, resolveModuleDependencies, type WeconModule } from "@weconjs/core";
import authModule from "./modules/auth/auth.module.js";
import usersModule from "./modules/users/users.module.js";
import postsModule from "./modules/posts/posts.module.js";

const roles = ["admin", "user", "guest"] as const;

// Build the module map for dependency resolution
const moduleMap = new Map<string, WeconModule>([
  [authModule.name, authModule],
  [usersModule.name, usersModule],
  [postsModule.name, postsModule],
]);

// Resolve module load order via topological sort
export const modules = resolveModuleDependencies(moduleMap);

type Roles = (typeof roles)[number];

// Collect all module routes under /api prefix
const apiRoutes = new Routes({
  prefix: "/api",
  routes: [
    authModule.routes! as Routes,
    usersModule.routes! as Routes,
    postsModule.routes! as Routes,
  ],
}) as Routes<Roles>;

// Build the Wecon RBAC routing instance
export const wecon = new Wecon()
  .roles(roles)
  .guestRole("guest")
  .routes(apiRoutes)
  .dev({
    debugMode: true,
    helpfulErrors: true,
    logRoutes: true,
  })
  .onRoutesPrepared((routes) => {
    console.log(`  Registered ${routes.length} routes with RBAC`);
  })
  .build();

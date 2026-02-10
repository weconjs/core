import path from "path";
import { fileURLToPath } from "url";
import { createWecon, loadConfig, buildUriFromConfig } from "@weconjs/core";
import { authenticate } from "./modules/auth/middleware/auth.middleware.js";
import { corsMiddleware } from "./shared/middleware/cors.js";
import { wecon, modules } from "./bootstrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Load the configuration and resolve for the current environment
  const config = await loadConfig(
    path.resolve(__dirname, "../wecon.config.js"),
    process.env.NODE_ENV || "development"
  );

  // Build database URI from config
  const dbUri = buildUriFromConfig(config.database);

  // Create the Wecon application with all features enabled
  const app = await createWecon({
    config,
    modules,
    wecon,

    // Custom middleware (applied before routes)
    middleware: [corsMiddleware, authenticate],

    // MongoDB database
    database: {
      enabled: true,
      uri: dbUri,
    },

    // i18n — auto-discover translations from module locales/ folders
    i18n: {
      enabled: true,
      modulesDir: path.resolve(__dirname, "modules"),
    },

    // Winston logger with file rotation
    logger: {
      useWinston: true,
      enableFile: config.logging?.enableFile ?? false,
      logDir: path.resolve(__dirname, "../logs"),
    },

    // Module dependency management
    moduleDeps: {
      autoInstall: config.mode !== "production",
      rootDir: path.resolve(__dirname, ".."),
    },

    // Lifecycle hooks
    hooks: {
      onBoot: async (ctx) => {
        ctx.logger.info("All modules loaded, server starting...");
      },
      onShutdown: async (ctx) => {
        ctx.logger.info("Graceful shutdown complete");
      },
      onModuleInit: async (mod, ctx) => {
        ctx.logger.debug(`Module initialized: ${mod.name}`);
      },
    },
  });

  // Start the server
  await app.start();
}

main().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});

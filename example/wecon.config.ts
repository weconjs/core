import { defineConfig } from "@weconjs/core";

export default defineConfig({
  app: {
    name: "wecon-app",
    version: "1.0.0",
  },
  modes: {
    development: {
      port: Number(process.env.PORT) || 3000,
      database: {
        debug: true,
        mongoose: {
          protocol: "mongodb",
          host: process.env.DB_HOST || "localhost",
          port: Number(process.env.DB_PORT) || 27017,
          database: process.env.DB_NAME || "wecon_app",
        },
      },
      logging: { level: "debug" },
    },
    production: {
      port: Number(process.env.PORT) || 8080,
      database: {
        mongoose: {
          protocol: "mongodb+srv",
          host: process.env.DB_HOST,
          database: process.env.DB_NAME || "wecon_app",
          auth: {
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
          },
        },
      },
      logging: {
        level: "info",
        enableFile: true,
      },
      https: {
        enabled: false,
      },
    },
  },
  features: {
    i18n: {
      enabled: true,
      defaultLocale: "en",
      supported: ["en", "es"],
    },
    socket: {
      enabled: true,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    },
  },
  modules: ["./src/modules/auth", "./src/modules/users", "./src/modules/posts"],
  moduleConfigs: {
    auth: {
      jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-key-32chars-long!!",
      jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN) || 86400,
      saltRounds: 10,
    },
  },
});

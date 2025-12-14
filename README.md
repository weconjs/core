# @weconjs/core

> Core framework package for Wecon - A convention-over-configuration Node.js framework.

[![npm version](https://img.shields.io/npm/v/@weconjs/core.svg)](https://www.npmjs.com/package/@weconjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration System](#configuration-system)
- [Module System](#module-system)
- [Server Factory](#server-factory)
- [Database Integration](#database-integration)
- [Logging](#logging)
- [API Reference](#api-reference)
- [Testing](#testing)

## Installation

```bash
npm install @weconjs/core
# or
yarn add @weconjs/core
```

### Optional Dependencies

```bash
# Winston logging with daily file rotation
npm install winston winston-daily-rotate-file

# Field-level access control for Mongoose
npm install @weconjs/mongoose-field-shield
```

## Features

| Feature | Description |
|---------|-------------|
| **Configuration System** | Mode-based configuration with inheritance (development, staging, production) |
| **Module System** | Auto-discovery, dependency resolution, and lifecycle hooks |
| **i18n Support** | Automatic translation file loading from module directories |
| **Socket.IO Integration** | Auto-discover and register socket handlers and middleware |
| **Database Connection** | MongoDB/Mongoose with URI builders, plugins, retry logic |
| **Server Factory** | Complete Express bootstrap with HTTPS, graceful shutdown |
| **Winston Logger** | Production-ready logging with console and file rotation |
| **Response Helpers** | Standardized API responses via `res.respond()` |
| **HTTPS Support** | Built-in SSL/TLS certificate loading and validation |
| **Graceful Shutdown** | Proper SIGTERM/SIGINT handling with cleanup hooks |

---

## Quick Start

### 1. Create Configuration File

```typescript
// wecon.config.ts
import { defineConfig } from '@weconjs/core';

export default defineConfig({
  app: {
    name: 'my-api',
    version: '1.0.0',
  },
  modes: {
    development: {
      port: 3000,
      database: {
        mongoose: {
          protocol: 'mongodb',
          host: 'localhost',
          port: 27017,
          database: 'myapp_dev',
        },
      },
      logging: { level: 'debug' },
    },
    production: {
      port: 8080,
      database: {
        mongoose: {
          protocol: 'mongodb+srv',
          host: process.env.DB_HOST,
          database: 'myapp',
          username: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        },
      },
      logging: { 
        level: 'info', 
        enableFile: true,
        directory: './logs',
      },
      https: {
        enabled: true,
        keyPath: './certs/privkey.pem',
        certPath: './certs/fullchain.pem',
      },
    },
  },
  modules: ['./src/modules/users', './src/modules/auth'],
  features: {
    i18n: { 
      enabled: true, 
      defaultLocale: 'en',
      supported: ['en', 'es', 'fr'],
    },
    fieldShield: {
      enabled: true,
      strict: true,
    },
  },
});
```

### 2. Define a Module

```typescript
// src/modules/users/users.module.ts
import { defineModule } from '@weconjs/core';
import { Routes, Route } from '@weconjs/lib';
import { userController } from './controllers/user.controller.js';

const usersRoutes = new Routes({
  prefix: '/users',
  routes: [
    new Route({ method: 'get', path: '/', handler: userController.findAll }),
    new Route({ method: 'get', path: '/:id', handler: userController.findById }),
    new Route({ method: 'post', path: '/', handler: userController.create }),
    new Route({ method: 'put', path: '/:id', handler: userController.update }),
    new Route({ method: 'delete', path: '/:id', handler: userController.delete }),
  ],
});

export default defineModule({
  name: 'users',
  description: 'User management module',
  routes: usersRoutes,
  dependencies: ['auth'], // Load auth module first
  onInit: async (ctx) => {
    ctx.logger.info('Users module initialized');
    // Setup module-specific resources
  },
});
```

### 3. Create Application Entry Point

```typescript
// src/main.ts
import path from 'path';
import { 
  createWecon, 
  loadConfig, 
  buildUriFromConfig, 
  type WeconContext 
} from '@weconjs/core';

async function main() {
  // Load configuration with mode resolution
  const config = await loadConfig(
    path.resolve(process.cwd(), 'wecon.config.ts'),
    process.env.NODE_ENV
  );

  console.log(`Starting ${config.app.name} v${config.app.version}`);
  console.log(`Mode: ${config.mode}`);

  // Dynamic import after config is loaded
  const { wecon, modules } = await import('./bootstrap.js');

  // Create and configure the application
  const app = await createWecon({
    config,
    modules: [...modules],
    wecon,
    middleware: [], // Your custom middleware array
    database: {
      enabled: true,
      uri: buildUriFromConfig(config.database),
      plugins: [], // Global Mongoose plugins
      debug: config.mode === 'development',
    },
    plugins: {
      fieldShield: config.features?.fieldShield?.enabled
        ? { strict: config.features.fieldShield.strict ?? true }
        : false,
    },
    i18n: {
      enabled: config.features?.i18n?.enabled ?? false,
      modulesDir: './src/modules',
    },
    logger: {
      useWinston: true,
      level: config.logging?.level ?? 'info',
      appName: config.app.name,
      enableFile: config.logging?.enableFile ?? false,
      logsDir: config.logging?.directory ?? './logs',
    },
    hooks: {
      onBoot: async (ctx: WeconContext) => {
        ctx.logger.info('Application ready to receive requests');
      },
      onShutdown: async (ctx: WeconContext) => {
        ctx.logger.info('Application shutting down...');
        // Cleanup resources, close connections
      },
    },
  });

  await app.start();
}

main().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
```

---

## Configuration System

### Mode-Based Configuration

Define environment-specific settings that inherit from a base configuration:

```typescript
import { defineConfig } from '@weconjs/core';

export default defineConfig({
  // Base configuration (shared across all modes)
  app: { name: 'my-api', version: '1.0.0' },
  
  // Mode-specific overrides
  modes: {
    development: {
      port: 3000,
      logging: { level: 'debug' },
    },
    staging: {
      port: 3000,
      logging: { level: 'info' },
    },
    production: {
      port: 8080,
      logging: { level: 'warn', enableFile: true },
    },
  },
});
```

### Loading Configuration

```typescript
import { loadConfig, resolveConfig } from '@weconjs/core';

// Load and resolve for current environment
const config = await loadConfig('./wecon.config.ts', process.env.NODE_ENV);

// Or load and resolve separately
const rawConfig = await loadConfig('./wecon.config.ts');
const resolved = resolveConfig(rawConfig, 'production');
```

---

## Module System

### Module Definition

```typescript
import { defineModule, type WeconContext } from '@weconjs/core';

export default defineModule({
  name: 'auth',
  description: 'Authentication and authorization',
  routes: authRoutes,
  
  // Declare dependencies (loaded first)
  dependencies: ['database-seeds'],
  
  // Lifecycle hooks
  onInit: async (module, ctx: WeconContext) => {
    // Called when module is registered
    ctx.logger.debug(`${module.name} module initializing`);
  },
  
  onBoot: async (module, ctx: WeconContext) => {
    // Called after all modules initialized, before server starts
    await seedDefaultRoles(ctx);
  },
  
  onShutdown: async (module, ctx: WeconContext) => {
    // Called on graceful shutdown
    await cleanupSessions();
  },
});
```

### Module Discovery

The framework automatically resolves dependencies using topological sorting:

```typescript
import { resolveModuleDependencies, loadModule } from '@weconjs/core';

const modules = await Promise.all([
  loadModule('./src/modules/users'),
  loadModule('./src/modules/auth'),
  loadModule('./src/modules/orders'),
]);

// Returns modules in correct initialization order
const sorted = resolveModuleDependencies(modules);
```

---

## Server Factory

### Basic Usage

```typescript
import { createWecon } from '@weconjs/core';

const app = await createWecon({
  config,
  modules,
  wecon, // @weconjs/lib instance
});

await app.start();
```

### Full Configuration

```typescript
const app = await createWecon({
  config,
  modules,
  wecon,
  
  // Custom Express middleware
  middleware: [cors(), helmet(), rateLimit()],
  
  // Database configuration
  database: {
    enabled: true,
    uri: 'mongodb://localhost/myapp',
    plugins: [timestampPlugin, auditPlugin],
    debug: true,
    retryAttempts: 5,
    retryDelay: 2000,
  },
  
  // FieldShield integration
  plugins: {
    fieldShield: { strict: true },
  },
  
  // i18n configuration
  i18n: {
    enabled: true,
    modulesDir: './src/modules',
  },
  
  // Logger configuration
  logger: {
    useWinston: true,
    level: 'info',
    appName: 'my-api',
    enableFile: true,
    logsDir: './logs',
  },
  
  // Lifecycle hooks
  hooks: {
    onBoot: async (ctx) => { /* Server starting */ },
    onShutdown: async (ctx) => { /* Cleanup */ },
    onModuleInit: async (module, ctx) => { /* Module loaded */ },
  },
});
```

### Response Helpers

The server factory installs `res.respond()` on all Express responses:

```typescript
// Controller example
async findAll(req: Request, res: Response) {
  const users = await userService.findAll();
  
  res.respond({
    success: true,
    data: users,
    meta: { total: users.length },
  });
}

// Error response
res.respond({
  success: false,
  message: req.t('user_not_found'),
  errors: [{ code: 'NOT_FOUND', field: 'id' }],
}, 404);
```

---

## Database Integration

### URI Builder

Build MongoDB connection strings from configuration:

```typescript
import { buildMongoUri, buildUriFromConfig } from '@weconjs/core';

// From individual parts
const uri = buildMongoUri({
  protocol: 'mongodb+srv',
  host: 'cluster.mongodb.net',
  database: 'myapp',
  username: 'user',
  password: 'pass',
  options: { retryWrites: 'true', w: 'majority' },
});

// From config object
const uri = buildUriFromConfig(config.database);
```

### Database Connection

```typescript
import { createDatabaseConnection } from '@weconjs/core';

const db = await createDatabaseConnection({
  uri: 'mongodb://localhost/myapp',
  plugins: [timestampPlugin],
  debug: process.env.NODE_ENV === 'development',
  retryAttempts: 5,
  retryDelay: 2000,
});
```

---

## Logging

### Winston Logger

```typescript
import { createWinstonLogger, createConsoleLogger } from '@weconjs/core';

// Winston with file rotation (requires winston + winston-daily-rotate-file)
const logger = await createWinstonLogger({
  level: 'info',
  appName: 'my-api',
  enableFile: true,
  logsDir: './logs',
});

// Console-only fallback
const logger = createConsoleLogger({
  level: 'debug',
  appName: 'my-api',
});

logger.info('Server started', { port: 3000 });
logger.error('Database connection failed', { error: err.message });
```

---

## API Reference

### Configuration

| Function | Description |
|----------|-------------|
| `defineConfig(config)` | Define application configuration with TypeScript support |
| `resolveConfig(config, mode)` | Resolve configuration for a specific mode |
| `loadConfig(path, mode?)` | Load configuration file and optionally resolve mode |

### Modules

| Function | Description |
|----------|-------------|
| `defineModule(definition)` | Define a module with routes and lifecycle hooks |
| `loadModule(path)` | Load a module from file path |
| `resolveModuleDependencies(modules)` | Sort modules by dependencies |

### Server

| Function | Description |
|----------|-------------|
| `createWecon(options)` | Create and configure Wecon application |

### Database

| Function | Description |
|----------|-------------|
| `createDatabaseConnection(options)` | Create MongoDB connection with retry logic |
| `buildMongoUri(parts)` | Build MongoDB URI from parts |
| `buildUriFromConfig(config)` | Build URI from database config object |

### Logging

| Function | Description |
|----------|-------------|
| `createWinstonLogger(options)` | Create Winston logger with file rotation |
| `createConsoleLogger(options)` | Create console-based logger |

### Socket.IO

| Function | Description |
|----------|-------------|
| `setupSocketIO(server, modulesDir, options)` | Setup Socket.IO with auto-discovery |
| `discoverSocketHandlers(modulesDir)` | Find socket handlers in modules |
| `discoverSocketMiddleware(modulesDir)` | Find socket middleware in modules |

---

## Testing

```bash
yarn test      # Run all 82 unit tests
yarn build     # Build TypeScript to dist/
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- Express 5.x
- Mongoose 8.x

## License

MIT © [weconjs](https://github.com/weconjs)

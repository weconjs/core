# @weconjs/core

> Convention-over-configuration Node.js framework built on Express.

[![npm version](https://img.shields.io/npm/v/@weconjs/core.svg)](https://www.npmjs.com/package/@weconjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Modules](#modules)
- [Routing & RBAC](#routing--rbac)
- [Database](#database)
- [Logging](#logging)
- [i18n](#i18n)
- [Socket.IO](#socketio)
- [Context & Services](#context--services)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Requirements](#requirements)
- [License](#license)

## Installation

```bash
npm install @weconjs/core
```

Express and Mongoose are peer dependencies:

```bash
npm install express mongoose
```

Optional peer dependencies:

```bash
# Winston logging with daily file rotation
npm install winston winston-daily-rotate-file

# Socket.IO real-time support
npm install socket.io

# Field-level access control for Mongoose
npm install @weconjs/mongoose-field-shield
```

## Quick Start

### 1. Define your configuration

```typescript
// wecon.config.ts
import { defineConfig } from '@weconjs/core';

export default defineConfig({
  app: { name: 'my-api', version: '1.0.0' },
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
          auth: {
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
          },
        },
      },
      logging: { level: 'info', enableFile: true },
    },
  },
  modules: ['./src/modules/auth', './src/modules/users'],
});
```

### 2. Define a module

```typescript
// src/modules/users/users.module.ts
import { defineModule, Routes, Route } from '@weconjs/core';
import { userController } from './controllers/user.controller.js';

const usersRoutes = new Routes({
  prefix: '/users',
  routes: [
    new Route({
      method: 'GET',
      path: '/',
      rai: 'users:list',
      roles: ['admin', 'user'],
      middlewares: [userController.findAll],
    }),
    new Route({
      method: 'GET',
      path: '/:id',
      rai: 'users:read',
      roles: ['admin', 'user'],
      middlewares: [userController.findById],
    }),
    new Route({
      method: 'POST',
      path: '/',
      rai: 'users:create',
      roles: ['admin'],
      middlewares: [userController.create],
    }),
  ],
});

export default defineModule({
  name: 'users',
  description: 'User management module',
  routes: usersRoutes,
  imports: ['auth'],
  onInit: async (ctx) => {
    ctx.logger.info('Users module initialized');
  },
});
```

### 3. Set up routing with RBAC

```typescript
// src/bootstrap.ts
import { Wecon, Routes } from '@weconjs/core';
import usersModule from './modules/users/users.module.js';
import authModule from './modules/auth/auth.module.js';

const roles = ['admin', 'user', 'guest'] as const;

export const wecon = new Wecon()
  .roles(roles)
  .guestRole('guest')
  .routes(
    new Routes({
      prefix: '/api',
      routes: [authModule.routes!, usersModule.routes!],
    })
  )
  .dev({ helpfulErrors: true, logRoutes: true })
  .build();

export const modules = [authModule, usersModule];
```

### 4. Create the application entry point

```typescript
// src/main.ts
import { createWecon, loadConfig, buildUriFromConfig } from '@weconjs/core';
import { wecon, modules } from './bootstrap.js';

async function main() {
  const config = await loadConfig('./wecon.config.ts', process.env.NODE_ENV);

  const app = await createWecon({
    config,
    modules,
    wecon,
    database: {
      enabled: true,
      uri: buildUriFromConfig(config.database),
    },
    logger: { useWinston: true, enableFile: false },
    hooks: {
      onBoot: (ctx) => ctx.logger.info('Server ready'),
      onShutdown: (ctx) => ctx.logger.info('Shutting down...'),
    },
  });

  await app.start();
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
```

## Configuration

### Mode-based configuration

Define environment-specific settings that deep-merge with a base configuration. Modes can inherit from other modes with `extends`:

```typescript
import { defineConfig } from '@weconjs/core';

export default defineConfig({
  app: { name: 'my-api', version: '1.0.0' },
  modes: {
    development: {
      port: 3000,
      logging: { level: 'debug' },
    },
    staging: {
      extends: 'development',
      port: 3000,
      logging: { level: 'info' },
    },
    production: {
      port: 8080,
      logging: { level: 'warn', enableFile: true },
      https: {
        enabled: true,
        keyPath: './certs/privkey.pem',
        certPath: './certs/fullchain.pem',
      },
    },
  },
});
```

### Loading & resolving configuration

```typescript
import { loadConfig, resolveConfig } from '@weconjs/core';

// Load and resolve for the current environment
const config = await loadConfig('./wecon.config.ts', process.env.NODE_ENV);

// Or resolve separately
const rawConfig = await loadConfig('./wecon.config.ts');
const resolved = resolveConfig(rawConfig, 'production');
```

### Per-module configuration

Modules can declare a Zod schema for their configuration. Values are validated at startup and accessible at runtime through the context:

```typescript
import { z } from 'zod';
import { defineModule } from '@weconjs/core';

export default defineModule({
  name: 'mail',
  config: {
    schema: z.object({
      from: z.string().email(),
      provider: z.enum(['ses', 'sendgrid']),
    }),
    defaults: { provider: 'ses' },
  },
  onInit: async (ctx) => {
    const mailConfig = ctx.getModuleConfig<{ from: string; provider: string }>('mail');
    ctx.logger.info(`Mail provider: ${mailConfig.provider}`);
  },
});
```

Provide values in your config file:

```typescript
export default defineConfig({
  app: { name: 'my-api' },
  moduleConfigs: {
    mail: { from: 'hello@example.com' },
  },
  // ...
});
```

## Modules

### Defining modules

```typescript
import { defineModule } from '@weconjs/core';

export default defineModule({
  name: 'auth',
  description: 'Authentication and authorization',
  routes: authRoutes,          // Routes instance
  imports: ['database-seeds'], // Dependencies (loaded first)
  exports: ['authService'],    // Exported services
  path: __dirname,             // Enables per-module package.json

  onInit: async (ctx) => {
    // Called when the module is initialized
  },
  onDestroy: async (ctx) => {
    // Called on graceful shutdown
  },
});
```

### Dependency resolution

Modules are sorted using topological sort, with circular dependency detection:

```typescript
import { loadModule, resolveModuleDependencies } from '@weconjs/core';

const modules = await Promise.all([
  loadModule('./src/modules/users'),
  loadModule('./src/modules/auth'),
  loadModule('./src/modules/orders'),
]);

// Returns modules in correct initialization order
const sorted = resolveModuleDependencies(modules);
```

### Per-module dependencies

Each module can have its own `package.json` for isolated dependencies. The framework can auto-install missing dependencies in development:

```typescript
const app = await createWecon({
  config,
  modules,
  moduleDeps: {
    autoInstall: true,
    rootDir: process.cwd(),
    paths: {
      auth: './src/modules/auth',
      users: './src/modules/users',
    },
  },
});
```

## Routing & RBAC

Wecon uses a two-layer architecture for request processing:

1. **Intelligence Layer** — `RaiMatcher` resolves the request to a RAI (Route Access Identifier) and checks authorization against the user's roles
2. **Execution Layer** — a single compiled Express Router handles the request

### Route Access Identifiers (RAI)

Every route has a unique RAI string (e.g. `users:list`, `orders:create`). The RAI is used for authorization checks and route introspection.

### Defining routes

```typescript
import { Route, Routes, RoutesParam } from '@weconjs/core';

const routes = new Routes({
  prefix: '/api/orders',
  middlewares: [authMiddleware],
  routes: [
    new Route({
      method: 'GET',
      path: '/',
      rai: 'orders:list',
      roles: ['admin', 'user'],
      middlewares: [orderController.list],
    }),
    new Route({
      method: 'POST',
      path: '/',
      rai: 'orders:create',
      roles: ['admin', 'user'],
      middlewares: [validateOrder, orderController.create],
    }),
    new Route({
      method: 'DELETE',
      path: '/:id',
      rai: 'orders:delete',
      roles: ['admin'],
      middlewares: [orderController.delete],
      meta: { audit: true },
    }),
  ],
});
```

Routes can be nested. Prefixes, middleware, and params accumulate from parent groups:

```typescript
const apiRoutes = new Routes({
  prefix: '/api',
  middlewares: [corsMiddleware, rateLimiter],
  routes: [authRoutes, userRoutes, orderRoutes],
});
```

### Building the Wecon instance

```typescript
import { Wecon } from '@weconjs/core';

const wecon = new Wecon()
  .roles(['admin', 'user', 'guest'] as const)
  .guestRole('guest')
  .routes(apiRoutes)
  .dev({
    debugMode: true,
    helpfulErrors: true,  // Detailed 401/404 messages in development
    logRoutes: true,
  })
  .onRoutesPrepared((routes) => {
    console.log(`Registered ${routes.length} routes`);
  })
  .build();

// Mount as Express middleware
app.use(wecon.handler());
```

### Type-safe roles

Augment the global `Wecon.Roles` type for compile-time role checking:

```typescript
// wecon.d.ts
declare global {
  namespace Wecon {
    type Roles = 'admin' | 'user' | 'guest';
  }
}
export {};
```

### Route introspection

```typescript
const allRoutes = wecon.getRoutes();
const route = wecon.getRoute('users:read');
```

## Database

### URI builder

```typescript
import { buildMongoUri, buildUriFromConfig } from '@weconjs/core';

const uri = buildMongoUri({
  protocol: 'mongodb+srv',
  host: 'cluster.mongodb.net',
  database: 'myapp',
  username: 'user',
  password: 'pass',
  options: { retryWrites: 'true', w: 'majority' },
});

// Or build from a resolved config
const uri = buildUriFromConfig(config.database);
```

### Connection with retry logic

```typescript
import { createDatabaseConnection } from '@weconjs/core';

const db = await createDatabaseConnection({
  uri: 'mongodb://localhost/myapp',
  plugins: [timestampPlugin],
  debug: process.env.NODE_ENV === 'development',
  fieldShield: { enabled: true, strict: true },
});

await db.connect();
```

The connection retries with configurable exponential backoff on failure.

## Logging

Two logging backends are supported: Winston (with daily file rotation) and a console-only fallback.

```typescript
import { createWinstonLogger, createConsoleLogger } from '@weconjs/core';

// Winston (requires winston + winston-daily-rotate-file)
const logger = await createWinstonLogger({
  level: 'info',
  appName: 'my-api',
  enableFile: true,
  logDir: './logs',
});

// Console fallback (zero dependencies)
const logger = createConsoleLogger({
  level: 'debug',
  appName: 'my-api',
});

logger.info('Server started', { port: 3000 });
logger.error('Connection failed', { error: err.message });
```

When creating an app with `createWecon`, the framework tries Winston first and falls back to the console logger automatically.

## i18n

Translation files are auto-discovered from module directories. Each module can have a `locales/` folder with JSON files:

```
src/modules/users/locales/en.json
src/modules/users/locales/es.json
```

Enable i18n in your config:

```typescript
const app = await createWecon({
  config,
  modules,
  i18n: { enabled: true, modulesDir: './src/modules' },
});
```

Use translations in handlers via `req.t()`:

```typescript
app.get('/greeting', (req, res) => {
  res.json({ message: req.t('users:welcome', { name: 'Alice' }) });
});
```

Interpolation uses `{{key}}` syntax in translation files:

```json
{ "welcome": "Welcome, {{name}}!" }
```

## Socket.IO

Socket handlers and middleware are auto-discovered from module directories:

```typescript
import { setupSocketIO, createSocketServer } from '@weconjs/core';

// Attach to existing HTTP server
const io = createSocketServer(httpServer, {
  cors: { origin: 'http://localhost:3000' },
});

// Auto-discover handlers from modules
await setupSocketIO(io, './src/modules');
```

Convention: place socket handlers in `src/modules/<name>/sockets/` and middleware in `src/modules/<name>/sockets/middleware/`.

## Context & Services

The `WeconContext` is passed to all module hooks, handlers, and middleware. It provides access to configuration, logging, and a service registry.

```typescript
// Register a service
ctx.registerService('mailer', new MailerService());

// Retrieve a service
const mailer = ctx.getService<MailerService>('mailer');

// Access module config (validated at startup)
const mailConfig = ctx.getModuleConfig<MailConfig>('mail');

// Update module config at runtime (re-validates against Zod schema)
ctx.setModuleConfig('mail', { from: 'new@example.com', provider: 'sendgrid' });
```

## Authentication

Wecon provides an `Authenticable` interface for any model used in authentication. The `WeconRequest` generic lets you type `req.user`:

```typescript
import type { Authenticable, WeconRequest, WeconResponse } from '@weconjs/core';

interface User extends Authenticable {
  email: string;
  name: { first: string; last: string };
}

function getProfile(req: WeconRequest<User>, res: WeconResponse) {
  const user = req.user!;
  res.respond({ data: { email: user.email, roles: user.roles } });
}
```

### Response helpers

The `res.respond()` helper produces standardized API responses:

```typescript
// Success
res.respond({ data: users, meta: { total: users.length } });
// → { success: true, data: [...], errors: null, meta: { total: 10 } }

// Error
res.status(404).respond({
  errors: [{ code: 'NOT_FOUND', message: 'User not found' }],
});
// → { success: false, data: null, errors: [...], meta: null }
```

## Server Factory

`createWecon` is the main entry point. It wires together all framework features and returns a `WeconApp` instance:

```typescript
import { createWecon } from '@weconjs/core';

const app = await createWecon({
  config,
  modules,
  wecon,                          // Wecon routing instance (optional)
  middleware: [cors(), helmet()],  // Custom Express middleware
  database: { enabled: true, uri: '...' },
  plugins: { fieldShield: { strict: true } },
  i18n: { enabled: true, modulesDir: './src/modules' },
  logger: { useWinston: true, enableFile: true, logDir: './logs' },
  moduleDeps: { autoInstall: true, paths: { auth: './src/modules/auth' } },
  hooks: {
    onBoot: async (ctx) => { /* before server starts */ },
    onShutdown: async (ctx) => { /* cleanup */ },
    onModuleInit: async (module, ctx) => { /* after each module init */ },
  },
});

const server = await app.start();     // Start listening
await app.shutdown();                  // Graceful shutdown
```

Features included automatically:
- `express.json()` and `express.urlencoded()` parsing
- `/health` endpoint
- HTTPS support (falls back to HTTP if certs are missing)
- Graceful shutdown on SIGTERM, SIGINT, SIGUSR2
- Global error handler with standardized responses

## API Reference

### Configuration

| Export | Description |
|--------|-------------|
| `defineConfig(config)` | Define application configuration with TypeScript support |
| `resolveConfig(config, mode)` | Resolve configuration for a specific mode |
| `loadConfig(path, mode?)` | Load configuration file and optionally resolve mode |

### Modules

| Export | Description |
|--------|-------------|
| `defineModule(definition)` | Define a module with routes and lifecycle hooks |
| `loadModule(path)` | Load a module from file path |
| `resolveModuleDependencies(modules)` | Sort modules by dependencies (topological sort) |
| `readModulePackageJson(path)` | Read a module's package.json |
| `checkModuleDeps(path, rootDir)` | Check if module dependencies are installed |
| `installModuleDeps(path, rootDir)` | Install missing module dependencies |
| `resolveAllModuleDeps(modules, rootDir, logger, autoInstall)` | Check/install deps for all modules |
| `detectPackageManager()` | Detect npm/yarn/pnpm |

### Server

| Export | Description |
|--------|-------------|
| `createWecon(options)` | Create and configure the application |

### Routing

| Export | Description |
|--------|-------------|
| `Wecon` | Main routing class with fluent API and RBAC |
| `Route` | Single endpoint definition (method, path, RAI, roles, middlewares) |
| `Routes` | Hierarchical route group with prefix, middleware, and params |
| `RoutesParam` | Route parameter definition with validation |
| `RaiMatcher` | RAI resolution engine (maps request path + method to a RAI) |
| `ErrorCatcher` | Base class for configuration error reporting |

### Database

| Export | Description |
|--------|-------------|
| `createDatabaseConnection(options)` | Create MongoDB connection with retry logic |
| `buildMongoUri(parts)` | Build MongoDB URI from parts |
| `buildUriFromConfig(config)` | Build URI from database config object |

### Logging

| Export | Description |
|--------|-------------|
| `createWinstonLogger(options)` | Create Winston logger with file rotation |
| `createConsoleLogger(options)` | Create console-based fallback logger |

### i18n

| Export | Description |
|--------|-------------|
| `initI18n(modulesDir, defaultLocale)` | Initialize i18n and return Express middleware |
| `loadI18nResources(modulesDir)` | Load translation files from module directories |
| `createI18nMiddleware(resources, defaultLocale)` | Create the Express middleware |

### Socket.IO

| Export | Description |
|--------|-------------|
| `createSocketServer(httpServer, options)` | Create Socket.IO server |
| `setupSocketIO(io, modulesDir)` | Auto-discover and register handlers |
| `initializeSocket(server, modulesDir, options)` | Combined setup helper |
| `discoverSocketHandlers(modulesDir)` | Find socket handler files in modules |
| `discoverSocketMiddleware(modulesDir)` | Find socket middleware files in modules |

### Context

| Export | Description |
|--------|-------------|
| `createContext(options)` | Create application context with service registry |
| `createLogger(options)` | Create a logger instance |

### Errors

| Export | Description |
|--------|-------------|
| `ConfigError` | Configuration error with code and metadata |
| `RequestError` | Request error with code and metadata |

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run build         # Build TypeScript to dist/
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- Express 5.x (peer dependency)
- Mongoose 8.x (peer dependency)

## License

MIT

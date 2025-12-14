# @weconjs/core

> Core framework package for Wecon - A convention-over-configuration Node.js framework.

[![npm version](https://img.shields.io/npm/v/@weconjs/core.svg)](https://www.npmjs.com/package/@weconjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @weconjs/core
# or
yarn add @weconjs/core
```

## Features

- 🔧 **Configuration System** - Mode-based config with inheritance
- 📦 **Module System** - Auto-discovery and dependency resolution
- 🌐 **i18n Support** - Auto-load translations from modules
- 🔌 **Socket.IO Integration** - Auto-discover socket handlers
- 🗄️ **Database Connection** - MongoDB/Mongoose integration
- 🚀 **Server Factory** - Express server setup in one call

## Quick Start

### Define Configuration

```typescript
// wecon.config.ts
import { defineConfig } from '@weconjs/core';

export default defineConfig({
  app: {
    name: 'my-api',
    version: '1.0.0',
  },
  port: 3000,
  modes: {
    development: {
      database: { uri: 'mongodb://localhost:27017/myapp' },
    },
    production: {
      database: { uri: process.env.DATABASE_URL },
    },
  },
});
```

### Define Modules

```typescript
// src/modules/users/users.module.ts
import { defineModule } from '@weconjs/core';

export default defineModule({
  name: 'users',
  description: 'User management module',
  routes: userRoutes,
  onInit: async (ctx) => {
    console.log('Users module initialized');
  },
});
```

### Create Application

```typescript
// src/index.ts
import { createWecon, resolveConfig, loadConfig, createDatabaseConnection } from '@weconjs/core';

const config = resolveConfig(await loadConfig(), process.env.NODE_ENV);
const db = await createDatabaseConnection({ uri: config.database.uri });

const app = await createWecon({
  config,
  modules: [usersModule, authModule],
  hooks: {
    onBoot: async () => {
      await db.connect();
    },
  },
});

await app.start();
```

## API Reference

### Configuration

- `defineConfig(config)` - Define application configuration
- `resolveConfig(config, mode)` - Resolve config for a specific mode
- `loadConfig()` - Load config from `wecon.config.ts`

### Modules

- `defineModule(definition)` - Define a module
- `loadModule(path)` - Load a module from file
- `resolveModuleDependencies(modules)` - Topologically sort modules

### Server

- `createWecon(options)` - Create Wecon application
- `initI18n(modulesDir)` - Initialize i18n middleware
- `createDatabaseConnection(options)` - Create database connection

### Socket.IO

- `setupSocketIO(httpServer, modulesDir, options)` - Setup Socket.IO
- `discoverSocketHandlers(modulesDir)` - Find socket handlers
- `discoverSocketMiddleware(modulesDir)` - Find socket middleware

### Context

- `createContext(options)` - Create application context
- `createLogger(options)` - Create logger instance

## Testing

```bash
yarn test    # Run tests
yarn build   # Build package
```

## License

MIT © [weconjs](https://github.com/weconjs)

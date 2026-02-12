/**
 * @wecon/core - defineConfig Tests
 *
 * Tests for configuration creation, validation, and flat config resolution.
 */

import { describe, it, expect } from 'vitest';
import { defineConfig, resolveConfig } from '../src/config.js';
import type { WeconConfig } from '../src/types.js';

describe('defineConfig', () => {
  it('should create a valid config with minimal options', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
    });

    expect(config.app.name).toBe('test-app');
    expect(config.app.version).toBe('1.0.0');
    expect(config.modules).toEqual([]);
    expect(config.features).toEqual({});
    expect(config.hooks).toEqual({});
    expect(config.moduleConfigs).toEqual({});
  });

  it('should preserve custom version', () => {
    const config = defineConfig({
      app: { name: 'test-app', version: '2.0.0' },
    });

    expect(config.app.version).toBe('2.0.0');
  });

  it('should throw error when app.name is missing or empty', () => {
    expect(() => {
      defineConfig({
        app: { name: '' },
      });
    }).toThrow('[Wecon] app.name is required');

    expect(() => {
      defineConfig({
        app: {} as { name: string },
      });
    }).toThrow('[Wecon] app.name is required');
  });

  it('should preserve flat config fields', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
      mode: 'production',
      port: 8080,
      database: { debug: false, mongoose: { host: 'db.example.com', database: 'prod-db' } },
      logging: { level: 'warn' },
      https: { enabled: true, port: 443 },
    });

    expect(config.mode).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.database?.debug).toBe(false);
    expect(config.database?.mongoose?.host).toBe('db.example.com');
    expect(config.logging?.level).toBe('warn');
    expect(config.https?.enabled).toBe(true);
  });

  it('should preserve modules array', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
      modules: ['./modules/auth', './modules/users'],
    });

    expect(config.modules).toEqual(['./modules/auth', './modules/users']);
  });

  it('should preserve features configuration', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
      features: {
        socket: { enabled: true, path: '/ws' },
        fieldShield: { enabled: true, strict: true },
      },
    });

    expect(config.features?.socket?.enabled).toBe(true);
    expect(config.features?.socket?.path).toBe('/ws');
    expect(config.features?.fieldShield?.strict).toBe(true);
  });

  it('should preserve moduleConfigs', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
      moduleConfigs: {
        auth: { jwt: { secretKey: 'test-secret' } },
        security: { cors: { origin: '*' } },
      },
    });

    expect((config.moduleConfigs as any).auth.jwt.secretKey).toBe('test-secret');
    expect((config.moduleConfigs as any).security.cors.origin).toBe('*');
  });
});

describe('resolveConfig', () => {
  it('should resolve flat config with explicit values', () => {
    const config: WeconConfig = {
      app: { name: 'test-app', version: '1.0.0' },
      mode: 'development',
      port: 4000,
      database: { debug: true },
      logging: { level: 'debug' },
      modules: ['./modules/auth'],
      features: { socket: { enabled: true } },
    };

    const resolved = resolveConfig(config, 'development');

    expect(resolved.mode).toBe('development');
    expect(resolved.port).toBe(4000);
    expect(resolved.database.debug).toBe(true);
    expect(resolved.logging.level).toBe('debug');
  });

  it('should apply defaults when no overrides are provided', () => {
    const simpleConfig: WeconConfig = {
      app: { name: 'simple-app' },
    };

    const resolved = resolveConfig(simpleConfig, 'development');

    expect(resolved.port).toBe(3001); // Default port
    expect(resolved.logging.level).toBe('info'); // Default level
    expect(resolved.database.debug).toBe(false); // Default debug
    expect(resolved.database.mongoose?.host).toBe('localhost'); // Default host
  });

  it('should deep merge database config over defaults', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      database: {
        debug: true,
        mongoose: { database: 'custom-db' },
      },
    };

    const resolved = resolveConfig(config);

    expect(resolved.database.debug).toBe(true);
    expect(resolved.database.mongoose?.database).toBe('custom-db');
    // Default values preserved
    expect(resolved.database.mongoose?.host).toBe('localhost');
    expect(resolved.database.mongoose?.port).toBe(27017);
  });

  it('should merge features from config', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      features: { socket: { enabled: true } },
    };

    const resolved = resolveConfig(config, 'development');

    expect(resolved.features.socket?.enabled).toBe(true);
  });

  it('should include modules from config', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      modules: ['./modules/auth'],
    };

    const resolved = resolveConfig(config, 'development');

    expect(resolved.modules).toEqual(['./modules/auth']);
  });

  it('should use mode param over config.mode', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      mode: 'development',
    };

    const resolved = resolveConfig(config, 'production');

    expect(resolved.mode).toBe('production');
  });

  it('should fall back to config.mode when no param is provided', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      mode: 'staging',
    };

    const resolved = resolveConfig(config);

    expect(resolved.mode).toBe('staging');
  });

  it('should use NODE_ENV when mode is not specified', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const config: WeconConfig = {
        app: { name: 'test-app' },
      };

      const resolved = resolveConfig(config);
      expect(resolved.mode).toBe('production');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should default to development when nothing is specified', () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    try {
      const config: WeconConfig = {
        app: { name: 'test-app' },
      };

      const resolved = resolveConfig(config);
      expect(resolved.mode).toBe('development');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should preserve moduleConfigs in resolved config', () => {
    const config: WeconConfig = {
      app: { name: 'test-app' },
      moduleConfigs: {
        auth: { jwt: { secretKey: 'my-secret' } },
      },
    };

    const resolved = resolveConfig(config);

    expect((resolved.moduleConfigs as any).auth.jwt.secretKey).toBe('my-secret');
  });
});

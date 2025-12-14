/**
 * @wecon/core - defineConfig Tests
 *
 * Tests for configuration creation, validation, and mode resolution.
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
    expect(config.modes).toEqual({});
    expect(config.modules).toEqual([]);
    expect(config.features).toEqual({});
    expect(config.hooks).toEqual({});
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

  it('should preserve modes configuration', () => {
    const config = defineConfig({
      app: { name: 'test-app' },
      modes: {
        development: { port: 3001 },
        production: { port: 8080 },
      },
    });

    expect(config.modes?.development?.port).toBe(3001);
    expect(config.modes?.production?.port).toBe(8080);
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
});

describe('resolveConfig', () => {
  const baseConfig: WeconConfig = {
    app: { name: 'test-app', version: '1.0.0' },
    modes: {
      development: {
        port: 3001,
        database: { debug: true },
        logging: { level: 'debug' },
      },
      production: {
        port: 8080,
        database: { debug: false },
        logging: { level: 'warn' },
      },
      staging: {
        extends: 'production',
        port: 8081,
        database: {
          mongoose: { database: 'staging-db' },
        },
      },
    },
    modules: ['./modules/auth'],
    features: {
      socket: { enabled: true },
    },
  };

  it('should resolve development mode', () => {
    const resolved = resolveConfig(baseConfig, 'development');

    expect(resolved.mode).toBe('development');
    expect(resolved.port).toBe(3001);
    expect(resolved.database.debug).toBe(true);
    expect(resolved.logging.level).toBe('debug');
  });

  it('should resolve production mode', () => {
    const resolved = resolveConfig(baseConfig, 'production');

    expect(resolved.mode).toBe('production');
    expect(resolved.port).toBe(8080);
    expect(resolved.database.debug).toBe(false);
    expect(resolved.logging.level).toBe('warn');
  });

  it('should handle mode inheritance with extends', () => {
    const resolved = resolveConfig(baseConfig, 'staging');

    expect(resolved.mode).toBe('staging');
    // Should inherit production port but override with staging port
    expect(resolved.port).toBe(8081);
    // Should inherit production logging
    expect(resolved.logging.level).toBe('warn');
    // Should inherit production database.debug
    expect(resolved.database.debug).toBe(false);
    // Should have staging-specific database name
    expect(resolved.database.mongoose?.database).toBe('staging-db');
  });

  it('should apply defaults when mode is not defined', () => {
    const simpleConfig: WeconConfig = {
      app: { name: 'simple-app' },
    };

    const resolved = resolveConfig(simpleConfig, 'development');

    expect(resolved.port).toBe(3001); // Default port
    expect(resolved.logging.level).toBe('info'); // Default level
  });

  it('should merge features from config', () => {
    const resolved = resolveConfig(baseConfig, 'development');

    expect(resolved.features.socket?.enabled).toBe(true);
  });

  it('should include modules from config', () => {
    const resolved = resolveConfig(baseConfig, 'development');

    expect(resolved.modules).toEqual(['./modules/auth']);
  });

  it('should use defaults for non-existent mode', () => {
    // Non-existent mode should use defaults, not throw
    const resolved = resolveConfig(baseConfig, 'nonexistent');

    expect(resolved.mode).toBe('nonexistent');
    expect(resolved.port).toBe(3001); // Default port
  });

  it('should detect circular mode inheritance', () => {
    const circularConfig: WeconConfig = {
      app: { name: 'circular-app' },
      modes: {
        a: { extends: 'b', port: 3000 },
        b: { extends: 'c', port: 3001 },
        c: { extends: 'a', port: 3002 },
      },
    };

    expect(() => {
      resolveConfig(circularConfig, 'a');
    }).toThrow('Circular mode inheritance detected');
  });

  it('should use NODE_ENV when mode is not specified', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const resolved = resolveConfig(baseConfig);
      expect(resolved.mode).toBe('production');
      expect(resolved.port).toBe(8080);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

/**
 * @wecon/core - createContext Tests
 *
 * Tests for application context creation and management.
 */

import { describe, it, expect, vi } from 'vitest';
import { createContext, createLogger } from '../src/context.js';
import type { ResolvedConfig, WeconLogger } from '../src/types.js';
import type { Application } from 'express';

// Mock Express app
const mockApp = {
  get: vi.fn(),
  post: vi.fn(),
  use: vi.fn(),
} as unknown as Application;

// Mock resolved config
const mockConfig: ResolvedConfig = {
  app: { name: 'test-app', version: '1.0.0' },
  mode: 'development',
  port: 3001,
  database: { debug: true },
  logging: { level: 'debug' },
  https: { enabled: false },
  features: { socket: { enabled: true } },
  modules: ['./modules/auth'],
};

describe('createContext', () => {
  it('should create a valid context with required options', () => {
    const ctx = createContext({
      config: mockConfig,
      app: mockApp,
    });

    expect(ctx.config).toBe(mockConfig);
    expect(ctx.app).toBe(mockApp);
    expect(ctx.logger).toBeDefined();
    expect(ctx.services).toEqual({});
    expect(ctx.io).toBeUndefined();
  });

  it('should include Socket.IO server when provided', () => {
    const mockIo = { on: vi.fn() } as any;

    const ctx = createContext({
      config: mockConfig,
      app: mockApp,
      io: mockIo,
    });

    expect(ctx.io).toBe(mockIo);
  });

  it('should use custom logger when provided', () => {
    const customLogger: WeconLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const ctx = createContext({
      config: mockConfig,
      app: mockApp,
      logger: customLogger,
    });

    expect(ctx.logger).toBe(customLogger);
  });

  describe('registerService', () => {
    it('should register a service', () => {
      const ctx = createContext({
        config: mockConfig,
        app: mockApp,
      });

      const authService = { login: vi.fn() };
      ctx.registerService('auth', authService);

      expect(ctx.services.auth).toBe(authService);
    });

    it('should allow overwriting a service with warning', () => {
      const ctx = createContext({
        config: mockConfig,
        app: mockApp,
      });

      const service1 = { version: 1 };
      const service2 = { version: 2 };

      ctx.registerService('myService', service1);
      ctx.registerService('myService', service2);

      expect(ctx.services.myService).toBe(service2);
    });
  });

  describe('getService', () => {
    it('should retrieve a registered service', () => {
      const ctx = createContext({
        config: mockConfig,
        app: mockApp,
      });

      interface AuthService {
        login: () => void;
      }

      const authService: AuthService = { login: vi.fn() };
      ctx.registerService('auth', authService);

      const retrieved = ctx.getService<AuthService>('auth');
      expect(retrieved).toBe(authService);
    });

    it('should return undefined for non-existent service', () => {
      const ctx = createContext({
        config: mockConfig,
        app: mockApp,
      });

      const result = ctx.getService('nonexistent');
      expect(result).toBeUndefined();
    });
  });
});

describe('createLogger', () => {
  it('should create a logger that respects log level', () => {
    const warnConfig: ResolvedConfig = {
      ...mockConfig,
      logging: { level: 'warn' },
    };

    const logger = createLogger(warnConfig);

    // These shouldn't output anything (below warn level)
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should log all levels when level is debug', () => {
    const debugConfig: ResolvedConfig = {
      ...mockConfig,
      logging: { level: 'debug' },
    };

    const logger = createLogger(debugConfig);

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should use custom logger when provided', () => {
    const customLogger: WeconLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = createLogger(mockConfig, customLogger);
    expect(result).toBe(customLogger);
  });
});

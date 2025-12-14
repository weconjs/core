/**
 * @wecon/core - defineModule Tests
 *
 * Tests for module definition, validation, and socket discovery.
 */

import { describe, it, expect, vi } from 'vitest';
import { defineModule, resolveModuleDependencies } from '../src/module.js';
import type { WeconModule } from '../src/types.js';

describe('defineModule', () => {
  it('should create a valid module with minimal options', () => {
    const module = defineModule({
      name: 'auth',
    });

    expect(module.name).toBe('auth');
    expect(module.namespace).toBe('auth');
    expect(module.description).toBe('');
    expect(module.imports).toEqual([]);
    expect(module.exports).toEqual([]);
    expect(module.socketHandlers).toEqual([]);
    expect(module.socketMiddleware).toEqual([]);
  });

  it('should use custom namespace when provided', () => {
    const module = defineModule({
      name: 'auth',
      namespace: 'authentication',
    });

    expect(module.namespace).toBe('authentication');
  });

  it('should preserve description', () => {
    const module = defineModule({
      name: 'auth',
      description: 'Authentication module',
    });

    expect(module.description).toBe('Authentication module');
  });

  it('should preserve imports and exports', () => {
    const module = defineModule({
      name: 'auth',
      imports: ['users', 'config'],
      exports: ['AuthService', 'JwtService'],
    });

    expect(module.imports).toEqual(['users', 'config']);
    expect(module.exports).toEqual(['AuthService', 'JwtService']);
  });

  it('should preserve lifecycle hooks', () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();

    const module = defineModule({
      name: 'auth',
      onInit,
      onDestroy,
    });

    expect(module.onInit).toBe(onInit);
    expect(module.onDestroy).toBe(onDestroy);
  });

  it('should throw error for missing name', () => {
    expect(() => {
      defineModule({
        name: '',
      });
    }).toThrow('[Wecon] Module name is required');

    expect(() => {
      defineModule({} as { name: string });
    }).toThrow('[Wecon] Module name is required');
  });

  it('should throw error for invalid name format', () => {
    expect(() => {
      defineModule({ name: 'Auth' }); // Uppercase
    }).toThrow('Invalid module name');

    expect(() => {
      defineModule({ name: '123auth' }); // Starts with number
    }).toThrow('Invalid module name');

    expect(() => {
      defineModule({ name: 'auth_module' }); // Underscore
    }).toThrow('Invalid module name');
  });

  it('should accept valid name formats', () => {
    expect(() => defineModule({ name: 'auth' })).not.toThrow();
    expect(() => defineModule({ name: 'user-auth' })).not.toThrow();
    expect(() => defineModule({ name: 'auth123' })).not.toThrow();
    expect(() => defineModule({ name: 'my-module-v2' })).not.toThrow();
  });
});

describe('resolveModuleDependencies', () => {
  it('should return modules in dependency order', () => {
    const modules = new Map<string, WeconModule>([
      ['users', defineModule({ name: 'users' })],
      ['auth', defineModule({ name: 'auth', imports: ['users'] })],
      ['api', defineModule({ name: 'api', imports: ['auth', 'users'] })],
    ]);

    const ordered = resolveModuleDependencies(modules);
    const names = ordered.map((m) => m.name);

    // users should come before auth and api
    expect(names.indexOf('users')).toBeLessThan(names.indexOf('auth'));
    expect(names.indexOf('users')).toBeLessThan(names.indexOf('api'));
    // auth should come before api
    expect(names.indexOf('auth')).toBeLessThan(names.indexOf('api'));
  });

  it('should handle modules with no dependencies', () => {
    const modules = new Map<string, WeconModule>([
      ['a', defineModule({ name: 'a' })],
      ['b', defineModule({ name: 'b' })],
      ['c', defineModule({ name: 'c' })],
    ]);

    const ordered = resolveModuleDependencies(modules);
    expect(ordered).toHaveLength(3);
  });

  it('should detect circular dependencies', () => {
    const modules = new Map<string, WeconModule>([
      ['a', defineModule({ name: 'a', imports: ['b'] })],
      ['b', defineModule({ name: 'b', imports: ['c'] })],
      ['c', defineModule({ name: 'c', imports: ['a'] })],
    ]);

    expect(() => {
      resolveModuleDependencies(modules);
    }).toThrow('Circular module dependency detected');
  });

  it('should throw for missing dependency', () => {
    const modules = new Map<string, WeconModule>([
      ['auth', defineModule({ name: 'auth', imports: ['nonexistent'] })],
    ]);

    expect(() => {
      resolveModuleDependencies(modules);
    }).toThrow('[Wecon] Module "nonexistent" not found');
  });

  it('should handle complex dependency graph', () => {
    const modules = new Map<string, WeconModule>([
      ['config', defineModule({ name: 'config' })],
      ['database', defineModule({ name: 'database', imports: ['config'] })],
      ['users', defineModule({ name: 'users', imports: ['database'] })],
      ['auth', defineModule({ name: 'auth', imports: ['users', 'config'] })],
      ['api', defineModule({ name: 'api', imports: ['auth', 'users'] })],
    ]);

    const ordered = resolveModuleDependencies(modules);
    const names = ordered.map((m) => m.name);

    // Verify dependency order
    expect(names.indexOf('config')).toBeLessThan(names.indexOf('database'));
    expect(names.indexOf('database')).toBeLessThan(names.indexOf('users'));
    expect(names.indexOf('users')).toBeLessThan(names.indexOf('auth'));
    expect(names.indexOf('auth')).toBeLessThan(names.indexOf('api'));
  });
});

/**
 * @wecon/core - Module Loader Tests
 *
 * Tests for per-module package.json reading and dependency checking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import {
  readModulePackageJson,
  checkModuleDeps,
  detectPackageManager,
} from "../src/module/module-loader.js";

const TEST_DIR = join(process.cwd(), "__tests__", ".tmp-module-loader");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("readModulePackageJson", () => {
  it("should return null when no package.json exists", () => {
    const result = readModulePackageJson(join(TEST_DIR, "nonexistent"));
    expect(result).toBeNull();
  });

  it("should read a valid module package.json", () => {
    const modulePath = join(TEST_DIR, "auth-module");
    mkdirSync(modulePath, { recursive: true });
    writeFileSync(
      join(modulePath, "package.json"),
      JSON.stringify({
        name: "@app/auth-module",
        private: true,
        dependencies: {
          jsonwebtoken: "^9.0.2",
          bcrypt: "^5.1.1",
        },
      })
    );

    const result = readModulePackageJson(modulePath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("@app/auth-module");
    expect(result!.dependencies).toEqual({
      jsonwebtoken: "^9.0.2",
      bcrypt: "^5.1.1",
    });
  });

  it("should return null for invalid JSON", () => {
    const modulePath = join(TEST_DIR, "bad-module");
    mkdirSync(modulePath, { recursive: true });
    writeFileSync(join(modulePath, "package.json"), "not-json{{{");

    const result = readModulePackageJson(modulePath);
    expect(result).toBeNull();
  });

  it("should handle package.json with no dependencies", () => {
    const modulePath = join(TEST_DIR, "simple-module");
    mkdirSync(modulePath, { recursive: true });
    writeFileSync(
      join(modulePath, "package.json"),
      JSON.stringify({ name: "@app/simple", private: true })
    );

    const result = readModulePackageJson(modulePath);
    expect(result).not.toBeNull();
    expect(result!.dependencies).toBeUndefined();
  });
});

describe("checkModuleDeps", () => {
  it("should detect missing dependencies", () => {
    const modulePath = join(TEST_DIR, "with-deps");
    const rootDir = join(TEST_DIR, "project-root");
    mkdirSync(modulePath, { recursive: true });
    mkdirSync(join(rootDir, "node_modules"), { recursive: true });

    writeFileSync(
      join(modulePath, "package.json"),
      JSON.stringify({
        dependencies: {
          "some-lib": "^1.0.0",
          "another-lib": "^2.0.0",
        },
      })
    );

    const result = checkModuleDeps(modulePath, rootDir, "test-module");
    expect(result.moduleName).toBe("test-module");
    expect(result.missing).toEqual(["some-lib", "another-lib"]);
    expect(result.installed).toEqual([]);
  });

  it("should detect installed dependencies", () => {
    const modulePath = join(TEST_DIR, "installed-deps");
    const rootDir = join(TEST_DIR, "project-root-2");
    mkdirSync(modulePath, { recursive: true });
    mkdirSync(join(rootDir, "node_modules", "express"), { recursive: true });

    writeFileSync(
      join(modulePath, "package.json"),
      JSON.stringify({
        dependencies: {
          express: "^5.0.0",
          "missing-pkg": "^1.0.0",
        },
      })
    );

    const result = checkModuleDeps(modulePath, rootDir, "test-module");
    expect(result.installed).toEqual(["express"]);
    expect(result.missing).toEqual(["missing-pkg"]);
  });

  it("should return empty arrays when no package.json exists", () => {
    const modulePath = join(TEST_DIR, "no-pkg");
    const rootDir = join(TEST_DIR, "root");
    mkdirSync(modulePath, { recursive: true });
    mkdirSync(rootDir, { recursive: true });

    const result = checkModuleDeps(modulePath, rootDir, "no-pkg");
    expect(result.declared).toEqual({});
    expect(result.missing).toEqual([]);
    expect(result.installed).toEqual([]);
  });
});

describe("detectPackageManager", () => {
  it("should detect npm by default", () => {
    const rootDir = join(TEST_DIR, "npm-project");
    mkdirSync(rootDir, { recursive: true });

    expect(detectPackageManager(rootDir)).toBe("npm");
  });

  it("should detect yarn from yarn.lock", () => {
    const rootDir = join(TEST_DIR, "yarn-project");
    mkdirSync(rootDir, { recursive: true });
    writeFileSync(join(rootDir, "yarn.lock"), "");

    expect(detectPackageManager(rootDir)).toBe("yarn");
  });

  it("should detect pnpm from pnpm-lock.yaml", () => {
    const rootDir = join(TEST_DIR, "pnpm-project");
    mkdirSync(rootDir, { recursive: true });
    writeFileSync(join(rootDir, "pnpm-lock.yaml"), "");

    expect(detectPackageManager(rootDir)).toBe("pnpm");
  });

  it("should prefer pnpm when both lock files exist", () => {
    const rootDir = join(TEST_DIR, "both-project");
    mkdirSync(rootDir, { recursive: true });
    writeFileSync(join(rootDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(rootDir, "yarn.lock"), "");

    expect(detectPackageManager(rootDir)).toBe("pnpm");
  });
});

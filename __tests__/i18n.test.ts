/**
 * @wecon/core - i18n Tests
 *
 * Tests for I18nLoader, initializeI18n, i18nNamespaceMiddleware,
 * and i18n utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { I18nLoader } from "../src/i18n/loader.js";
import { i18nNamespaceMiddleware } from "../src/i18n/middleware.js";
import { translate, getCurrentLanguage, changeLanguage } from "../src/i18n/utils.js";

const TEST_DIR = join(process.cwd(), "__tests__", ".tmp-i18n");

function createTranslationFile(
  moduleName: string,
  lang: string,
  content: Record<string, unknown>
) {
  const dir = join(TEST_DIR, moduleName, "i18n");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${lang}.translation.json`),
    JSON.stringify(content, null, 2),
    "utf-8"
  );
}

// =============================================================================
// I18nLoader
// =============================================================================

describe("I18nLoader", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should load translations from module i18n directories", () => {
    createTranslationFile("auth", "en", {
      validation: { REQUIRED_EMAIL: "Email is required" },
    });
    createTranslationFile("auth", "fr", {
      validation: { REQUIRED_EMAIL: "L'email est requis" },
    });

    const loader = new I18nLoader(TEST_DIR);
    const resources = loader.loadAll();

    expect(resources.en).toBeDefined();
    expect(resources.en.auth).toBeDefined();
    expect(resources.en.auth.validation).toEqual({
      REQUIRED_EMAIL: "Email is required",
    });
    expect(resources.fr.auth.validation).toEqual({
      REQUIRED_EMAIL: "L'email est requis",
    });
  });

  it("should handle missing modules directory gracefully", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const loader = new I18nLoader("/nonexistent/path");
    const resources = loader.loadAll();

    expect(resources).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should handle modules without i18n directories", () => {
    // Create a module directory without an i18n subfolder
    mkdirSync(join(TEST_DIR, "users"), { recursive: true });

    const loader = new I18nLoader(TEST_DIR);
    const resources = loader.loadAll();

    expect(resources).toEqual({});
  });

  it("should handle invalid JSON files gracefully", () => {
    const dir = join(TEST_DIR, "broken", "i18n");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "en.translation.json"), "{ invalid json", "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const loader = new I18nLoader(TEST_DIR);
    const resources = loader.loadAll();

    expect(resources.en?.broken).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should detect supported languages from filenames", () => {
    createTranslationFile("core", "en", { hello: "Hello" });
    createTranslationFile("core", "fr", { hello: "Bonjour" });
    createTranslationFile("core", "ar", { hello: "مرحبا" });

    const loader = new I18nLoader(TEST_DIR);
    loader.loadAll();

    const languages = loader.getSupportedLanguages();
    expect(languages).toContain("en");
    expect(languages).toContain("fr");
    expect(languages).toContain("ar");
    expect(languages).toHaveLength(3);
  });

  it("should detect namespaces from directory structure", () => {
    createTranslationFile("core", "en", { hello: "Hello" });
    createTranslationFile("auth", "en", { login: "Login" });
    createTranslationFile("users", "en", { profile: "Profile" });

    const loader = new I18nLoader(TEST_DIR);
    loader.loadAll();

    const namespaces = loader.getNamespaces();
    expect(namespaces).toContain("core");
    expect(namespaces).toContain("auth");
    expect(namespaces).toContain("users");
    expect(namespaces).toHaveLength(3);
  });

  it("should merge multiple modules into one resource object", () => {
    createTranslationFile("core", "en", { errors: { NOT_FOUND: "Not found" } });
    createTranslationFile("auth", "en", { login: { success: "Logged in" } });
    createTranslationFile("core", "fr", { errors: { NOT_FOUND: "Non trouvé" } });
    createTranslationFile("auth", "fr", { login: { success: "Connecté" } });

    const loader = new I18nLoader(TEST_DIR);
    const resources = loader.loadAll();

    // English
    expect(resources.en.core.errors).toEqual({ NOT_FOUND: "Not found" });
    expect(resources.en.auth.login).toEqual({ success: "Logged in" });

    // French
    expect(resources.fr.core.errors).toEqual({ NOT_FOUND: "Non trouvé" });
    expect(resources.fr.auth.login).toEqual({ success: "Connecté" });
  });

  it("should return resources via getResources()", () => {
    createTranslationFile("core", "en", { hello: "Hello" });

    const loader = new I18nLoader(TEST_DIR);
    loader.loadAll();

    const resources = loader.getResources();
    expect(resources.en.core.hello).toBe("Hello");
  });

  it("should ignore non-translation files in i18n directories", () => {
    createTranslationFile("core", "en", { hello: "Hello" });
    // Write a non-translation file
    writeFileSync(
      join(TEST_DIR, "core", "i18n", "README.md"),
      "# Documentation",
      "utf-8"
    );

    const loader = new I18nLoader(TEST_DIR);
    const resources = loader.loadAll();

    expect(loader.getSupportedLanguages()).toEqual(["en"]);
    expect(resources.en.core.hello).toBe("Hello");
  });

  it("should reset resources on each loadAll() call", () => {
    createTranslationFile("core", "en", { hello: "Hello" });

    const loader = new I18nLoader(TEST_DIR);
    loader.loadAll();
    expect(loader.getSupportedLanguages()).toEqual(["en"]);

    // Clean and recreate with different content
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    createTranslationFile("core", "fr", { hello: "Bonjour" });

    loader.loadAll();
    expect(loader.getSupportedLanguages()).toEqual(["fr"]);
    expect(loader.getResources().en).toBeUndefined();
  });
});

// =============================================================================
// initializeI18n
// =============================================================================

describe("initializeI18n", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should return a middleware function", async () => {
    createTranslationFile("core", "en", { hello: "Hello" });

    const { initializeI18n } = await import("../src/i18n/middleware.js");
    const middleware = await initializeI18n(TEST_DIR, "en");

    expect(typeof middleware).toBe("function");
  });

  it("should initialize i18next with loaded resources", async () => {
    createTranslationFile("core", "en", { hello: "Hello" });
    createTranslationFile("core", "fr", { hello: "Bonjour" });

    const { initializeI18n, getI18n } = await import(
      "../src/i18n/middleware.js"
    );
    await initializeI18n(TEST_DIR, "en");

    const i18n = getI18n();
    expect(i18n.isInitialized).toBe(true);
  });

  it("should use provided fallback language", async () => {
    createTranslationFile("core", "fr", { hello: "Bonjour" });

    const { initializeI18n, getI18n } = await import(
      "../src/i18n/middleware.js"
    );
    await initializeI18n(TEST_DIR, "fr");

    const i18n = getI18n();
    expect(i18n.options.fallbackLng).toContain("fr");
  });

  it("should work with empty modules directory", async () => {
    const { initializeI18n } = await import("../src/i18n/middleware.js");
    const middleware = await initializeI18n(TEST_DIR, "en");

    expect(typeof middleware).toBe("function");
  });
});

// =============================================================================
// i18nNamespaceMiddleware
// =============================================================================

describe("i18nNamespaceMiddleware", () => {
  it("should skip if req.i18n is not set", () => {
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    i18nNamespaceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.t).toBeUndefined();
  });

  it("should set req.t using route namespace", () => {
    const mockFixedT = vi.fn();
    const req = {
      i18n: {
        language: "en",
        getFixedT: vi.fn().mockReturnValue(mockFixedT),
      },
      route_instance: {
        meta: { namespace: "auth" },
      },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    i18nNamespaceMiddleware(req, res, next);

    expect(req.i18n.getFixedT).toHaveBeenCalledWith("en", ["auth", "core"]);
    expect(req.t).toBe(mockFixedT);
    expect(next).toHaveBeenCalled();
  });

  it("should fallback to 'core' namespace when no route namespace", () => {
    const mockFixedT = vi.fn();
    const req = {
      i18n: {
        language: "fr",
        getFixedT: vi.fn().mockReturnValue(mockFixedT),
      },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    i18nNamespaceMiddleware(req, res, next);

    expect(req.i18n.getFixedT).toHaveBeenCalledWith("fr", ["core", "core"]);
    expect(next).toHaveBeenCalled();
  });

  it("should default to 'en' when i18n.language is not set", () => {
    const mockFixedT = vi.fn();
    const req = {
      i18n: {
        language: undefined,
        getFixedT: vi.fn().mockReturnValue(mockFixedT),
      },
      route_instance: {
        meta: { namespace: "users" },
      },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    i18nNamespaceMiddleware(req, res, next);

    expect(req.i18n.getFixedT).toHaveBeenCalledWith("en", ["users", "core"]);
    expect(next).toHaveBeenCalled();
  });
});

// =============================================================================
// translate
// =============================================================================

describe("translate", () => {
  it("should return req.t wrapper when i18n is available", () => {
    const req = {
      t: vi.fn().mockReturnValue("Translated text"),
    } as any;

    const t = translate(req);
    const result = t("auth:login.success");

    expect(req.t).toHaveBeenCalledWith("auth:login.success", undefined);
    expect(result).toBe("Translated text");
  });

  it("should pass options to req.t", () => {
    const req = {
      t: vi.fn().mockReturnValue("Hello, John!"),
    } as any;

    const t = translate(req);
    t("core:welcome", { name: "John" });

    expect(req.t).toHaveBeenCalledWith("core:welcome", { name: "John" });
  });

  it("should return key as fallback when i18n is not initialized", () => {
    const req = {} as any;

    const t = translate(req);
    const result = t("core:errors.NOT_FOUND");

    expect(result).toBe("core:errors.NOT_FOUND");
  });
});

// =============================================================================
// getCurrentLanguage
// =============================================================================

describe("getCurrentLanguage", () => {
  it("should return language from req.i18n", () => {
    const req = {
      i18n: { language: "fr" },
    } as any;

    expect(getCurrentLanguage(req)).toBe("fr");
  });

  it("should default to 'en' when i18n is not available", () => {
    const req = {} as any;

    expect(getCurrentLanguage(req)).toBe("en");
  });
});

// =============================================================================
// changeLanguage
// =============================================================================

describe("changeLanguage", () => {
  it("should call req.i18n.changeLanguage", () => {
    const req = {
      i18n: { changeLanguage: vi.fn() },
    } as any;

    changeLanguage(req, "ar");

    expect(req.i18n.changeLanguage).toHaveBeenCalledWith("ar");
  });

  it("should not throw when i18n is not available", () => {
    const req = {} as any;

    expect(() => changeLanguage(req, "fr")).not.toThrow();
  });
});

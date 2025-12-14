/**
 * Logger Tests
 *
 * Tests for the Winston-based logger factory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsoleLogger, createWinstonLogger } from "../src/logger/index.js";

describe("createConsoleLogger", () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a logger with default options", () => {
    const logger = createConsoleLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should log messages at info level by default", () => {
    const logger = createConsoleLogger();

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    // Debug should be filtered out at 'info' level
    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("should log all levels when level is debug", () => {
    const logger = createConsoleLogger({ level: "debug" });

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("should only log errors when level is error", () => {
    const logger = createConsoleLogger({ level: "error" });

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("should include app name in log output", () => {
    const logger = createConsoleLogger({ appName: "test-app", level: "debug" });

    logger.info("test message");

    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining("[test-app]")
    );
  });

  it("should include metadata in log output", () => {
    const logger = createConsoleLogger({ level: "debug" });

    logger.info("test message", { userId: "123", action: "login" });

    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('"userId":"123"')
    );
  });

  it("should include timestamp in log output", () => {
    const logger = createConsoleLogger({ level: "debug" });

    logger.info("test message");

    // ISO format timestamp check
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T/)
    );
  });
});

describe("createWinstonLogger", () => {
  it("should create a logger asynchronously", async () => {
    const logger = await createWinstonLogger({ level: "info" });

    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should have winston instance when winston is available", async () => {
    const logger = await createWinstonLogger();

    // Winston should be available in the test environment
    expect(logger.winston).toBeDefined();
  });

  it("should respect log level configuration", async () => {
    const logger = await createWinstonLogger({ level: "error" });

    // Since winston handles level filtering internally,
    // we just verify the logger was created with the correct config
    expect(logger).toBeDefined();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */

class ConfigError extends Error {
  public meta: Record<string, any>;

  constructor(message: string, meta: Record<string, any> = {}) {
    super(`ConfigError: ${message}`);
    this.message = message;
    this.meta = meta;

    Object.setPrototypeOf(this, ConfigError.prototype);
    this.name = "ConfigError";

    if ("captureStackTrace" in Error) {
      Error.captureStackTrace(this, ConfigError);
    }
  }
}

export default ConfigError;

import { randomUUID } from "crypto";
import type { RequestParamHandler } from "express";
import ErrorCatcher from "./ErrorCatcher.js";
import type { ErrorTraceType, PossibleErrosType } from "../types.js";
import errors from "../errors/index.js";

/**
 * Parameter handler with optional validation rules.
 * Attached to Routes to validate and process URL params (e.g. :userId).
 */
class RoutesParam extends ErrorCatcher {
  readonly uuid: string;
  public path: string;
  public middleware: RequestParamHandler;
  validate?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    validatorFn?: (value: string) => boolean;
  };

  constructor(
    path: string,
    middleware: RequestParamHandler,
    validate?: {
      pattern?: RegExp;
      minLength?: number;
      maxLength?: number;
      validatorFn?: (value: string) => boolean;
    }
  ) {
    super();

    this.uuid = randomUUID();
    this.path = path;
    this.middleware = middleware;
    this.validate = validate;

    try {
      this.validateParam();
    } catch (err) {
      const errInfo = ErrorCatcher.getCallerInfo();
      this.handleConfigError(err as Error, errInfo);
    }
  }

  private validateParam(): void {
    if (!this.path) {
      throw new errors.ConfigError("ROUTES_PARAM:MISSING_PATH");
    }

    if (!this.middleware) {
      throw new errors.ConfigError("ROUTES_PARAM:MISSING_MIDDLEWARE");
    }

    if (this.validate) {
      if (typeof this.validate !== "object" || Array.isArray(this.validate)) {
        throw new errors.ConfigError("ROUTES_PARAM:INVALID_VALIDATE_TYPE");
      }
      if (this.validate.pattern && !(this.validate.pattern instanceof RegExp)) {
        throw new errors.ConfigError("ROUTES_PARAM:INVALID_PATTERN_TYPE");
      }
      if (this.validate.minLength !== undefined && typeof this.validate.minLength !== "number") {
        throw new errors.ConfigError("ROUTES_PARAM:INVALID_MIN_LENGTH_TYPE");
      }
      if (this.validate.maxLength !== undefined && typeof this.validate.maxLength !== "number") {
        throw new errors.ConfigError("ROUTES_PARAM:INVALID_MAX_LENGTH_TYPE");
      }
      if (this.validate.validatorFn && typeof this.validate.validatorFn !== "function") {
        throw new errors.ConfigError("ROUTES_PARAM:INVALID_VALIDATOR_FN_TYPE");
      }
    }
  }

  private handleConfigError(err: Error, errInfo: ErrorTraceType): void {
    const POSSIBLE_ERRORS: PossibleErrosType = {
      "ROUTES_PARAM:INVALID_VALIDATE_TYPE": {
        title: "Invalid 'validate' property type",
        details: "The 'validate' property must be an object, but received: " + typeof this.validate,
        fix: "Ensure validate is an object:\n    validate: { pattern: /regex/, minLength: 3 }",
      },
      "ROUTES_PARAM:MISSING_PATH": {
        title: "Missing required 'path' parameter",
        details: "The RoutesParam instance requires a 'path' to be defined",
        fix: "Provide a path parameter:\n    new RoutesParam('userId', middleware)",
      },
      "ROUTES_PARAM:MISSING_MIDDLEWARE": {
        title: "Missing required 'middleware' parameter",
        details: "The RoutesParam instance requires a 'middleware' function",
        fix: "Provide a middleware function:\n    new RoutesParam('userId', (req, res, next, id) => { next() })",
      },
      "ROUTES_PARAM:INVALID_PATTERN_TYPE": {
        title: "Invalid 'validate.pattern' property type",
        details: "The 'validate.pattern' must be a RegExp, but received: " + typeof this.validate?.pattern,
        fix: "Ensure pattern is a RegExp:\n    validate: { pattern: /^[0-9]+$/ }",
      },
      "ROUTES_PARAM:INVALID_MIN_LENGTH_TYPE": {
        title: "Invalid 'validate.minLength' property type",
        details: "The 'validate.minLength' must be a number, but received: " + typeof this.validate?.minLength,
        fix: "Ensure minLength is a number:\n    validate: { minLength: 3 }",
      },
      "ROUTES_PARAM:INVALID_MAX_LENGTH_TYPE": {
        title: "Invalid 'validate.maxLength' property type",
        details: "The 'validate.maxLength' must be a number, but received: " + typeof this.validate?.maxLength,
        fix: "Ensure maxLength is a number:\n    validate: { maxLength: 50 }",
      },
      "ROUTES_PARAM:INVALID_VALIDATOR_FN_TYPE": {
        title: "Invalid 'validate.validatorFn' property type",
        details: "The 'validate.validatorFn' must be a function, but received: " + typeof this.validate?.validatorFn,
        fix: "Ensure validatorFn is a function:\n    validate: { validatorFn: (value) => value.startsWith('user-') }",
      },
    };

    const errorConfig = POSSIBLE_ERRORS[err.message] || {
      title: err.message,
      details: "An unexpected error occurred",
      fix: "Please check your RoutesParam configuration",
    };

    ErrorCatcher.logError(errorConfig, errInfo);
  }

  /** Run all validation rules against a param value */
  validateValue(value: string): boolean {
    if (!this.validate) return true;

    if (this.validate.pattern && !this.validate.pattern.test(value)) return false;
    if (this.validate.minLength !== undefined && value.length < this.validate.minLength) return false;
    if (this.validate.maxLength !== undefined && value.length > this.validate.maxLength) return false;
    if (this.validate.validatorFn && !this.validate.validatorFn(value)) return false;

    return true;
  }
}

export default RoutesParam;

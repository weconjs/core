import chalk from "chalk";
import type { ErrorInfoType, ErrorTraceType } from "../types.js";

/**
 * Base class for configuration error tracking.
 * Captures caller info from stack traces for precise error reporting.
 */
export abstract class ErrorCatcher {
  /**
   * Extract caller file, line, column from the stack trace.
   * Skips internal frames to point to the user's code.
   */
  static getCallerInfo(): ErrorTraceType {
    const err = new Error();
    const stack = err.stack || "";
    const stackLines = stack.split("\n").slice(1);

    // Skip getCallerInfo and constructor frames
    const callerLine = stackLines[2] || stackLines[1] || "";

    // V8 format: "    at ClassName.method (file:///path/file.ts:15:23)"
    let match = callerLine.match(/\((.+?):(\d+):(\d+)\)$/);

    if (!match) {
      // Format without parentheses: "    at file:///path/file.ts:15:23"
      match = callerLine.match(/at\s+(.+?):(\d+):(\d+)$/);
    }

    if (match) {
      const file = match[1].replace("file://", "");
      const line = parseInt(match[2], 10);
      const column = parseInt(match[3], 10);

      const functionMatch = callerLine.match(/at\s+(?:async\s+)?(\S+?)\s+\(/);
      const functionName = functionMatch ? functionMatch[1] : null;

      return { file, line, column, function: functionName };
    }

    return { file: "unknown", line: 0, column: 0, function: null };
  }

  /**
   * Log a formatted config error with location info, then exit.
   */
  static logError(error: ErrorInfoType, tracedStackInfo: ErrorTraceType): void {
    console.error(
      chalk.red.bold("\n-=>") +
        chalk.white.bold(" Whoops! We caught an error for you.") +
        chalk.red.bold(" <=-\n")
    );

    console.error(chalk.red.bold("✖ Error:"), chalk.white(error.title));
    console.error(chalk.gray("\n  Details:"), chalk.white(error.details));
    console.error(
      chalk.gray("\n  Location:"),
      chalk.cyan(
        `${tracedStackInfo.file}:${tracedStackInfo.line}:${tracedStackInfo.column}`
      )
    );
    console.error(chalk.yellow.bold("\n  💡 How to fix:"));
    console.error(chalk.yellow(`  ${error.fix.replace(/\n/g, "\n  ")}`));
    console.error("");

    process.exit(1);
  }
}

export default ErrorCatcher;

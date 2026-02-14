/**
 * @weconjs/core - Startup Banner
 *
 * Pretty, developer-friendly startup output with colors.
 */

import type { ResolvedConfig, WeconModule } from "../types.js";

interface BannerOptions {
  config: ResolvedConfig;
  modules: WeconModule[];
  port: number;
  protocol: "http" | "https";
  dbConnected: boolean;
  i18nEnabled: boolean;
  devtoolsEnabled: boolean;
  devtoolsPrefix: string;
  routeCount?: number;
  apiPrefix?: string;
}

export async function printBanner(options: BannerOptions): Promise<void> {
  const {
    config,
    modules,
    port,
    protocol,
    dbConnected,
    i18nEnabled,
    devtoolsEnabled,
    devtoolsPrefix,
    routeCount,
    apiPrefix,
  } = options;

  // Dynamic import chalk (ESM)
  let c: {
    bold: (s: string) => string;
    dim: (s: string) => string;
    green: (s: string) => string;
    yellow: (s: string) => string;
    cyan: (s: string) => string;
    magenta: (s: string) => string;
    gray: (s: string) => string;
    red: (s: string) => string;
    blue: (s: string) => string;
    white: (s: string) => string;
    bgMagenta: (s: string) => string;
    greenBright: (s: string) => string;
  };

  try {
    const chalk = (await import("chalk")).default;
    c = {
      bold: (s) => chalk.bold(s),
      dim: (s) => chalk.dim(s),
      green: (s) => chalk.green(s),
      yellow: (s) => chalk.yellow(s),
      cyan: (s) => chalk.cyan(s),
      magenta: (s) => chalk.magenta(s),
      gray: (s) => chalk.gray(s),
      red: (s) => chalk.red(s),
      blue: (s) => chalk.blue(s),
      white: (s) => chalk.white(s),
      bgMagenta: (s) => chalk.bgMagenta(s),
      greenBright: (s) => chalk.greenBright(s),
    };
  } catch {
    // Fallback: no colors
    const id = (s: string) => s;
    c = {
      bold: id, dim: id, green: id, yellow: id, cyan: id,
      magenta: id, gray: id, red: id, blue: id, white: id,
      bgMagenta: id, greenBright: id,
    };
  }

  const url = `${protocol}://localhost:${port}`;
  const mode = config.mode;
  const modeColor = mode === "production" ? c.red : mode === "staging" ? c.yellow : c.green;

  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(
    `  ${c.magenta("▲")} ${c.bold(config.app.name)} ${c.dim(`v${config.app.version}`)}`
  );
  lines.push("");

  // Server info
  lines.push(`  ${c.dim("├─")} ${c.dim("URL")}         ${c.cyan(url)}`);
  if (apiPrefix) {
    lines.push(`  ${c.dim("├─")} ${c.dim("API Prefix")}  ${c.cyan(apiPrefix)}`);
  }
  lines.push(`  ${c.dim("├─")} ${c.dim("Version")}     ${c.white(`v${config.app.version}`)}`);
  lines.push(`  ${c.dim("├─")} ${c.dim("Mode")}        ${modeColor(mode)}`);

  // Database
  const dbName = config.database?.mongoose?.database;
  const dbStatus = dbConnected
    ? c.green("● connected") + (dbName ? ` ${c.dim("—")} ${c.white(dbName)}` : "")
    : c.dim("○ disabled");
  lines.push(`  ${c.dim("├─")} ${c.dim("Database")}    ${dbStatus}`);

  // Modules
  const moduleNames = modules.map((m) => m.name).join(c.dim(", "));
  lines.push(`  ${c.dim("├─")} ${c.dim("Modules")}     ${c.white(String(modules.length))} ${c.dim("—")} ${moduleNames}`);

  // Routes
  if (routeCount !== undefined) {
    lines.push(`  ${c.dim("├─")} ${c.dim("Routes")}      ${c.white(String(routeCount))} ${c.dim("endpoints")}`);
  }

  // Features
  const features: string[] = [];
  if (i18nEnabled) features.push("i18n");
  if (config.features?.swagger?.enabled) features.push("Swagger");
  if (config.features?.socket?.enabled) features.push("Socket.IO");
  if (features.length > 0) {
    lines.push(`  ${c.dim("├─")} ${c.dim("Features")}    ${features.join(c.dim(", "))}`);
  }

  // DevTools
  // if (devtoolsEnabled) {
  //   const dtUrl = `${url}${devtoolsPrefix}`;
  //   lines.push(`  ${c.dim("├─")} ${c.dim("DevTools")}    ${c.cyan(dtUrl)}`);
  // }

  // Ready
  lines.push(`  ${c.dim("│")}`);
  lines.push(`  ${c.greenBright("✓")} ${c.bold("Ready")} ${c.dim(`in ${mode} mode`)}`);
  lines.push("");

  console.log(lines.join("\n"));
}

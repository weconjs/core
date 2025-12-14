/**
 * @weconjs/core - Socket.IO Integration
 *
 * Provides Socket.IO server setup, handler discovery, and middleware loading.
 * Auto-discovers `*.socket.ts` files from module directories.
 *
 * @example
 * ```typescript
 * // src/modules/chat/socket/chat.socket.ts
 * import { SocketHandler } from '@weconjs/core';
 *
 * const chatHandler: SocketHandler = (io, socket) => {
 *   socket.on('message', (data) => {
 *     io.emit('message', data);
 *   });
 * };
 *
 * export default chatHandler;
 * ```
 */

import type { Server as HttpServer } from "http";
import type { Server as HttpsServer } from "https";
import { glob } from "glob";
import { join, basename, dirname } from "path";

/**
 * Socket.IO Server instance type
 */
export type SocketServer = import("socket.io").Server;

/**
 * Socket.IO Socket instance type
 */
export type SocketInstance = import("socket.io").Socket;

/**
 * Socket handler function signature
 *
 * Called when a client connects. Use this to set up event listeners.
 */
export type SocketHandler = (io: SocketServer, socket: SocketInstance) => void;

/**
 * Socket middleware function signature
 *
 * Called before the connection handler. Can be used for authentication.
 */
export type SocketMiddleware = (
  socket: SocketInstance,
  next: (err?: Error) => void
) => void;

/**
 * Discovered socket handler with metadata
 */
export interface DiscoveredSocketHandler {
  name: string;
  namespace: string;
  handler: SocketHandler;
}

/**
 * Socket configuration options
 */
export interface SocketOptions {
  /**
   * Enable Socket.IO
   */
  enabled?: boolean;

  /**
   * CORS configuration
   */
  cors?: {
    origin: string | string[];
    methods?: string[];
    credentials?: boolean;
  };

  /**
   * Path for the Socket.IO endpoint
   */
  path?: string;
}

/**
 * Create a Socket.IO server attached to an HTTP server
 *
 * @param httpServer - The HTTP/HTTPS server to attach to
 * @param options - Socket configuration options
 * @returns Socket.IO server instance
 */
export async function createSocketServer(
  httpServer: HttpServer | HttpsServer,
  options: SocketOptions = {}
): Promise<SocketServer> {
  // Dynamic import to avoid bundling issues
  const { Server } = await import("socket.io");

  const io = new Server(httpServer, {
    path: options.path || "/socket.io",
    cors: options.cors || {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  return io;
}

/**
 * Discover socket handlers in module directories
 *
 * Scans for `socket/*.socket.ts` files in each module.
 *
 * @param modulesDir - Path to the modules directory
 * @returns Array of discovered socket handlers
 */
export async function discoverSocketHandlers(
  modulesDir: string
): Promise<DiscoveredSocketHandler[]> {
  const handlers: DiscoveredSocketHandler[] = [];

  try {
    // Find all *.socket.ts files
    const files = await glob("**/socket/*.socket.{ts,js}", {
      cwd: modulesDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const module = await import(file);
        const handler = module.default;

        if (typeof handler !== "function") {
          console.warn(
            `[Wecon] Socket file ${basename(file)} must export a default function`
          );
          continue;
        }

        // Extract handler name and module namespace
        const fileName = basename(file).replace(/\.socket\.(ts|js)$/, "");
        const moduleDir = dirname(dirname(file)); // Go up from socket/
        const namespace = basename(moduleDir);

        handlers.push({
          name: fileName,
          namespace,
          handler,
        });

        console.log(`[Wecon] Discovered socket handler: ${namespace}/${fileName}`);
      } catch (err) {
        console.error(`[Wecon] Failed to load socket handler ${file}:`, err);
      }
    }
  } catch (err) {
    console.warn("[Wecon] Failed to discover socket handlers:", err);
  }

  return handlers;
}

/**
 * Discover socket middleware in module directories
 *
 * Looks for `socket/socket.middleware.ts` in each module.
 *
 * @param modulesDir - Path to the modules directory
 * @returns Array of socket middleware functions
 */
export async function discoverSocketMiddleware(
  modulesDir: string
): Promise<SocketMiddleware[]> {
  const middleware: SocketMiddleware[] = [];

  try {
    // Find all socket.middleware.ts files
    const files = await glob("**/socket/socket.middleware.{ts,js}", {
      cwd: modulesDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const module = await import(file);
        const mw = module.default;

        if (Array.isArray(mw)) {
          middleware.push(...mw.filter((m) => typeof m === "function"));
        } else if (typeof mw === "function") {
          middleware.push(mw);
        } else {
          console.warn(
            `[Wecon] ${file} must export a middleware function or array`
          );
        }
      } catch (err) {
        // File doesn't exist or error - skip
      }
    }
  } catch (err) {
    console.warn("[Wecon] Failed to discover socket middleware:", err);
  }

  return middleware;
}

/**
 * Initialize Socket.IO with discovered handlers and middleware
 *
 * @param io - Socket.IO server instance
 * @param handlers - Discovered socket handlers
 * @param middleware - Socket middleware functions
 */
export function initializeSocket(
  io: SocketServer,
  handlers: DiscoveredSocketHandler[],
  middleware: SocketMiddleware[] = []
): void {
  // Apply middleware
  for (const mw of middleware) {
    io.use(mw);
  }

  // Set up connection handler
  io.on("connection", (socket) => {
    console.log(`[Wecon] Socket connected: ${socket.id}`);

    // Call all discovered handlers
    for (const { handler, namespace, name } of handlers) {
      try {
        handler(io, socket);
      } catch (err) {
        console.error(`[Wecon] Error in socket handler ${namespace}/${name}:`, err);
      }
    }

    socket.on("disconnect", () => {
      console.log(`[Wecon] Socket disconnected: ${socket.id}`);
    });
  });

  console.log(`[Wecon] Socket.IO initialized with ${handlers.length} handlers`);
}

/**
 * Full Socket.IO setup for a Wecon application
 *
 * @param httpServer - HTTP server to attach to
 * @param modulesDir - Path to modules directory
 * @param options - Socket configuration
 * @returns Socket.IO server instance
 */
export async function setupSocketIO(
  httpServer: HttpServer | HttpsServer,
  modulesDir: string,
  options: SocketOptions = {}
): Promise<SocketServer | null> {
  if (options.enabled === false) {
    console.log("[Wecon] Socket.IO disabled");
    return null;
  }

  // Create Socket.IO server
  const io = await createSocketServer(httpServer, options);

  // Discover handlers and middleware
  const [handlers, middleware] = await Promise.all([
    discoverSocketHandlers(modulesDir),
    discoverSocketMiddleware(modulesDir),
  ]);

  // Initialize
  initializeSocket(io, handlers, middleware);

  return io;
}

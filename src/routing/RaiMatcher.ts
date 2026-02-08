import { match, type MatchFunction, type ParamData } from "path-to-regexp";
import errors from "../errors/index.js";
import type Route from "./Route.js";

export type RaiRoutesList = Array<Pick<Route, "path" | "method" | "rai">>;

interface CachedRoute {
  matcher: MatchFunction<ParamData>;
  rai: string;
  method: string;
  path: string;
}

/**
 * High-performance RAI lookup engine.
 * Pre-compiles path matchers, uses exact + runtime caches for O(1) lookups.
 */
class RaiMatcher {
  private cache: Map<string, CachedRoute>;
  private routesByMethod: Map<string, CachedRoute[]>;
  private exactRoutes: Map<string, string>;

  constructor(raisList: RaiRoutesList) {
    this.cache = new Map();
    this.routesByMethod = new Map();
    this.exactRoutes = new Map();
    this.initialize(raisList);
  }

  /** Pre-compile all route matchers and organize by HTTP method */
  private initialize(raisList: RaiRoutesList): void {
    for (const route of raisList) {
      if (typeof route.path !== "string" || !route.method) {
        console.warn(`Invalid route configuration:`, route);
        continue;
      }

      const normalizedMethod = route.method.trim().toUpperCase();

      // Cache exact routes (no params) for O(1) lookup
      if (!route.path.includes(":") && !route.path.includes("*")) {
        const exactKey = `${normalizedMethod}:${route.path}`;
        this.exactRoutes.set(exactKey, route.rai);

        // Also handle trailing slash variant
        const withSlash = route.path.endsWith("/")
          ? route.path.slice(0, -1)
          : route.path + "/";
        this.exactRoutes.set(`${normalizedMethod}:${withSlash}`, route.rai);
      }

      const cachedRoute: CachedRoute = {
        matcher: match(route.path, { decode: decodeURIComponent }),
        rai: route.rai,
        method: normalizedMethod,
        path: route.path,
      };

      if (!this.routesByMethod.has(normalizedMethod)) {
        this.routesByMethod.set(normalizedMethod, []);
      }
      this.routesByMethod.get(normalizedMethod)!.push(cachedRoute);
    }

    // Sort by specificity (static segments score higher)
    for (const [, routes] of this.routesByMethod) {
      routes.sort(
        (a, b) =>
          this.getRouteSpecificity(b.path) - this.getRouteSpecificity(a.path)
      );
    }
  }

  /** Score route specificity: static=10, dynamic=1, wildcard=0.5 */
  private getRouteSpecificity(path: string): number {
    let score = 0;
    const segments = path.split("/").filter(Boolean);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.startsWith(":")) {
        score += 1;
      } else if (segment === "*") {
        score += 0.5;
      } else {
        score += 10;
      }
      score += (segments.length - i) * 0.1;
    }

    return score;
  }

  /** Normalize trailing slashes */
  private normalizeRoute(route: string): { primary: string; alternate: string } {
    const primary =
      route.endsWith("/") && route.length > 1 ? route.slice(0, -1) : route;
    const alternate =
      primary === route ? (route === "/" ? route : route + "/") : route;
    return { primary, alternate };
  }

  /** Find RAI for the given request path and method */
  public findRai(path: string, method: string): string {
    const normalizedMethod = method.trim().toUpperCase();
    const { primary, alternate } = this.normalizeRoute(path);

    // 1. Exact match (fastest)
    const exactKey = `${normalizedMethod}:${primary}`;
    if (this.exactRoutes.has(exactKey)) {
      return this.exactRoutes.get(exactKey)!;
    }

    // 2. Runtime cache for previously matched dynamic routes
    const cacheKey = `${normalizedMethod}:${primary}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.rai;
    }

    // 3. Method-specific route matching
    const methodRoutes = this.routesByMethod.get(normalizedMethod);
    if (!methodRoutes) {
      throw new errors.RequestError(
        `No RAI found for the request URL: ${path} with method: ${method}`,
        { code: "RAI_NOT_FOUND", route: path, method }
      );
    }

    // 4. Pattern matching (sorted by specificity)
    for (const route of methodRoutes) {
      const matchResult = route.matcher(primary) || route.matcher(alternate);

      if (matchResult) {
        this.cache.set(cacheKey, route);

        // Evict oldest entry if cache is too large
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey!);
        }

        return route.rai;
      }
    }

    // 5. No match
    throw new errors.RequestError(
      `No RAI found for the request URL: ${path} with method: ${method}`,
      {
        code: "RAI_NOT_FOUND",
        route: path,
        method,
        availableRoutes: methodRoutes.map((r) => r.path),
      }
    );
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; methods: string[] } {
    return {
      size: this.cache.size,
      methods: Array.from(this.routesByMethod.keys()),
    };
  }
}

export default RaiMatcher;

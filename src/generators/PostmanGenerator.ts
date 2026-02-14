/**
 * PostmanGenerator - Intelligent Postman Collection & Environment Generator
 *
 * This utility class generates:
 * 1. Postman Collection v2.1.0 JSON files
 * 2. Postman Environment JSON files with auto-extracted variables
 *
 * Features:
 * - Automatic variable extraction from route paths (e.g., :userId -> {{userId}})
 * - Collection of custom variables from PostmanRoute and PostmanGroup configs
 * - Hierarchical folder structure matching Routes organization
 * - Smart defaults for missing configurations
 */

import { writeFileSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";
import Route from "../routing/Route.js";
import Routes from "../routing/Routes.js";
import type {
  PostmanInfo,
  PostmanVariable,
  PostmanVariableList,
  PostmanAuth,
  PostmanEventList,
  PostmanProtocolProfileBehavior,
} from "../types/postman.types.js";
import type { PostmanItem } from "../routing/PostmanRoute.js";
import type { PostmanItemGroup } from "../routing/PostmanGroup.js";

// so we can easily change schema version in the future
const SCHEMA_URL =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

/**
 * Configuration for PostmanGenerator
 */
export interface PostmanGeneratorConfig {
  /** Name of the Postman collection */
  name: string;
  /** Description of the API */
  description?: string;
  /** Base URL for all requests (will be added as {{baseUrl}} variable) */
  baseUrl?: string;
  /** API version */
  version?: string;
  /** Output file paths */
  output?: {
    /** Path to save the collection JSON file */
    collection?: string;
    /** Path to save the environment JSON file */
    environment?: string;
  };
}

/**
 * Postman Collection v2.1.0 structure
 */
interface PostmanCollection {
  info: PostmanInfo;
  item: (PostmanItemGroup | PostmanItem)[];
  auth?: PostmanAuth | null;
  event?: PostmanEventList;
  variable?: PostmanVariableList;
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;
}

/**
 * Postman Environment structure
 */
interface PostmanEnvironment {
  id?: string;
  name: string;
  values: Array<{
    key: string;
    value: string;
    type?: "default" | "secret";
    enabled?: boolean;
    description?: string;
  }>;
  _postman_variable_scope?: string;
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

/**
 * PostmanGenerator class
 */
class PostmanGenerator {
  private config: PostmanGeneratorConfig;
  private routes: Routes;
  private collectedVariables: Map<string, PostmanVariable> = new Map();
  private pathVariables: Set<string> = new Set();

  constructor(config: PostmanGeneratorConfig, routes: Routes) {
    this.config = config;
    this.routes = routes;
  }

  /**
   * Generate both collection and environment files
   */
  public async generate(): Promise<{
    collection: PostmanCollection;
    environment: PostmanEnvironment;
  }> {
    // Extract all variables from routes
    this.extractVariables();

    // Generate collection
    const collection = this.generateCollection();

    // Generate environment
    const environment = this.generateEnvironment();

    // Write files if output paths specified
    if (this.config.output?.collection) {
      this.writeJsonFile(this.config.output.collection, collection);
    }

    if (this.config.output?.environment) {
      this.writeJsonFile(this.config.output.environment, environment);
    }

    return { collection, environment };
  }

  /**
   * Extract variables from all routes and their configurations
   */
  private extractVariables(): void {
    // Add baseUrl as a variable
    if (this.config.baseUrl) {
      this.collectedVariables.set("baseUrl", {
        key: "baseUrl",
        value: this.config.baseUrl,
        type: "string",
        description: "Base URL for all API requests",
      });
    }

    // Recursively extract variables from routes
    this.extractVariablesFromRoutes(this.routes);
  }

  /**
   * Recursively extract variables from Routes instances
   */
  private extractVariablesFromRoutes(
    routes: Routes | Route,
    parentPath: string = ""
  ): void {
    if (routes instanceof Route) {
      // Extract path parameters (e.g., :userId)
      const pathParams = this.extractPathParams(routes.path);
      pathParams.forEach((param) => this.pathVariables.add(param));

      // Extract variables from PostmanRoute config
      if (routes.postman) {
        // Deep scan the entire PostmanRoute configuration object
        this.recursivelyScanForVariables(routes.postman);
      }
    } else if (routes instanceof Routes) {
      const currentPath = parentPath + routes.prefix;

      // Extract variables from PostmanGroup config
      if (routes.postman) {
        // Deep scan the entire PostmanGroup configuration object
        this.recursivelyScanForVariables(routes.postman);
      }

      // Recursively process child routes
      routes.routes.forEach((childRoute) => {
        this.extractVariablesFromRoutes(childRoute, currentPath);
      });
    }
  }

  /**
   * Recursively scan an object for string values containing {{variable}}
   */
  private recursivelyScanForVariables(obj: unknown): void {
    if (!obj) return;

    if (typeof obj === "string") {
      const variables = this.extractVariablesFromString(obj);
      variables.forEach((varName) => {
        if (!this.collectedVariables.has(varName)) {
          this.collectedVariables.set(varName, {
            key: varName,
            value: "",
            type: "string",
            description: "Extracted from configuration",
          });
        }
      });
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => this.recursivelyScanForVariables(item));
      return;
    }

    if (typeof obj === "object") {
      // Special handling for PostmanVariable objects to preserve their metadata
      // Check if it looks like a PostmanVariable (has key/id and value)
      const potentialVar = obj as PostmanVariable;
      if (
        (potentialVar.key || potentialVar.id) &&
        potentialVar.value !== undefined
      ) {
        const key = potentialVar.key || potentialVar.id;
        if (key && !this.collectedVariables.has(key)) {
          this.collectedVariables.set(key, potentialVar);
        }
        // Continue scanning value just in case it has nested vars (unlikely but possible)
        this.recursivelyScanForVariables(potentialVar.value);
        return;
      }

      // Standard object traversal
      Object.values(obj).forEach((value) =>
        this.recursivelyScanForVariables(value)
      );
    }
  }

  /**
   * Extract path parameters from Express-style path
   * Example: /users/:userId/posts/:postId -> ['userId', 'postId']
   */
  private extractPathParams(path: string): string[] {
    const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (!matches) return [];
    return matches.map((match) => match.slice(1)); // Remove the ':' prefix
  }

  /**
   * Extract variable references from strings (e.g., {{authToken}})
   */
  private extractVariablesFromString(str: string): string[] {
    const matches = str.match(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
    if (!matches) return [];
    return matches.map((match) => match.slice(2, -2)); // Remove {{ and }}
  }

  /**
   * Generate the Postman Collection
   */
  private generateCollection(): PostmanCollection {
    const collection: PostmanCollection = {
      info: {
        name: this.config.name,
        description: this.config.description || "",
        version: this.config.version || "1.0.0",
        schema: SCHEMA_URL,
      },
      item: [],
    };

    // Convert Routes to Postman items
    collection.item = this.convertRoutesToItems(this.routes);

    // Add collection-level variables
    const collectionVars = Array.from(this.collectedVariables.values());
    if (collectionVars.length > 0) {
      collection.variable = collectionVars;
    }

    return collection;
  }

  /**
   * Convert Routes/Route instances to Postman items/folders
   */
  private convertRoutesToItems(
    routes: Routes | Route,
    parentPrefix: string = ""
  ): (PostmanItem | PostmanItemGroup)[] {
    const items: (PostmanItem | PostmanItemGroup)[] = [];

    if (routes instanceof Route) {
      routes.path = `${parentPrefix}${routes.path}`;
      // Convert single Route to PostmanItem
      const item = this.convertRouteToItem(routes);
      items.push(item);
    } else if (routes instanceof Routes) {
      // Check if this Routes instance should be a folder
      const shouldBeFolder = routes.postman?.folderName || routes.prefix;

      // Process child routes first
      const childItems: (PostmanItem | PostmanItemGroup)[] = [];
      routes.routes.forEach((childRoute) => {
        const children = this.convertRoutesToItems(
          childRoute,
          parentPrefix + routes.prefix
        );
        childItems.push(...children);
      });

      if (shouldBeFolder) {
        // Use PostmanGroup to generate the folder
        if (routes.postman) {
          const folder = routes.postman.toPostmanItemGroup(childItems);
          items.push(folder);
        } else {
          // Fallback if no PostmanGroup config but has prefix (shouldn't happen with default init)
          items.push({
            name: routes.prefix || "Routes",
            item: childItems,
          });
        }
      } else {
        // No folder, just flatten the children
        items.push(...childItems);
      }
    }

    return items;
  }

  /**
   * Convert a single Route to a PostmanItem
   */
  private convertRouteToItem(route: Route): PostmanItem {
    const baseUrl = this.config.baseUrl || "{{baseUrl}}";

    // Use PostmanRoute's toPostmanItem if configured
    if (route.postman) {
      return route.postman.toPostmanItem(route, baseUrl);
    }

    // Otherwise, generate a basic item (Fallback)
    const postmanPath = this.convertPathToPostman(route.path);

    const item: PostmanItem = {
      name: route.name || `[${route.method}] ${route.path}`,
      request: {
        method: route.method.toUpperCase(),
        header: [],
        url: {
          raw: `${baseUrl}${postmanPath}`,
          host: baseUrl.includes("://") ? [baseUrl] : [baseUrl],
          path: postmanPath.split("/").filter((segment) => segment !== ""),
        },
      },
    };

    // Add description if available
    if (route.description) {
      item.description = route.description;
    }

    return item;
  }

  /**
   * Convert Express-style path to Postman-style path
   * Example: /users/:userId -> /users/{{userId}}
   */
  private convertPathToPostman(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{{$1}}");
  }

  /**
   * Generate the Postman Environment
   */
  private generateEnvironment(): PostmanEnvironment {
    const environment: PostmanEnvironment = {
      name: `${this.config.name} - Environment`,
      values: [],
      _postman_variable_scope: "environment",
      _postman_exported_at: new Date().toISOString(),
      _postman_exported_using: "Wecon PostmanGenerator",
    };

    // Add collected variables
    this.collectedVariables.forEach((variable) => {
      environment.values.push({
        key: variable.key || variable.id || "",
        value: String(variable.value || ""),
        type: "default",
        enabled: !variable.disabled,
        description:
          typeof variable.description === "string"
            ? variable.description
            : variable.description?.content,
      });
    });

    // Add path variables (from :param) with empty values
    this.pathVariables.forEach((paramName) => {
      if (!this.collectedVariables.has(paramName)) {
        environment.values.push({
          key: paramName,
          value: "",
          type: "default",
          enabled: true,
          description: `Path parameter extracted from route`,
        });
      }
    });

    return environment;
  }

  /**
   * Write JSON to file with pretty formatting
   */
  private writeJsonFile(filePath: string, data: unknown): void {
    try {
      // Ensure directory exists
      const dir = dirname(filePath);
      mkdirSync(dir, { recursive: true });

      // Write file
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`✓ Generated Postman file: ${filePath}`);
    } catch (error) {
      console.error(`✗ Failed to write Postman file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Static helper to generate from Wecon configuration
   */
  public static async generateFromWecon(
    config: PostmanGeneratorConfig,
    routes: Routes
  ): Promise<{
    collection: PostmanCollection;
    environment: PostmanEnvironment;
  }> {
    const generator = new PostmanGenerator(config, routes);
    return generator.generate();
  }
}

export default PostmanGenerator;

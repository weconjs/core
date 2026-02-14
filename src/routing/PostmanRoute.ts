import type {
  PostmanDescription,
  PostmanAuth,
  PostmanVariableList,
  PostmanEventList,
  PostmanProtocolProfileBehavior,
  PostmanRouteConfig,
} from "../types/postman.types.js";

/**
 * Postman URL structure
 */
interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | string[];
  query?: Array<{
    key: string;
    value: string;
    disabled?: boolean;
    description?: PostmanDescription;
  }>;
  hash?: string;
  variable?: PostmanVariableList;
}

/**
 * Postman Request structure
 */
interface PostmanRequest {
  method: string;
  header?: Array<{
    key: string;
    value: string;
    disabled?: boolean;
    description?: PostmanDescription;
  }>;
  body?: {
    mode: string;
    raw?: string;
    urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
    formdata?: Array<{
      key: string;
      value: string;
      type?: string;
      disabled?: boolean;
    }>;
    file?: { src: string };
    graphql?: { query: string; variables?: string };
    options?: {
      raw?: {
        language?: string;
      };
    };
  };
  url: PostmanUrl | string;
  auth?: PostmanAuth | null;
  description?: PostmanDescription;
  proxy?: unknown;
  certificate?: unknown;
}

/**
 * Postman Item structure (represents a single request)
 */
export interface PostmanItem {
  id?: string;
  name: string;
  description?: PostmanDescription;
  variable?: PostmanVariableList;
  event?: PostmanEventList;
  request: PostmanRequest | string;
  response?: Array<{
    name: string;
    originalRequest?: unknown;
    status?: string;
    code?: number;
    header?: Array<{ key: string; value: string }>;
    body?: string;
    _postman_previewlanguage?: string;
  }>;
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;
}

/**
 * PostmanRoute
 *
 * Configures how a single API Route is represented in the generated Postman collection.
 * This class handles the transformation of route metadata into a Postman Request Item.
 *
 * @example
 * ```typescript
 * new Route({
 *   method: 'POST',
 *   path: '/users',
 *   postman: new PostmanRoute({
 *     name: 'Create New User',
 *     body: {
 *       mode: 'raw',
 *       raw: JSON.stringify({ name: 'John' })
 *     }
 *   })
 * })
 * ```
 */
class PostmanRoute {
  name?: string;
  description?: PostmanDescription;
  auth?: PostmanAuth | null;
  variable?: PostmanVariableList;
  event?: PostmanEventList;
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: PostmanRouteConfig["body"];
  response?: PostmanRouteConfig["response"];

  constructor(config: PostmanRouteConfig) {
    this.name = config.name;
    this.description = config.description;
    this.auth = config.auth;
    this.variable = config.variable;
    this.event = config.event;
    this.protocolProfileBehavior = config.protocolProfileBehavior;
    this.headers = config.headers;
    this.query = config.query;
    this.body = config.body;
    this.response = config.response;
  }

  /**
   * Converts this configuration into a Postman Collection Item.
   *
   * @param route - The route definition containing method, path, etc.
   * @param baseUrl - The base URL variable (default: "{{baseUrl}}")
   * @returns A formatted Postman Item object
   */
  public toPostmanItem(
    route: {
      method: string;
      path: string;
      name: string;
      description: string;
      rai: string;
      params?: Array<{ path: string; description?: string }>;
    },
    baseUrl: string = "{{baseUrl}}"
  ): PostmanItem {
    // 1. Prepare Path (Convert :param to {{param}})
    const postmanPath = this.convertPathToPostman(route.path);

    // 2. Build URL Object
    const url: PostmanUrl = {
      raw: `${baseUrl}${postmanPath}`,
      host: baseUrl.includes("://") ? [baseUrl] : [baseUrl],
      path: postmanPath.split("/").filter((segment) => segment !== ""),
    };

    // 3. Add Query Parameters
    if (this.query) {
      url.query = Object.entries(this.query).map(([key, value]) => ({
        key,
        value,
        disabled: false,
      }));
    }

    // 4. Build Headers
    const headers: Array<{ key: string; value: string; disabled?: boolean }> =
      [];
    if (this.headers) {
      Object.entries(this.headers).forEach(([key, value]) => {
        headers.push({ key, value, disabled: false });
      });
    }

    // 5. Construct Request Object
    const request: PostmanRequest = {
      method: route.method.toUpperCase(),
      header: headers,
      url,
    };

    // 6. Add Body (if applicable)
    if (this.body) {
      request.body = {
        mode: this.body.mode,
        ...(this.body.mode === "raw" && this.body.raw !== undefined
          ? { raw: this.body.raw }
          : {}),
        ...(this.body.mode === "urlencoded" && this.body.urlencoded
          ? { urlencoded: this.body.urlencoded }
          : {}),
        ...(this.body.mode === "formdata" && this.body.formdata
          ? { formdata: this.body.formdata }
          : {}),
        ...(this.body.mode === "file" && this.body.file
          ? { file: this.body.file }
          : {}),
        ...(this.body.mode === "graphql" && this.body.graphql
          ? { graphql: this.body.graphql }
          : {}),
        ...(this.body.options ? { options: this.body.options } : {}),
      };
    }

    // 7. Add Authentication (if explicitly set)
    if (this.auth !== undefined) {
      request.auth = this.auth;
    }

    // 8. Assemble Final Item
    const item: PostmanItem = {
      name: this.name || route.name,
      request,
    };

    // 9. Add Optional Metadata
    if (this.description !== undefined) {
      item.description = this.description;
    } else if (route.description) {
      item.description = route.description;
    }

    if (this.variable) item.variable = this.variable;
    if (this.event) item.event = this.event;
    if (this.protocolProfileBehavior)
      item.protocolProfileBehavior = this.protocolProfileBehavior;
    if (this.response) item.response = this.response;

    return item;
  }

  /**
   * Helper: Converts Express path params (:id) to Postman syntax ({{id}})
   */
  private convertPathToPostman(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{{$1}}");
  }
}

export default PostmanRoute;

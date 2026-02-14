/**
 * TypeScript type definitions based on Postman Collection Format v2.1.0
 * Schema: https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json
 */

/**
 * Description can be a raw text string, an object with content and type, or null
 */
export type PostmanDescription =
  | string
  | {
      content?: string;
      type?: string; // e.g., 'text/markdown' or 'text/html'
      version?: string | number;
    }
  | null;

/**
 * Version information for the collection
 */
export interface PostmanVersion {
  major?: number;
  minor?: number;
  patch?: number;
  identifier?: string;
  meta?: Record<string, unknown>;
}

/**
 * Information block for a Postman collection (required for collection root)
 */
export interface PostmanInfo {
  /** Name of the collection - user-friendly identifier */
  name: string;
  /** Unique identifier for the collection (compatibility with v1) */
  _postman_id?: string;
  /** Description of the collection */
  description?: PostmanDescription;
  /** Version information */
  version?: PostmanVersion | string;
  /** Schema URL - should link to the Postman schema used to validate */
  schema: string;
}

/**
 * Authentication attribute for any authorization method
 */
export interface PostmanAuthAttribute {
  key: string;
  value?: unknown;
  type?: string;
}

/**
 * Authentication types supported by Postman
 */
export type PostmanAuthType =
  | "apikey"
  | "awsv4"
  | "basic"
  | "bearer"
  | "digest"
  | "edgegrid"
  | "hawk"
  | "noauth"
  | "oauth1"
  | "oauth2"
  | "ntlm";

/**
 * Authentication configuration for Postman collections/folders/requests
 */
export interface PostmanAuth {
  type: PostmanAuthType;
  noauth?: unknown;
  apikey?: PostmanAuthAttribute[];
  awsv4?: PostmanAuthAttribute[];
  basic?: PostmanAuthAttribute[];
  bearer?: PostmanAuthAttribute[];
  digest?: PostmanAuthAttribute[];
  edgegrid?: PostmanAuthAttribute[];
  hawk?: PostmanAuthAttribute[];
  ntlm?: PostmanAuthAttribute[];
  oauth1?: PostmanAuthAttribute[];
  oauth2?: PostmanAuthAttribute[];
}

/**
 * Variable types supported by Postman
 */
export type PostmanVariableType = "string" | "boolean" | "any" | "number";

/**
 * Postman variable definition
 */
export interface PostmanVariable {
  /** Unique identifier for the variable */
  id?: string;
  /** Human-friendly variable name (key) */
  key?: string;
  /** The variable value */
  value?: unknown;
  /** Variable type */
  type?: PostmanVariableType;
  /** Variable name (alternative to key) */
  name?: string;
  /** Variable description */
  description?: PostmanDescription;
  /** Whether this variable was set by Postman */
  system?: boolean;
  /** Whether this variable is disabled */
  disabled?: boolean;
}

/**
 * List of variables
 */
export type PostmanVariableList = PostmanVariable[];

/**
 * Script definition for Postman events
 */
export interface PostmanScript {
  /** Unique identifier for the script */
  id?: string;
  /** Script type (e.g., 'text/javascript') */
  type?: string;
  /** Script content as array of strings (lines) or single string */
  exec?: string[] | string;
  /** Source file reference */
  src?: string | { id?: string; name?: string };
  /** Script name */
  name?: string;
}

/**
 * Event definition (test or prerequest scripts)
 */
export interface PostmanEvent {
  /** Unique identifier for the event */
  id?: string;
  /** Event type: 'test' or 'prerequest' */
  listen: string;
  /** Script to execute */
  script?: PostmanScript;
  /** Whether the event is disabled */
  disabled?: boolean;
}

/**
 * List of events
 */
export type PostmanEventList = PostmanEvent[];

/**
 * Protocol profile behavior configuration
 * Alters the standard request-sending behavior
 */
export interface PostmanProtocolProfileBehavior {
  /** Whether to disable body pruning */
  disableBodyPruning?: boolean;
  /** Whether to disable cookie jar */
  disableCookies?: boolean;
  /** Whether to follow redirects */
  followRedirects?: boolean;
  /** Whether to follow original HTTP method */
  followOriginalHttpMethod?: boolean;
  /** Whether to follow auth with redirect */
  followAuthorizationHeader?: boolean;
  /** Maximum number of redirects to follow */
  maxRedirects?: number;
  /** Whether to remove Content-Length header */
  removeContentLength?: boolean;
  /** Whether to remove Referer header on redirect */
  removeRefererHeaderOnRedirect?: boolean;
  /** Whether to strict SSL */
  strictSSL?: boolean;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Configuration for a Postman folder (item-group) at the Routes level
 * This represents the folder/collection-level properties that can be configured
 */
export interface PostmanGroupConfig {
  /** Folder name - user-friendly identifier for the folder */
  folderName: string;

  /** Description of the folder/collection */
  description?: PostmanDescription;

  /** Authentication configuration for this folder (inherited by child items) */
  auth?: PostmanAuth | null;

  /** Variables scoped to this folder */
  variable?: PostmanVariableList;

  /** Pre-request and test scripts for this folder */
  event?: PostmanEventList;

  /** Protocol profile behavior configuration */
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;
}

/**
 * Configuration for PostmanRoute
 * Represents a single request item in a Postman collection
 */
export interface PostmanRouteConfig {
  /** Item name - overrides the auto-generated name from Route */
  name?: string;

  /** Item description */
  description?: PostmanDescription;

  /** Authentication configuration for this request (overrides parent auth) */
  auth?: PostmanAuth | null;

  /** Variables scoped to this request */
  variable?: PostmanVariableList;

  /** Pre-request and test scripts for this request */
  event?: PostmanEventList;

  /** Protocol profile behavior configuration */
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;

  /** Request headers as key-value pairs */
  headers?: Record<string, string>;

  /** Query parameters as key-value pairs */
  query?: Record<string, string>;

  /** Request body configuration */
  body?: {
    mode: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
    raw?: string;
    urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
    formdata?: Array<{ key: string; value: string; type?: "text" | "file"; disabled?: boolean }>;
    file?: { src: string };
    graphql?: { query: string; variables?: string };
    options?: {
      raw?: {
        language?: "json" | "javascript" | "html" | "xml" | "text";
      };
    };
  };

  /** Sample responses for this request */
  response?: Array<{
    name: string;
    originalRequest?: unknown;
    status?: string;
    code?: number;
    header?: Array<{ key: string; value: string }>;
    body?: string;
    _postman_previewlanguage?: string;
  }>;
}

/**
 * Re-export for backwards compatibility and convenience
 */
export type PostmanCollectionConfig = PostmanGroupConfig;

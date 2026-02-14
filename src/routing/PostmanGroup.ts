import type {
  PostmanDescription,
  PostmanAuth,
  PostmanVariableList,
  PostmanEventList,
  PostmanProtocolProfileBehavior,
  PostmanGroupConfig,
} from "../types/postman.types.js";
import type { PostmanItem } from "./PostmanRoute.js";

/**
 * Postman Item Group (Folder) structure
 */
export interface PostmanItemGroup {
  name: string;
  description?: PostmanDescription;
  item: (PostmanItem | PostmanItemGroup)[];
  auth?: PostmanAuth | null;
  event?: PostmanEventList;
  variable?: PostmanVariableList;
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;
}

/**
 * PostmanGroup
 *
 * Configures how a group of Routes (a folder) is represented in the generated Postman collection.
 * This class handles the creation of Postman Folders (Item Groups).
 *
 * @example
 * ```typescript
 * new Routes({
 *   prefix: '/users',
 *   postman: new PostmanGroup({
 *     folderName: 'User Management',
 *     description: 'Endpoints for managing users',
 *     auth: { type: 'bearer', ... }
 *   })
 * })
 * ```
 */
class PostmanGroup {
  /** Folder name - the display name for this folder in Postman */
  folderName: string;

  /** Description of the folder/route group */
  description?: PostmanDescription;

  /** Authentication configuration (inherited by child items unless overridden) */
  auth?: PostmanAuth | null;

  /** Variables scoped to this folder */
  variable?: PostmanVariableList;

  /** Pre-request and test scripts for this folder */
  event?: PostmanEventList;

  /** Protocol profile behavior configuration */
  protocolProfileBehavior?: PostmanProtocolProfileBehavior;

  constructor(config: PostmanGroupConfig) {
    this.folderName = config.folderName;
    this.description = config.description;
    this.auth = config.auth;
    this.variable = config.variable;
    this.event = config.event;
    this.protocolProfileBehavior = config.protocolProfileBehavior;
  }

  /**
   * Converts this configuration and a list of child items into a Postman Folder.
   *
   * @param items - The list of child requests (Items) or sub-folders (ItemGroups)
   * @returns A formatted Postman ItemGroup object
   */
  public toPostmanItemGroup(
    items: (PostmanItem | PostmanItemGroup)[]
  ): PostmanItemGroup {
    const folder: PostmanItemGroup = {
      name: this.folderName,
      item: items,
    };

    if (this.description) folder.description = this.description;
    if (this.auth !== undefined) folder.auth = this.auth;
    if (this.variable) folder.variable = this.variable;
    if (this.event) folder.event = this.event;
    if (this.protocolProfileBehavior) {
      folder.protocolProfileBehavior = this.protocolProfileBehavior;
    }

    return folder;
  }
}

export default PostmanGroup;

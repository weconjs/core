/**
 * @wecon/core - Module utilities
 */

export {
  readModulePackageJson,
  checkModuleDeps,
  detectPackageManager,
  installModuleDeps,
  resolveAllModuleDeps,
} from "./module-loader.js";

export type {
  ModulePackageJson,
  DepsCheckResult,
} from "./module-loader.js";

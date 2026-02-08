/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  namespace NodeJS {
    interface CallSite {
      getFileName(): string | null;
      getLineNumber(): number | null;
      getColumnNumber(): number | null;
      getFunctionName(): string | null;
      getTypeName(): string | null;
      getMethodName(): string | null;
      getThis(): any;
      isNative(): boolean;
    }
  }
}

export {};

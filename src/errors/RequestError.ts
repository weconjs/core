/* eslint-disable @typescript-eslint/no-explicit-any */

class RequestError extends Error {
  public meta: Record<string, any>;

  constructor(message: string, meta: Record<string, any> = {}) {
    super(`RequestError: ${message}`);
    this.message = message;
    this.meta = meta;

    Object.setPrototypeOf(this, RequestError.prototype);
    this.name = "RequestError";

    if ("captureStackTrace" in Error) {
      Error.captureStackTrace(this, RequestError);
    }
  }
}

export default RequestError;

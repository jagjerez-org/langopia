export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const obj = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const message = obj
      ? String(obj.message ?? obj.error ?? `Request failed with status ${status}`)
      : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

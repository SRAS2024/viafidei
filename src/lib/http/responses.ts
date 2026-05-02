import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "too_large"
  | "rate_limited"
  | "server_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 400,
  too_large: 413,
  rate_limited: 429,
  server_error: 500,
};

export function jsonOk<T extends Record<string, unknown>>(data?: T): NextResponse {
  return NextResponse.json({ ok: true, ...(data ?? {}) }, { status: 200 });
}

export function jsonError(
  code: ApiErrorCode,
  options: { message?: string; details?: unknown; status?: number } = {},
): NextResponse {
  const status = options.status ?? STATUS_BY_CODE[code];
  const body: Record<string, unknown> = { ok: false, error: code };
  if (options.message) body.message = options.message;
  if (options.details !== undefined) body.details = options.details;
  return NextResponse.json(body, { status });
}

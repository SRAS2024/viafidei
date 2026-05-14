import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/lib/observability";

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
  options: { message?: string; details?: unknown; status?: number; requestId?: string } = {},
): NextResponse {
  const status = options.status ?? STATUS_BY_CODE[code];
  const body: Record<string, unknown> = { ok: false, error: code };
  if (options.message) body.message = options.message;
  if (options.details !== undefined) body.details = options.details;
  // Surface the request id in the body so a user reporting an error can
  // hand the operator a value that connects directly to the structured
  // log line for the failed request. Mirror it onto the response header
  // too so curl / browser network panels show the same id without needing
  // to parse the body. Safe to expose: the id is generated per request
  // and carries no PII.
  if (options.requestId) body.requestId = options.requestId;
  const init: { status: number; headers?: Record<string, string> } = { status };
  if (options.requestId) {
    init.headers = { [REQUEST_ID_HEADER]: options.requestId };
  }
  return NextResponse.json(body, init);
}

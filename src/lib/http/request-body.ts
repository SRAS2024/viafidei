import type { NextRequest } from "next/server";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024;
export const DEFAULT_FORM_BODY_LIMIT_BYTES = 256 * 1024;

export type ReadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "too_large" | "invalid_json" | "missing" };

/**
 * A real form post, not a script's JSON. A form that saves by fetch still sends one when it
 * is pressed before its script has run, or where script never runs, and the answer it needs
 * is a page to land on rather than JSON to show the reader.
 */
export function isFormPost(req: NextRequest): boolean {
  const contentType = req.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

function declaredContentLengthExceeds(req: NextRequest, limit: number): boolean {
  const raw = req.headers.get("content-length");
  if (!raw) return false;
  const length = Number.parseInt(raw, 10);
  if (!Number.isFinite(length)) return false;
  return length > limit;
}

export async function readJsonBody<T = unknown>(
  req: NextRequest,
  options: { limitBytes?: number } = {},
): Promise<ReadJsonResult<T>> {
  const limit = options.limitBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
  if (declaredContentLengthExceeds(req, limit)) {
    return { ok: false, reason: "too_large" };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (text.length === 0) return { ok: false, reason: "missing" };
  if (text.length > limit) return { ok: false, reason: "too_large" };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export async function readFormBody(
  req: NextRequest,
  options: { limitBytes?: number } = {},
): Promise<{ ok: true; form: FormData } | { ok: false; reason: "too_large" | "invalid" }> {
  const limit = options.limitBytes ?? DEFAULT_FORM_BODY_LIMIT_BYTES;
  if (declaredContentLengthExceeds(req, limit)) {
    return { ok: false, reason: "too_large" };
  }
  try {
    const form = await req.formData();
    return { ok: true, form };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

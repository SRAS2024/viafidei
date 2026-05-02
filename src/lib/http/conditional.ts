import type { ConditionalState } from "../ingestion/types";

export function buildConditionalHeaders(
  state: ConditionalState | undefined,
): Record<string, string> {
  if (!state) return {};
  const headers: Record<string, string> = {};
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;
  return headers;
}

export function readConditionalState(headers: Headers): ConditionalState {
  return {
    etag: headers.get("etag"),
    lastModified: headers.get("last-modified"),
  };
}

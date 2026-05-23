/**
 * HTTP fetcher used by the worker to retrieve approved Catholic sources.
 *
 * The fetcher refuses to hit any URL whose host is not in the authority
 * registry, so the worker physically cannot pull from a non-approved
 * source.
 */

import { createHash } from "node:crypto";

import { authorityLevelForHost, findAuthoritySource } from "./authority-registry";
import type { FetchedSource } from "../types";

export class UnapprovedSourceError extends Error {
  constructor(host: string) {
    super(`Source host "${host}" is not in the approved authority registry. Refusing fetch.`);
    this.name = "UnapprovedSourceError";
  }
}

export interface FetchOptions {
  citationId: string;
  url: string;
  signal?: AbortSignal;
  userAgent?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function parseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    throw new Error(`Invalid source URL: ${url}`);
  }
}

const DEFAULT_USER_AGENT =
  "ViafideiWorker/2.0 (+https://github.com/sras2024/viafidei; checklist-first content factory)";
const DEFAULT_TIMEOUT_MS = 30_000;

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, " ").trim() || null;
}

export async function fetchApprovedSource(options: FetchOptions): Promise<FetchedSource> {
  const host = parseHost(options.url);
  const authorityLevel = authorityLevelForHost(host);
  if (!authorityLevel) {
    throw new UnapprovedSourceError(host);
  }

  const f = options.fetcher ?? fetch;
  const controller =
    options.signal && options.signal instanceof AbortSignal ? null : new AbortController();
  const timer =
    controller != null
      ? setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      : null;

  try {
    const response = await f(options.url, {
      headers: {
        "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: options.signal ?? controller?.signal,
      redirect: "follow",
    });

    const body = await response.text();
    const title = extractTitle(body);
    const checksum = sha256(body);

    return {
      citationId: options.citationId,
      url: options.url,
      host,
      authorityLevel,
      status: response.status,
      body,
      checksum,
      title,
      fetchedAt: new Date(),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function describeAuthoritySource(host: string): string {
  const src = findAuthoritySource(host);
  return src ? `${src.name} (${src.authorityLevel})` : host;
}

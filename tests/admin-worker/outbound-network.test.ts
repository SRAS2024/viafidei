/**
 * Outbound proxy setup — lets the worker reach the open internet through a proxy
 * in restricted/proxied deployments. Pins the pure helpers (proxy-URL resolution
 * + credential redaction) and that installOutboundProxy is fail-open and a no-op
 * when no proxy env var is present.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveProxyUrl,
  redactProxyUrl,
  installOutboundProxy,
} from "@/lib/admin-worker/outbound-network";

const PROXY_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of PROXY_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of PROXY_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("resolveProxyUrl", () => {
  it("returns null when no proxy env var is set", () => {
    expect(resolveProxyUrl()).toBeNull();
  });

  it("prefers HTTPS_PROXY and reads the standard vars", () => {
    process.env.HTTP_PROXY = "http://proxy.internal:3128";
    expect(resolveProxyUrl()).toBe("http://proxy.internal:3128");
    process.env.HTTPS_PROXY = "http://secure.proxy:8080";
    expect(resolveProxyUrl()).toBe("http://secure.proxy:8080");
  });
});

describe("redactProxyUrl", () => {
  it("strips credentials so nothing secret is logged", () => {
    expect(redactProxyUrl("http://user:pass@proxy:8080")).toBe("http://***:***@proxy:8080/");
  });
  it("passes through a credential-free URL", () => {
    expect(redactProxyUrl("http://proxy.internal:3128")).toContain("proxy.internal:3128");
  });
  it("handles null", () => {
    expect(redactProxyUrl(null)).toBeNull();
  });
});

describe("installOutboundProxy", () => {
  it("never throws and reports a coherent state", async () => {
    const state = await installOutboundProxy();
    expect(state).toHaveProperty("installed");
    expect(state).toHaveProperty("mode");
    expect(typeof state.reason).toBe("string");
    // Idempotent — second call returns the same cached state object.
    const again = await installOutboundProxy();
    expect(again).toEqual(state);
  });
});

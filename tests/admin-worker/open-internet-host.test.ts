/**
 * The fetch gate: the registry + the Holy See .va TLD are always reachable;
 * ADMIN_WORKER_OPEN_INTERNET widens the worker to lesser-known accurate sources
 * anywhere, while local / social / commerce hosts stay blocked either way.
 * (Accuracy is enforced downstream by cross-source verification + strict QA.)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isFetchableHost, openInternetEnabled } from "@/lib/checklist/sources/authority-registry";

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.ADMIN_WORKER_OPEN_INTERNET;
  delete process.env.ADMIN_WORKER_OPEN_INTERNET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_WORKER_OPEN_INTERNET;
  else process.env.ADMIN_WORKER_OPEN_INTERNET = saved;
});

describe("open-internet fetch gate", () => {
  it("registry + .va hosts are always fetchable", () => {
    expect(isFetchableHost("www.vatican.va")).toBe(true);
    expect(isFetchableHost("press.va")).toBe(true);
    expect(isFetchableHost("www.usccb.org")).toBe(true);
  });

  it("unknown hosts are blocked in registry-only mode (default)", () => {
    expect(openInternetEnabled()).toBe(false);
    expect(isFetchableHost("some-parish-blog.example")).toBe(false);
  });

  it("unknown hosts become fetchable once open-internet mode is on", () => {
    process.env.ADMIN_WORKER_OPEN_INTERNET = "1";
    expect(openInternetEnabled()).toBe(true);
    expect(isFetchableHost("some-parish-blog.example")).toBe(true);
    expect(isFetchableHost("a-diocese-somewhere.org")).toBe(true);
  });

  it("local / social / commerce hosts stay blocked even in open mode", () => {
    process.env.ADMIN_WORKER_OPEN_INTERNET = "true";
    expect(isFetchableHost("localhost")).toBe(false);
    expect(isFetchableHost("127.0.0.1")).toBe(false);
    expect(isFetchableHost("www.facebook.com")).toBe(false);
    expect(isFetchableHost("twitter.com")).toBe(false);
    expect(isFetchableHost("www.amazon.com")).toBe(false);
  });
});

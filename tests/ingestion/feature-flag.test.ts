import { afterEach, describe, expect, it, vi } from "vitest";
import { isDurableQueueEnabled } from "@/lib/config";

const ORIGINAL = process.env.USE_DURABLE_INGESTION_QUEUE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.USE_DURABLE_INGESTION_QUEUE;
  else process.env.USE_DURABLE_INGESTION_QUEUE = ORIGINAL;
});

describe("USE_DURABLE_INGESTION_QUEUE feature flag", () => {
  it("defaults to true when env is unset", () => {
    delete process.env.USE_DURABLE_INGESTION_QUEUE;
    expect(isDurableQueueEnabled()).toBe(true);
  });

  it("returns false when env is '0'", () => {
    vi.stubEnv("USE_DURABLE_INGESTION_QUEUE", "0");
    expect(isDurableQueueEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false when env is 'false'", () => {
    vi.stubEnv("USE_DURABLE_INGESTION_QUEUE", "false");
    expect(isDurableQueueEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns true when env is 'true'", () => {
    vi.stubEnv("USE_DURABLE_INGESTION_QUEUE", "true");
    expect(isDurableQueueEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns true when env is '1'", () => {
    vi.stubEnv("USE_DURABLE_INGESTION_QUEUE", "1");
    expect(isDurableQueueEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});

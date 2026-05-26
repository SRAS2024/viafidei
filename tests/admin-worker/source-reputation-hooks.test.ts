/**
 * Source reputation per-stage hooks (spec §16). Verifies every
 * pipeline stage maps to the correct EWMA outcome field.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));

import { pushReputation, pushReputationBatch } from "@/lib/admin-worker/source-reputation-hooks";
import { recordSourceOutcome } from "@/lib/admin-worker/source-reputation";

const prisma = {} as unknown as Parameters<typeof pushReputation>[0];

describe("pushReputation — per-stage outcome routing (spec §16)", () => {
  it("fetch stage routes to fetchOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "fetch",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ fetchOk: true, sourceHost: "vatican.va" }),
    );
  });

  it("source_read stage routes to buildOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "source_read",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ buildOk: true }),
    );
  });

  it("classification stage routes to buildOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "classification",
      ok: false,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ buildOk: false }),
    );
  });

  it("verification stage routes to validationOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "verification",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ validationOk: true }),
    );
  });

  it("qa stage routes to qaOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "qa",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ qaOk: true }),
    );
  });

  it("publish stage routes to publishedOk", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "publish",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ publishedOk: true }),
    );
  });

  it("post_publish failure additionally flags wrongContent", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "post_publish",
      ok: false,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ publishedOk: false, wrongContent: true }),
    );
  });

  it("duplicate stage routes to duplicate=true", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "duplicate",
      ok: false,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ duplicate: true }),
    );
  });

  it("wrong_content stage routes to wrongContent=true", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "vatican.va",
      stage: "wrong_content",
      ok: false,
    });
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ wrongContent: true }),
    );
  });

  it("ignores hooks with no sourceHost", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputation(prisma, {
      sourceHost: "",
      stage: "fetch",
      ok: true,
    });
    expect(vi.mocked(recordSourceOutcome)).not.toHaveBeenCalled();
  });

  it("batch helper iterates the hooks list", async () => {
    vi.mocked(recordSourceOutcome).mockClear();
    await pushReputationBatch(prisma, [
      { sourceHost: "vatican.va", stage: "fetch", ok: true },
      { sourceHost: "vatican.va", stage: "classification", ok: true },
      { sourceHost: "vatican.va", stage: "publish", ok: true },
    ]);
    expect(vi.mocked(recordSourceOutcome)).toHaveBeenCalledTimes(3);
  });
});

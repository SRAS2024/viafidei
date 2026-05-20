/**
 * content_build passes the source role through (spec §2, §3).
 *
 * The cross-source validator gates publication by the producing
 * source's role: a `primary_content_source` bypasses the evidence
 * requirement, every wider role must produce cross-source evidence.
 *
 * The worker's content_build stage MUST therefore look up the
 * IngestionSource.role and forward it to runContentFactory(). If it
 * doesn't, the factory falls back to `discovery_only_source` and
 * even Vatican.va primary content would be forced through
 * cross-source validation — silently rejecting good content with
 * `validation_evidence_missing`.
 *
 * This test mocks runContentFactory and asserts the dispatch stage
 * forwards the looked-up role.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const { runContentFactoryMock } = vi.hoisted(() => ({
  runContentFactoryMock: vi.fn(async () => ({
    contentType: "Prayer",
    sourceUrl: "https://vatican.va/p/our-father",
    build: { outcome: "built_complete_package" },
    decision: "persisted-created",
  })),
}));

vi.mock("@/lib/content-factory", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    runContentFactory: runContentFactoryMock,
    getSourceDocument: vi.fn(async () => ({
      sourceUrl: "https://vatican.va/p/our-father",
      sourceHost: "vatican.va",
      cleanedBody: "Our Father, who art in heaven. Amen.",
      sourcePurposes: { canIngestPrayers: true },
    })),
  };
});

import { runJobByKind } from "@/lib/ingestion/queue/dispatch";

beforeEach(() => {
  resetPrismaMock();
  runContentFactoryMock.mockClear();
  prismaMock.sourceDocument.findUnique.mockResolvedValue({
    id: "doc1",
    sourceUrl: "https://vatican.va/p/our-father",
    sourceHost: "vatican.va",
  });
});

function contentBuildJob(sourceId: string | null) {
  return {
    id: "job1",
    jobKind: "content_build",
    sourceId,
    triggeredBy: "automatic",
    payload: {
      sourceDocumentId: "doc1",
      contentType: "Prayer",
    },
  } as never;
}

describe("content_build forwards the source role (spec §2, §3)", () => {
  it("looks up IngestionSource.role and passes it to runContentFactory", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      role: "primary_content_source",
    });
    await runJobByKind(contentBuildJob("src-vatican"));
    expect(runContentFactoryMock).toHaveBeenCalledTimes(1);
    const arg = runContentFactoryMock.mock.calls[0][0] as { sourceRole?: string };
    expect(arg.sourceRole).toBe("primary_content_source");
  });

  it("forwards a validation_source role unchanged", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      role: "validation_source",
    });
    await runJobByKind(contentBuildJob("src-validator"));
    const arg = runContentFactoryMock.mock.calls[0][0] as { sourceRole?: string };
    expect(arg.sourceRole).toBe("validation_source");
  });

  it("passes undefined (factory falls back to discovery-only) when the source has no role row", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);
    await runJobByKind(contentBuildJob("src-missing"));
    const arg = runContentFactoryMock.mock.calls[0][0] as { sourceRole?: string };
    expect(arg.sourceRole).toBeUndefined();
  });

  it("does not crash when the job has no sourceId", async () => {
    const result = await runJobByKind(contentBuildJob(null));
    expect(runContentFactoryMock).toHaveBeenCalledTimes(1);
    const arg = runContentFactoryMock.mock.calls[0][0] as { sourceRole?: string };
    expect(arg.sourceRole).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

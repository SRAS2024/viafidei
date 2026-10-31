/**
 * Doctrinal validation needs are compared and recorded (R3).
 *
 * APPARITION.apparitionDate and CHURCH_DOCUMENT.dateOrEra are validation needs
 * the publish gate demands a stored evidence row for, but the verifier only
 * compared REQUIRED_FACTS (apparitionTitle/approvalStatus, historyType/title).
 * The date was fetched, never compared, never stored — so a title MATCH
 * promoted the artifact, the publish gate found no date row, filed
 * VALIDATION_EVIDENCE_MISSING, the repair wiped the evidence, and the item
 * looped verify → QA → publish → repair until its rounds ran out. Web
 * apparitions and Church documents could never publish, and the date nobody
 * compared was exactly the fact that needed checking.
 *
 * These pin: every fetched field is compared and recorded; an unconfirmed need
 * blocks; promotion to VERIFICATION_READY demands every need be confirmed; the
 * dates are compared in the forms independent pages print them.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
});

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "rp1" })),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

/** What each validation probe reports, per field, for the dispatcher test. */
const probeResults: Record<string, "MATCH" | "MISSING_EVIDENCE"> = {};
vi.mock("@/lib/admin-worker/validation-fetcher", () => ({
  fetchAndCompareValidation: vi.fn(
    async (_prisma: unknown, input: { field: string; expectedValue: string }) => {
      const status = probeResults[input.field] ?? "MISSING_EVIDENCE";
      return [
        {
          host: "www.vatican.va",
          url: `https://www.vatican.va/content/${input.field}.html`,
          authority: "VATICAN",
          matchStatus: status,
          expected: input.expectedValue,
          found: status === "MATCH" ? input.expectedValue : null,
          confidence: status === "MATCH" ? 0.9 : 0,
          reason: "test probe",
        },
      ];
    },
  ),
  findCorpusValidationEvidence: vi.fn(async () => []),
}));

import { verifyCrossSource } from "@/lib/admin-worker/cross-source-verifier";
import { runCrossSourceVerification } from "@/lib/admin-worker/dispatcher";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import { runVerifier, SENSITIVE_FIELDS } from "@/lib/admin-worker/verifier";
import {
  evaluateValidationNeeds,
  expectedValueVariants,
} from "@/lib/admin-worker/web-extraction-helpers";

describe("verifyCrossSource compares the caller's facts, not only REQUIRED_FACTS", () => {
  it("records a row for dateOrEra when it is asked to verify it", () => {
    const out = verifyCrossSource({
      contentType: "CHURCH_DOCUMENT",
      fields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
      validationSources: [
        { host: "www.vatican.va", fields: { title: "Rerum Novarum", dateOrEra: "1891" } },
      ],
      requiredFacts: ["historyType", "title", "dateOrEra"],
    });
    const date = out.evidence.filter((r) => r.fieldVerified === "dateOrEra");
    expect(date).toHaveLength(1);
    expect(date[0].matchStatus).toBe("MATCH");
  });

  it("without requiredFacts keeps the type's REQUIRED_FACTS (no date row)", () => {
    const out = verifyCrossSource({
      contentType: "CHURCH_DOCUMENT",
      fields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
      validationSources: [{ host: "www.vatican.va", fields: { title: "Rerum Novarum" } }],
    });
    expect(out.evidence.some((r) => r.fieldVerified === "dateOrEra")).toBe(false);
  });

  it("a different year from the source is a recorded MISMATCH, not silence", () => {
    const out = verifyCrossSource({
      contentType: "APPARITION",
      fields: { apparitionTitle: "Our Lady of Lourdes", apparitionDate: "1858" },
      validationSources: [{ host: "www.vatican.va", fields: { apparitionDate: "1879" } }],
      requiredFacts: ["apparitionDate"],
    });
    expect(out.evidence[0].matchStatus).toBe("MISMATCH");
    expect(out.publishAllowed).toBe(false);
  });
});

describe("runVerifier blocks an unconfirmed validation need", () => {
  function prisma() {
    const created: Array<Record<string, unknown>> = [];
    return {
      created,
      client: {
        adminWorkerCrossSourceVerification: {
          create: vi.fn(async (args: { data: Record<string, unknown> }) => {
            created.push(args.data);
            return { id: `v${created.length}` };
          }),
        },
      } as unknown as Parameters<typeof runVerifier>[0],
    };
  }

  it("a title MATCH alone no longer allows a Church document to publish", async () => {
    const { client, created } = prisma();
    const out = await runVerifier(client, {
      contentType: "CHURCH_DOCUMENT",
      contentId: "art-doc",
      fields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
      validationSources: [{ host: "www.vatican.va", fields: { title: "Rerum Novarum" } }],
      requiredFacts: ["historyType", "title", "dateOrEra"],
      validationNeeds: ["dateOrEra"],
    });
    expect(out.publishAllowed).toBe(false);
    expect(out.blockingSensitiveFields).toContain("dateOrEra");
    // The date was compared and its (unconfirmed) outcome stored.
    expect(created.some((r) => r.fieldName === "dateOrEra")).toBe(true);
  });

  it("allows the publish once an independent source confirms the date too", async () => {
    const { client } = prisma();
    const out = await runVerifier(client, {
      contentType: "CHURCH_DOCUMENT",
      contentId: "art-doc",
      fields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
      validationSources: [
        {
          host: "www.vatican.va",
          fields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
        },
      ],
      requiredFacts: ["historyType", "title", "dateOrEra"],
      validationNeeds: ["dateOrEra"],
    });
    expect(out.blockingSensitiveFields).toEqual([]);
    expect(out.publishAllowed).toBe(true);
  });

  it("SENSITIVE_FIELDS names the fields the extractors actually emit", () => {
    expect(SENSITIVE_FIELDS.CHURCH_DOCUMENT).toContain("dateOrEra");
    expect(SENSITIVE_FIELDS.APPARITION).toEqual(
      expect.arrayContaining(["approvalStatus", "apparitionDate"]),
    );
  });
});

describe("evaluateValidationNeeds — the shared promote/publish predicate", () => {
  it("separates missing, unconfirmed, conflicted and confirmed needs", () => {
    const v = evaluateValidationNeeds(
      "APPARITION",
      ["approvalStatus", "apparitionDate", "apparitionLocation", "apparitionTitle"],
      [
        { fieldName: "approvalStatus", matchResult: "MATCH" },
        { fieldName: "approvalStatus", matchResult: "MISSING" },
        { fieldName: "apparitionDate", matchResult: "MISSING" },
        { fieldName: "apparitionTitle", matchResult: "MISMATCH" },
        { fieldName: "apparitionTitle", matchResult: "MATCH" },
      ],
    );
    expect(v.confirmed).toEqual(["approvalStatus"]);
    expect(v.unconfirmed).toEqual(["apparitionDate"]);
    expect(v.missing).toEqual(["apparitionLocation"]);
    expect(v.conflicted).toEqual(["apparitionTitle"]);
    expect(v.allConfirmed).toBe(false);
  });

  it("a derived need stands or falls with its parent field", () => {
    const rows = [{ fieldName: "feastDay", matchResult: "MATCH" }];
    const v = evaluateValidationNeeds("SAINT", ["feastDay", "feastMonth", "feastDayNumber"], rows);
    expect(v.allConfirmed).toBe(true);
    expect(evaluateValidationNeeds("SAINT", ["feastMonth"], []).missing).toEqual(["feastMonth"]);
  });
});

describe("expectedValueVariants for the dates the extractors lift", () => {
  it("offers the day-month form of a prose date, never the bare year", () => {
    const v = expectedValueVariants("CHURCH_DOCUMENT", "dateOrEra", "May 15, 1891");
    expect(v.primary).toBe("May 15, 1891");
    expect(v.all).toContain("15 May 1891");
    expect(v.all).not.toContain("1891");
  });

  it("reads a day-first date the same way", () => {
    const v = expectedValueVariants("APPARITION", "apparitionDate", "11 February 1858");
    expect(v.all).toContain("February 11, 1858");
  });

  it("accepts either dash in a year range", () => {
    const v = expectedValueVariants("CHURCH_DOCUMENT", "dateOrEra", "1545-1563");
    expect(v.all).toEqual(expect.arrayContaining(["1545-1563", "1545–1563", "1545 to 1563"]));
  });

  it("leaves a bare year as itself", () => {
    expect(expectedValueVariants("CHURCH_DOCUMENT", "dateOrEra", "1891")).toEqual({
      primary: "1891",
      all: ["1891"],
    });
  });
});

describe("CROSS_SOURCE_VERIFICATION promotes only when every need is confirmed", () => {
  const DOC = {
    id: "art-doc",
    contentType: "CHURCH_DOCUMENT",
    normalizedTitle: "Rerum Novarum",
    normalizedSlug: "rerum-novarum",
    extractedFields: { historyType: "encyclicals", title: "Rerum Novarum", dateOrEra: "1891" },
    fieldProvenance: [{ fieldName: "title" }],
    missingFields: [],
    validationNeeds: ["dateOrEra"],
    formattingMetadata: {},
    confidenceScore: 0.8,
    packageChecksum: "ck-doc",
    status: "BUILD_READY",
    sourceReadId: "sr-doc",
  };

  function makePrisma(artifact: Record<string, unknown> = DOC) {
    const rows: Array<{ fieldName: string; matchResult: string }> = [];
    const update = vi.fn(async () => ({}));
    const client = {
      adminWorkerPackageArtifact: { findFirst: vi.fn(async () => artifact), update },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({ sourceHost: "www.usccb.org" })),
      },
      adminWorkerCrossSourceVerification: {
        count: vi.fn(async () => rows.length),
        create: vi.fn(async (args: { data: { fieldName: string; matchResult: string } }) => {
          rows.push({ fieldName: args.data.fieldName, matchResult: args.data.matchResult });
          return { id: `v${rows.length}` };
        }),
        findMany: vi.fn(async () => rows),
      },
      adminWorkerRepairPlan: { count: vi.fn(async () => 0) },
    };
    return {
      rows,
      update,
      prisma: client as unknown as Parameters<typeof runCrossSourceVerification>[0],
    };
  }

  beforeEach(() => {
    vi.mocked(filePlan).mockClear();
    for (const k of Object.keys(probeResults)) delete probeResults[k];
  });

  it("a title MATCH with an unconfirmed date parks NEEDS_REPAIR (was VERIFICATION_READY)", async () => {
    probeResults.title = "MATCH";
    probeResults.historyType = "MATCH";
    const { prisma, rows, update } = makePrisma();
    await runCrossSourceVerification(prisma, "p1");
    // The date was compared and recorded this time.
    expect(rows.some((r) => r.fieldName === "dateOrEra")).toBe(true);
    const data = (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.status).toBe("NEEDS_REPAIR");
    expect(String(data.rejectionReason)).toContain("dateOrEra");
    expect(vi.mocked(filePlan)).toHaveBeenCalledTimes(1);
  });

  it("an independently confirmed date promotes to VERIFICATION_READY", async () => {
    probeResults.title = "MATCH";
    probeResults.historyType = "MATCH";
    probeResults.dateOrEra = "MATCH";
    const { prisma, rows, update } = makePrisma();
    await runCrossSourceVerification(prisma, "p1");
    expect(rows.find((r) => r.fieldName === "dateOrEra")?.matchResult).toBe("MATCH");
    const data = (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.status).toBe("VERIFICATION_READY");
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });

  // The probe matches a page against the date's printable forms and leads with
  // "Month D, YYYY". The value stored for a confirming source used to be that
  // form, while the candidate kept the extractor's own string, and compare()
  // does not equate the two: a date the page confirmed was recorded as a
  // MISMATCH, the need became "conflicted", and the artifact went round its
  // verification rounds to NEEDS_REVIEW.
  it.each([
    ["CHURCH_DOCUMENT", "dateOrEra", "May 15 1891"],
    ["CHURCH_DOCUMENT", "dateOrEra", "15 May 1891"],
    ["CHURCH_DOCUMENT", "dateOrEra", "1891-05-15"],
    ["APPARITION", "apparitionDate", "February 11 1858"],
  ])("a confirmed %s %s written %j is recorded as the MATCH it is", async (type, field, date) => {
    for (const f of ["title", "historyType", "apparitionTitle", "approvalStatus", field]) {
      probeResults[f] = "MATCH";
    }
    const artifact =
      type === "APPARITION"
        ? {
            ...DOC,
            id: "art-app",
            contentType: "APPARITION",
            normalizedTitle: "Our Lady of Lourdes",
            normalizedSlug: "our-lady-of-lourdes",
            extractedFields: {
              apparitionTitle: "Our Lady of Lourdes",
              approvalStatus: "approved",
              apparitionDate: date,
            },
            validationNeeds: ["approvalStatus", "apparitionDate"],
          }
        : { ...DOC, extractedFields: { ...DOC.extractedFields, dateOrEra: date } };
    const { prisma, rows, update } = makePrisma(artifact);
    await runCrossSourceVerification(prisma, "p1");
    expect(rows.filter((r) => r.fieldName === field).map((r) => r.matchResult)).toEqual(["MATCH"]);
    expect(rows.some((r) => r.matchResult === "MISMATCH")).toBe(false);
    const data = (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.status).toBe("VERIFICATION_READY");
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });
});

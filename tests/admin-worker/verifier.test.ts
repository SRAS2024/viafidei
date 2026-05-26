/**
 * AdminWorkerVerifier (spec §11). Confirms sensitive-field
 * enforcement, durable persistence to AdminWorkerCrossSourceVerification,
 * and the publish-allowed gate.
 */

import { describe, expect, it, vi } from "vitest";

import { runVerifier, SENSITIVE_FIELDS } from "@/lib/admin-worker/verifier";

function makePrisma() {
  const created: unknown[] = [];
  return {
    created,
    prisma: {
      adminWorkerCrossSourceVerification: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const row = { id: `v${created.length}`, ...args.data };
          created.push(row);
          return row;
        }),
      },
    } as unknown as Parameters<typeof runVerifier>[0],
  };
}

describe("runVerifier — durable cross-source verification (spec §11)", () => {
  it("publishAllowed true when every sensitive field matches across sources", async () => {
    const { prisma } = makePrisma();
    const out = await runVerifier(prisma, {
      contentType: "SAINT",
      contentId: "saint-1",
      packageChecksum: "checksum-1",
      fields: {
        saintName: "Saint Thérèse of Lisieux",
        feastDay: "October 1",
        feastMonth: "October",
        feastDayNumber: 1,
      },
      validationSources: [
        {
          host: "vatican.va",
          fields: {
            saintName: "Saint Thérèse of Lisieux",
            feastDay: "October 1",
            feastMonth: "October",
            feastDayNumber: 1,
          },
        },
        {
          host: "usccb.org",
          fields: {
            saintName: "Saint Thérèse of Lisieux",
            feastDay: "October 1",
            feastMonth: "October",
            feastDayNumber: 1,
          },
        },
      ],
    });
    expect(out.publishAllowed).toBe(true);
    expect(out.blockingSensitiveFields).toEqual([]);
    expect(out.verificationRowIds.length).toBeGreaterThan(0);
  });

  it("blocks publish when a sensitive saint feast day does not match", async () => {
    const { prisma } = makePrisma();
    const out = await runVerifier(prisma, {
      contentType: "SAINT",
      contentId: "saint-1",
      fields: {
        saintName: "Saint Thérèse",
        feastDay: "October 1",
        feastMonth: "October",
        feastDayNumber: 1,
      },
      validationSources: [
        {
          host: "wikipedia.org",
          fields: {
            saintName: "Saint Thérèse",
            // Conflict — different feast day
            feastDay: "December 14",
            feastMonth: "December",
            feastDayNumber: 14,
          },
        },
      ],
    });
    expect(out.publishAllowed).toBe(false);
    expect(out.blockingSensitiveFields).toContain("feastDay");
  });

  it("blocks publish when apparition approvalStatus is missing", async () => {
    const { prisma } = makePrisma();
    const out = await runVerifier(prisma, {
      contentType: "APPARITION",
      fields: {
        apparitionTitle: "Our Lady of Fátima",
        // approvalStatus missing!
      },
      validationSources: [
        {
          host: "vatican.va",
          fields: { apparitionTitle: "Our Lady of Fátima" },
        },
      ],
    });
    expect(out.publishAllowed).toBe(false);
    expect(out.blockingSensitiveFields).toContain("approvalStatus");
    expect(out.summary).toMatch(/approvalStatus|Missing required/i);
  });

  it("persists one AdminWorkerCrossSourceVerification row per (field, source)", async () => {
    const { prisma, created } = makePrisma();
    await runVerifier(prisma, {
      contentType: "SAINT",
      fields: {
        saintName: "Saint Pio",
        feastDay: "September 23",
        feastMonth: "September",
        feastDayNumber: 23,
      },
      validationSources: [
        {
          host: "vatican.va",
          fields: {
            saintName: "Saint Pio",
            feastDay: "September 23",
            feastMonth: "September",
            feastDayNumber: 23,
          },
        },
      ],
    });
    expect(created.length).toBeGreaterThan(0);
    expect((created[0] as { finalDecision: string }).finalDecision).toMatch(
      /ACCEPT|MISSING_EVIDENCE|REJECT|CONFLICT_NEEDS_REVIEW/,
    );
  });

  it("includes summary text the admin UI can render", async () => {
    const { prisma } = makePrisma();
    const out = await runVerifier(prisma, {
      contentType: "SAINT",
      fields: {
        saintName: "Saint Pio",
        feastDay: "September 23",
        feastMonth: "September",
        feastDayNumber: 23,
      },
      validationSources: [
        {
          host: "vatican.va",
          fields: {
            saintName: "Saint Pio",
            feastDay: "September 23",
            feastMonth: "September",
            feastDayNumber: 23,
          },
        },
      ],
    });
    expect(out.summary).toBeTruthy();
    expect(out.summary.length).toBeGreaterThan(10);
  });

  it("SENSITIVE_FIELDS lists the right fields per content type", () => {
    expect(SENSITIVE_FIELDS.SAINT).toContain("feastDay");
    expect(SENSITIVE_FIELDS.APPARITION).toContain("approvalStatus");
    expect(SENSITIVE_FIELDS.NOVENA).toContain("duration");
    expect(SENSITIVE_FIELDS.ROSARY).toContain("mysterySets");
    expect(SENSITIVE_FIELDS.SACRAMENT).toContain("sacramentKey");
  });
});

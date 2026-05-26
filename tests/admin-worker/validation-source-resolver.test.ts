/**
 * Validation source resolver (spec §5). Confirms the resolver picks
 * authoritative sources, excludes the primary source, and surfaces
 * higher-authority candidates for conflict resolution.
 */

import { describe, expect, it, vi } from "vitest";

import {
  findHigherAuthority,
  resolveValidationSources,
} from "@/lib/admin-worker/validation-source-resolver";

function makePrisma(
  rows: Array<{
    sourceHost: string;
    reputationTier: string;
    validationEvidenceSuccessRate: number;
  }> = [],
) {
  return {
    adminWorkerSourceReputation: {
      findMany: vi.fn(async () => rows),
    },
  } as unknown as Parameters<typeof resolveValidationSources>[0];
}

describe("resolveValidationSources — spec §5", () => {
  it("ranks Vatican above USCCB for saint feast day", async () => {
    const out = await resolveValidationSources(makePrisma(), {
      contentType: "SAINT",
      field: "feastDay",
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].host).toBe("www.vatican.va");
    expect(out[0].authority).toBe("VATICAN");
  });

  it("excludes the primary source so we never validate against ourselves", async () => {
    const out = await resolveValidationSources(makePrisma(), {
      contentType: "SAINT",
      field: "feastDay",
      primarySourceHost: "www.vatican.va",
    });
    expect(out.every((r) => r.host !== "www.vatican.va")).toBe(true);
  });

  it("bumps rank for sources with high past validation success", async () => {
    const withRep = await resolveValidationSources(
      makePrisma([
        {
          sourceHost: "www.usccb.org",
          reputationTier: "TRUSTED",
          validationEvidenceSuccessRate: 0.95,
        },
      ]),
      { contentType: "SAINT", field: "feastDay" },
    );
    const usccb = withRep.find((r) => r.host === "www.usccb.org");
    expect(usccb?.pastSuccessRate).toBe(0.95);
  });

  it("returns an empty array for an unknown (contentType, field) combination", async () => {
    const out = await resolveValidationSources(makePrisma(), {
      contentType: "PARISH",
      field: "feastDay",
    });
    expect(out).toEqual([]);
  });

  it("respects the limit option", async () => {
    const out = await resolveValidationSources(
      makePrisma(),
      { contentType: "SAINT", field: "feastDay" },
      { limit: 1 },
    );
    expect(out.length).toBe(1);
  });
});

describe("findHigherAuthority — conflict resolution (spec §5)", () => {
  it("returns a source whose authority outranks the consulted set", async () => {
    const next = await findHigherAuthority(makePrisma(), {
      contentType: "SAINT",
      field: "feastDay",
      excludeAuthorities: ["USCCB", "TRUSTED_PUBLISHER"],
    });
    expect(next?.authority).toBe("VATICAN");
  });

  it("returns null when every authority has been consulted", async () => {
    const next = await findHigherAuthority(makePrisma(), {
      contentType: "SAINT",
      field: "feastDay",
      excludeAuthorities: ["VATICAN", "USCCB", "TRUSTED_PUBLISHER"],
    });
    expect(next).toBeNull();
  });
});

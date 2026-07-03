/**
 * Per-method strategy memory + adaptive selection (adaptive-worker Phase C/D).
 *
 * Pins: outcomes update the EWMA success rate; ranking prefers content-type-
 * specific rows over the "*" aggregate and sorts by EWMA; and the ε-greedy
 * chooser exploits the best method by default but explores when ε fires or an
 * unseen candidate exists.
 */
import { describe, expect, it } from "vitest";

import {
  ANY_CONTENT_TYPE,
  chooseMethodWithExploration,
  planMethods,
  rankMethods,
  recordMethodOutcome,
} from "@/lib/admin-worker/method-memory";

interface Stat {
  dimension: string;
  method: string;
  contentType: string;
  attempts: number;
  successes: number;
  failures: number;
  ewma: number;
  lastOutcome: string | null;
  lastReason: string | null;
}

function key(d: string, m: string, c: string) {
  return `${d}|${m}|${c}`;
}

function fakePrisma(seed: Stat[] = []) {
  const rows = new Map<string, Stat>(
    seed.map((s) => [key(s.dimension, s.method, s.contentType), s]),
  );
  return {
    rows,
    adminWorkerStrategyStat: {
      findUnique: async ({
        where,
      }: {
        where: {
          dimension_method_contentType: { dimension: string; method: string; contentType: string };
        };
      }) => {
        const w = where.dimension_method_contentType;
        return rows.get(key(w.dimension, w.method, w.contentType)) ?? null;
      },
      findMany: async ({
        where,
      }: {
        where?: { dimension?: string; contentType?: { in: string[] } };
      }) => {
        return [...rows.values()].filter((r) => {
          if (where?.dimension && r.dimension !== where.dimension) return false;
          if (where?.contentType?.in && !where.contentType.in.includes(r.contentType)) return false;
          return true;
        });
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: {
          dimension_method_contentType: { dimension: string; method: string; contentType: string };
        };
        update: Record<string, unknown>;
        create: Stat;
      }) => {
        const w = where.dimension_method_contentType;
        const k = key(w.dimension, w.method, w.contentType);
        const existing = rows.get(k);
        if (existing) {
          if (update.attempts) existing.attempts += 1;
          if (update.successes) existing.successes += 1;
          if (update.failures) existing.failures += 1;
          if (typeof update.ewma === "number") existing.ewma = update.ewma;
          existing.lastOutcome = (update.lastOutcome as string) ?? existing.lastOutcome;
        } else {
          rows.set(k, { ...create });
        }
        return rows.get(k);
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

describe("recordMethodOutcome", () => {
  it("creates a row on first outcome (signal = success)", async () => {
    const prisma = fakePrisma();
    await recordMethodOutcome(prisma as FakePrisma, {
      dimension: "discovery",
      method: "SITEMAP",
      contentType: "PRAYER",
      ok: true,
    });
    const row = prisma.rows.get(key("discovery", "SITEMAP", "PRAYER"));
    expect(row.attempts).toBe(1);
    expect(row.successes).toBe(1);
    expect(row.ewma).toBe(1);
  });

  it("moves EWMA toward the newest outcome", async () => {
    const prisma = fakePrisma([
      {
        dimension: "discovery",
        method: "RSS",
        contentType: "*",
        attempts: 1,
        successes: 1,
        failures: 0,
        ewma: 1,
        lastOutcome: "success",
        lastReason: null,
      },
    ]);
    // A failure should pull the EWMA down from 1 (alpha 0.25 → 0.75).
    await recordMethodOutcome(prisma as FakePrisma, {
      dimension: "discovery",
      method: "RSS",
      ok: false,
    });
    const row = prisma.rows.get(key("discovery", "RSS", "*"));
    expect(row.ewma).toBeCloseTo(0.75, 5);
    expect(row.failures).toBe(1);
  });
});

describe("rankMethods", () => {
  it("sorts by EWMA desc and prefers content-type-specific over aggregate", async () => {
    const prisma = fakePrisma([
      mk("discovery", "SITEMAP", "PRAYER", 0.9, 10),
      mk("discovery", "RSS", "PRAYER", 0.3, 10),
      mk("discovery", "SITEMAP", "*", 0.5, 40), // aggregate, should be shadowed by specific
      mk("discovery", "WEB_SEARCH", "*", 0.6, 5), // no specific → aggregate used
    ]);
    const ranked = await rankMethods(prisma as FakePrisma, {
      dimension: "discovery",
      contentType: "PRAYER",
    });
    expect(ranked[0].method).toBe("SITEMAP");
    expect(ranked[0].ewma).toBe(0.9); // the PRAYER-specific row, not the 0.5 aggregate
    expect(ranked[0].fromAggregate).toBe(false);
    const webSearch = ranked.find((r) => r.method === "WEB_SEARCH");
    expect(webSearch?.fromAggregate).toBe(true);
    // RSS (0.3) ranks last.
    expect(ranked[ranked.length - 1].method).toBe("RSS");
  });
});

describe("chooseMethodWithExploration", () => {
  it("exploits the best known method when ε does not fire", async () => {
    const prisma = fakePrisma([
      mk("fetch", "static", "*", 0.9, 20),
      mk("fetch", "dynamic", "*", 0.4, 20),
    ]);
    const choice = await chooseMethodWithExploration(prisma as FakePrisma, {
      dimension: "fetch",
      candidates: ["static", "dynamic"],
      epsilon: 0.15,
      rand: () => 0.99, // never explore
    });
    expect(choice.method).toBe("static");
    expect(choice.mode).toBe("exploit");
  });

  it("explores a non-best candidate when ε fires", async () => {
    const prisma = fakePrisma([
      mk("fetch", "static", "*", 0.9, 20),
      mk("fetch", "dynamic", "*", 0.4, 20),
    ]);
    const choice = await chooseMethodWithExploration(prisma as FakePrisma, {
      dimension: "fetch",
      candidates: ["static", "dynamic"],
      epsilon: 0.15,
      // First rand() < ε triggers explore; there are no unseen candidates here.
      rand: () => 0.01,
    });
    expect(choice.method).toBe("dynamic");
    expect(choice.mode).toBe("explore");
  });

  it("returns the single candidate without exploring", async () => {
    const prisma = fakePrisma();
    const choice = await chooseMethodWithExploration(prisma as FakePrisma, {
      dimension: "fetch",
      candidates: ["static"],
    });
    expect(choice.method).toBe("static");
    expect(choice.mode).toBe("exploit");
  });
});

function mk(
  dimension: string,
  method: string,
  contentType: string,
  ewma: number,
  attempts: number,
): Stat {
  return {
    dimension,
    method,
    contentType,
    attempts,
    successes: Math.round(ewma * attempts),
    failures: attempts - Math.round(ewma * attempts),
    ewma,
    lastOutcome: "success",
    lastReason: null,
  };
}

describe("planMethods (apply the learned preference)", () => {
  it("runs everything (best-first) when no method is a chronic failure", async () => {
    const prisma = fakePrisma([
      mk("discovery", "SITEMAP", "*", 0.8, 10),
      mk("discovery", "RSS", "*", 0.5, 10),
    ]);
    const plan = await planMethods(prisma as FakePrisma, {
      dimension: "discovery",
      candidates: ["RSS", "SITEMAP", "API"], // API unseen
      rand: () => 0.99,
    });
    expect(plan.skipped).toEqual([]);
    // Best-first: SITEMAP (0.8) before RSS (0.5); unseen API is optimistic (>= 1).
    expect(plan.run[0]).toBe("API");
    expect(plan.run.indexOf("SITEMAP")).toBeLessThan(plan.run.indexOf("RSS"));
  });

  it("skips a chronic-failure method (strong evidence) when ε does not fire", async () => {
    const prisma = fakePrisma([
      mk("discovery", "SITEMAP", "*", 0.9, 12),
      mk("discovery", "API", "*", 0.05, 20), // chronic failure: low ewma, many attempts
    ]);
    const plan = await planMethods(prisma as FakePrisma, {
      dimension: "discovery",
      candidates: ["SITEMAP", "API"],
      epsilon: 0.15,
      rand: () => 0.99, // no exploration
    });
    expect(plan.skipped).toEqual(["API"]);
    expect(plan.run).toEqual(["SITEMAP"]);
  });

  it("re-trials a chronic failure when ε fires (never abandons permanently)", async () => {
    const prisma = fakePrisma([mk("discovery", "API", "*", 0.05, 20)]);
    const plan = await planMethods(prisma as FakePrisma, {
      dimension: "discovery",
      candidates: ["API"],
      epsilon: 0.15,
      rand: () => 0.01, // explore → re-trial
    });
    expect(plan.skipped).toEqual([]);
    expect(plan.run).toEqual(["API"]);
  });

  it("does not skip a low score that lacks enough attempts (avoids premature judgement)", async () => {
    const prisma = fakePrisma([mk("discovery", "API", "*", 0.05, 3)]); // only 3 attempts
    const plan = await planMethods(prisma as FakePrisma, {
      dimension: "discovery",
      candidates: ["API"],
      rand: () => 0.99,
    });
    expect(plan.skipped).toEqual([]);
    expect(plan.run).toEqual(["API"]);
  });
});

// eslint sanity: ANY_CONTENT_TYPE export is the sentinel used by callers.
it("exports the aggregate sentinel", () => {
  expect(ANY_CONTENT_TYPE).toBe("*");
});

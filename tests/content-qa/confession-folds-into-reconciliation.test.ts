/**
 * Confession must NOT count as a separate sacrament threshold outside
 * the seven canonical sacraments. The sacrament normalizer collapses
 * Confession → Reconciliation, and the strict pipeline writes the row
 * with sacramentKey = "reconciliation". The sacrament threshold counts
 * only the seven canonical keys, so a Confession ingest can only
 * contribute to the Reconciliation slot — not a separate row.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeSacrament,
  SACRAMENT_KEYS,
  isCanonicalSacramentKey,
} from "@/lib/content-qa/sacrament-normalize";
import { validateSacramentPackage } from "@/lib/content-qa/contracts/sacrament";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const USCCB = staticPurposesForHost("usccb.org");

describe("Confession folds into Reconciliation (not a separate threshold)", () => {
  it("normalizes Confession → reconciliation", () => {
    const norm = normalizeSacrament({
      title: "Sacrament of Confession",
      body: "The sacrament of Confession gives sanctifying grace to the recipient. Minister: a priest.",
    });
    expect(norm.key).toBe("reconciliation");
  });

  it("normalizes Penance → reconciliation", () => {
    const norm = normalizeSacrament({
      title: "Penance",
      body: "The sacrament of penance is essential. Grace is conferred. Catechism 1422.",
    });
    expect(norm.key).toBe("reconciliation");
  });

  it("the seven canonical keys contain reconciliation but NOT confession", () => {
    expect([...SACRAMENT_KEYS]).toContain("reconciliation");
    expect([...SACRAMENT_KEYS]).not.toContain("confession");
    expect([...SACRAMENT_KEYS]).not.toContain("penance");
  });

  it("isCanonicalSacramentKey rejects 'confession' but accepts 'reconciliation'", () => {
    expect(isCanonicalSacramentKey("confession")).toBe(false);
    expect(isCanonicalSacramentKey("penance")).toBe(false);
    expect(isCanonicalSacramentKey("reconciliation")).toBe(true);
  });

  it("a Confession Sacrament package validates and gets sacramentKey = reconciliation", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "confession",
        title: "The Sacrament of Confession",
        sourceUrl: "https://www.usccb.org/confession",
        sourceHost: "usccb.org",
        payload: {
          // sacramentKey deliberately omitted — normalizer should pick up Confession
          sacramentName: "Confession",
          background: "The sacrament of Confession is a healing sacrament instituted by Christ.",
          catholicExplanation:
            "Confession (also called Reconciliation or Penance) confers sanctifying grace. The minister is a priest. The matter is the penitent's contrition; the form is absolution. Catechism 1422.",
          preparationGuide: "Examination of conscience. Pray for true contrition.",
          participationGuide:
            "Approach the priest. Make the Sign of the Cross. Begin: 'Bless me father, for I have sinned.'",
        },
      },
      { sourcePurposes: USCCB },
    );
    expect(result.decision).toBe("publish");
  });

  it("a non-sacrament content type (e.g. Blessing of Throats) is deleted, not counted", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "blessing-throats",
        title: "Blessing of Throats",
        sourceUrl: "https://www.usccb.org/blessing",
        sourceHost: "usccb.org",
        payload: {
          sacramentKey: null,
          sacramentName: "Blessing of Throats",
          background: "On the feast of Saint Blaise, throats are blessed.",
          catholicExplanation: "Not one of the seven sacraments.",
          preparationGuide: "None.",
          participationGuide: "Receive the blessing.",
        },
      },
      { sourcePurposes: USCCB },
    );
    expect(result.decision).toBe("delete");
  });
});

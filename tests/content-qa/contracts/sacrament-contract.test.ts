import { describe, expect, it } from "vitest";
import { validateSacramentPackage } from "@/lib/content-qa/contracts/sacrament";
import { normalizeSacrament } from "@/lib/content-qa/sacrament-normalize";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const USCCB = staticPurposesForHost("usccb.org");
const PARISH_DIR = staticPurposesForHost("parishesonline.com");

describe("SacramentPackage contract", () => {
  it("accepts only the seven canonical sacraments", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "baptism",
        title: "The Sacrament of Baptism",
        sourceUrl: "https://www.usccb.org/baptism",
        sourceHost: "usccb.org",
        payload: {
          sacramentKey: "baptism",
          sacramentName: "Baptism",
          background:
            "Baptism is the first sacrament of Christian initiation. It washes away original sin and incorporates the recipient into the Body of Christ.",
          catholicExplanation:
            "Baptism is the sacrament instituted by Christ that confers sanctifying grace and the indelible character of being a Christian. The matter is water; the form is the Trinitarian formula. The minister is ordinarily a priest or deacon.",
          biblicalFoundation: "Matthew 28:19",
          preparationGuide:
            "Parents should attend a baptismal preparation class. Godparents must be practicing Catholics.",
          participationGuide:
            "Bring the baby in white clothing. The priest will pour water three times saying the Trinitarian formula.",
        },
      },
      { sourcePurposes: USCCB },
    );
    expect(result.decision).toBe("publish");
  });

  it("normalizes 'Confession' to Reconciliation", () => {
    const norm = normalizeSacrament({
      title: "The Sacrament of Confession",
      body: "Confession is the sacrament where we receive forgiveness for our sins. The minister is a priest. Catechism 1422.",
    });
    expect(norm.key).toBe("reconciliation");
    expect(norm.group).toBe("Healing");
  });

  it("normalizes 'Penance' to Reconciliation", () => {
    const norm = normalizeSacrament({
      title: "Penance",
      body: "The sacrament of penance is the sacrament Catholics receive to obtain absolution. Grace is given.",
    });
    expect(norm.key).toBe("reconciliation");
  });

  it("deletes a confession schedule page", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "confession-schedule",
        title: "Confession Schedule",
        sourceUrl: "https://www.usccb.org/schedule",
        sourceHost: "usccb.org",
        payload: {
          sacramentKey: null,
          sacramentName: "Confession Schedule",
          background:
            "Confession schedule: Saturday 3pm-4pm. Confession times: Wednesday after Mass.",
          catholicExplanation: "Times of confession.",
          preparationGuide: "Show up on time.",
          participationGuide: "Wait in line.",
        },
      },
      { sourcePurposes: USCCB },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a sacrament registration page", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "baptism-registration",
        title: "Baptism Registration",
        sourceUrl: "https://www.usccb.org/register",
        sourceHost: "usccb.org",
        payload: {
          sacramentKey: "baptism",
          sacramentName: "Baptism Registration",
          background:
            "Register now for our baptism class. Class sign up open. Click here to enroll.",
          catholicExplanation: "Sign up for baptism class.",
          preparationGuide: "Register here.",
          participationGuide: "Show up at the class.",
        },
      },
      { sourcePurposes: USCCB },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes content that is not one of the seven sacraments", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "blessing-of-throats",
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

  it("rejects a sacrament from a source not approved for sacraments", () => {
    const result = validateSacramentPackage(
      {
        contentType: "Sacrament",
        slug: "baptism-from-parish-dir",
        title: "The Sacrament of Baptism",
        sourceUrl: "https://parishesonline.com/baptism",
        sourceHost: "parishesonline.com",
        payload: {
          sacramentKey: "baptism",
          sacramentName: "Baptism",
          background:
            "Baptism is the first sacrament of Christian initiation. It washes away original sin.",
          catholicExplanation: "Baptism is the sacrament instituted by Christ.",
          preparationGuide: "Parents should attend a baptismal preparation class.",
          participationGuide: "Bring the baby in white clothing.",
        },
      },
      { sourcePurposes: PARISH_DIR },
    );
    expect(result.decision).toBe("reject");
    expect(result.reason).toMatch(/not approved to ingest sacraments|canIngestSacraments/);
  });
});

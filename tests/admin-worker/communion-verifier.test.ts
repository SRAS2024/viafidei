/**
 * The communion-with-Rome verifier is the safety gate for Google Maps parish
 * discovery: a parish is only ever published when its own website shows it is a
 * Roman Catholic parish in communion with the Holy See. These tests pin the
 * heuristic — disqualifying bodies are rejected, clear Roman signals pass, and
 * everything ambiguous is left "unknown" (→ human review), never published.
 */
import { describe, expect, it } from "vitest";

import { assessCommunionFromText, htmlToText } from "@/lib/admin-worker/communion-verifier";

describe("communion verifier", () => {
  it("rejects Old Catholic parishes", () => {
    const v = assessCommunionFromText(
      "St. Mary's is an Old Catholic parish in the Union of Utrecht tradition.",
    );
    expect(v.status).toBe("not-in-communion");
    expect(v.signals.negative.join(" ")).toMatch(/Old Catholic/i);
  });

  it("rejects the Polish National Catholic Church", () => {
    const v = assessCommunionFromText("A parish of the Polish National Catholic Church (PNCC).");
    expect(v.status).toBe("not-in-communion");
  });

  it("rejects sedevacantist chapels", () => {
    const v = assessCommunionFromText(
      "We are a sedevacantist chapel offering the traditional Mass.",
    );
    expect(v.status).toBe("not-in-communion");
  });

  it("rejects bodies that ordain women", () => {
    const v = assessCommunionFromText("Our independent community welcomes women priests.");
    expect(v.status).toBe("not-in-communion");
  });

  it("rejects Orthodox and Anglican identity", () => {
    expect(assessCommunionFromText("A Greek Orthodox church.").status).toBe("not-in-communion");
    expect(assessCommunionFromText("An Anglican parish.").status).toBe("not-in-communion");
  });

  it("confirms a Roman Catholic parish with a diocese and USCCB", () => {
    const v = assessCommunionFromText(
      "Saint Patrick Roman Catholic Church, a parish of the Diocese of Springfield. " +
        "See the USCCB for more. Sacrament of Reconciliation offered Saturdays.",
    );
    expect(v.status).toBe("in-communion");
    expect(v.confidence).toBeGreaterThan(0.6);
  });

  it("confirms an explicit communion statement", () => {
    const v = assessCommunionFromText(
      "Our parish is in full communion with the Holy See and the Bishop of Rome.",
    );
    expect(v.status).toBe("in-communion");
  });

  it("leaves a bare 'Catholic' site unknown (Old Catholics also say 'Catholic')", () => {
    const v = assessCommunionFromText("Welcome to our Catholic community. Mass is at 10am.");
    expect(v.status).toBe("unknown");
  });

  it("routes the SSPX to review rather than auto-publishing or rejecting", () => {
    const v = assessCommunionFromText(
      "A chapel of the Society of Saint Pius X (SSPX) offering the traditional Latin Mass.",
    );
    expect(v.status).toBe("unknown");
    expect(v.signals.review.join(" ")).toMatch(/SSPX/i);
  });

  it("strips HTML to scannable text", () => {
    const t = htmlToText(
      "<html><head><style>x{}</style></head><body><h1>Roman&nbsp;Catholic</h1></body></html>",
    );
    expect(t).toContain("Roman Catholic");
    expect(t).not.toContain("<");
  });
});

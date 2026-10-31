/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedDetail } from "@/components/ui/PublishedDetail";
import type { PublishedItem } from "@/lib/data/published";

afterEach(() => cleanup());

function makeItem(payload: Record<string, unknown>): PublishedItem {
  return {
    id: "1",
    contentType: "RITE",
    slug: "roman-rite",
    title: "The Roman Rite",
    authorityLevel: "MAGISTERIAL",
    version: 1,
    payload,
  } as PublishedItem;
}

describe("PublishedDetail — stray metadata is never rendered as a section", () => {
  it("renders only the fields a page names — nothing else in the payload", () => {
    // There is no catch-all any more: it is how "Feast month: 11", "Wikidata
    // qid", "Content subtype" and "Structure: nine_days" reached readers.
    render(
      <PublishedDetail
        item={makeItem({
          history: "A long and venerable history of the Roman Rite.",
          riteKey: "roman",
          associatedSaintSlug: "st-gregory",
          canonicalUrl: "https://example.org/roman-rite",
          approvedStatus: "APPROVED",
          requiresHumanReview: false,
          confidence: 0.92,
          errors: [],
          contentType: "RITE",
          feastMonth: 11,
          feastDayOfMonth: 15,
          wikidataQid: "Q2123866",
          contentSubtype: "liturgical_rite",
          structure: "nine_days",
          saintName: "Saint Pio of Pietrelcina",
          devotionType: "consecration",
          dropdownMetadata: { foo: "bar" },
        })}
        primaryFields={["history"]}
      />,
    );
    expect(screen.getByText(/venerable history/i)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "History",
    ]);
    for (const stray of [
      /rite key/i,
      /canonical url/i,
      /approved status/i,
      /requires human review/i,
      /confidence/i,
      /feast month/i,
      /Q2123866/,
      /content subtype/i,
      /nine_days/,
      /saint name/i,
      /devotion type/i,
      /dropdown metadata/i,
    ]) {
      expect(screen.queryByText(stray)).not.toBeInTheDocument();
    }
  });

  it("does not render the summary as a body section (it belongs in the header)", () => {
    render(
      <PublishedDetail item={makeItem({ summary: "Short summary.", history: "Full history." })} />,
    );
    // Summary text appears once (the header), never as its own "Summary" section.
    expect(screen.queryByRole("heading", { name: /summary/i })).not.toBeInTheDocument();
    expect(screen.getByText("Short summary.")).toBeInTheDocument();
  });

  it("still renders a metadata-looking field when a page requests it explicitly", () => {
    // Display fields that merely match the metadata suffix (e.g. a Doctor's
    // doctorTitle ends in "Title") are legitimately surfaced via secondary
    // fields; explicit requests bypass the catch-all metadata filter.
    render(
      <PublishedDetail
        item={makeItem({ background: "A life of grace.", doctorTitle: "Angelic Doctor" })}
        primaryFields={["background"]}
        secondaryFields={["doctorTitle"]}
      />,
    );
    expect(screen.getByRole("heading", { name: /doctor title/i })).toBeInTheDocument();
    expect(screen.getByText("Angelic Doctor")).toBeInTheDocument();
  });

  it("never renders internal routing keys (sacramentKey, riteKey) even if listed", () => {
    // These are links between content, not content. The "Sacrament Key:
    // reconciliation" leak must not recur even when a page names them.
    render(
      <PublishedDetail
        item={makeItem({ steps: ["Step one"], sacramentKey: "reconciliation", riteKey: "roman" })}
        primaryFields={["steps"]}
        secondaryFields={["sacramentKey", "riteKey"]}
      />,
    );
    expect(screen.queryByRole("heading", { name: /sacrament key/i })).not.toBeInTheDocument();
    expect(screen.queryByText("reconciliation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /rite key/i })).not.toBeInTheDocument();
    // The real content (the steps) still renders.
    expect(screen.getByText("Step one")).toBeInTheDocument();
  });
});

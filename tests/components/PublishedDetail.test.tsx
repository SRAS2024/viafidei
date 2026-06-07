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
  it("hides internal key/slug/url and worker-metadata fields from the catch-all body", () => {
    render(
      <PublishedDetail
        item={makeItem({
          history: "A long and venerable history of the Roman Rite.",
          // All of the following are structural metadata that previously leaked
          // into the page as stray headings like "Rite Key".
          riteKey: "roman",
          associatedSaintSlug: "st-gregory",
          canonicalUrl: "https://example.org/roman-rite",
          approvedStatus: "APPROVED",
          requiresHumanReview: false,
          confidence: 0.92,
          errors: [],
          contentType: "RITE",
        })}
      />,
    );
    // Real content renders.
    expect(screen.getByText(/venerable history/i)).toBeInTheDocument();
    // None of the metadata keys surface as headings.
    for (const stray of [
      /rite key/i,
      /associated saint slug/i,
      /canonical url/i,
      /approved status/i,
      /requires human review/i,
      /confidence/i,
      /errors/i,
    ]) {
      expect(screen.queryByText(stray)).not.toBeInTheDocument();
    }
  });

  it("hides the worker's *Name / *Title / *Type fields (title duplicates + classification) from the catch-all", () => {
    render(
      <PublishedDetail
        item={makeItem({
          background: "He bore the stigmata for fifty years.",
          // These are exactly the stray sections seen on detail pages:
          saintName: "Saint Pio of Pietrelcina", // duplicates the title
          saintType: "mystic", // classification metadata
          devotionTitle: "Devotion to the Sacred Heart",
          devotionType: "consecration",
          liturgyType: "office",
          dropdownMetadata: { foo: "bar" },
        })}
      />,
    );
    expect(screen.getByText(/bore the stigmata/i)).toBeInTheDocument();
    for (const stray of [
      /saint name/i,
      /saint type/i,
      /devotion title/i,
      /devotion type/i,
      /liturgy type/i,
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

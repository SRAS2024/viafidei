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

  it("does not render the summary as a body section (it belongs in the header)", () => {
    render(
      <PublishedDetail item={makeItem({ summary: "Short summary.", history: "Full history." })} />,
    );
    // Summary text appears once (the header), never as its own "Summary" section.
    expect(screen.queryByRole("heading", { name: /summary/i })).not.toBeInTheDocument();
    expect(screen.getByText("Short summary.")).toBeInTheDocument();
  });

  it("still renders a metadata-looking key when a page requests it explicitly", () => {
    // Guides legitimately surface sacramentKey via secondaryFields; explicit
    // requests bypass the catch-all metadata filter.
    render(
      <PublishedDetail
        item={makeItem({ steps: ["Step one"], sacramentKey: "baptism" })}
        primaryFields={["steps"]}
        secondaryFields={["sacramentKey"]}
      />,
    );
    expect(screen.getByRole("heading", { name: /sacrament key/i })).toBeInTheDocument();
    expect(screen.getByText("baptism")).toBeInTheDocument();
  });
});

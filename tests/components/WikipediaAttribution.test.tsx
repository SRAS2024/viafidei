/**
 * @vitest-environment jsdom
 *
 * The detail page credits Wikipedia in ONE small line when it shows text
 * quoted from an article ("Text from Wikipedia (title), CC BY-SA 4.0", both
 * linked), and never prints the structured saint's internal fields ("Feast
 * month 6", "Wikidata qid Q78679") that used to leak into the page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedDetail } from "@/components/ui/PublishedDetail";
import { createTranslator } from "@/lib/i18n/translator";
import { WikipediaAttribution } from "@/components/ui/WikipediaAttribution";
import type { PublishedItem } from "@/lib/data/published";

const t = createTranslator("en");

afterEach(() => cleanup());

const EN = "https://en.wikipedia.org/wiki/Hildegard_Burjan";
const BURJAN = {
  slug: "saint-hildegard-burjan",
  canonicalName: "Hildegard Burjan",
  feastDay: "06-12",
  feastMonth: 6,
  feastDayOfMonth: 12,
  wikidataQid: "Q78679",
  biography:
    "Hildegard Burjan was an Austrian politician and the founder of the Caritas Socialis " +
    "sisterhood, beatified in 2012.",
  canonizationStatus: "beatified",
  citations: ["https://www.wikidata.org/wiki/Q78679", EN],
};

function saint(payload: Record<string, unknown>): PublishedItem {
  return {
    id: "1",
    checklistItemId: "c1",
    contentType: "SAINT",
    slug: "saint-hildegard-burjan",
    title: "Blessed Hildegard Burjan",
    subtitle: "",
    authorityLevel: "TRUSTED_PUBLISHER",
    version: 1,
    publishedAt: null,
    payload,
  };
}

describe("WikipediaAttribution", () => {
  it("renders the credit line with the article and licence links", () => {
    render(<WikipediaAttribution contentType="SAINT" payload={BURJAN} />);
    const line = screen.getByText(/Text from/);
    expect(line).toHaveClass("vf-fineprint");
    expect(line.textContent?.replaceAll(" (opens in a new tab)", "")).toBe(
      "Text from Wikipedia (Hildegard Burjan), CC BY-SA 4.0",
    );
    // A voice goes from one link to the next, with no stop on the comma between them.
    expect(line.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^,$/);
    expect(
      screen.getByRole("link", { name: "Wikipedia (Hildegard Burjan) (opens in a new tab)" }),
    ).toHaveAttribute("href", EN);
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0 (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
  });

  it("renders nothing when no shown text came from Wikipedia", () => {
    const { container } = render(
      <WikipediaAttribution contentType="PRAYER" payload={{ text: "Our Father…" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PublishedDetail on a structured saint", () => {
  it("credits Wikipedia once, at the foot of the page", () => {
    render(
      <PublishedDetail
        t={t}
        item={saint(BURJAN)}
        primaryFields={["biography"]}
        secondaryFields={["feastDay"]}
      />,
    );
    expect(screen.getAllByText(/Text from/)).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /^Wikipedia \(Hildegard Burjan\)/ }),
    ).toBeInTheDocument();
  });

  it("never prints the feast month / day-of-month split or the Wikidata id", () => {
    render(<PublishedDetail t={t} item={saint(BURJAN)} primaryFields={["biography"]} />);
    expect(screen.queryByText(/feast month/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/day of month/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wikidata qid/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Q78679")).not.toBeInTheDocument();
  });
});

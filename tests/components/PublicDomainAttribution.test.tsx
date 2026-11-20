/**
 * @vitest-environment jsdom
 *
 * The line a public-domain work gets — "Text from the Catholic Encyclopedia
 * (1913), “St. Ita”, public domain", the work linked to the page the text came
 * from. No licence asks for it, so a saint's page (like every page but a Church
 * document's or a parish's) shows none, and no Wikipedia credit either.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublicDomainAttribution } from "@/components/ui/PublicDomainAttribution";
import { PublishedDetail } from "@/components/ui/PublishedDetail";
import { createTranslator } from "@/lib/i18n/translator";
import type { PublishedItem } from "@/lib/data/published";

const t = createTranslator("en");

afterEach(() => cleanup());

const CE = "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita";
const RM = "https://archive.org/details/romanmartyrology00cathuoft";
const ITA = {
  slug: "saint-ite-of-killeedy",
  canonicalName: "Íte of Killeedy",
  feastDay: "01-15",
  biography:
    'Saint Ita, called the "Brigid of Munster"; b. in the present County of Waterford, about 475; ' +
    "d. 15 January, 570. She became a nun, settling down at Cluain Credhail.",
  canonizationStatus: "canonized",
  citations: [
    "https://www.wikidata.org/wiki/Q1288349",
    "https://en.wikipedia.org/wiki/%C3%8Dte_of_Killeedy",
    CE,
  ],
  provenance: {
    biography: "catholic-encyclopedia-1913",
    biographyUrl: CE,
    biographyTitle: "St. Ita",
    feast: "wikipedia",
  },
};

describe("PublicDomainAttribution", () => {
  it("credits the Encyclopedia article, linked", () => {
    render(<PublicDomainAttribution payload={ITA} />);
    const line = screen.getByText(/Text from/);
    expect(line).toHaveClass("vf-fineprint");
    expect(line.textContent?.replace(" (opens in a new tab)", "")).toBe(
      "Text from the Catholic Encyclopedia (1913), “St. Ita”, public domain",
    );
    expect(
      screen.getByRole("link", { name: "the Catholic Encyclopedia (1913) (opens in a new tab)" }),
    ).toHaveAttribute("href", CE);
  });

  it("credits the Martyrology", () => {
    render(
      <PublicDomainAttribution
        payload={{
          biography: "At Riez, in France, St. Maximus, bishop and confessor …",
          provenance: { biography: "roman-martyrology-1916", biographyUrl: RM },
        }}
      />,
    );
    expect(screen.getByText(/Text from/).textContent?.replace(" (opens in a new tab)", "")).toBe(
      "Text from the Roman Martyrology (1916), public domain",
    );
    expect(
      screen.getByRole("link", { name: "the Roman Martyrology (1916) (opens in a new tab)" }),
    ).toHaveAttribute("href", RM);
  });

  it("renders nothing for Wikipedia text", () => {
    const { container } = render(
      <PublicDomainAttribution
        payload={{
          biography: "Hildegard Burjan was an Austrian politician.",
          provenance: { biography: "wikipedia", article: "https://en.wikipedia.org/wiki/X" },
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PublishedDetail on a saint with an Encyclopedia biography", () => {
  const item: PublishedItem = {
    id: "1",
    checklistItemId: "c1",
    contentType: "SAINT",
    slug: ITA.slug,
    title: "Saint Íte of Killeedy",
    subtitle: "",
    authorityLevel: "TRUSTED_PUBLISHER",
    version: 1,
    publishedAt: null,
    payload: ITA,
  };

  it("shows no credit line: no licence asks for one, and it is not Wikipedia's text", () => {
    // The owner's rule: no sources on a saint's page. The Wikipedia line alone stays
    // where a page still shows Wikipedia's words, because its licence requires it.
    render(<PublishedDetail t={t} item={item} primaryFields={["biography"]} />);
    expect(screen.getByText(/Brigid of Munster/)).toBeInTheDocument();
    expect(screen.queryByText(/Text from/)).not.toBeInTheDocument();
    expect(screen.queryByText(/public domain/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CC BY-SA/)).not.toBeInTheDocument();
  });

  it("keeps the line on a Church document, whose sources stay as they are", () => {
    const document: PublishedItem = {
      ...item,
      contentType: "CHURCH_DOCUMENT",
      slug: "a-document",
      title: "A Document",
      payload: { ...ITA, summary: ITA.biography },
    };
    render(<PublishedDetail t={t} item={document} primaryFields={["biography"]} />);
    expect(screen.getAllByText(/Text from/)).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /^the Catholic Encyclopedia \(1913\)/ }),
    ).toBeInTheDocument();
  });
});

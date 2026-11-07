/**
 * @vitest-environment jsdom
 */
/**
 * PublishedDetail's presentation layer (PUB-7 / PUB-8).
 *
 * Before this, the eyebrow printed the raw enum ("MARIAN_TITLE"), section
 * headings were `key.replace(/([A-Z])/g, " $1")` ("Duration Minutes"), a
 * saint's feast day read "04-19", nested objects became "[object Object]", and
 * `relatedPrayers` printed a column of slugs.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedDetail } from "@/components/ui/PublishedDetail";
import type { PublishedItem } from "@/lib/data/published";

afterEach(() => cleanup());

function makeItem(
  payload: Record<string, unknown>,
  contentType: PublishedItem["contentType"] = "RITE",
): PublishedItem {
  return {
    id: "1",
    contentType,
    slug: "an-item",
    title: "An Item",
    authorityLevel: "MAGISTERIAL",
    version: 1,
    payload,
  } as PublishedItem;
}

describe("PublishedDetail — eyebrow (PUB-7)", () => {
  it("prints the human content-type label, never the enum", () => {
    const { container } = render(<PublishedDetail item={makeItem({}, "MARIAN_TITLE")} />);
    expect(screen.getByText("Our Lady")).toBeInTheDocument();
    expect(container.textContent).not.toContain("MARIAN_TITLE");
  });

  it("reads 'Church Document' and 'Spiritual Life' for the other ugly enums", () => {
    const { container: a } = render(<PublishedDetail item={makeItem({}, "CHURCH_DOCUMENT")} />);
    expect(a.textContent).toContain("Church Document");
    cleanup();
    const { container: b } = render(<PublishedDetail item={makeItem({}, "SPIRITUAL_PRACTICE")} />);
    expect(b.textContent).toContain("Spiritual Life");
    expect(b.textContent).not.toContain("SPIRITUAL_PRACTICE");
  });

  it("says 'Litany' for a PRAYER whose prayerType is a litany", () => {
    render(<PublishedDetail item={makeItem({ prayerType: "litany" }, "PRAYER")} />);
    expect(screen.getByText("Litany")).toBeInTheDocument();
  });

  it("lets a page override the eyebrow with something more specific", () => {
    render(<PublishedDetail item={makeItem({}, "SAINT")} eyebrow="Martyr" />);
    expect(screen.getByText("Martyr")).toBeInTheDocument();
    expect(screen.queryByText("Saint")).not.toBeInTheDocument();
  });
});

describe("PublishedDetail — field presentation (PUB-8)", () => {
  it("humanises the heading instead of splitting the camelCase key", () => {
    render(
      <PublishedDetail
        item={makeItem({ durationMinutes: 20 })}
        secondaryFields={["durationMinutes"]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Duration" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Duration Minutes/ })).not.toBeInTheDocument();
  });

  it("renders a duration as a sentence, not a bare number", () => {
    render(
      <PublishedDetail
        item={makeItem({ durationMinutes: 20 })}
        secondaryFields={["durationMinutes"]}
      />,
    );
    expect(screen.getByText("About 20 minutes")).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("renders a stored MM-DD feast day as a date a reader can read", () => {
    render(
      <PublishedDetail item={makeItem({ feastDay: "04-19" })} secondaryFields={["feastDay"]} />,
    );
    expect(screen.getByRole("heading", { name: "Feast day" })).toBeInTheDocument();
    expect(screen.getByText("April 19")).toBeInTheDocument();
    expect(screen.queryByText("04-19")).not.toBeInTheDocument();
  });

  it("leaves a non-date feast description exactly as written", () => {
    render(
      <PublishedDetail
        item={makeItem({ feastDay: "The Friday after Corpus Christi" })}
        secondaryFields={["feastDay"]}
      />,
    );
    expect(screen.getByText("The Friday after Corpus Christi")).toBeInTheDocument();
  });

  it("renders a nested object as labelled pairs, never [object Object]", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({ openingHours: { weekdayHours: "9-5", sundayHours: "Closed" } })}
        secondaryFields={["openingHours"]}
      />,
    );
    expect(container.textContent).not.toContain("[object Object]");
    expect(screen.getByText("Weekday hours")).toBeInTheDocument();
    expect(screen.getByText("9-5")).toBeInTheDocument();
  });

  it("hides a value it cannot present rather than printing a stray heading", () => {
    render(
      <PublishedDetail
        item={makeItem({ background: "Real content.", indulgenced: true })}
        primaryFields={["background"]}
        secondaryFields={["indulgenced"]}
      />,
    );
    expect(screen.getByText("Real content.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Indulgenced/ })).not.toBeInTheDocument();
  });

  it("shows short string arrays as a plain list that nothing makes look clickable", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({ patronages: ["Travellers", "Lost items"] })}
        secondaryFields={["patronages"]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Patronage" })).toBeInTheDocument();
    const list = container.querySelector("ul.vf-plain-list");
    expect(list?.textContent).toBe("TravellersLost items");
    // VoiceOver drops a list with no markers unless the role is said out loud.
    expect(list).toHaveAttribute("role", "list");
    expect(list?.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("sets a field's blank lines as paragraphs, and keeps its single line breaks", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({ body: "First paragraph.\n\nSecond paragraph,\nwith a break." })}
        primaryFields={["body"]}
      />,
    );
    const paragraphs = Array.from(container.querySelectorAll(".vf-reading p"));
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      "First paragraph.",
      "Second paragraph,\nwith a break.",
    ]);
    expect(paragraphs[1]).toHaveClass("whitespace-pre-line");
  });
});

describe("PublishedDetail — reference slugs are never content (G-05)", () => {
  it("refuses to print relatedPrayers even when a page asks for them", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({
          background: "A devotion of the Church.",
          relatedPrayers: ["apostles-creed", "our-father"],
          relatedSaints: ["st-dominic"],
        })}
        primaryFields={["background"]}
        secondaryFields={["relatedPrayers", "relatedSaints"]}
      />,
    );
    expect(screen.getByText("A devotion of the Church.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("apostles-creed");
    expect(container.textContent).not.toContain("our-father");
    expect(container.textContent).not.toContain("st-dominic");
    expect(screen.queryByRole("heading", { name: /Related/ })).not.toBeInTheDocument();
  });
});

describe("PublishedDetail — slug and URL fields are references, not prose", () => {
  it("hides *Slug / *Slugs / *Url fields even when a page lists them", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({
          body: "The document text.",
          associatedSaintSlugs: ["st-gregory"],
          associatedApparitionSlug: "our-lady-of-lourdes",
          canonicalUrl: "https://www.vatican.va/some-document",
        })}
        primaryFields={["body"]}
        secondaryFields={["associatedSaintSlugs", "associatedApparitionSlug", "canonicalUrl"]}
      />,
    );
    expect(screen.getByText("The document text.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("st-gregory");
    expect(container.textContent).not.toContain("our-lady-of-lourdes");
    expect(container.textContent).not.toContain("vatican.va");
  });

  it("still renders a Key/Title/Name/Type field a page asks for explicitly", () => {
    // Only the slug/url suffixes are unconditional; a Doctor's doctorTitle is
    // real content the page is entitled to show.
    render(
      <PublishedDetail
        item={makeItem({ doctorTitle: "Angelic Doctor" })}
        secondaryFields={["doctorTitle"]}
      />,
    );
    expect(screen.getByText("Angelic Doctor")).toBeInTheDocument();
  });

  it("humanises an UPPER_SNAKE status enum", () => {
    render(
      <PublishedDetail
        item={makeItem({ approvedStatus: "VATICAN_APPROVED" })}
        secondaryFields={["approvedStatus"]}
      />,
    );
    expect(screen.getByText("Vatican approved")).toBeInTheDocument();
    expect(screen.queryByText("VATICAN_APPROVED")).not.toBeInTheDocument();
  });
});

describe("PublishedDetail — the title and what matters (owner's formatting pass)", () => {
  const withSubtitle = (payload: Record<string, unknown>) =>
    ({ ...makeItem(payload, "SAINT"), subtitle: "Religious · Feast April 11" }) as PublishedItem;

  it("puts the page's fact lines directly under the title, in order, as sentences", () => {
    const { container } = render(
      <PublishedDetail
        item={withSubtitle({ biography: "She was abbess of Noyon." })}
        showSubtitle={false}
        facts={["Patron of Noyon", null, "Feast day: April 11", "640 – 670"]}
        primaryFields={["biography"]}
        headings={{ biography: null }}
      />,
    );
    const lines = Array.from(container.querySelectorAll("header p")).map((p) => p.textContent);
    expect(lines).toEqual(["Saint", "Patron of Noyon", "Feast day: April 11", "640 – 670"]);
    // The subtitle that repeated them is gone, and the biography has no label.
    expect(screen.queryByText("Religious · Feast April 11")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText("She was abbess of Noyon.")).toBeInTheDocument();
  });

  it("sets labelled facts apart from the prose, then the actions, then the summary", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({ summary: "A one-line lede.", background: "The history." })}
        factItems={[{ label: "Feast day", value: "April 11" }, null]}
        primaryFields={["background"]}
      />,
    );
    const header = container.querySelector("header")!;
    expect(Array.from(header.children).map((el) => el.className.split(" ")[0])).toEqual([
      "vf-eyebrow",
      "vf-detail-title",
      "vf-facts",
      "vf-detail-actions",
      "vf-lede",
    ]);
    expect(header.querySelector("dt")).toHaveTextContent("Feast day");
    expect(header.querySelector("dd")).toHaveTextContent("April 11");
  });

  it("never lets a title break through the name Our Lady", () => {
    render(
      <PublishedDetail item={{ ...makeItem({}), title: "Apparition of Our Lady of Fatima" }} />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Apparition of Our\u00a0Lady of Fatima",
    );
  });

  it("keeps the subtitle by default — for most types it is the compact fact line", () => {
    render(<PublishedDetail item={withSubtitle({})} />);
    expect(screen.getByText("Religious · Feast April 11")).toBeInTheDocument();
  });

  it("does not repeat a summary that a shown field already says", () => {
    // A sacrament's summary is the first sentence of its overview.
    const overview = "Baptism is the basis of the whole Christian life. It is the gateway.";
    render(
      <PublishedDetail
        item={makeItem({ summary: "Baptism is the basis of the whole Christian life.", overview })}
        primaryFields={["overview"]}
      />,
    );
    expect(screen.getAllByText(/basis of the whole Christian life/)).toHaveLength(1);
  });

  it("shows the summary as the lede otherwise, and not at all when the page turns it off", () => {
    const item = makeItem({ summary: "A one-line lede.", background: "The history." });
    const { unmount } = render(<PublishedDetail item={item} primaryFields={["background"]} />);
    expect(screen.getByText("A one-line lede.")).toBeInTheDocument();
    unmount();
    render(<PublishedDetail item={item} primaryFields={["background"]} lede={false} />);
    expect(screen.queryByText("A one-line lede.")).not.toBeInTheDocument();
  });

  it("lets a page rename a heading", () => {
    render(
      <PublishedDetail
        item={makeItem({ faithfulEstimate: "Roughly four hundred thousand." })}
        primaryFields={["faithfulEstimate"]}
        headings={{ faithfulEstimate: "Faithful" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Faithful" })).toBeInTheDocument();
  });

  it("never prints sources, even when a page lists them", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({
          catechismReferences: ["CCC 1499-1532"],
          sources: ["https://www.vatican.va/"],
          relatedDocuments: ["quas-primas"],
        })}
        primaryFields={["catechismReferences", "sources", "relatedDocuments"]}
      />,
    );
    expect(container.textContent).not.toMatch(/CCC 1499|vatican\.va|quas-primas/);
  });
});

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

  it("shows short string arrays as chips", () => {
    const { container } = render(
      <PublishedDetail
        item={makeItem({ patronages: ["Travellers", "Lost items"] })}
        secondaryFields={["patronages"]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Patronage" })).toBeInTheDocument();
    expect(screen.getByText("Travellers")).toBeInTheDocument();
    // Chips, not a bulleted column.
    expect(container.querySelector("ul.list-disc")).toBeNull();
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

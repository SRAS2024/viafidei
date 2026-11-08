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
import { createTranslator } from "@/lib/i18n/translator";
import type { PublishedItem } from "@/lib/data/published";
import { attachDisplay } from "@/lib/translation/display";

const t = createTranslator("en");

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
    const { container } = render(<PublishedDetail t={t} item={makeItem({}, "MARIAN_TITLE")} />);
    expect(screen.getByText("Our Lady")).toBeInTheDocument();
    expect(container.textContent).not.toContain("MARIAN_TITLE");
  });

  it("reads 'Church Document' and 'Spiritual Life' for the other ugly enums", () => {
    const { container: a } = render(
      <PublishedDetail t={t} item={makeItem({}, "CHURCH_DOCUMENT")} />,
    );
    expect(a.textContent).toContain("Church Document");
    cleanup();
    const { container: b } = render(
      <PublishedDetail t={t} item={makeItem({}, "SPIRITUAL_PRACTICE")} />,
    );
    expect(b.textContent).toContain("Spiritual Life");
    expect(b.textContent).not.toContain("SPIRITUAL_PRACTICE");
  });

  it("says 'Litany' for a PRAYER whose prayerType is a litany", () => {
    render(<PublishedDetail t={t} item={makeItem({ prayerType: "litany" }, "PRAYER")} />);
    expect(screen.getByText("Litany")).toBeInTheDocument();
  });

  it("says the kind of content in the reader's language", () => {
    const es = createTranslator("es");
    const { container } = render(<PublishedDetail t={es} item={makeItem({}, "CHURCH_DOCUMENT")} />);
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(
      new RegExp(`^${es("search.type.churchDocument")}$`),
    );
    expect(screen.queryByText("Church Document")).not.toBeInTheDocument();
  });

  it("says a litany's word in the reader's language too", () => {
    const de = createTranslator("de");
    render(<PublishedDetail t={de} item={makeItem({ prayerType: "litany" }, "PRAYER")} />);
    expect(screen.getByText(de("search.type.litany"))).toBeInTheDocument();
  });

  it("translates a page's own word when it is one of those kinds", () => {
    // Italian says "Dottore della Chiesa" of a woman Doctor too (see the next block).
    const it_ = createTranslator("it");
    render(<PublishedDetail t={it_} item={makeItem({}, "SAINT")} eyebrow="Doctor of the Church" />);
    expect(screen.getByText("Dottore della Chiesa")).toBeInTheDocument();
    expect(screen.queryByText("Doctor of the Church")).not.toBeInTheDocument();
  });

  it("leaves any other word of a page's as the page gave it", () => {
    render(<PublishedDetail t={createTranslator("es")} item={makeItem({})} eyebrow="Martyr" />);
    expect(screen.getByText("Martyr")).toBeInTheDocument();
  });

  it("shows no word where a page asks for none", () => {
    const { container } = render(
      <PublishedDetail t={createTranslator("es")} item={makeItem({})} eyebrow={null} />,
    );
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
  });

  it("lets a page override the eyebrow with something more specific", () => {
    render(<PublishedDetail t={t} item={makeItem({}, "SAINT")} eyebrow="Martyr" />);
    expect(screen.getByText("Martyr")).toBeInTheDocument();
    expect(screen.queryByText("Saint")).not.toBeInTheDocument();
  });

  it.each([
    ["Title of the Blessed Virgin Mary", "es", "Advocación de la Virgen María"],
    ["Sacrament of Christian Initiation", "es", "Sacramento de la iniciación cristiana"],
    ["Sacrament at the Service of Communion", "ko", "친교에 봉사하는 성사"],
    ["Liturgical symbolism", "es", "Simbolismo litúrgico"],
    ["Rosary", "ko", "묵주기도"],
    ["Priest · Doctor of the Church", "es", "Sacerdote · Doctor de la Iglesia"],
    ["Pope from 1978 to 2005", "de", "Papst von 1978 bis 2005"],
    ["Mother of John the Baptist", "pl", "Matka Jana Chrzciciela"],
  ] as const)("says a page's own word, %s, in the reader's language (%s)", (word, locale, said) => {
    const { container } = render(
      <PublishedDetail t={createTranslator(locale)} item={makeItem({})} eyebrow={word} />,
    );
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(new RegExp(`^${said}$`));
  });
});

describe("PublishedDetail — a saint's stage over a bare name", () => {
  // "Santo" over "Catherine of Vadstena" read her as a man. The record does not say
  // whether a saint is a man or a woman, or one person or forty martyrs.
  const BOTH = ["Saint", "Blessed", "Servant of God"];
  it.each([
    ["es", BOTH],
    ["it", BOTH],
    ["pt", BOTH],
    ["fr", BOTH],
    ["pl", [...BOTH, "Venerable"]],
    ["la", BOTH],
    ["de", [...BOTH, "Venerable"]],
    // "Lingkod ng Diyos" is anyone's; "San" and "Santa" are not.
    ["tl", ["Saint", "Blessed"]],
  ] as const)("is left out in %s, which cannot say it without knowing", (locale, stages) => {
    for (const stage of stages) {
      const { container } = render(
        <PublishedDetail
          t={createTranslator(locale)}
          item={makeItem({}, "SAINT")}
          eyebrow={stage}
        />,
      );
      expect(container.querySelector(".vf-eyebrow")).toBeNull();
      expect(container.textContent).not.toMatch(/\b(Saint|Blessed|Santo|Beato|Sanctus|Święty)\b/);
      cleanup();
    }
  });

  it.each([
    ["en", "Saint", "Saint"],
    ["ko", "Saint", "성인"],
    ["vi", "Blessed", "Chân phước"],
    ["zh", "Servant of God", "天主之仆"],
    ["es", "Venerable", "Venerable"],
    ["la", "Venerable", "Venerabilis"],
  ] as const)("is said in %s where one word serves everyone (%s)", (locale, stage, said) => {
    const { container } = render(
      <PublishedDetail t={createTranslator(locale)} item={makeItem({}, "SAINT")} eyebrow={stage} />,
    );
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(new RegExp(`^${said}$`));
  });

  // Junia and Phoebe are among the records filed as apostles.
  it.each([
    ["es", "Apóstol de Jesús"],
    ["fr", "Apôtre et disciple de Jésus"],
    ["it", null],
    ["de", null],
    ["ko", "예수님의 사도이자 제자"],
  ] as const)("says 'Apostle' in %s only in words true of a woman too", (locale, said) => {
    const { container } = render(
      <PublishedDetail
        t={createTranslator(locale)}
        item={makeItem({}, "SAINT")}
        eyebrow="Apostle and Disciple of Jesus"
      />,
    );
    const label = container.querySelector(".vf-eyebrow");
    if (said === null) expect(label).toBeNull();
    else expect(label).toHaveTextContent(new RegExp(`^${said}$`));
  });

  it("keeps a Doctor's office where the role before it has no word", () => {
    const { container } = render(
      <PublishedDetail
        t={createTranslator("it")}
        item={makeItem({}, "DOCTOR")}
        eyebrow="Religious · Doctor of the Church"
      />,
    );
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(/^Dottore della Chiesa$/);
  });

  // Teresa of Ávila, Catherine of Siena, Thérèse of Lisieux and Hildegard of Bingen are
  // Doctors, and Spanish, Portuguese and German have a word for a woman Doctor of its own.
  it.each([
    ["es", "Doctora de la Iglesia", "Doctor de la Iglesia"],
    ["pt", "Doutora da Igreja", "Doutor da Igreja"],
    ["de", "Kirchenlehrerin", "Kirchenlehrer"],
  ] as const)(
    "calls a woman Doctor and a man Doctor each by their word in %s",
    (locale, woman, man) => {
      const eyebrowOver = (slug: string) => {
        const { container, unmount } = render(
          <PublishedDetail
            t={createTranslator(locale)}
            item={{ ...makeItem({}, "DOCTOR"), slug }}
            eyebrow="Religious · Doctor of the Church"
          />,
        );
        const text = container.querySelector(".vf-eyebrow")?.textContent;
        unmount();
        return text;
      };
      expect(eyebrowOver("doctor-teresa-of-avila")).toBe(woman);
      expect(eyebrowOver("doctor-augustine-of-hippo")).toBe(man);
    },
  );

  it("still calls a bishop a Doctor in Spanish", () => {
    const { container } = render(
      <PublishedDetail
        t={createTranslator("es")}
        item={makeItem({}, "DOCTOR")}
        eyebrow="Bishop · Doctor of the Church"
      />,
    );
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(
      /^Obispo · Doctor de la Iglesia$/,
    );
  });
});

describe("PublishedDetail — field presentation (PUB-8)", () => {
  it("humanises the heading instead of splitting the camelCase key", () => {
    render(
      <PublishedDetail
        t={t}
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
        t={t}
        item={makeItem({ durationMinutes: 20 })}
        secondaryFields={["durationMinutes"]}
      />,
    );
    expect(screen.getByText("About 20 minutes")).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("renders a stored MM-DD feast day as a date a reader can read", () => {
    render(
      <PublishedDetail
        t={t}
        item={makeItem({ feastDay: "04-19" })}
        secondaryFields={["feastDay"]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Feast day" })).toBeInTheDocument();
    expect(screen.getByText("April 19")).toBeInTheDocument();
    expect(screen.queryByText("04-19")).not.toBeInTheDocument();
  });

  it("leaves a non-date feast description exactly as written", () => {
    render(
      <PublishedDetail
        t={t}
        item={makeItem({ feastDay: "The Friday after Corpus Christi" })}
        secondaryFields={["feastDay"]}
      />,
    );
    expect(screen.getByText("The Friday after Corpus Christi")).toBeInTheDocument();
  });

  it("renders a nested object as labelled pairs, never [object Object]", () => {
    const { container } = render(
      <PublishedDetail
        t={t}
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
        t={t}
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
        t={t}
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
        t={t}
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
        t={t}
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
        t={t}
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
        t={t}
        item={makeItem({ doctorTitle: "Angelic Doctor" })}
        secondaryFields={["doctorTitle"]}
      />,
    );
    expect(screen.getByText("Angelic Doctor")).toBeInTheDocument();
  });

  it("humanises an UPPER_SNAKE status enum", () => {
    render(
      <PublishedDetail
        t={t}
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
        t={t}
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
        t={t}
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
      <PublishedDetail
        t={t}
        item={{ ...makeItem({}), title: "Apparition of Our Lady of Fatima" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Apparition of Our\u00a0Lady of Fatima",
    );
  });

  it("keeps the subtitle by default — for most types it is the compact fact line", () => {
    render(<PublishedDetail t={t} item={withSubtitle({})} />);
    expect(screen.getByText("Religious · Feast April 11")).toBeInTheDocument();
  });

  it("does not repeat a summary that a shown field already says", () => {
    // A sacrament's summary is the first sentence of its overview.
    const overview = "Baptism is the basis of the whole Christian life. It is the gateway.";
    render(
      <PublishedDetail
        t={t}
        item={makeItem({ summary: "Baptism is the basis of the whole Christian life.", overview })}
        primaryFields={["overview"]}
      />,
    );
    expect(screen.getAllByText(/basis of the whole Christian life/)).toHaveLength(1);
  });

  it("shows the summary as the lede otherwise, and not at all when the page turns it off", () => {
    const item = makeItem({ summary: "A one-line lede.", background: "The history." });
    const { unmount } = render(
      <PublishedDetail t={t} item={item} primaryFields={["background"]} />,
    );
    expect(screen.getByText("A one-line lede.")).toBeInTheDocument();
    unmount();
    render(<PublishedDetail t={t} item={item} primaryFields={["background"]} lede={false} />);
    expect(screen.queryByText("A one-line lede.")).not.toBeInTheDocument();
  });

  it("keeps a short summary as the lede, up to about five lines of it", () => {
    const summary = "A".repeat(150) + " " + "B".repeat(149);
    expect(summary).toHaveLength(300);
    const { container } = render(<PublishedDetail t={t} item={makeItem({ summary })} />);
    expect(container.querySelector("header .vf-lede")).toHaveTextContent(summary);
  });

  it("sets a longer summary as reading text after the header, with no word changed", () => {
    const sentence = "The council set out the place of the laity in the mission of the Church.";
    const summary = Array.from({ length: 12 }, () => sentence).join(" ");
    expect(summary.length).toBeGreaterThan(600);
    const { container } = render(
      <PublishedDetail
        t={t}
        item={makeItem({ summary, background: "The history." })}
        primaryFields={["background"]}
      />,
    );
    expect(container.querySelector(".vf-lede")).toBeNull();
    expect(container.querySelector("header")!.textContent).not.toContain(sentence);
    const sections = container.querySelectorAll("article > .vf-detail-section");
    // Before the fields, so it still opens the page.
    expect(sections).toHaveLength(2);
    const paragraphs = Array.from(sections[0]!.querySelectorAll(".vf-reading p"));
    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs.map((p) => p.textContent).join(" ")).toBe(summary);
  });

  it("does not set a long summary twice when a shown field already says it", () => {
    const summary = "The council set out the place of the laity. ".repeat(10).trim();
    const { container } = render(
      <PublishedDetail
        t={t}
        item={makeItem({ summary, overview: `${summary} And more.` })}
        primaryFields={["overview"]}
      />,
    );
    expect(container.querySelectorAll("article > .vf-detail-section")).toHaveLength(1);
  });

  it("prints a paragraph two fields both hold once, under the first heading", () => {
    const paragraph = "A title first invoked by the founders of the Society of the Atonement.";
    const { container } = render(
      <PublishedDetail
        t={t}
        item={makeItem(
          {
            origin: paragraph,
            // The same words, in other capitals and punctuation, are still the same words.
            theologicalSignificance: `${paragraph.toUpperCase()} `,
            iconographyNotes: "Shown with a cross.",
          },
          "MARIAN_TITLE",
        )}
        primaryFields={["origin", "theologicalSignificance", "iconographyNotes"]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Origin",
      "Iconography notes",
    ]);
    expect(container.querySelectorAll("article > .vf-detail-section")).toHaveLength(2);
    expect(screen.getAllByText(paragraph)).toHaveLength(1);
  });

  it("keeps two fields that say different things, even when one begins like the other", () => {
    render(
      <PublishedDetail
        t={t}
        item={makeItem(
          {
            origin: "In 1858 the Virgin appeared at Lourdes.",
            theologicalSignificance: "In 1858 the Virgin appeared at Lourdes, and calls to prayer.",
          },
          "MARIAN_TITLE",
        )}
        primaryFields={["origin", "theologicalSignificance"]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Origin",
      "Why it matters",
    ]);
  });

  it("keeps a short answer two fields both give: that is two facts, not a repeat", () => {
    render(
      <PublishedDetail
        t={t}
        item={makeItem({ minister: "A bishop", recipient: "A bishop" })}
        primaryFields={["minister", "recipient"]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Minister",
      "Recipient",
    ]);
    expect(screen.getAllByText("A bishop")).toHaveLength(2);
  });

  it("decides on the stored text, so a translation cannot bring the second one back", () => {
    const paragraph = "A title first invoked by the founders of the Society of the Atonement.";
    const item = attachDisplay(
      { ...makeItem({ origin: paragraph, theologicalSignificance: paragraph }, "MARIAN_TITLE") },
      {
        locale: "es",
        title: "Nuestra Señora",
        subtitle: null,
        payload: { origin: "Un título.", theologicalSignificance: "Un título que se invoca." },
        machineTranslated: true,
        pendingUnits: 0,
      },
    );
    render(
      <PublishedDetail t={t} item={item} primaryFields={["origin", "theologicalSignificance"]} />,
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getByText("Un título.")).toBeInTheDocument();
  });

  it("lets a page rename a heading", () => {
    render(
      <PublishedDetail
        t={t}
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
        t={t}
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

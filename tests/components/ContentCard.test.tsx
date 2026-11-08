/**
 * @vitest-environment jsdom
 */
/**
 * The card every collection shares. A label under the title is there to add
 * something, a pope's numeral stays with his name, and a description fills the
 * height its card has rather than stopping short above blank space.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ContentCard,
  keepNumeralWithName,
  lineRepeatsTitle,
  summaryLinesFor,
} from "@/components/ui/ContentCard";
import { keepPhrasesWhole } from "@/components/ui/keep-whole";
import { PageHero } from "@/components/ui/PageHero";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
/** The declarations of the first rule with exactly this selector. */
function ruleOf(selector: string): string {
  const start = css.indexOf(`\n  ${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("lineRepeatsTitle", () => {
  it("catches a line that only says what the title says", () => {
    expect(lineRepeatsTitle("Almsgiving", "Almsgiving")).toBe(true);
    expect(lineRepeatsTitle("Lectio Divina", "Lectio divina")).toBe(true);
    expect(lineRepeatsTitle("Friday Penance", "Penance")).toBe(true);
    expect(lineRepeatsTitle("Saint Peter the Apostle", "Apostle")).toBe(true);
    expect(lineRepeatsTitle("Marian Devotion", "Marian devotion")).toBe(true);
  });

  it("keeps a line with anything to add", () => {
    expect(lineRepeatsTitle("A Rule of Life", "Fasting")).toBe(false);
    expect(lineRepeatsTitle("Friday Penance", "Penance and fasting")).toBe(false);
    expect(lineRepeatsTitle("Pope Mark", "336")).toBe(false);
    expect(lineRepeatsTitle("Saint Joseph", "Feast day: March 19")).toBe(false);
  });

  it("reads accents and case alike, and never counts an empty line", () => {
    expect(lineRepeatsTitle("Thérèse of Lisieux", "therese")).toBe(true);
    expect(lineRepeatsTitle("Anything", "—")).toBe(false);
  });

  // "Vocation" stayed under "Vocational Discernment" and "How to Pray for Vocations".
  it("takes another form of a title's word, by a short ending, for the same word", () => {
    expect(lineRepeatsTitle("Vocational Discernment", "Vocation")).toBe(true);
    expect(lineRepeatsTitle("How to Pray for Vocations", "Vocation")).toBe(true);
    expect(lineRepeatsTitle("Vocation", "Vocations")).toBe(true);
    expect(lineRepeatsTitle("The Penances of Lent", "Penance")).toBe(true);
  });

  it("does not take a short word, or a longer one that only begins the same, for it", () => {
    expect(lineRepeatsTitle("Saint Mark", "Market")).toBe(false);
    expect(lineRepeatsTitle("Mary, Mother of God", "Maryland")).toBe(false);
    expect(lineRepeatsTitle("Marian Devotion", "Marianne")).toBe(false);
    expect(lineRepeatsTitle("Vocational Discernment", "Vocation and family")).toBe(false);
  });
});

describe("keepPhrasesWhole", () => {
  // Balanced wrapping broke "33- / Day", "step- / by-step" and "Our / Lady", and opened
  // a line with a dash. No word changes: a span and a no-break space hold them.
  it("holds a short hyphenated compound in a span that does not wrap", () => {
    render(<p>{keepPhrasesWhole("How to Make the 33-Day Preparation, step-by-step")}</p>);
    const held = [...document.querySelectorAll("span.whitespace-nowrap")].map((s) => s.textContent);
    expect(held).toEqual(["33-Day", "step-by-step"]);
    // Never a non-breaking hyphen, which a screen reader may read out.
    expect(document.body.textContent).not.toContain("‑");
    expect(document.body.textContent).toBe("How to Make the 33-Day Preparation, step-by-step");
  });

  it("joins Our Lady and keeps a dash with the word before it", () => {
    expect(keepPhrasesWhole("Apparition of Our Lady of Lourdes")).toBe(
      "Apparition of Our Lady of Lourdes",
    );
    expect(
      keepPhrasesWhole(
        "The seven sacraments of the Catholic Church — channels of grace instituted by Christ.",
      ),
    ).toBe("The seven sacraments of the Catholic Church — channels of grace instituted by Christ.");
  });

  it("lets a compound too long for a phone's line break at its hyphens", () => {
    render(<p>{keepPhrasesWhole("Saint-Jean-Baptiste-de-la-Salle")}</p>);
    expect(document.querySelector("span.whitespace-nowrap")).toBeNull();
  });

  it("holds them on a card's title and a hero's lede, with the link's name unchanged", () => {
    render(
      <>
        <ContentCard href="/g" title="How to Make the 33-Day Preparation for Marian Consecration" />
        <PageHero title="Spiritual Life" subtitle="Guided devotions and step-by-step checklists." />
      </>,
    );
    expect(
      screen.getByRole("link", {
        name: "How to Make the 33-Day Preparation for Marian Consecration",
      }),
    ).toContainHTML('<span class="whitespace-nowrap">33-Day</span>');
    expect(document.querySelector(".vf-page-hero-lede span.whitespace-nowrap")).toHaveTextContent(
      "step-by-step",
    );
  });
});

describe("keepNumeralWithName", () => {
  it("joins a regnal numeral to the name before it", () => {
    expect(keepNumeralWithName("Pope Venerable Pius XII")).toBe("Pope Venerable Pius XII");
    expect(keepNumeralWithName("Saint Louis IX of France")).toBe("Saint Louis IX of France");
    expect(keepNumeralWithName("Pope John Paul I")).toBe("Pope John Paul I");
  });

  it("changes no word, and leaves ordinary titles alone", () => {
    expect(keepNumeralWithName("Our Lady of Lourdes")).toBe("Our Lady of Lourdes");
    expect(keepNumeralWithName("Lord, I believe")).toBe("Lord, I believe");
    expect(keepNumeralWithName("Pope Leo XIV").replace(/ /g, " ")).toBe("Pope Leo XIV");
  });
});

describe("the card", () => {
  it("drops a label that repeats the title and keeps the rest in order", () => {
    render(
      <ContentCard
        href="/x"
        title="Saint Peter the Apostle"
        meta={["Apostle", "Patron of the papacy", "Feast day: June 29"]}
      />,
    );
    const article = screen.getByRole("article");
    expect([...article.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "Patron of the papacy",
      "Feast day: June 29",
    ]);
  });

  it("drops a thematic line that repeats the title too", () => {
    render(<ContentCard href="/x" title="Novena to Saint Jude" theme="Saint Jude" />);
    expect(screen.getByRole("article").querySelector(".vf-entry-theme")).toBeNull();
  });

  it("keeps the whole name as the link's name", () => {
    render(<ContentCard href="/x" title="Pope Leo XIV" />);
    const link = screen.getByRole("link", { name: /^Pope Leo\sXIV$/ });
    expect(link).toHaveAttribute("href", "/x");
  });

  it("gives its description the lines its title leaves", () => {
    render(<ContentCard href="/x" title="Short" summary="Words." />);
    const summary = screen.getByText("Words.");
    expect(summary).toHaveClass("vf-clamp");
    const box = summary.closest(".vf-entry-fit") as HTMLElement;
    expect(box.style.getPropertyValue("--clamp")).toBe(String(summaryLinesFor("Short")));
  });
});

describe("the card's type", () => {
  it("balances a title's lines, so one word is never left alone on the last", () => {
    expect(ruleOf(".vf-entry-title")).toContain("text-wrap: balance");
  });

  it("caps a title's size on a phone, so an ordinary word stays whole in enlarged text", () => {
    expect(ruleOf(".vf-entry-title")).toContain("min(var(--fs-card-title), 9vw)");
    expect(ruleOf(".vf-entry-meta")).toContain("min(var(--fs-meta), 7vw)");
    expect(ruleOf(".vf-detail-title")).toContain("min(var(--fs-page-title), 11.5vw)");
    expect(ruleOf(".vf-page-hero-title")).toContain("min(var(--fs-page-title), 11.5vw)");
  });

  it("balances a centred lede", () => {
    expect(ruleOf(".vf-page-hero-lede")).toContain("text-wrap: balance");
  });
});

describe("one day's saints", () => {
  /** The rule for a selector inside the day's three-to-a-row container query. */
  const threeToARow = css.slice(css.indexOf("@container vf-centred (min-width: 59.5rem)"));

  it("go by the width of their own box, so enlarged text earns fewer to a row", () => {
    expect(css).toContain("container: vf-centred / inline-size;");
    // Three of the /saints list's cards and their gaps; then two of them.
    expect(css).toContain("@container vf-centred (min-width: 59.5rem)");
    expect(css).toContain("@container vf-centred (min-width: 39.25rem)");
  });

  it("leave no card alone under a full row: two left over stand between its cards", () => {
    expect(threeToARow).toMatch(
      /li:nth-last-child\(2\):nth-child\(3n \+ 1\) \{\s*grid-column: 2 \/ span 2;/,
    );
    expect(threeToARow).toMatch(
      /li:last-child:nth-child\(3n \+ 2\) \{\s*grid-column: 4 \/ span 2;/,
    );
  });

  it("make one left over a second pair: the last four are two rows of two", () => {
    expect(threeToARow).toMatch(
      /li:nth-last-child\(4\):nth-child\(3n \+ 1\),\s*\.vf-grid-centred \.vf-grid > li:nth-last-child\(2\):nth-child\(3n\) \{\s*grid-column: 2 \/ span 2;/,
    );
    expect(threeToARow).toMatch(
      /li:nth-last-child\(3\):nth-child\(3n \+ 2\),\s*\.vf-grid-centred \.vf-grid > li:last-child:nth-child\(3n \+ 1\) \{\s*grid-column: 4 \/ span 2;/,
    );
  });

  it("stand in the middle when there is only one", () => {
    expect(threeToARow).toMatch(/li:first-child:last-child \{\s*grid-column: 3 \/ span 2;/);
  });
});

describe("a description in a row of cards", () => {
  /** The whole lines of description a height of this many rem can show. */
  const LINE = 1.125 * 1.45;

  it("follows the height its card was given, line by line, up to eight", () => {
    for (let lines = 3; lines <= 8; lines += 1) {
      const step = new RegExp(
        String.raw`@container vf-fit \(min-height: ([\d.]+)rem\) \{\s*\.vf-entry-fit > \.vf-clamp \{\s*-webkit-line-clamp: ${lines};`,
      ).exec(css);
      expect(step, `${lines} lines`).not.toBeNull();
      const height = Number(step![1]);
      // About 0.4rem short of that many whole lines: the last may sit that far into
      // the 0.875rem above Open, never on it. A step any later dropped a whole line
      // and left it blank for want of a few pixels (Saint Catherine of Alexandria).
      expect(height).toBeLessThan(lines * LINE - 0.35);
      expect(lines * LINE - height).toBeLessThan(0.875 / 2);
    }
  });

  it("asks for a height container only where a browser has one", () => {
    expect(css).toMatch(/@supports \(container-type: size\) \{\s*\.vf-entry-fit \{/);
  });
});

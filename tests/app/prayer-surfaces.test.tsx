/**
 * @vitest-environment jsdom
 */
/**
 * Latin / Greek on every form of prayer.
 *
 * The owner found the language toggle "gone" on the Rosary, the Divine Mercy
 * Chaplet and the novenas. On /devotions/* it had never been there: a
 * devotion's prayers were a row of links to other pages, so the Rosary and the
 * Divine Mercy Chaplet showed no prayer text and no chip at all. Novenas listed
 * the same three prayers whatever their days actually prayed. These pages now
 * carry the prayers themselves — inline where they are named and as dropdowns
 * below — with the shared Latin / Greek chips. A list holds every prayer the
 * text names as well as the stored ones, in the order the text prays them, and
 * nothing the page's own text and payload do not give.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { findCuratedEntry } from "@/lib/checklist/knowledge";
import type { PublishedItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const published = new Map<string, PublishedItem>();

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en") }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
  },
}));

vi.mock("@/components/profile", () => ({
  SaveContentButton: () => null,
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
    getAnyPublishedBySlug: async (slug: string, types: string[]) =>
      types.map((t) => published.get(`${t}:${slug}`)).find(Boolean) ?? null,
    listPublished: async (contentType: string) =>
      [...published.values()].filter((item) => item.contentType === contentType),
    listPublishedBySlugs: async (contentType: string, slugs: string[]) =>
      slugs
        .map((slug) => published.get(`${contentType}:${slug}`))
        .filter((item): item is PublishedItem => item != null),
    buildPublishedMetadata: () => ({}),
  };
});

import DevotionDetailPage from "@/app/devotions/[slug]/page";
import NovenaDetailPage from "@/app/novenas/[slug]/page";
import OurLadyDetailPage from "@/app/our-lady/[slug]/page";
import SpiritualLifeDetailPage from "@/app/spiritual-life/[slug]/page";

function put(contentType: string, slug: string, title: string, payload: Record<string, unknown>) {
  published.set(`${contentType}:${slug}`, {
    id: slug,
    contentType,
    slug,
    title,
    subtitle: "",
    authorityLevel: "VATICAN",
    version: 1,
    payload,
  } as unknown as PublishedItem);
}

function seedPrayers() {
  put("PRAYER", "sign-of-the-cross", "Sign of the Cross", {
    body: "In the name of the Father...",
    latin: "In nomine Patris...",
  });
  put("PRAYER", "our-father", "Our Father", {
    body: "Our Father, who art in heaven...",
    latin: "Pater noster, qui es in caelis...",
    greek: "Πάτερ ἡμῶν...",
  });
  put("PRAYER", "hail-mary", "Hail Mary", {
    body: "Hail Mary, full of grace...",
    latin: "Ave Maria, gratia plena...",
  });
  put("PRAYER", "glory-be", "Glory Be", { body: "Glory be to the Father..." });
  put("PRAYER", "apostles-creed", "Apostles' Creed", {
    body: "I believe in God...",
    latin: "Credo in Deum...",
  });
  put("PRAYER", "salve-regina", "Hail Holy Queen (Salve Regina)", {
    body: "Hail, holy Queen, Mother of mercy...",
    latin: "Salve, Regina, mater misericordiae...",
  });
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const prayerList = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section")!;
/** The dropdown titles of a prayer list, in order (eyebrow included). */
const listedPrayers = (list: HTMLElement) =>
  within(list)
    .getAllByRole("button", { expanded: false })
    .map((b) => b.textContent ?? "");

beforeEach(() => {
  published.clear();
  window.sessionStorage.clear();
  seedPrayers();
});
afterEach(() => cleanup());

describe("/devotions/[slug] — the Rosary and the chaplets", () => {
  beforeEach(() => {
    put("DEVOTION", "divine-mercy-chaplet", "The Divine Mercy Chaplet", {
      background: "The Lord Jesus dictated the chaplet to St. Faustina in 1935.",
      practiceInstructions:
        "Begin with the Sign of the Cross, the Our Father, the Hail Mary, and the Apostles' Creed.",
      relatedPrayers: ["our-father", "hail-mary", "apostles-creed"],
    });
  });

  it("lists the devotion's prayers as dropdowns with Latin and Greek chips", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    const list = prayerList("Prayers of this devotion");
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Greek" })).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /Our Father/ }));
    fireEvent.click(within(list).getByRole("button", { name: "Latin" }));
    expect(
      within(list)
        .getByText(/Pater noster/)
        .closest(".vf-prayer"),
    ).toHaveAttribute("translate", "no");
  });

  it("opens a prayer named in 'How to practice' in place", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    const howTo = prayerList("How to practice");
    const inline = within(howTo).getByRole("button", { name: /Apostles' Creed/ });
    fireEvent.click(inline);
    expect(within(howTo).getByText("I believe in God...")).toBeInTheDocument();
  });

  it("no longer shows the prayers as a row of links to other pages", async () => {
    const { container } = render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    expect(screen.queryByRole("heading", { name: "Related prayers" })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/prayers/"]')).toBeNull();
  });

  // The live Rosary: its stored list has no Sign of the Cross and puts the
  // Creed fourth, though the instructions begin with both.
  const ROSARY = {
    background: "The Rosary is the great Marian psalter of the Latin Church.",
    practiceInstructions:
      "Begin with the Sign of the Cross and the Apostles' Creed. Pray one Our Father, three " +
      "Hail Marys (for an increase of faith, hope, and charity), and a Glory Be. Then meditate " +
      "on each of the five mysteries in turn, praying one Our Father, ten Hail Marys, and a " +
      "Glory Be for each. Conclude with the Hail Holy Queen.",
    relatedPrayers: ["our-father", "hail-mary", "glory-be", "apostles-creed", "salve-regina"],
  };

  it("lists every prayer the Rosary's instructions name, in the order they are prayed", async () => {
    put("DEVOTION", "holy-rosary", "The Holy Rosary", ROSARY);
    render(await DevotionDetailPage(params("holy-rosary")));
    const list = prayerList("Prayers of this devotion");
    expect(listedPrayers(list)).toEqual([
      "Prayer 1Sign of the Cross",
      "Prayer 2Apostles' Creed",
      "Prayer 3Our Father",
      "Prayer 4Hail Mary",
      "Prayer 5Glory Be",
      "Prayer 6Hail Holy Queen (Salve Regina)",
    ]);
    expect(list).toHaveTextContent("In the order they are prayed");

    // The Sign of the Cross the instructions open with now opens in place too.
    const howTo = prayerList("How to practice");
    fireEvent.click(within(howTo).getByRole("button", { name: /Sign of the Cross/ }));
    expect(within(howTo).getByText("In the name of the Father...")).toBeInTheDocument();
  });

  it("reads how to pray it, its prayers, then its background", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    const article = screen.getByRole("article");
    expect(
      within(article)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(["How to practice", "Prayers of this devotion", "Background"]);
  });

  it("links the step-by-step guide that names the devotion, not every guide that mentions it", async () => {
    put("DEVOTION", "holy-rosary", "The Holy Rosary", ROSARY);
    put("GUIDE", "how-to-pray-the-rosary", "How to Pray the Holy Rosary", {
      relatedDevotions: ["holy-rosary"],
    });
    put("GUIDE", "joyful-mysteries-of-the-rosary", "The Joyful Mysteries of the Rosary", {
      relatedDevotions: ["holy-rosary"],
    });
    put("GUIDE", "how-to-pray-the-holy-rosary-elsewhere", "How to Pray the Holy Rosary Again", {
      relatedDevotions: ["stations-of-the-cross"],
    });
    render(await DevotionDetailPage(params("holy-rosary")));
    const guide = screen.getByRole("heading", { name: "Guide" }).closest("section")!;
    const links = within(guide).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/guides/how-to-pray-the-rosary"]);
    expect(links[0]).toHaveTextContent("How to Pray the Holy Rosary");
  });

  it("shows no guide row when no guide names the devotion", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    expect(screen.queryByRole("heading", { name: "Guide" })).not.toBeInTheDocument();
  });

  it("never prints an indulgence's source citation (the curated scapular shape)", async () => {
    const curated = findCuratedEntry("DEVOTION", "green-scapular")!;
    expect(curated.payload.indulgences).toMatchObject({ claimed: true });
    put("DEVOTION", "green-scapular", "The Green Scapular", curated.payload);
    const { container } = render(await DevotionDetailPage(params("green-scapular")));
    expect(container.querySelectorAll("dt")).toHaveLength(0);
    const text = container.textContent ?? "";
    for (const source of ["Citation", "Enchiridion", "Apostolic Penitentiary", "Indulgences"]) {
      expect(text, source).not.toContain(source);
    }
  });
});

describe("/novenas/[slug]", () => {
  it("numbers each day and lists the prayers its days name, in order", async () => {
    put("NOVENA", "divine-mercy-novena", "Divine Mercy Novena", {
      days: [
        {
          day: 1,
          title: "All mankind, especially sinners",
          prayerText: "Begin with the Sign of the Cross, one Our Father and the Apostles' Creed.",
        },
      ],
    });
    render(await NovenaDetailPage(params("divine-mercy-novena")));

    const day = screen.getByRole("button", { name: /Day 1\s*All mankind/ });
    fireEvent.click(day);
    // The day's prayer names open in place (case-sensitively: it is prayer text).
    expect(screen.getAllByRole("button", { name: /Our Father/ }).length).toBeGreaterThan(0);

    const list = prayerList("Prayers of this novena");
    const titles = within(list)
      .getAllByRole("button", { expanded: false })
      .map((b) => b.textContent);
    expect(titles).toEqual([
      expect.stringContaining("Sign of the Cross"),
      expect.stringContaining("Our Father"),
      expect.stringContaining("Apostles' Creed"),
    ]);
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
  });

  it("sets a day as prayer even when it names none of the novena's prayers", async () => {
    put("NOVENA", "novena-saint-jude", "Novena to Saint Jude", {
      days: [
        {
          day: 1,
          title: "Patron of hopeless cases",
          prayerText: "V. Pray for us, blessed Jude.\nR. That we may be made worthy.",
        },
      ],
    });
    const { container } = render(await NovenaDetailPage(params("novena-saint-jude")));
    fireEvent.click(screen.getByRole("button", { name: /Day 1\s*Patron of hopeless cases/ }));
    expect(
      container.querySelector(".vf-disclosure-body .vf-prayer .vf-prayer-response"),
    ).toHaveTextContent("That we may be made worthy.");
  });

  it("reads its days, its prayers, then its background", async () => {
    put("NOVENA", "divine-mercy-novena", "Divine Mercy Novena", {
      background: "The Lord Jesus dictated the novena to St. Faustina in 1937.",
      days: [{ day: 1, title: "All mankind", prayerText: "Begin with one Our Father." }],
    });
    render(await NovenaDetailPage(params("divine-mercy-novena")));
    const article = screen.getByRole("article");
    expect(
      within(article)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(["Days", "Prayers of this novena", "Background"]);
  });

  it("lists no prayers its days do not pray — no customary Our Father, Hail Mary, Glory Be", async () => {
    put("NOVENA", "novena-saint-jude", "Novena to Saint Jude", {
      days: [{ day: 1, title: "Patron of hopeless cases", prayerText: "O blessed apostle..." }],
    });
    render(await NovenaDetailPage(params("novena-saint-jude")));
    expect(
      screen.queryByRole("heading", { name: "Prayers of this novena" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Our Father|Hail Mary|Glory Be/ })).toBeNull();
  });

  it("still opens the prayers a day names when its listed prayers are not published", async () => {
    put("NOVENA", "novena-x", "Novena X", {
      relatedPrayers: ["not-published"],
      days: [{ day: 1, title: "Patron of the poor", prayerText: "Pray one Our Father." }],
    });
    render(await NovenaDetailPage(params("novena-x")));
    const list = prayerList("Prayers of this novena");
    expect(listedPrayers(list)).toEqual(["Prayer 1Our Father"]);
    fireEvent.click(screen.getByRole("button", { name: /Day 1\s*Patron of the poor/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Our Father/ }));
    expect(screen.getByText("Our Father, who art in heaven...")).toBeInTheDocument();
  });
});

describe("/our-lady/[slug] and /spiritual-life/[slug]", () => {
  it("shows a Marian title's prayers in full, never their slugs", async () => {
    put("MARIAN_TITLE", "gate-of-heaven", "Gate of Heaven", {
      origin: "Ianua caeli is an invocation of the Litany of Loreto.",
      associatedPrayers: ["hail-mary", "not-published"],
    });
    const { container } = render(await OurLadyDetailPage(params("gate-of-heaven")));
    const list = prayerList("Prayers");
    expect(within(list).getByRole("button", { name: /Hail Mary/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("hail-mary");
    expect(container.textContent).not.toContain("not-published");
  });

  it("does not number a Marian title's prayers as a sequence — they are alternatives", async () => {
    put("MARIAN_TITLE", "our-lady-of-mercy", "Our Lady of Mercy", {
      origin: "Honoured by the Mercedarians since the thirteenth century.",
      associatedPrayers: ["salve-regina", "hail-mary"],
    });
    render(await OurLadyDetailPage(params("our-lady-of-mercy")));
    const list = prayerList("Prayers");
    expect(listedPrayers(list)).toEqual(["Hail Holy Queen (Salve Regina)", "Hail Mary"]);
    expect(list).not.toHaveTextContent("In the order they are prayed");
    expect(list).toHaveTextContent("Tap a prayer to reveal its full text in the chosen language.");
  });

  it("gives Lectio Divina four separate steps, its facts, and its background after them", async () => {
    put("SPIRITUAL_PRACTICE", "lectio-divina", "Lectio Divina", {
      summary: "An ancient monastic practice.",
      tradition: "Benedictine",
      frequency: "Daily",
      background: "It was the daily practice of the monasteries.",
      instructions:
        "1. Lectio (reading): read a brief passage. 2. Meditatio (meditation): reflect on a word. 3. Oratio (prayer): respond to God. 4. Contemplatio (contemplation): rest in God's presence. Pope Benedict XVI urged its rediscovery.",
    });
    render(await SpiritualLifeDetailPage(params("lectio-divina")));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Step 1: Lectio (reading)",
      "Step 2: Meditatio (meditation)",
      "Step 3: Oratio (prayer)",
      "Step 4: Contemplatio (contemplation)",
    ]);
    expect(screen.getByText(/^Pope Benedict XVI urged its rediscovery/)).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "How to practice",
      "Background",
    ]);
    const facts = document.querySelector("dl.vf-facts")!;
    expect([...facts.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      "Tradition",
      "When",
    ]);
  });

  it("shows a practice's prayers in full", async () => {
    put("SPIRITUAL_PRACTICE", "meditating-the-mysteries", "Meditating the Mysteries", {
      instructions: "Pray one Our Father and ten Hail Marys for each mystery.",
      relatedPrayers: ["our-father", "hail-mary"],
    });
    render(await SpiritualLifeDetailPage(params("meditating-the-mysteries")));
    const list = prayerList("Prayers");
    expect(within(list).getByRole("button", { name: /Our Father/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Greek" })).toBeInTheDocument();
  });
});

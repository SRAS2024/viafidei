/**
 * @vitest-environment jsdom
 *
 * Tab loading + empty state component tests (spec §19).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";

import { createTranslator } from "@/lib/i18n/translator";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "es" }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(locale.current) }),
}));

import { TabEmptyState, TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

afterEach(() => {
  cleanup();
  locale.current = "en";
});

/** The placeholder is a server component: it awaits the reader's language first. */
const skeleton = (props: ComponentProps<typeof TabLoadingSkeleton>) => TabLoadingSkeleton(props);

describe("TabLoadingSkeleton", () => {
  it("renders the supplied title", async () => {
    render(await skeleton({ title: "Prayers" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Prayers");
  });

  it("renders the requested number of skeleton cards", async () => {
    render(await skeleton({ title: "Sacraments", cards: 7 }));
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards).toHaveLength(7);
  });

  it("defaults to 6 skeleton cards when no count is supplied", async () => {
    render(await skeleton({ title: "Saints" }));
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards).toHaveLength(6);
  });

  it("holds a row of chips by their words, so they wrap as the real ones do", async () => {
    const { container } = render(
      await skeleton({ title: "Rites", filterLabels: ["All", "Latin (Western)"] }),
    );
    const chips = [...container.querySelectorAll(".vf-list-controls .vf-chip")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "Latin (Western)"]);
    // Their words take up room and nothing else: not seen, not read, not pressed.
    expect(chips[0]!.firstElementChild).toHaveClass("invisible");
    expect(chips[0]!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(chips[0]!.parentElement).toHaveClass("pointer-events-none", "flex-wrap");
  });

  it("tells a screen reader it is loading, from outside the busy wrapper", async () => {
    render(await skeleton({ title: "History", subtitle: "A sentence." }));
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Loading the latest published content"));
    expect(status).toHaveClass("sr-only");
    // A live region inside something busy may be held back until it is gone.
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId("tab-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("tab-loading")).not.toHaveAttribute("role");
  });

  it("says so in the reader's language", async () => {
    locale.current = "es";
    render(await skeleton({ title: "Oraciones" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Cargando el contenido publicado"),
    );
  });

  it("holds a missing sentence's place with the same words, not read out twice", async () => {
    const { container } = render(await skeleton({ title: "Saints of the day" }));
    const lede = container.querySelector(".vf-page-hero-lede");
    expect(lede).toHaveTextContent("Loading the latest published content");
    expect(lede).toHaveAttribute("aria-hidden", "true");
    cleanup();
    const withSentence = render(await skeleton({ title: "Saints", subtitle: "A sentence." }));
    expect(withSentence.container.querySelectorAll(".vf-page-hero-lede")).toHaveLength(1);
    expect(screen.getByText("A sentence.")).not.toHaveAttribute("aria-hidden");
  });

  it("drops a label that only repeats the title, as the finished page does", async () => {
    const { container } = render(await skeleton({ eyebrow: "Prayers", title: "Prayers" }));
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    cleanup();
    const translated = render(await skeleton({ eyebrow: "Oraciones", title: "Prayers" }));
    expect(translated.container.querySelector(".vf-eyebrow")).toHaveTextContent("Oraciones");
  });

  it("lays each line out in the finished card's own classes", async () => {
    render(await skeleton({ title: "Novenas", cards: 1, metaLines: 2, themeLines: 2 }));
    const card = screen.getByTestId("tab-loading-card");
    expect(card.querySelector(".vf-entry-title")).not.toBeNull();
    expect(card.querySelectorAll(".vf-entry-meta")).toHaveLength(2);
    expect(card.querySelectorAll(".vf-entry-theme .vf-skeleton")).toHaveLength(2);
    expect(card.querySelectorAll(".vf-entry-summary .vf-skeleton")).toHaveLength(4);
    expect(card.querySelector(".vf-entry-action")).not.toBeNull();
  });

  it("leaves off the description and its action for a list without them", async () => {
    render(await skeleton({ title: "Popes", cards: 1, summary: false }));
    const card = screen.getByTestId("tab-loading-card");
    expect(card.querySelector(".vf-entry-summary")).toBeNull();
    expect(card.querySelector(".vf-entry-action")).toBeNull();
  });

  it("holds the filter's width beside the search, and no more than that", async () => {
    const { container, rerender } = render(await skeleton({ title: "Saints" }));
    const filter = () => container.querySelector<HTMLElement>(".vf-list-controls > span");
    expect(filter()).toBeNull();
    rerender(await skeleton({ title: "Saints", filterWidth: "5.125rem" }));
    expect(filter()).toHaveStyle({ width: "5.125rem" });
  });

  it("holds the room of a section heading, hidden from a screen reader", async () => {
    const { container } = render(await skeleton({ title: "Liturgy", heading: "Mass & Rites" }));
    expect(container.querySelector(".vf-section-head")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".vf-section-title")?.textContent).toBe("Mass & Rites");
  });
});

describe("TabEmptyState", () => {
  it("renders the supplied title", () => {
    render(<TabEmptyState title="No prayers yet" />);
    expect(screen.getByText("No prayers yet")).toBeInTheDocument();
  });

  it("renders the default 'still building' description", () => {
    render(<TabEmptyState title="No saints yet" />);
    expect(screen.getByText(/factory is still building content/i)).toBeInTheDocument();
  });

  it("renders a custom description when supplied", () => {
    render(<TabEmptyState title="Empty" description="Custom message goes here." />);
    expect(screen.getByText("Custom message goes here.")).toBeInTheDocument();
  });
});

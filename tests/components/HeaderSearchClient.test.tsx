/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { HeaderSearchClient } from "@/components/layout/HeaderSearchClient";

const SUGGESTIONS = [
  {
    group: "prayers",
    id: "1",
    slug: "anima-christi",
    label: "Anima Christi",
    subtitle: "A prayer of thanksgiving after Communion",
    typeLabel: "Prayer",
    href: "/prayers/anima-christi",
  },
  { group: "prayers", id: "2", slug: "te-deum", label: "Te Deum" },
  {
    group: "saints",
    id: "3",
    slug: "augustine",
    label: "St. Augustine",
    subtitle: "Bishop, Doctor of the Church",
    typeLabel: "Saint",
    href: "/saints/augustine",
  },
];

function mockSuggestFetch(suggestions: unknown[] = SUGGESTIONS) {
  // Header search debounces input and only fetches when length >= 2.
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Clicks the collapsed search icon to reveal the input bar, then returns it. */
async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Search the site" }));
  return screen.getByRole("combobox", { name: "Search the site" });
}

/**
 * Matched substrings are wrapped in <mark>, so a row's title is split across
 * elements. Match on the row button's whole text instead of a single node.
 */
function optionByText(text: string): HTMLElement {
  const option = screen.getAllByRole("option").find((el) => (el.textContent ?? "").includes(text));
  if (!option) throw new Error(`No suggestion row containing "${text}"`);
  return option;
}

/** Types a query and waits for the suggestion list to appear. */
async function typeAndWait(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = await openSearch(user);
  await user.type(input, query);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeInTheDocument(), { timeout: 1000 });
  return input;
}

describe("HeaderSearchClient", () => {
  it("starts as a search icon and expands into a combobox when clicked", async () => {
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    // Collapsed: just the icon button, no input.
    const toggle = screen.getByRole("button", { name: "Search the site" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    const input = await openSearch(userEvent.setup());
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    // The listbox id is generated per instance (useId) so two headers on one
    // page cannot collide; only the wiring is asserted.
    expect(input.getAttribute("aria-controls")).toBeTruthy();
  });

  it("does NOT fetch suggestions for queries shorter than 2 characters", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "a");
    // Debounce is 180ms — give it room.
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("debounces: typing a whole word issues a single request", async () => {
    mockSuggestFetch();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "rosary");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("q=rosary");
  });

  it("shows the suggestion listbox after the user types and the server replies", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    await typeAndWait(userEvent.setup(), "ani");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-label", "Search suggestions");
    expect(optionByText("Anima Christi")).toBeInTheDocument();
  });

  it("groups rows under the server's human type label and shows the subtitle", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    await typeAndWait(userEvent.setup(), "ani");
    // Human labels, never a raw enum or a group key.
    expect(screen.getByText("Prayer")).toBeInTheDocument();
    expect(screen.getByText("Saint")).toBeInTheDocument();
    expect(optionByText("A prayer of thanksgiving after Communion")).toBeInTheDocument();
  });

  it("marks the matched part of a title so the reader sees why a row matched", async () => {
    mockSuggestFetch();
    const { container } = render(
      <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />,
    );
    await typeAndWait(userEvent.setup(), "ani");
    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toContain("Ani");
  });

  it("never renders a raw slug in the dropdown", async () => {
    mockSuggestFetch();
    const { container } = render(
      <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />,
    );
    await typeAndWait(userEvent.setup(), "ani");
    expect(container.textContent).not.toContain("anima-christi");
    expect(container.textContent).not.toContain("te-deum");
  });

  it("ArrowDown / ArrowUp move the active suggestion and aria-expanded becomes true", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    const input = await typeAndWait(user, "ani");
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    // The combobox points at the active row for screen readers.
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter on the active option navigates to the href the server supplied", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(pushMock).toHaveBeenCalledWith("/prayers/anima-christi");
  });

  it("falls back to the local route map when a suggestion carries no href", async () => {
    // Older/cached API responses have no `href`; a row must still be clickable.
    mockSuggestFetch([{ group: "saints", id: "9", slug: "augustine", label: "St. Augustine" }]);
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "aug");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(pushMock).toHaveBeenCalledWith("/saints/augustine");
  });

  it("Escape closes the dropdown and clears the active selection", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("shows a loading state while the request is in flight", async () => {
    // A fetch that never settles keeps the panel in its loading state.
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(() => expect(screen.getByText("Searching…")).toBeInTheDocument(), {
      timeout: 1000,
    });
  });

  it("shows an empty state rather than a blank panel when nothing matches", async () => {
    mockSuggestFetch([]);
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "zzzq");
    await waitFor(() => expect(screen.getByText(/No matches for/)).toBeInTheDocument(), {
      timeout: 1000,
    });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows an error state when the suggest endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(
      () => expect(screen.getByText("Search is unavailable right now.")).toBeInTheDocument(),
      { timeout: 1000 },
    );
  });

  it("offers a way to the full results page for the current query", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.click(screen.getByRole("button", { name: /See all results for/ }));
    expect(pushMock).toHaveBeenCalledWith("/search?q=ani");
  });

  it("aborts the in-flight request when the query changes", async () => {
    const seen: AbortSignal[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.signal) seen.push(init.signal);
      return new Promise(() => {}) as Promise<Response>;
    });
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    const input = await openSearch(user);
    await user.type(input, "ani");
    await waitFor(() => expect(seen.length).toBe(1), { timeout: 1000 });
    await user.type(input, "ma");
    await waitFor(() => expect(seen.length).toBe(2), { timeout: 1000 });
    // The first request's signal is aborted, so its (slower) reply is dropped.
    expect(seen[0].aborted).toBe(true);
    expect(seen[1].aborted).toBe(false);
  });

  it("has no obvious accessibility violations in the collapsed (icon) state", async () => {
    const { container } = render(
      <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

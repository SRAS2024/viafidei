/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "react-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("Escape closes the dropdown, keeping the text and the focus in the field", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    const input = await typeAndWait(user, "ani");
    await user.keyboard("{ArrowDown}{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(input).toHaveValue("ani");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("ArrowDown reopens the dropdown Escape closed", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("a second Escape closes the search and puts focus back on its icon", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{Escape}{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    const toggle = screen.getByRole("button", { name: "Search the site" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape in an empty field goes straight back to the icon", async () => {
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await openSearch(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search the site" })).toHaveFocus();
  });

  it("shows a loading state while the request is in flight, and says it aloud", async () => {
    // A fetch that never settles keeps the panel in its loading state.
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}) as Promise<Response>);
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Searching…"), {
      timeout: 1000,
    });
    // One visible copy for the eye, one in the status region for the ear.
    expect(screen.getAllByText("Searching…")).toHaveLength(2);
  });

  it("shows an empty state rather than a blank panel when nothing matches", async () => {
    mockSuggestFetch([]);
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "zzzq");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/No matches for/), {
      timeout: 1000,
    });
    expect(screen.getAllByText(/No matches for/)).toHaveLength(2);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows an error state when the suggest endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(
      () => expect(screen.getByRole("status")).toHaveTextContent("Search is unavailable"),
      { timeout: 1000 },
    );
    expect(screen.getAllByText("Search is unavailable right now.")).toHaveLength(2);
  });

  it("announces how many suggestions arrived through a region that was already there", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute("aria-live", "polite");
    await typeAndWait(userEvent.setup(), "ani");
    // The same element: a region created with its text is not reliably read.
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(/^3 suggestions\./);
    expect(status).toHaveTextContent(/arrow keys/);
  });

  it("groups options in a valid listbox, each row reachable only with the arrow keys", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    await typeAndWait(userEvent.setup(), "ani");
    const listbox = screen.getByRole("listbox");
    const groups = within(listbox).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-labelledby"))).toHaveLength(2);
    expect(within(listbox).getByRole("group", { name: "Saint" })).toBeInTheDocument();
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option).toHaveAttribute("tabindex", "-1");
      expect(option).toHaveAttribute("aria-setsize", "3");
    }
    expect(within(listbox).queryByRole("list")).not.toBeInTheDocument();
  });

  it("says a row's position in the whole list, and its type, to a screen reader", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    await typeAndWait(userEvent.setup(), "zz");
    const row = optionByText("St. Augustine");
    expect(row).toHaveAttribute("aria-posinset", "3");
    expect(row).toHaveAccessibleName(/St\. Augustine.*Bishop, Doctor of the Church.*Saint/);
  });

  it("wraps from the first row to the last, and scrolls the active row into view", async () => {
    mockSuggestFetch();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    // @ts-expect-error restoring jsdom's own lack of it
    delete Element.prototype.scrollIntoView;
  });

  it("closes the panel when focus is tabbed away, keeping the typed text", async () => {
    mockSuggestFetch();
    render(
      <>
        <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />
        <button type="button">Elsewhere</button>
      </>,
    );
    const user = userEvent.setup();
    const input = await typeAndWait(user, "ani");
    await user.tab(); // to See all results
    expect(screen.getByRole("button", { name: /See all results for/ })).toHaveFocus();
    await user.tab(); // out of the search
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("ani");
  });

  it("Escape on See all results returns to the field with the panel shut", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    const input = await typeAndWait(user, "ani");
    await user.tab();
    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("puts the search away after a row is opened", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await typeAndWait(user, "ani");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(pushMock).toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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

describe("HeaderSearchClient — the phone's panel", () => {
  const panel = () => (
    <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" variant="panel" />
  );

  it("keeps its icon, whose state and target follow the field's row", async () => {
    render(panel());
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Search the site" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const row = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(row).toContainElement(screen.getByRole("combobox", { name: "Search the site" }));
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("closes from the icon, clearing the field and keeping focus on the icon", async () => {
    mockSuggestFetch();
    render(panel());
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Search the site" });
    await user.click(toggle);
    await user.type(screen.getByRole("combobox"), "ani");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), { timeout: 1000 });
    await user.click(toggle);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("does not mention arrow keys on a touch screen's panel", async () => {
    mockSuggestFetch();
    render(panel());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Search the site" }));
    await user.type(screen.getByRole("combobox"), "ani");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), { timeout: 1000 });
    expect(screen.getByRole("status")).toHaveTextContent(/^3 suggestions\.$/);
  });

  it("has no obvious accessibility violations with the panel open", async () => {
    mockSuggestFetch();
    const { container } = render(panel());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Search the site" }));
    await user.type(screen.getByRole("combobox"), "ani");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), { timeout: 1000 });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe("HeaderSearchClient — opening on a real tap", () => {
  /**
   * In a browser React re-renders in a microtask, and a microtask runs between
   * one event listener and the next — so by the time the tap that opened the
   * search reached the window's outside-click listener, the icon button it hit
   * had already been swapped for the form and was no longer "inside". The
   * search shut again within the same tap: on the live site, pressing the icon
   * did nothing. jsdom dispatches synchronously and never showed it, so this
   * flushes React's work at the point a browser would.
   */
  function clickLikeABrowser(element: HTMLElement) {
    const flush = () => flushSync(() => {});
    document.addEventListener("click", flush);
    try {
      fireEvent.click(element);
    } finally {
      document.removeEventListener("click", flush);
    }
  }

  it("stays open after the tap that opened it", () => {
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    clickLikeABrowser(screen.getByRole("button", { name: "Search the site" }));
    expect(screen.getByRole("combobox", { name: "Search the site" })).toBeInTheDocument();
  });

  it("still closes on a tap outside while empty", async () => {
    render(
      <>
        <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />
        <button type="button">Elsewhere</button>
      </>,
    );
    const user = userEvent.setup();
    await openSearch(user);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search the site" })).toBeInTheDocument();
  });

  it("stays open on a tap outside once something is typed", async () => {
    mockSuggestFetch();
    render(
      <>
        <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />
        <button type="button">Elsewhere</button>
      </>,
    );
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ros");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.getByRole("combobox", { name: "Search the site" })).toHaveValue("ros");
  });
});

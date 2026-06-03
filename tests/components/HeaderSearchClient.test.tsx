/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { HeaderSearchClient } from "@/components/layout/HeaderSearchClient";

const SUGGESTIONS = [
  { group: "prayers", id: "1", slug: "anima-christi", label: "Anima Christi" },
  { group: "prayers", id: "2", slug: "te-deum", label: "Te Deum" },
  { group: "saints", id: "3", slug: "augustine", label: "St. Augustine" },
];

function mockSuggestFetch(suggestions = SUGGESTIONS) {
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
  vi.restoreAllMocks();
});

/** Clicks the collapsed search icon to reveal the input bar, then returns it. */
async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Search the site" }));
  return screen.getByRole("combobox", { name: "Search the site" });
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
    expect(input).toHaveAttribute("aria-controls", "vf-header-search-listbox");
  });

  it("does NOT fetch suggestions for queries shorter than 2 characters", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "a");
    // Debounce is 150ms — give it room.
    await new Promise((r) => setTimeout(r, 250));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the suggestion listbox after the user types and the server replies", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeInTheDocument(), {
      timeout: 1000,
    });
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-label", "Search suggestions");
    expect(screen.getByText("Anima Christi")).toBeInTheDocument();
  });

  it("ArrowDown / ArrowUp move the active suggestion and aria-expanded becomes true", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    const input = await openSearch(user);
    await user.type(input, "ani");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeInTheDocument(), {
      timeout: 1000,
    });
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");
    // First option is aria-selected.
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter on the active option navigates to its detail route", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeInTheDocument(), {
      timeout: 1000,
    });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(pushMock).toHaveBeenCalledWith("/prayers/anima-christi");
  });

  it("Escape closes the dropdown and clears the active selection", async () => {
    mockSuggestFetch();
    render(<HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />);
    const user = userEvent.setup();
    await user.type(await openSearch(user), "ani");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeInTheDocument(), {
      timeout: 1000,
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("has no obvious accessibility violations in the collapsed (icon) state", async () => {
    const { container } = render(
      <HeaderSearchClient placeholder="Search" ariaLabel="Search the site" />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

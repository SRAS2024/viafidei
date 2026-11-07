/**
 * @vitest-environment jsdom
 */
/**
 * The one script the timeline's links and forms share. Each is a plain link or
 * form that works on its own; this turns them into navigations that keep the
 * page where it is, and leaves alone whatever is not its to handle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The same object every time, as the real router is.
const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HistoryResults, HistoryShell, useHistoryNav } from "@/app/history/HistoryShell";

function Nav({ href, landing }: { href: string; landing: "target" | "event" }) {
  const { navigate } = useHistoryNav();
  return (
    <button type="button" onClick={() => navigate(href, { landing })}>
      move
    </button>
  );
}

// jsdom cannot follow a link or a form, so whatever the shell leaves to the browser
// stops here, after the shell has had its say.
const stopAtDocument = (event: Event) => event.preventDefault();

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollBy = vi.fn();
  window.history.replaceState(null, "", "/history");
  document.addEventListener("click", stopAtDocument);
  document.addEventListener("submit", stopAtDocument);
});

afterEach(() => {
  document.removeEventListener("click", stopAtDocument);
  document.removeEventListener("submit", stopAtDocument);
  cleanup();
});

function withLink(href: string, attrs: Record<string, string> = {}) {
  render(
    <HistoryShell>
      <a href={href} {...attrs}>
        go
      </a>
    </HistoryShell>,
  );
  return screen.getByRole("link", { name: "go" });
}

describe("HistoryShell links", () => {
  it("keeps the page where it is when a link changes the view", () => {
    fireEvent.click(withLink("/history?era=fathers"));
    expect(push).toHaveBeenCalledWith("/history?era=fathers", { scroll: false });
  });

  it("follows a link to another page in the same way the site's links do", () => {
    fireEvent.click(withLink("/saints/saint-peter"));
    expect(push).toHaveBeenCalledWith("/saints/saint-peter");
  });

  it("leaves a click that asks for a new tab or window to the browser", () => {
    const link = withLink("/history?era=fathers");
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { shiftKey: true });
    fireEvent.click(link, { button: 1 });
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves other sites and new-tab links to the browser", () => {
    fireEvent.click(withLink("https://www.vatican.va/x"));
    cleanup();
    fireEvent.click(withLink("/saints/saint-peter", { target: "_blank" }));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("HistoryShell forms", () => {
  function submit(action: string, fields: Record<string, string>) {
    render(
      <HistoryShell>
        <form method="get" action={action} aria-label="f">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} name={name} defaultValue={value} />
          ))}
        </form>
      </HistoryShell>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "f" }));
  }

  it("submits a GET form as a navigation, leaving out what is blank", () => {
    submit("/history", { q: " nicaea ", era: "fathers", theme: "" });
    expect(push).toHaveBeenCalledWith("/history?q=nicaea&era=fathers", { scroll: false });
  });

  it("keeps a typed year's anchor", () => {
    submit("/history#history-year-target", { year: "1054" });
    expect(push).toHaveBeenCalledWith("/history?year=1054#history-year-target", { scroll: false });
  });

  it("goes on from a typed year to the row it found, leaving the field behind", async () => {
    render(
      <HistoryShell>
        <form method="get" action="/history#history-year-target" aria-label="year">
          <input name="year" defaultValue="1054" />
        </form>
        <details id="history-event-great-schism-1054">
          <summary className="vf-timeline-summary vf-timeline-current">The Great Schism</summary>
        </details>
      </HistoryShell>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "year" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector(".vf-timeline-current")),
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("says so on the status when a typed year found no row to go to", async () => {
    render(
      <HistoryShell>
        <form method="get" action="/history#history-year-target" aria-label="year">
          <input name="year" defaultValue="1054" />
        </form>
        <p id="history-status" tabIndex={-1}>
          Showing no events
        </p>
      </HistoryShell>,
    );
    fireEvent.submit(screen.getByRole("form", { name: "year" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById("history-status")),
    );
  });

  it("leaves a form for somewhere else to the browser", () => {
    submit("/search", { q: "rosary" });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("HistoryShell menus", () => {
  function withMenus() {
    const { container } = render(
      <HistoryShell>
        <details data-history-menu open className="vf-history-menu" data-testid="one">
          <summary>One</summary>
          <a href="/history?theme=councils">Councils</a>
        </details>
        <details data-history-menu open className="vf-history-eras-fold" data-testid="two">
          <summary>Two</summary>
          <a href="/history?era=fathers">Fathers</a>
        </details>
        <button type="button">elsewhere</button>
      </HistoryShell>,
    );
    return {
      one: container.querySelector<HTMLDetailsElement>('[data-testid="one"]')!,
      two: container.querySelector<HTMLDetailsElement>('[data-testid="two"]')!,
    };
  }

  it("closes after a choice and gives the focus back to its summary", () => {
    const { one } = withMenus();
    fireEvent.click(screen.getByRole("link", { name: "Councils" }));
    expect(one.open).toBe(false);
    expect(document.activeElement).toBe(one.querySelector("summary"));
    expect(push).toHaveBeenCalledWith("/history?theme=councils", { scroll: false });
  });

  it("closes the other menu when one is used", () => {
    const { one, two } = withMenus();
    fireEvent.click(one.querySelector("summary")!);
    expect(two.open).toBe(false);
  });

  it("closes on Escape and gives the focus back", () => {
    const { one } = withMenus();
    const link = screen.getByRole("link", { name: "Councils" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(one.open).toBe(false);
    expect(document.activeElement).toBe(one.querySelector("summary"));
  });

  it("closes when the reader presses anywhere else", () => {
    const { one, two } = withMenus();
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(one.open).toBe(false);
    expect(two.open).toBe(false);
  });

  it("closes the floating menu when the focus moves on from it", () => {
    const { one } = withMenus();
    fireEvent.blur(screen.getByRole("link", { name: "Councils" }), {
      relatedTarget: screen.getByRole("button", { name: "elsewhere" }),
    });
    expect(one.open).toBe(false);
  });

  // Safari takes the focus off a press on a link to whatever is focusable around it,
  // or to nothing. A menu that closed then hid the link before the click arrived, and
  // the press landed on the panel behind: the page's theme filter did nothing.
  it("stays open when the focus goes to nothing, or to something around it", () => {
    const { one } = withMenus();
    const link = screen.getByRole("link", { name: "Councils" });
    fireEvent.blur(link, { relatedTarget: null });
    expect(one.open).toBe(true);
    fireEvent.blur(link, { relatedTarget: one.parentElement });
    expect(one.open).toBe(true);
  });

  it("does not let a press on its own link move the focus, or on its button stop it", () => {
    const { one } = withMenus();
    // fireEvent returns false when the default was prevented.
    expect(fireEvent.mouseDown(screen.getByRole("link", { name: "Councils" }))).toBe(false);
    expect(fireEvent.mouseDown(one.querySelector("summary")!)).toBe(true);
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }))).toBe(true);
  });

  it("brings an opened menu into view", () => {
    const { one } = withMenus();
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    fireEvent(one, new Event("toggle"));
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    expect(scroll.mock.contexts[0]).toBe(one.querySelector("a"));
  });

  it("starts from a menu's button when the menu is taller than the window", () => {
    const { one } = withMenus();
    const panel = one.querySelector("a")!;
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      bottom: window.innerHeight * 2,
    } as DOMRect);
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    fireEvent(one, new Event("toggle"));
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(scroll.mock.contexts[0]).toBe(one.querySelector("summary"));
  });

  it("leaves the page alone when a menu closes, or a row opens", () => {
    const { one } = withMenus();
    render(
      <HistoryShell>
        <details className="vf-timeline-event" open data-testid="row">
          <summary>Pentecost</summary>
          <p>Details</p>
        </details>
      </HistoryShell>,
    );
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    one.open = false;
    fireEvent(one, new Event("toggle"));
    fireEvent(screen.getByTestId("row"), new Event("toggle"));
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe("HistoryShell landings", () => {
  it("hands the focus to the status from a way back that is gone once followed", async () => {
    render(
      <HistoryShell>
        <p id="history-status" tabIndex={-1}>
          Showing all
        </p>
        <a href="/history" data-landing="status">
          Clear search
        </a>
      </HistoryShell>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Clear search" }));
    expect(push).toHaveBeenCalledWith("/history", { scroll: false });
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById("history-status")),
    );
  });

  it("goes to a row on this very view with nothing to fetch", () => {
    window.history.replaceState(null, "", "/history?year=1054");
    render(
      <HistoryShell>
        <a href="#history-event-great-schism-1054">Go to this event</a>
        <details id="history-event-great-schism-1054">
          <summary className="vf-timeline-summary vf-timeline-current">The Great Schism</summary>
        </details>
      </HistoryShell>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Go to this event" }));
    expect(push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.querySelector(".vf-timeline-current"));
  });

  it("moves the list under the slider while it is held in view, keeping the focus on it", async () => {
    render(
      <HistoryShell>
        <Nav href="/history?year=38#history-year-target" landing="target" />
        <section className="vf-history-docked">
          <input aria-label="slider" />
        </section>
        <span id="history-year-target" />
      </HistoryShell>,
    );
    const docked = document.querySelector<HTMLElement>(".vf-history-docked")!;
    vi.spyOn(docked, "getBoundingClientRect").mockReturnValue({ bottom: 190 } as DOMRect);
    // Where a row comes to rest once the browser has scrolled it to the top.
    const row = document.getElementById("history-year-target")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 150 } as DOMRect);
    screen.getByRole("textbox", { name: "slider" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "move" }));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    // Below the slider's foot, with two lines' room: 190 + 32 - 150.
    expect(window.scrollBy).toHaveBeenCalledWith(0, -72);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "slider" }));
  });

  it("gives up the room above a row before it cuts off the row's foot", async () => {
    render(
      <HistoryShell>
        <Nav href="/history?year=38#history-year-target" landing="target" />
        <section className="vf-history-docked" />
        <span id="history-year-target" />
        <details data-testid="row">
          <summary>A row of four lines at enlarged text</summary>
        </details>
      </HistoryShell>,
    );
    const docked = document.querySelector<HTMLElement>(".vf-history-docked")!;
    vi.spyOn(docked, "getBoundingClientRect").mockReturnValue({ bottom: 400 } as DOMRect);
    const row = document.getElementById("history-year-target")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 380 } as DOMRect);
    // The window has 768 - 400 = 368 below the box, so a row of 360 leaves room for 8.
    vi.spyOn(screen.getByTestId("row"), "getBoundingClientRect").mockReturnValue({
      height: 360,
    } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: "move" }));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(window.scrollBy).toHaveBeenCalledWith(0, -28);
  });

  it("does not move it past where the foot of the page has already left it", async () => {
    render(
      <HistoryShell>
        <Nav href="/history?year=2026#history-year-target" landing="target" />
        <section className="vf-history-docked" />
        <span id="history-year-target" />
      </HistoryShell>,
    );
    const docked = document.querySelector<HTMLElement>(".vf-history-docked")!;
    vi.spyOn(docked, "getBoundingClientRect").mockReturnValue({ bottom: 190 } as DOMRect);
    const row = document.getElementById("history-year-target")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 700 } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: "move" }));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("stays with the slider where it could not be held in view", async () => {
    render(
      <HistoryShell>
        <Nav href="/history?year=38#history-year-target" landing="target" />
        <span id="history-year-target" />
      </HistoryShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "move" }));
    await act(async () => {});
    expect(push).toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});

describe("HistoryShell deep links", () => {
  it("asks the server for the page holding an old link's event", () => {
    window.history.replaceState(null, "", "/history#history-event-first-vatican-council");
    render(<HistoryShell>{null}</HistoryShell>);
    expect(replace).toHaveBeenCalledWith(
      "/history?event=first-vatican-council#history-event-first-vatican-council",
      { scroll: false },
    );
  });

  it("opens the row and lands on it when it is already on this page", () => {
    window.history.replaceState(null, "", "/history#history-event-pentecost");
    render(
      <HistoryShell>
        <details id="history-event-pentecost">
          <summary>Pentecost</summary>
          <p>Details</p>
        </details>
      </HistoryShell>,
    );
    const row = document.getElementById("history-event-pentecost") as HTMLDetailsElement;
    expect(row.open).toBe(true);
    expect(document.activeElement).toBe(row.querySelector("summary"));
    expect(replace).not.toHaveBeenCalled();
    // The row it scrolls is the one the focus goes to, whose margin clears the sticky
    // era heading: the browser would scroll that one anyway.
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(
      row.querySelector("summary"),
    );
  });

  it("lands on the row a query names, the server having opened it", () => {
    window.history.replaceState(null, "", "/history?event=pentecost");
    render(
      <HistoryShell>
        <details id="history-event-pentecost" open>
          <summary>Pentecost</summary>
        </details>
      </HistoryShell>,
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing for any other hash", () => {
    window.history.replaceState(null, "", "/history#history-results");
    render(<HistoryShell>{null}</HistoryShell>);
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

// Safari gives a summary no press action, so VoiceOver's press on a closed row would do
// nothing. The state is kept true by script because the role is only there with script.
describe("HistoryShell disclosures", () => {
  function rows(ids: string[], open: string[] = []) {
    return (
      <>
        {ids.map((id) => (
          <details key={id} id={id} open={open.includes(id)}>
            <summary>{id}</summary>
            <p>Inside {id}</p>
          </details>
        ))}
      </>
    );
  }

  it("names every summary a button, with its real state", () => {
    render(<HistoryShell>{rows(["a", "b"], ["b"])}</HistoryShell>);
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "b" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the state true however a row opens and closes", () => {
    render(<HistoryShell>{rows(["a"])}</HistoryShell>);
    const details = document.getElementById("a") as HTMLDetailsElement;
    const summary = screen.getByRole("button", { name: "a" });
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(summary).toHaveAttribute("aria-expanded", "true");
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("names the rows of a new view, and leaves alone a disclosure outside the page's list", () => {
    const { rerender } = render(
      <>
        <details id="elsewhere">
          <summary>elsewhere</summary>
        </details>
        <HistoryShell>{rows(["a"])}</HistoryShell>
      </>,
    );
    rerender(
      <>
        <details id="elsewhere">
          <summary>elsewhere</summary>
        </details>
        <HistoryShell>{rows(["a", "c"])}</HistoryShell>
      </>,
    );
    expect(screen.getByRole("button", { name: "c" })).toHaveAttribute("aria-expanded", "false");
    const outside = document.getElementById("elsewhere") as HTMLDetailsElement;
    outside.open = true;
    fireEvent(outside, new Event("toggle"));
    expect(outside.querySelector("summary")).not.toHaveAttribute("aria-expanded");
    expect(outside.querySelector("summary")).not.toHaveAttribute("role");
  });
});

describe("HistoryResults", () => {
  it("is the list's anchor, and not busy at rest", () => {
    render(
      <HistoryShell>
        <HistoryResults>rows</HistoryResults>
      </HistoryShell>,
    );
    const results = document.getElementById("history-results")!;
    expect(results).toHaveAttribute("aria-busy", "false");
    expect(results).not.toHaveAttribute("data-pending");
    expect(results).toHaveTextContent("rows");
  });
});

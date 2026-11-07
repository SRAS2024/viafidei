/**
 * @vitest-environment jsdom
 */
/**
 * The one script the timeline's links and forms share. Each is a plain link or
 * form that works on its own; this turns them into navigations that keep the
 * page where it is, and leaves alone whatever is not its to handle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The same object every time, as the real router is.
const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HistoryResults, HistoryShell } from "@/app/history/HistoryShell";

// jsdom cannot follow a link or a form, so whatever the shell leaves to the browser
// stops here, after the shell has had its say.
const stopAtDocument = (event: Event) => event.preventDefault();

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
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

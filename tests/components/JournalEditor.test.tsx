/**
 * @vitest-environment jsdom
 */
/**
 * A journal entry is never lost without a word.
 *
 * The form used to post and the server redirect, so an entry over a limit, or a save while
 * signed out or rate limited, closed the form with the words gone and nothing said. The
 * words now stay in the form whatever goes wrong, and the reader is told why, in a way a
 * screen reader speaks. And a move within the site, which unmounts the form with no word
 * from the browser, asks first if it was a link, and gives the words back when the reader
 * returns, however they left.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { JournalEditButton } from "@/app/profile/journal/JournalEditButton";
import { JournalEditor } from "@/app/profile/journal/JournalEditor";
import { forgetJournalDraft } from "@/app/profile/journal/journal-save";
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX } from "@/app/profile/journal/limits";

const saveLabels = {
  titleTooLong: "Title is {count} of {max}.",
  bodyTooLong: "Entry is {count} of {max}.",
  signedOut: "Signed out. Your writing is still here.",
  logInNewTab: "Log in (opens a new tab)",
  rateLimited: "Too many saves. Your writing is still here.",
  saveFailed: "Could not save. Check your connection.",
  serverFailed: "Could not save, for a reason on our side.",
  draftBack: "Your unsaved writing is back.",
  leaveWarning: "Your writing is not saved. Leave now?",
  locale: "en",
};
const labels = {
  title: "Title",
  body: "Body",
  save: "Save",
  cancel: "Cancel",
  newEntry: "New entry",
  saved: "Entry saved.",
  ...saveLabels,
};

const ORIGINAL_FETCH = globalThis.fetch;
const fetchMock = vi.fn();

function answer(status: number) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: status < 400 }), { status }));
}

const DRAFT_KEYS = ["new:u1", "new:u2", "entry:e1", "entry:e2"];

/** Asks whether the browser's own "leave this page?" would come up now. */
function browserWouldAsk(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  window.history.pushState({}, "", "/profile/journal");
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  cleanup();
  for (const key of DRAFT_KEYS) forgetJournalDraft(key);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function typeInto(field: HTMLElement, value: string) {
  fireEvent.input(field, { target: { value } });
}

async function openWith(title: string, body: string) {
  const user = userEvent.setup();
  render(<JournalEditor draftKey="new:u1" labels={labels} />);
  await user.click(screen.getByRole("button", { name: "New entry" }));
  typeInto(screen.getByLabelText("Title"), title);
  typeInto(screen.getByLabelText("Body"), body);
  return user;
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Save" }));

describe("JournalEditor", () => {
  it("puts no maxLength on the fields: a browser cuts pasted text at it without a word", async () => {
    await openWith("", "");
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("maxlength");
    expect(screen.getByLabelText("Body")).not.toHaveAttribute("maxlength");
  });

  it("saves by fetch, says so, and goes back to the button", async () => {
    answer(200);
    const user = await openWith("A title", "Some words.");
    await save(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "A title", body: "Some words." }),
      }),
    );
    const newEntry = await screen.findByRole("button", { name: "New entry" });
    expect(newEntry).toHaveFocus();
    expect(screen.queryByLabelText("Body")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Entry saved.");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the status region in the page before anything is said in it", async () => {
    const user = userEvent.setup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "New entry" }));
    expect(screen.getByRole("status")).toBe(region);
  });

  it("clears the saved message when another entry is begun", async () => {
    answer(200);
    const user = await openWith("A title", "Some words.");
    await save(user);
    await user.click(await screen.findByRole("button", { name: "New entry" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByLabelText("Body")).toHaveValue("");
  });

  it("keeps an over-long body, says why, and takes focus there, sending nothing", async () => {
    const body = "x".repeat(JOURNAL_BODY_MAX + 5);
    const user = await openWith("A title", body);
    await save(user);
    const field = screen.getByLabelText("Body");
    expect(field).toHaveValue(body);
    expect(screen.getByLabelText("Title")).toHaveValue("A title");
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      `Entry is ${(JOURNAL_BODY_MAX + 5).toLocaleString()} of ${JOURNAL_BODY_MAX.toLocaleString()}.`,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an over-long title, says why, and takes focus there", async () => {
    const title = "t".repeat(JOURNAL_TITLE_MAX + 1);
    const user = await openWith(title, "Some words.");
    await save(user);
    const field = screen.getByLabelText("Title");
    expect(field).toHaveValue(title);
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription("Title is 201 of 200.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes an entry of exactly the limit", async () => {
    answer(200);
    const user = await openWith("t".repeat(JOURNAL_TITLE_MAX), "x".repeat(JOURNAL_BODY_MAX));
    await save(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("drops the message as soon as its reason has gone", async () => {
    const user = await openWith("A title", "x".repeat(JOURNAL_BODY_MAX + 1));
    await save(user);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    typeInto(screen.getByLabelText("Body"), "x".repeat(JOURNAL_BODY_MAX));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Body")).not.toHaveAttribute("aria-invalid");
  });

  // A reader on a healthy connection must not be sent to check it.
  it.each([
    [500, labels.serverFailed],
    [400, labels.serverFailed],
    [413, labels.serverFailed],
    [503, labels.serverFailed],
    [429, labels.rateLimited],
    [401, "Signed out. Your writing is still here."],
  ])("keeps the words on a %i and says why", async (status, message) => {
    answer(status);
    const user = await openWith("A title", "Some words.");
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Title")).toHaveValue("A title");
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps the words when the connection is lost, and says so", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Load failed"));
    const user = await openWith("A title", "Some words.");
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.saveFailed);
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
  });

  it("saves the same words on the next try, and clears the failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Load failed"));
    const user = await openWith("A title", "Some words.");
    await save(user);
    await screen.findByRole("alert");
    answer(200);
    await save(user);
    expect(await screen.findByRole("button", { name: "New entry" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/journal",
      expect.objectContaining({ body: JSON.stringify({ title: "A title", body: "Some words." }) }),
    );
  });

  it("offers a signed-out reader a log in that does not take them from their words", async () => {
    answer(401);
    const user = await openWith("A title", "Some words.");
    await save(user);
    const link = await screen.findByRole("link", { name: "Log in (opens a new tab)" });
    expect(link).toHaveAttribute("href", "/login?next=/profile/journal");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("does not save twice while a save is on its way", async () => {
    let finish: (res: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
    const user = await openWith("A title", "Some words.");
    await save(user);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
    await save(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response("{}", { status: 200 }));
    await screen.findByRole("button", { name: "New entry" });
  });

  it("asks before a reload throws away unsaved writing, and only then", async () => {
    await openWith("", "");
    expect(browserWouldAsk()).toBe(false);
    typeInto(screen.getByLabelText("Body"), "Some words.");
    expect(browserWouldAsk()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(browserWouldAsk()).toBe(false);
  });

  it("does not count spaces as writing", async () => {
    await openWith("  ", " \n ");
    expect(browserWouldAsk()).toBe(false);
  });

  it("writes a count in the page's language, not the browser's", async () => {
    const user = userEvent.setup();
    render(
      <JournalEditor
        draftKey="new:u1"
        labels={{ ...labels, locale: "es", bodyTooLong: "{count} de {max}." }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "New entry" }));
    typeInto(screen.getByLabelText("Title"), "A title");
    typeInto(screen.getByLabelText("Body"), "x".repeat(JOURNAL_BODY_MAX + 1));
    await save(user);
    expect(screen.getByRole("alert")).toHaveTextContent("20.001 de 20.000.");
  });

  it("has no obvious accessibility violations with its messages showing", async () => {
    answer(401);
    const user = await openWith("t".repeat(JOURNAL_TITLE_MAX), "x".repeat(JOURNAL_BODY_MAX + 1));
    await save(user);
    const container = document.body.firstElementChild as HTMLElement;
    expect((await axe(container)).violations).toEqual([]);
    typeInto(screen.getByLabelText("Body"), "Some words.");
    await save(user);
    await screen.findByRole("link", { name: "Log in (opens a new tab)" });
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("unsaved writing, when the reader leaves the page", () => {
  /** Leaves as a move within the site does: the form unmounts with no word from anyone. */
  async function writeThenLeave() {
    const user = await openWith("A title", "Some words.");
    cleanup();
    return user;
  }

  it("comes back in the form when the page returns, with focus on what says so", async () => {
    await writeThenLeave();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Title")).toHaveValue("A title");
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
    await waitFor(() => expect(screen.getByText(labels.draftBack)).toHaveFocus());
  });

  it("has the form's first field as the next stop after the notice", async () => {
    const user = await writeThenLeave();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    await waitFor(() => expect(screen.getByText(labels.draftBack)).toHaveFocus());
    await user.tab();
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  // Next's route announcer speaks the page's title as it arrives, and could talk over
  // anything said in that same moment.
  it("gives the page's arrival a moment before taking focus", async () => {
    await writeThenLeave();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    const notice = await screen.findByText(labels.draftBack);
    expect(notice).not.toHaveFocus();
    await waitFor(() => expect(notice).toHaveFocus());
  });

  // The header stays through a move within the site, and so does focus on its link.
  it("takes focus from wherever it was left when the page arrived", async () => {
    await writeThenLeave();
    const link = document.createElement("a");
    link.href = "/prayers";
    document.body.appendChild(link);
    link.focus();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    const notice = await screen.findByText(labels.draftBack);
    await waitFor(() => expect(notice).toHaveFocus());
  });

  it("leaves a reader who has moved on in that moment where they went", async () => {
    await writeThenLeave();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    const body = await screen.findByLabelText("Body");
    body.focus();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(body).toHaveFocus();
  });

  it("goes with the last change: a field cleared stays cleared", async () => {
    await openWith("A title", "Some words.");
    typeInto(screen.getByLabelText("Body"), "");
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Title")).toHaveValue("A title");
    expect(screen.getByLabelText("Body")).toHaveValue("");
  });

  it("includes a mark from the toolbar, which fires no input event", async () => {
    const user = await openWith("A title", "Some words.");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    const body = (screen.getByLabelText("Body") as HTMLTextAreaElement).value;
    expect(body).toContain("**");
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Body")).toHaveValue(body);
  });

  it("is gone once saved", async () => {
    answer(200);
    const user = await openWith("A title", "Some words.");
    await save(user);
    await screen.findByRole("button", { name: "New entry" });
    expect(browserWouldAsk()).toBe(false);
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(screen.getByRole("button", { name: "New entry" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("is still kept after a failed save", async () => {
    answer(500);
    const user = await openWith("A title", "Some words.");
    await save(user);
    await screen.findByRole("alert");
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Body")).toHaveValue("Some words.");
  });

  it("is gone once cancelled, and the next entry starts empty", async () => {
    const user = await openWith("A title", "Some words.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    await user.click(screen.getByRole("button", { name: "New entry" }));
    expect(screen.getByLabelText("Body")).toHaveValue("");
    expect(screen.queryByText(labels.draftBack)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("drops the notice when the entry is cancelled or saved, and starts empty after", async () => {
    await writeThenLeave();
    const user = userEvent.setup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    await screen.findByLabelText("Title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "New entry" }));
    expect(screen.queryByText(labels.draftBack)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("is never handed to someone else who signs in with this tab open", async () => {
    await writeThenLeave();
    render(<JournalEditor draftKey="new:u2" labels={labels} />);
    expect(screen.getByRole("button", { name: "New entry" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("survives a reload, which empties everything but this tab's storage", async () => {
    window.sessionStorage.setItem(
      "vf-journal-draft:new:u2",
      JSON.stringify({ title: "Before the reload", body: "Some words." }),
    );
    render(<JournalEditor draftKey="new:u2" labels={labels} />);
    expect(await screen.findByLabelText("Title")).toHaveValue("Before the reload");
    expect(browserWouldAsk()).toBe(true);
  });

  it.each(["not json", "null", '{"title":1,"body":2}', '"text"'])(
    "ignores a stored value it cannot read: %s",
    (stored) => {
      window.sessionStorage.setItem("vf-journal-draft:new:u2", stored);
      render(<JournalEditor draftKey="new:u2" labels={labels} />);
      expect(screen.getByRole("button", { name: "New entry" })).toBeInTheDocument();
    },
  );

  it("still comes back within the site when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await writeThenLeave();
    expect(browserWouldAsk()).toBe(true);
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Body")).toHaveValue("Some words.");
  });

  it("does not leave an older copy behind when storage is full", async () => {
    await openWith("A title", "Some words.");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    typeInto(screen.getByLabelText("Body"), "Far more words.");
    expect(window.sessionStorage.getItem("vf-journal-draft:new:u1")).toBeNull();
  });

  // The page it comes back to may never come. The browser's question is still asked on the
  // next page, for a closed tab or a reload.
  it("still has the browser ask once the form has gone", async () => {
    await writeThenLeave();
    expect(browserWouldAsk()).toBe(true);
  });

  // The words stay in this tab through a post within the site, as they would through logging
  // in again, and they are waiting afterwards. Nobody should be asked about leaving them.
  it("does not have the browser ask about a form posting within the site", async () => {
    await writeThenLeave();
    const form = document.createElement("form");
    form.setAttribute("action", "/api/auth/login");
    form.addEventListener("submit", (event) => event.preventDefault());
    document.body.appendChild(form);
    fireEvent.submit(form);
    expect(browserWouldAsk()).toBe(false);
  });

  it("still has the browser ask about a form posting to another site", async () => {
    await writeThenLeave();
    const form = document.createElement("form");
    form.setAttribute("action", "https://www.vatican.va/search");
    form.addEventListener("submit", (event) => event.preventDefault());
    document.body.appendChild(form);
    fireEvent.submit(form);
    expect(browserWouldAsk()).toBe(true);
  });

  it("has no obvious accessibility violations with its notice showing", async () => {
    await writeThenLeave();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    await screen.findByLabelText("Title");
    const container = document.body.firstElementChild as HTMLElement;
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("a press on a link while writing", () => {
  function addLink(href: string, attributes: Record<string, string> = {}) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = "A link";
    for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
    // A link's own handler is what starts a client navigation, and what must not hear a
    // press the reader takes back. jsdom's own attempt at navigating is stopped here too.
    const heard = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener("click", heard);
    document.body.appendChild(link);
    return { link, heard };
  }

  it("asks, and a No leaves the reader and their words where they are", async () => {
    await openWith("A title", "Some words.");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { link, heard } = addLink("/prayers");
    const followed = fireEvent.click(link);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(labels.leaveWarning);
    expect(followed).toBe(false);
    expect(heard).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
  });

  it("asks, and a Yes lets the link go, with the words kept for coming back", async () => {
    await openWith("A title", "Some words.");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { link, heard } = addLink("/prayers");
    fireEvent.click(link);
    expect(heard).toHaveBeenCalledTimes(1);
    cleanup();
    render(<JournalEditor draftKey="new:u1" labels={labels} />);
    expect(await screen.findByLabelText("Body")).toHaveValue("Some words.");
  });

  it("asks from a press inside the link, such as on its icon", async () => {
    await openWith("A title", "Some words.");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { link } = addLink("/prayers");
    const icon = document.createElement("span");
    link.appendChild(icon);
    fireEvent.click(icon);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("asks one question for two forms with unsaved words", async () => {
    const user = userEvent.setup();
    render(
      <>
        <JournalEditor draftKey="new:u1" labels={labels} />
        <JournalEditor draftKey="new:u2" labels={labels} />
      </>,
    );
    for (const button of screen.getAllByRole("button", { name: "New entry" })) {
      await user.click(button);
    }
    for (const field of screen.getAllByLabelText("Body")) typeInto(field, "Some words.");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(addLink("/prayers").link);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does not ask the same question twice for a link that loads a whole new page", async () => {
    await openWith("A title", "Some words.");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(addLink("/prayers").link);
    expect(browserWouldAsk()).toBe(false);
  });

  it("goes back to asking once that moment has passed", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    try {
      render(<JournalEditor draftKey="new:u1" labels={labels} />);
      fireEvent.click(screen.getByRole("button", { name: "New entry" }));
      typeInto(screen.getByLabelText("Body"), "Some words.");
      vi.spyOn(window, "confirm").mockReturnValue(true);
      fireEvent.click(addLink("/prayers").link);
      vi.advanceTimersByTime(1500);
      expect(browserWouldAsk()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not ask with nothing written", async () => {
    await openWith("", "");
    const confirm = vi.spyOn(window, "confirm");
    fireEvent.click(addLink("/prayers").link);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does not ask once the form has gone: a later page's links are free", async () => {
    await openWith("A title", "Some words.");
    cleanup();
    const confirm = vi.spyOn(window, "confirm");
    fireEvent.click(addLink("/prayers").link);
    expect(confirm).not.toHaveBeenCalled();
  });

  // These leave the form on the page, as it is.
  it.each([
    ["the favorites filter", "/profile/journal?filter=favorites", {}],
    ["a place on this page", "#main-content", {}],
    ["a new tab", "/prayers", { target: "_blank" }],
    ["a download", "/prayers", { download: "" }],
  ])("does not ask for %s", async (_label, href, attributes) => {
    await openWith("A title", "Some words.");
    const confirm = vi.spyOn(window, "confirm");
    fireEvent.click(addLink(href, attributes).link);
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }])(
    "does not ask for a press that opens elsewhere: %j",
    async (modifier) => {
      await openWith("A title", "Some words.");
      const confirm = vi.spyOn(window, "confirm");
      fireEvent.click(addLink("/prayers").link, modifier);
      expect(confirm).not.toHaveBeenCalled();
    },
  );

  // The browser asks about this itself, since it unloads the page: one question, not two.
  it("leaves another site to the browser's own question", async () => {
    await openWith("A title", "Some words.");
    const confirm = vi.spyOn(window, "confirm");
    fireEvent.click(addLink("https://www.vatican.va/").link);
    expect(confirm).not.toHaveBeenCalled();
    expect(browserWouldAsk()).toBe(true);
  });

  it("is not stirred by a press on anything but a link", async () => {
    await openWith("A title", "Some words.");
    const confirm = vi.spyOn(window, "confirm");
    fireEvent.click(screen.getByLabelText("Title"));
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("JournalEditButton", () => {
  const editLabels = {
    edit: "Edit",
    title: "Title",
    body: "Body",
    save: "Save",
    cancel: "Cancel",
    ...saveLabels,
  };

  async function openEdit() {
    const user = userEvent.setup();
    render(
      <JournalEditButton
        entryId="e1"
        initialTitle="A title"
        initialBody="Some words."
        labels={editLabels}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit: A title" }));
    return user;
  }

  it("saves with PATCH and goes back to the button", async () => {
    answer(200);
    const user = await openEdit();
    await user.type(screen.getByLabelText("Body"), " More.");
    await save(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal/e1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "A title", body: "Some words. More." }),
      }),
    );
    expect(await screen.findByRole("button", { name: "Edit: A title" })).toHaveFocus();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an over-long body, says why, and takes focus there, sending nothing", async () => {
    const user = await openEdit();
    const body = "x".repeat(JOURNAL_BODY_MAX + 1);
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: body } });
    await save(user);
    const field = screen.getByLabelText("Body");
    expect(field).toHaveValue(body);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Shorter." } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [500, labels.serverFailed],
    [429, "Too many saves."],
    [401, "Signed out."],
  ])("keeps the words on a %i and says why", async (status, message) => {
    answer(status);
    const user = await openEdit();
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
  });

  it("keeps the words when the connection is lost, and says so", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Load failed"));
    const user = await openEdit();
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.saveFailed);
    expect(screen.getByLabelText("Body")).toHaveValue("Some words.");
  });

  it("asks before a reload throws away an unsaved change", async () => {
    await openEdit();
    expect(browserWouldAsk()).toBe(false);
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed." } });
    expect(browserWouldAsk()).toBe(true);
  });

  it("asks nothing once a change has been taken back: the entry itself is safe", async () => {
    await openEdit();
    const body = screen.getByLabelText("Body");
    fireEvent.change(body, { target: { value: "Changed." } });
    fireEvent.change(body, { target: { value: "Some words." } });
    expect(browserWouldAsk()).toBe(false);
  });

  it("asks before a link takes the reader away from a change", async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed." } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = document.createElement("a");
    link.href = "/prayers";
    document.body.appendChild(link);
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(labels.leaveWarning);
  });

  it("gives a change back when the page returns, with focus on what says so", async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed." } });
    cleanup();
    render(
      <JournalEditButton
        entryId="e1"
        initialTitle="A title"
        initialBody="Some words."
        labels={editLabels}
      />,
    );
    expect(await screen.findByLabelText("Body")).toHaveValue("Changed.");
    await waitFor(() => expect(screen.getByText(labels.draftBack)).toHaveFocus());
  });

  it("forgets the change once saved or cancelled", async () => {
    answer(200);
    const user = await openEdit();
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed." } });
    await save(user);
    await screen.findByRole("button", { name: "Edit: A title" });
    expect(browserWouldAsk()).toBe(false);

    await user.click(screen.getByRole("button", { name: "Edit: A title" }));
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed again." } });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(browserWouldAsk()).toBe(false);
  });

  it("keeps each entry's change to itself", async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Changed." } });
    cleanup();
    render(
      <JournalEditButton
        entryId="e2"
        initialTitle="Another"
        initialBody="Other words."
        labels={editLabels}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit: Another" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Body")).not.toBeInTheDocument();
  });
});

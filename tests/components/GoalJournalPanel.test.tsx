/**
 * @vitest-environment jsdom
 */
/**
 * A goal's journal panel saves through the same route as the journal, and a journal entry
 * is never lost without a word here either. A lost connection used to throw out of the save
 * with nothing said, and maxLength cut pasted text at the limit, also with nothing said.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { GoalJournalPanel } from "@/app/profile/goals/GoalJournalPanel";
import { GoalManager } from "@/app/profile/goals/GoalManager";
import { forgetJournalDraft } from "@/app/profile/journal/journal-save";
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX } from "@/app/profile/journal/limits";

const labels = {
  titleTooLong: "Title is {count} of {max}.",
  bodyTooLong: "Entry is {count} of {max}.",
  signedOut: "Signed out.",
  logInNewTab: "Log in (opens a new tab)",
  rateLimited: "Too many saves.",
  saveFailed: "Could not save. Check your connection.",
  serverFailed: "Could not save, for a reason on our side.",
  draftBack: "Your unsaved writing is back.",
  leaveWarning: "Your writing is not saved. Leave now?",
  locale: "en",
};

const ORIGINAL_FETCH = globalThis.fetch;
const fetchMock = vi.fn();

const savedAnswer = () =>
  new Response(
    JSON.stringify({
      ok: true,
      entry: { id: "e1", title: "A title", body: "Some words.", createdAt: "2026-11-07" },
    }),
    { status: 200 },
  );

function browserWouldAsk(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  window.history.pushState({}, "", "/profile/goals");
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  cleanup();
  forgetJournalDraft("goal:g1");
  forgetJournalDraft("goal:g2");
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const titleField = () => screen.getByLabelText("Entry title");
const bodyField = () => screen.getByLabelText(/What did God do/);

function showPanel(goalId = "g1", extra: Partial<typeof labels> = {}) {
  return render(
    <GoalJournalPanel goalId={goalId} initialEntries={[]} open labels={{ ...labels, ...extra }} />,
  );
}

async function fillIn(title = "A title", body = "Some words.") {
  const user = userEvent.setup();
  showPanel();
  fireEvent.change(titleField(), { target: { value: title } });
  fireEvent.change(bodyField(), { target: { value: body } });
  return user;
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Save entry" }));

describe("GoalJournalPanel", () => {
  it("adds the saved entry and empties the form", async () => {
    fetchMock.mockResolvedValueOnce(savedAnswer());
    const user = await fillIn();
    await save(user);
    expect(await screen.findByRole("heading", { name: "A title" })).toBeInTheDocument();
    expect(titleField()).toHaveValue("");
    expect(titleField()).toHaveFocus();
  });

  it("sends the entry against its goal", async () => {
    fetchMock.mockResolvedValueOnce(savedAnswer());
    const user = await fillIn();
    await save(user);
    await screen.findByRole("heading", { name: "A title" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "A title", body: "Some words.", goalId: "g1" }),
      }),
    );
  });

  it.each([
    [500, labels.serverFailed],
    [413, labels.serverFailed],
    [429, labels.rateLimited],
    [401, "Signed out."],
  ])("keeps the words on a %i, and says why", async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
    const user = await fillIn();
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(titleField()).toHaveValue("A title");
    expect(bodyField()).toHaveValue("Some words.");
  });

  it("keeps the words when the connection is lost, and says so", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Load failed"));
    const user = await fillIn();
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.saveFailed);
    expect(titleField()).toHaveValue("A title");
    expect(bodyField()).toHaveValue("Some words.");
  });

  it("sends a signed-out reader to log in and back to this page", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    const user = await fillIn();
    await save(user);
    const link = await screen.findByRole("link", { name: labels.logInNewTab });
    expect(link).toHaveAttribute("href", "/login?next=/profile/goals");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not save twice while a save is on its way", async () => {
    let finish: (res: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
    const user = await fillIn();
    await save(user);
    expect(screen.getByRole("button", { name: "Save entry" })).toHaveAttribute("aria-busy", "true");
    await save(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(savedAnswer());
    await screen.findByRole("heading", { name: "A title" });
  });

  it("clears the form even if the answer cannot be read: the entry is saved", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    const user = await fillIn();
    await save(user);
    await vi.waitFor(() => expect(titleField()).toHaveValue(""));
    expect(browserWouldAsk()).toBe(false);
    // The list is fetched again, so the entry shows.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe("GoalJournalPanel, at the limits", () => {
  it("puts no maxLength on the fields: a browser cuts pasted text at it without a word", () => {
    showPanel();
    expect(titleField()).not.toHaveAttribute("maxlength");
    expect(bodyField()).not.toHaveAttribute("maxlength");
  });

  it("keeps an over-long body whole, says why, and takes focus there, sending nothing", async () => {
    const body = "q".repeat(JOURNAL_BODY_MAX + 10);
    const user = await fillIn("A title", body);
    await save(user);
    expect(bodyField()).toHaveValue(body);
    expect(bodyField()).toHaveFocus();
    expect(bodyField()).toHaveAttribute("aria-invalid", "true");
    expect(bodyField()).toHaveAccessibleDescription("Entry is 20,010 of 20,000.");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an over-long title whole, says why, and takes focus there", async () => {
    const title = "t".repeat(JOURNAL_TITLE_MAX + 1);
    const user = await fillIn(title, "Some words.");
    await save(user);
    expect(titleField()).toHaveValue(title);
    expect(titleField()).toHaveFocus();
    expect(titleField()).toHaveAccessibleDescription("Title is 201 of 200.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops the message as soon as its reason has gone", async () => {
    const user = await fillIn("A title", "q".repeat(JOURNAL_BODY_MAX + 1));
    await save(user);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(bodyField(), { target: { value: "q".repeat(JOURNAL_BODY_MAX) } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(bodyField()).not.toHaveAttribute("aria-invalid");
  });

  it("measures what will be sent, which is trimmed", async () => {
    fetchMock.mockResolvedValueOnce(savedAnswer());
    const user = await fillIn("A title", `${"q".repeat(JOURNAL_BODY_MAX)}   \n`);
    await save(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes a count in the page's language, not the browser's", async () => {
    const user = userEvent.setup();
    showPanel("g1", { locale: "es" });
    fireEvent.change(titleField(), { target: { value: "A title" } });
    fireEvent.change(bodyField(), { target: { value: "q".repeat(JOURNAL_BODY_MAX + 1) } });
    await save(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Entry is 20.001 of 20.000.");
  });

  it("has no obvious accessibility violations with its message showing", async () => {
    const user = await fillIn("t".repeat(JOURNAL_TITLE_MAX + 1), "q".repeat(JOURNAL_BODY_MAX + 1));
    await save(user);
    const container = document.body.firstElementChild as HTMLElement;
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("GoalJournalPanel, when the reader leaves", () => {
  it("asks before a link or a reload throws the words away, and only then", async () => {
    showPanel();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = document.createElement("a");
    link.href = "/prayers";
    link.addEventListener("click", (event) => event.preventDefault());
    document.body.appendChild(link);
    fireEvent.click(link);
    expect(confirm).not.toHaveBeenCalled();
    expect(browserWouldAsk()).toBe(false);

    fireEvent.change(bodyField(), { target: { value: "Some words." } });
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(labels.leaveWarning);
    expect(browserWouldAsk()).toBe(true);
  });

  it("gives the words back when the page returns, with focus on what says so", async () => {
    await fillIn();
    cleanup();
    showPanel();
    const notice = await screen.findByText(labels.draftBack);
    await vi.waitFor(() => expect(notice).toHaveFocus());
    expect(titleField()).toHaveValue("A title");
    expect(bodyField()).toHaveValue("Some words.");
  });

  it("keeps each goal's words to itself", async () => {
    await fillIn();
    cleanup();
    showPanel("g2");
    expect(titleField()).toHaveValue("");
    expect(screen.queryByText(labels.draftBack)).not.toBeInTheDocument();
  });

  it("forgets them once saved", async () => {
    fetchMock.mockResolvedValueOnce(savedAnswer());
    const user = await fillIn();
    await save(user);
    await screen.findByRole("heading", { name: "A title" });
    expect(browserWouldAsk()).toBe(false);
    cleanup();
    showPanel();
    expect(titleField()).toHaveValue("");
  });

  it("opens the goal's panel when its words come back, in the goal's card", async () => {
    await fillIn();
    cleanup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    const goal = {
      id: "g1",
      title: "Pray daily",
      description: null,
      status: "ACTIVE",
      dueDate: null,
      checklist: [],
    };
    render(
      <GoalManager
        initialGoals={[goal]}
        labels={
          {
            journalSave: labels,
            newGoal: "New goal",
            edit: "Edit",
            complete: "Complete",
            archive: "Archive",
            delete: "Delete",
          } as never
        }
      />,
    );
    const notice = await screen.findByText(labels.draftBack);
    await vi.waitFor(() => expect(notice).toHaveFocus());
    expect(bodyField()).toHaveValue("Some words.");
    expect(screen.getByRole("button", { name: "Hide journal" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

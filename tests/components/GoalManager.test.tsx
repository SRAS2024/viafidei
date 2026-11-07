/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { GoalManager } from "@/app/profile/goals/GoalManager";

const labels = {
  journalSave: {
    titleTooLong: "Title is {count} of {max}.",
    bodyTooLong: "Entry is {count} of {max}.",
    signedOut: "Signed out.",
    logInNewTab: "Log in",
    rateLimited: "Too many saves.",
    saveFailed: "Check your connection.",
    serverFailed: "A problem on our side.",
    draftBack: "Your unsaved writing is back.",
    leaveWarning: "Leave now?",
    locale: "en",
  },
  newGoal: "New goal",
  title: "Title",
  description: "Description",
  dueDate: "Due date",
  save: "Save",
  startGoal: "Start Goal",
  alreadyCompleted: "Already Completed",
  cancel: "Cancel",
  edit: "Edit",
  complete: "Mark complete",
  archive: "Archive",
  delete: "Delete",
  addChecklist: "Add step",
  deleteTitle: "Delete goal",
  deleteBody: "Are you sure?",
  checklist: "Checklist",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const GOAL = {
  id: "g1",
  title: "Pray daily",
  description: "After dinner",
  status: "ACTIVE",
  dueDate: null,
  checklist: [{ id: "c1", label: "Find the rosary", sortOrder: 0, isCompleted: false }],
};

describe("GoalManager goal card", () => {
  it("names every control for a screen reader", () => {
    render(<GoalManager initialGoals={[GOAL]} labels={labels} />);
    expect(screen.getByRole("checkbox", { name: "Find the rosary" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Remove: Find the rosary" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Add step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit: Pray daily" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete: Pray daily" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open journal" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("labels the fields while editing, and moves focus into them and back", async () => {
    render(<GoalManager initialGoals={[GOAL]} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit: Pray daily" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("After dinner");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit: Pray daily" })).toHaveFocus(),
    );
  });

  it("ticks a step at once and goes back if the save fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }) as Response),
    );
    render(<GoalManager initialGoals={[GOAL]} labels={labels} />);
    const box = screen.getByRole("checkbox", { name: "Find the rosary" });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not save that step/);
    expect(box).not.toBeChecked();
  });

  it("prints a due date as the calendar day it is, wherever the reader is", () => {
    render(
      <GoalManager
        initialGoals={[{ ...GOAL, dueDate: "2099-03-05T00:00:00.000Z" }]}
        labels={labels}
      />,
    );
    expect(screen.getByText(/Due Mar 5, 2099/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls a goal overdue only once its due day has passed", () => {
    vi.useFakeTimers({ now: new Date("2099-03-05T20:00:00.000Z") });
    try {
      render(
        <GoalManager
          initialGoals={[{ ...GOAL, dueDate: "2099-03-05T00:00:00.000Z" }]}
          labels={labels}
        />,
      );
      expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
      cleanup();
      render(
        <GoalManager
          initialGoals={[{ ...GOAL, dueDate: "2099-03-04T00:00:00.000Z" }]}
          labels={labels}
        />,
      );
      expect(screen.getByText("Overdue")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps Archived goals in the shared disclosure", () => {
    render(<GoalManager initialGoals={[{ ...GOAL, status: "ARCHIVED" }]} labels={labels} />);
    const trigger = screen.getByRole("button", { name: "Archived (1)" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Pray daily" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("heading", { name: "Pray daily" })).toBeInTheDocument();
  });

  it("moves focus to the completed link when a goal completes and leaves the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({ goal: { ...GOAL, status: "COMPLETED" } }),
          }) as Response,
      ),
    );
    render(<GoalManager initialGoals={[GOAL]} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark complete: Pray daily" }));
    const link = await screen.findByRole("link", { name: /View completed goals \(1\)/ });
    await waitFor(() => expect(link).toHaveFocus());
    expect(screen.queryByRole("heading", { name: "Pray daily" })).not.toBeInTheDocument();
  });
});

describe("GoalManager create flow", () => {
  function openForm() {
    render(<GoalManager initialGoals={[]} completedCount={0} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "New goal" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pray daily" } });
  }

  it("offers both Start Goal and Already Completed when adding a goal", () => {
    openForm();
    expect(screen.getByRole("button", { name: "Start Goal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Already Completed" })).toBeInTheDocument();
  });

  it("Already Completed posts completed:true (manual prior completion)", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            goal: {
              id: "g1",
              title: "Pray daily",
              description: null,
              status: "COMPLETED",
              dueDate: null,
              checklist: [],
            },
          }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Already Completed" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/goals", expect.anything()));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.completed).toBe(true);
    expect(body.title).toBe("Pray daily");
  });

  it("offers one Cancel, inside the form", () => {
    openForm();
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "New goal" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("Start Goal posts completed:false", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            goal: {
              id: "g2",
              title: "Pray daily",
              description: null,
              status: "ACTIVE",
              dueDate: null,
              checklist: [],
            },
          }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Start Goal" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.completed).toBe(false);
  });
});

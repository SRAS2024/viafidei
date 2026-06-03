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
  vi.restoreAllMocks();
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

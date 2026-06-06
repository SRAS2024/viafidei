/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import { RequestHomepageMakeoverButton } from "@/app/admin/admin-worker/RequestHomepageMakeoverButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.push.mockClear();
  nav.refresh.mockClear();
});

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" } as Response;
}

describe("RequestHomepageMakeoverButton", () => {
  it("shows only the makeover button when there is no reviewable draft", () => {
    render(<RequestHomepageMakeoverButton initialDraft={null} />);
    expect(screen.getByRole("button", { name: /Request Homepage Makeover/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("renders the three actions below a completion message for an initial reviewable draft", () => {
    render(
      <RequestHomepageMakeoverButton
        initialDraft={{
          id: "d1",
          status: "AWAITING_REVIEW",
          reasonSummary: "Drafted AWAITING_REVIEW change set.",
          sectionsChanged: ["added:featured-prayers"],
          confidence: 0.7,
        }}
      />,
    );
    expect(screen.getByText("Makeover ready for review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("navigates to the preview screen when Preview is clicked", () => {
    render(
      <RequestHomepageMakeoverButton
        initialDraft={{ id: "d9", status: "PROPOSED", reasonSummary: "", sectionsChanged: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(nav.push).toHaveBeenCalledWith("/admin/homepage/preview/d9");
  });

  it("reveals the actions after running a makeover that returns a reviewable draft", async () => {
    globalThis.fetch = vi.fn(async () =>
      okJson({
        taskId: "t1",
        draftId: "d2",
        status: "AWAITING_REVIEW",
        finalScore: 0.42,
        sectionsChanged: ["added:featured-saints"],
        reasonSummary: "Drafted change set.",
      }),
    ) as unknown as typeof fetch;

    render(<RequestHomepageMakeoverButton initialDraft={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Request Homepage Makeover/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument());
    expect(screen.getByText("Makeover ready for review")).toBeInTheDocument();
    expect(screen.getByText(/score=0.42/)).toBeInTheDocument();
  });

  it("hides the completion message + actions after Publish", async () => {
    const fetchMock = vi.fn(async () => okJson({ published: true, status: "APPROVED" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <RequestHomepageMakeoverButton
        initialDraft={{ id: "d3", status: "AWAITING_REVIEW", reasonSummary: "x", sectionsChanged: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(screen.queryByText("Makeover ready for review")).toBeNull());
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.getByText("Homepage published.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin-worker/homepage-draft/d3",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "publish" }) }),
    );
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("hides the completion message + actions after Discard", async () => {
    const fetchMock = vi.fn(async () => okJson({ discarded: true, status: "REJECTED" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <RequestHomepageMakeoverButton
        initialDraft={{ id: "d4", status: "PROPOSED", reasonSummary: "x", sectionsChanged: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(screen.queryByText("Makeover ready for review")).toBeNull());
    expect(screen.getByText("Draft discarded.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/admin-worker/homepage-draft/d4",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "discard" }) }),
    );
  });
});

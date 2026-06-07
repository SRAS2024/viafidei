/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import {
  HomepagePreviewShell,
  type PreviewBlock,
} from "@/app/admin/homepage/preview/[draftId]/HomepagePreviewShell";

const blocks: PreviewBlock[] = [
  {
    blockKey: "featured-prayers",
    blockType: "featured-prayers",
    heading: "Featured Prayers",
    items: [
      { slug: "our-father", title: "Our Father" },
      { slug: "hail-mary", title: "Hail Mary" },
    ],
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.push.mockClear();
});

function okText() {
  return { ok: true, status: 200, text: async () => "", json: async () => ({}) } as Response;
}

describe("HomepagePreviewShell", () => {
  it("renders the proposed rails, the static slots, and the controls", () => {
    render(
      <HomepagePreviewShell
        draftId="d1"
        initialBlocks={blocks}
        topSlot={<div>TOP_SECTION</div>}
        bottomSlot={<div>BOTTOM_SECTION</div>}
      />,
    );
    expect(screen.getByText("TOP_SECTION")).toBeInTheDocument();
    expect(screen.getByText("BOTTOM_SECTION")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Featured Prayers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Our Father")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to Admin Worker/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("shows an empty-state when no featured rails were proposed", () => {
    render(
      <HomepagePreviewShell draftId="d1" initialBlocks={[]} topSlot={null} bottomSlot={null} />,
    );
    expect(screen.getByText("No featured rails proposed")).toBeInTheDocument();
  });

  it("lets the admin remove an item from a rail", () => {
    render(
      <HomepagePreviewShell draftId="d1" initialBlocks={blocks} topSlot={null} bottomSlot={null} />,
    );
    expect(screen.getByDisplayValue("Hail Mary")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Hail Mary" }));
    expect(screen.queryByDisplayValue("Hail Mary")).toBeNull();
    expect(screen.getByDisplayValue("Our Father")).toBeInTheDocument();
  });

  it("saves edits then navigates back when Back is clicked", async () => {
    const fetchMock = vi.fn(async () => okText());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <HomepagePreviewShell draftId="d7" initialBlocks={blocks} topSlot={null} bottomSlot={null} />,
    );

    // Edit the heading first.
    fireEvent.change(screen.getByDisplayValue("Featured Prayers"), {
      target: { value: "Prayers We Love" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Back to Admin Worker/ }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/admin/admin-worker"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/admin-worker/homepage-draft/d7");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.proposedSnapshot[0].configJson.heading).toBe("Prayers We Love");
  });

  it("PATCHes edits and POSTs publish when Publish is clicked", async () => {
    const fetchMock = vi.fn(async () => okText());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <HomepagePreviewShell draftId="d8" initialBlocks={blocks} topSlot={null} bottomSlot={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/admin/admin-worker"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PATCH");
    const publishInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(publishInit.method).toBe("POST");
    expect(publishInit.body).toBe(JSON.stringify({ action: "publish" }));
  });

  it("POSTs discard (without a PATCH) when Discard is clicked", async () => {
    const fetchMock = vi.fn(async () => okText());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <HomepagePreviewShell draftId="d9" initialBlocks={blocks} topSlot={null} bottomSlot={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/admin/admin-worker"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ action: "discard" }));
  });
});

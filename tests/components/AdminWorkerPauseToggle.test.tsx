/**
 * @vitest-environment jsdom
 *
 * The status banner must reflect REAL liveness, not just the pause flag — the
 * exact bug the screenshots surfaced (it said "Active" while the heartbeat was
 * 17h stale). Three states: Running (live, not paused), Offline (not paused, no
 * heartbeat), Paused (operator paused).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminWorkerPauseToggle } from "@/app/admin/admin-worker/AdminWorkerPauseToggle";
import { AdminWorkerIcon } from "@/app/admin/admin-worker/_ui";

describe("AdminWorkerIcon", () => {
  it("is a sketched, no-colour mark: currentColor stroke, no fill", () => {
    const { container } = render(<AdminWorkerIcon className="h-6 w-6" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    // No hardcoded colour anywhere (hex / rgb / named fills) — it inherits tone.
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}|rgb\(|fill="(?!none)/);
    // It is an atom (orbit ellipses + nucleus circle) with tools inside.
    expect(container.querySelectorAll("ellipse").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector("circle")).toBeTruthy();
    // Accessible name.
    expect(svg.getAttribute("aria-label")).toBe("Admin Worker");
  });
});

describe("AdminWorkerPauseToggle status banner", () => {
  it("reads Offline (not Active) when not paused but the heartbeat is stale", () => {
    render(
      <AdminWorkerPauseToggle
        initialPaused={false}
        initialReason={null}
        workerLive={false}
        heartbeatAgo="17h ago"
      />,
    );
    const el = screen.getByTestId("admin-worker-pause-toggle");
    expect(el.getAttribute("data-status")).toBe("offline");
    expect(el.textContent).toContain("Admin Worker: Offline");
    expect(el.textContent).toContain("17h ago");
    expect(el.textContent).not.toContain("Admin Worker: Active");
  });

  it("reads Running when live and not paused", () => {
    render(
      <AdminWorkerPauseToggle
        initialPaused={false}
        initialReason={null}
        workerLive={true}
        heartbeatAgo="just now"
      />,
    );
    const el = screen.getByTestId("admin-worker-pause-toggle");
    expect(el.getAttribute("data-status")).toBe("running");
    expect(el.textContent).toContain("Admin Worker: Running");
  });

  it("reads Paused when the operator paused it, even if live", () => {
    render(
      <AdminWorkerPauseToggle
        initialPaused={true}
        initialReason={"operator request"}
        workerLive={true}
        heartbeatAgo="just now"
      />,
    );
    const el = screen.getByTestId("admin-worker-pause-toggle");
    expect(el.getAttribute("data-status")).toBe("paused");
    expect(el.textContent).toContain("Admin Worker: Paused");
    expect(el.textContent).toContain("operator request");
  });
});

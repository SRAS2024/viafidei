/**
 * The Mac app's pill and status line while the host restarts a crashed worker.
 *
 * Measured gap: pollStatus drew runState "crashed" as pill OFF. That was
 * harmless while a crash backoff lasted 2-10 s; with never-give-up restarts
 * the host stays "crashed" for up to 5 min per attempt — indefinitely while
 * degraded — with the durable switch ON and a restart armed, so the main
 * operator surface said OFF while the worker was about to restart on its own.
 * The first five restarts carry no failureReason, so the label said nothing
 * either; and the reasons it did show were made sticky, so a degraded
 * runtime's message stayed on screen after it had recovered. A click on that
 * "OFF" pill sent ON, cancelling the backoff and resetting the streak.
 *
 * Asserted against the source: scripts/desktop-app/main.swift is compiled by
 * build.sh, not by this suite (`swiftc -typecheck` checks it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const app = readFileSync(join(process.cwd(), "scripts/desktop-app/main.swift"), "utf8");
const poll = app.slice(app.indexOf("private func pollStatus()"), app.indexOf("// MARK: views"));
const host = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");

describe("the app while the host restarts a crashed worker", () => {
  it("keeps the pill ON — the switch is still ON — and OFF only for a parked runtime", () => {
    expect(poll).not.toMatch(/runState == "crashed"[^\n]*pill\.isOn = false/);
    expect(poll).toContain('if runState == "crashed", !self.pill.isBusy { self.pill.isOn = true }');
    expect(poll).toContain('if runState == "failed" { self.pill.isOn = false }');
  });

  it("makes only a parked runtime's reason sticky; a restart's reason is shown while it is true", () => {
    expect(poll).toContain(
      'if runState == "failed", let failureReason { self.stickyError = failureReason }',
    );
    expect(poll).not.toContain("if let failureReason { self.stickyError = failureReason }");
    expect(poll).toContain("self.statusLabel.stringValue = self.stickyError ?? transient ?? label");
  });

  it("says when the next attempt is, from the restart plan the host publishes", () => {
    expect(poll).toContain('self.restartingText(json["restart"] as? [String: Any])');
    const text = app.slice(app.indexOf("private func restartingText("));
    expect(text).toContain('restart?["nextAttemptAt"] as? String');
    expect(text).toContain('restart?["consecutive"] as? Int');
    // ISO strings from Date.toISOString carry milliseconds.
    expect(text).toContain(".withFractionalSeconds");
    // …which the host does publish on every status.
    expect(host).toContain("consecutive: host.restarts,");
    expect(host).toMatch(/nextAttemptAt: host\.nextRestartAt/);
  });
});

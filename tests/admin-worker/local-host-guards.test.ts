/**
 * The local host must survive its own async failures.
 *
 * Measured gap: startFromSwitchPoll, reconcileSwitchTick and the lease tick
 * were `try/finally` with no catch, scheduled as `void tick().finally(next)`,
 * so a single database error in a phone-initiated start became an unhandled
 * rejection — and the host's unhandledRejection handler shut the whole runtime
 * down. Nothing restarts the host, so content work stopped until somebody
 * relaunched the app. At boot the same error rejected main() before the ticks,
 * the signal handlers and the app watch were installed: a host that ignored
 * the app quitting and never reconciled the switch.
 *
 * Asserted against the source, like the other host wiring tests:
 * scripts/local-worker-host.ts is a process entry point (it listens, spawns
 * and installs process handlers at import).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const src = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");
const main = src.slice(src.indexOf("async function main(): Promise<void> {"));

describe("local host — process guards come first", () => {
  it("installs signals, crash handlers and the app watch before any boot database work", () => {
    const guards = main.indexOf("installProcessGuards(shutdown);");
    expect(guards).toBeGreaterThan(0);
    expect(guards).toBeLessThan(main.indexOf("await probeDatabase();"));
    expect(guards).toBeLessThan(main.indexOf("await resumeAtBoot();"));
    const install = src.slice(
      src.indexOf("function installProcessGuards("),
      src.indexOf("async function resumeAtBoot("),
    );
    expect(install).toContain('process.on("SIGTERM", () => shutdown("SIGTERM"));');
    expect(install).toContain("watchSupervisor(shutdown);");
  });

  it("reads only a closed pipe as 'the app is gone', never a network reset", () => {
    const install = src.slice(
      src.indexOf("function installProcessGuards("),
      src.indexOf("async function resumeAtBoot("),
    );
    expect(install).toContain("if (isClosedPipe(err)) {");
    expect(install).not.toContain("isBrokenPipe(");
  });

  it("keeps running on an unhandled rejection (logged and deduplicated), not shutting down", () => {
    const install = src.slice(
      src.indexOf("function installProcessGuards("),
      src.indexOf("async function resumeAtBoot("),
    );
    expect(install).toContain("installProcessSafetyNet({");
    expect(install).toContain('if (event === "unhandledRejection") process.on(event, handler);');
    expect(src).not.toContain('shutdown("unhandledRejection")');
  });
});

describe("local host — ticks and boot cannot die on one database error", () => {
  it("the reconcile tick catches, logs a repeating failure once, and still reschedules", () => {
    const tick = src.slice(
      src.indexOf("async function reconcileSwitchTick()"),
      src.indexOf("async function reconcileSwitchOnce()"),
    );
    expect(tick).toMatch(/try \{\s*await reconcileSwitchOnce\(\);/);
    expect(tick).toContain("} catch (err) {");
    expect(tick).toContain("if (message !== lastReconcileFailure) {");
    expect(main).toContain("void reconcileSwitchTick().finally(scheduleReconcileTick);");
  });

  it("the lease tick has a catch in front of its rescheduling", () => {
    expect(main).toMatch(
      /void leaseTick\(\)\s*\.catch\([\s\S]*?\)\s*\.finally\(scheduleLeaseTick\);/,
    );
  });

  it("wraps the boot resume so a failure there leaves the ticks to retry", () => {
    expect(main).toMatch(/try \{\s*await resumeAtBoot\(\);\s*\} catch \(err\) \{/);
    expect(main.indexOf("await resumeAtBoot();")).toBeLessThan(
      main.indexOf("scheduleLeaseTick();"),
    );
  });

  it("parks the runtime at boot only for a configuration problem, not a database still waking up", () => {
    const resume = src.slice(
      src.indexOf("async function resumeAtBoot("),
      src.indexOf("async function main("),
    );
    expect(resume).toMatch(/if \(bootConfig\.blockingReason\) \{\s*host\.runState = "failed";/);
  });

  it("never starts a worker once shutdown has begun", () => {
    expect(src).toContain("if (host.child || shuttingDown) return;");
  });
});

/**
 * The local host must never outlive the Mac app that supervises it (an
 * orphaned host once spun at 100% CPU for 8 days writing to a dead log
 * pipe). These cover the pure pieces of that guard; the end-to-end
 * "kill the app, the host stops" behaviour was verified against a real
 * supervising .app process.
 */

import { describe, expect, it } from "vitest";

import {
  hasAppAncestor,
  isBrokenPipe,
  isClosedPipe,
  parseProcessTable,
} from "@/lib/admin-worker/supervised-host";

const PS = [
  "    1     0 /sbin/launchd",
  "  500     1 /Applications/Via Fidei.app/Contents/MacOS/ViaFidei",
  "  600   500 /bin/bash",
  "  700   600 /opt/homebrew/bin/node",
  "  800   700 /opt/homebrew/Cellar/node@22/22.23.1/bin/node",
  "  900     1 /opt/homebrew/bin/node",
  "  950   900 /opt/homebrew/Cellar/node@22/22.23.1/bin/node",
].join("\n");

describe("supervised host guard", () => {
  it("parses ps output, keeping paths with spaces", () => {
    const t = parseProcessTable(PS);
    expect(t.get(500)?.comm).toBe("/Applications/Via Fidei.app/Contents/MacOS/ViaFidei");
    expect(t.get(800)?.ppid).toBe(700);
  });

  it("sees the app above a host it launched", () => {
    expect(hasAppAncestor(parseProcessTable(PS), 800)).toBe(true);
  });

  it("treats a host adopted by launchd as orphaned", () => {
    expect(hasAppAncestor(parseProcessTable(PS), 950)).toBe(false);
  });

  it("treats a missing process as orphaned and never loops forever", () => {
    expect(hasAppAncestor(parseProcessTable(PS), 4242)).toBe(false);
    const cyclic = parseProcessTable("  10    11 /bin/a\n  11    10 /bin/b");
    expect(hasAppAncestor(cyclic, 10)).toBe(false);
  });

  it("recognises a closed log pipe", () => {
    expect(isBrokenPipe(Object.assign(new Error("write EPIPE"), { code: "EPIPE" }))).toBe(true);
    expect(isBrokenPipe({ code: "ERR_STREAM_DESTROYED" })).toBe(true);
    expect(isBrokenPipe(new Error("boom"))).toBe(false);
    expect(isBrokenPipe(null)).toBe(false);
  });

  it("keeps a network reset out of the process-wide closed-pipe test", () => {
    // On one of our own stdio streams a reset means the reader is gone; seen by
    // a process-wide handler it is far more likely a socket to some server.
    expect(isBrokenPipe({ code: "ECONNRESET" })).toBe(true);
    expect(isClosedPipe({ code: "ECONNRESET" })).toBe(false);
    expect(isClosedPipe({ code: "EPIPE" })).toBe(true);
    expect(isClosedPipe({ code: "ERR_STREAM_DESTROYED" })).toBe(true);
    expect(isClosedPipe(undefined)).toBe(false);
  });
});

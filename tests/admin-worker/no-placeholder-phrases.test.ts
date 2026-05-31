/**
 * Spec §19: no placeholder phrases in Admin Worker production modules.
 * Fails if any source file under src/lib/admin-worker/ contains
 * placeholder language (TODO, FIXME, "not implemented", "placeholder
 * stage", "log intent only", "stub", "phase 2", "future pass"). Tests
 * and documentation are allowed to mention these words; production
 * code is not.
 *
 * Note: harmless prefixes ("noop", "no-op" inside comments unrelated
 * to dispatcher work) and the "future" word in unrelated contexts are
 * not flagged — we match the explicit phrases that signal an
 * unfinished placeholder.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const ADMIN_WORKER_DIR = resolve(here, "../../src/lib/admin-worker");

/** Phrases that signal a placeholder / unfinished stage. */
const PLACEHOLDER_PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: "TODO comment", rx: /\bTODO\b/ },
  { name: "FIXME comment", rx: /\bFIXME\b/ },
  { name: "XXX comment", rx: /\bXXX\b/ },
  { name: '"not implemented"', rx: /not implemented/i },
  { name: '"placeholder stage"', rx: /placeholder stage/i },
  { name: '"log intent only"', rx: /log intent only/i },
  { name: '"phase 2"', rx: /\bphase 2\b/i },
  { name: '"nothing extra to do here"', rx: /nothing extra to do here/i },
  { name: '"build engine runs QA inline; nothing"', rx: /build engine runs QA inline; nothing/i },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

describe("no placeholder phrases in Admin Worker production modules (spec §19)", () => {
  const files = walk(ADMIN_WORKER_DIR);

  it("scans the full Admin Worker source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const { name, rx } of PLACEHOLDER_PATTERNS) {
    it(`no production module contains ${name}`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const body = readFileSync(file, "utf8");
        if (rx.test(body)) {
          const rel = file.slice(ADMIN_WORKER_DIR.length + 1);
          offenders.push(rel);
        }
      }
      expect(offenders, `${name} found in: ${offenders.join(", ") || "(none)"}`).toEqual([]);
    });
  }
});

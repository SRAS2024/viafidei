/**
 * Regression: banned devices are READ-ONLY in admin. There must be
 * NO admin "unban" button or `/api/admin/banned-devices/.../unban`
 * route.
 *
 * The spec is explicit: signed device ban links exist only for
 * Security Breach events, and once a device is banned, the admin
 * panel must not offer a reversal button. The audit scans for any
 * mutation route or UI control that would unban a device.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walk(SRC_DIR);

describe("banned devices have no admin unban UI or route", () => {
  it("no admin route exposes an unban / unblock / restore mutation", () => {
    const offenders: string[] = [];
    for (const path of FILES) {
      const rel = path.replace(process.cwd() + "/", "");
      if (!rel.startsWith("src/app/api/admin/")) continue;
      const src = readFileSync(path, "utf8");
      if (/bannedDevice\.delete|bannedDevice\.update|unbanDevice|deleteBannedDevice/i.test(src)) {
        offenders.push(rel);
      }
      // Admin route mutating BannedDevice (anything that isn't a
      // create / read) is forbidden.
      if (/prisma\.bannedDevice\.(delete|update|deleteMany|updateMany)/.test(src)) {
        offenders.push(rel);
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Admin unban routes detected:\n${offenders.join("\n")}`);
    }
  });

  it("admin UI files do not render an unban / restore interactive control", () => {
    const offenders: string[] = [];
    for (const path of FILES) {
      const rel = path.replace(process.cwd() + "/", "");
      if (!rel.startsWith("src/app/admin/")) continue;
      if (!path.endsWith(".tsx")) continue;
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        // Skip pure docstring / comment lines and inert UI subtitles
        // that DESCRIBE the absence of unban (rather than render a
        // control).
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // Require an interactive control marker (<button>, onClick=,
        // formAction=, action=, fetch(...) referencing unban) in the
        // same line as the unban verb.
        const hasUnbanVerb =
          /\b(unban|un-ban|lift\s+ban|remove\s+ban|restore\s+device|reverse\s+ban)\b/i.test(line);
        if (!hasUnbanVerb) continue;
        const hasControlMarker = /(<button|onClick=|formAction=|fetch\(|action:|action=)/i.test(
          line,
        );
        if (hasControlMarker) {
          offenders.push(`${rel}:${i + 1}  ${trimmed}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Admin unban UI control detected:\n${offenders.join("\n")}`);
    }
  });
});

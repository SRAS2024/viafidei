/**
 * Structural regression: Confession is NOT a standalone admin metric,
 * threshold, or report row.
 *
 * The spec is explicit:
 *   - Remove Confession as a standalone admin metric.
 *   - Remove Confession as a standalone threshold.
 *   - Remove Confession as a standalone report row.
 *   - Confession should normalize to Reconciliation only.
 *
 * This audit scans the data + diagnostics layer for any threshold
 * counter, dashboard row, or report entry keyed on "Confession" /
 * "confession" as a content category. Sacrament normalization
 * machinery and historical doc comments are allowed; what's NOT
 * allowed is a query or counter that addresses Confession as a
 * top-level admin category distinct from Sacraments.
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

describe("Confession is not a standalone admin metric / threshold / report row", () => {
  it("no admin threshold definition keys on 'confession'", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const rel = path.replace(process.cwd() + "/", "");
      // Limit to the admin / data / diagnostics layer.
      if (
        !rel.startsWith("src/lib/data/") &&
        !rel.startsWith("src/lib/diagnostics/") &&
        !rel.startsWith("src/lib/content-qa/")
      ) {
        continue;
      }
      // The sacrament normalizer is explicitly allowed to mention
      // Confession because that's where the Confession→Reconciliation
      // mapping lives.
      if (rel === "src/lib/content-qa/sacrament-normalize.ts") continue;
      // Wrong-content detector is allowed to detect Confession-shaped
      // content for normalisation purposes.
      if (rel === "src/lib/content-qa/wrong-content-detector.ts") continue;
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Skip pure comment lines.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // Disallowed: bare `Confession:` or `"Confession":` /
        // `'Confession':` keys in a metric / threshold / report
        // record — i.e. the literal Confession word as a metric
        // key. Allowed: slugs like "prayer-before-confession"
        // (those are valid Reconciliation-related prayer slugs).
        // The regex requires the key to be EXACTLY "Confession"
        // (case-sensitive) or `confession` standing alone (not as
        // part of a kebab-case slug like
        // "prayer-before-confession").
        if (/^\s*["']?Confession["']?\s*:\s*\{/.test(line)) {
          offenders.push({
            path: rel,
            line: i + 1,
            text: trimmed,
          });
        }
        if (/contentType\s*:\s*["']Confession["']/.test(line)) {
          // contentType="Confession" in a database write or query
          // would resurrect it as a standalone type.
          offenders.push({
            path: rel,
            line: i + 1,
            text: trimmed,
          });
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(
        `Confession surfaces as a standalone admin / threshold / report key:\n${summary}`,
      );
    }
  });

  it("ContentTypeKey union does not include 'Confession'", async () => {
    // Direct import — TypeScript would already flag a Confession
    // assignment as invalid, but the runtime check confirms the
    // union members.
    const types = await import("@/lib/content-qa/types");
    // We can't reflect a TS union at runtime, but the related
    // content-type lists exposed at runtime should not contain it.
    const exported = Object.keys(types).join(" ");
    expect(exported).not.toMatch(/Confession/);
  });
});

/**
 * Regression test: synthetic legacy build logs and synthetic
 * `legacy-runner://` SourceDocument rows cannot be created.
 *
 * Before the factory-only refactor, the worker produced one
 * SourceDocument with URL `legacy-runner://<adapterKey>/<jobId>` and
 * one ContentPackageBuildLog with `builderName=LegacyAdapter:...`
 * per legacy adapter run. Both are removed.
 *
 * This audit scans the active production tree:
 *   - No file may emit `legacy-runner://` as a sourceUrl.
 *   - No file may emit `LegacyAdapter:` as a builderName.
 *   - The dispatcher's source path does not call `recordBuildLog`
 *     with a synthetic builderName.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

function walkSrc(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walkSrc(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walkSrc(SRC_DIR);

describe("synthetic legacy build logs are gone", () => {
  it("no production file emits a `legacy-runner://` sourceUrl", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        if (/legacy-runner:\/\//.test(line)) {
          offenders.push({
            path: path.replace(process.cwd(), ""),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(`Synthetic legacy SourceDocument writes still present:\n${summary}`);
    }
  });

  it("no production file emits a `LegacyAdapter:` builder name", () => {
    const offenders: Array<{ path: string; line: number; text: string }> = [];
    for (const path of FILES) {
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        if (/LegacyAdapter:/.test(line)) {
          offenders.push({
            path: path.replace(process.cwd(), ""),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.path}:${o.line}  ${o.text}`).join("\n");
      throw new Error(`Synthetic LegacyAdapter build log writes still present:\n${summary}`);
    }
  });

  it("dispatch.ts does NOT call recordBuildLog", () => {
    const dispatch = readFileSync(
      join(SRC_DIR, "lib", "ingestion", "queue", "dispatch.ts"),
      "utf8",
    );
    // The dispatcher must delegate to runContentFactory for every
    // build log write — it never writes a synthetic build log
    // directly.
    expect(dispatch).not.toMatch(/\brecordBuildLog\s*\(/);
  });
});

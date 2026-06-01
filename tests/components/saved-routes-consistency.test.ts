/**
 * The Save/Add button's kinds must stay in lockstep with the actual
 * /api/saved/* routes.
 *
 * The button fetches `/api/saved/<kind>`; if `kind` has no route the click
 * 404s. That exact bug existed — SaveButton listed a "parishes" kind with no
 * `/api/saved/parishes` route (and no saveable parish content). These tests
 * pin the SaveKind union and the SAVEABLE_CONTENT map to the routes that
 * actually exist, in both directions, so the button can never point at a
 * missing route and a route can never be silently orphaned.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SAVED_API_DIR = join(ROOT, "src", "app", "api", "saved");
const SAVE_BUTTON = readFileSync(
  join(ROOT, "src", "components", "profile", "SaveButton.tsx"),
  "utf8",
);
const SAVE_CONTENT = readFileSync(
  join(ROOT, "src", "components", "profile", "SaveContentButton.tsx"),
  "utf8",
);

/** Route segments that actually have a handler: src/app/api/saved/<seg>/route.ts */
const routeKinds = new Set(
  readdirSync(SAVED_API_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SAVED_API_DIR, e.name, "route.ts")))
    .map((e) => e.name),
);

/** Members of `export type SaveKind = "a" | "b" | …;` */
function saveKindUnion(): Set<string> {
  const m = /export type SaveKind =([^;]+);/.exec(SAVE_BUTTON);
  if (!m) throw new Error("SaveKind union not found in SaveButton.tsx");
  return new Set(Array.from(m[1]!.matchAll(/"([^"]+)"/g), (x) => x[1]!));
}

/** `kind:` values inside SAVEABLE_CONTENT */
function saveableKinds(): string[] {
  const block = /SAVEABLE_CONTENT[^{]*\{([\s\S]*?)\n\};/.exec(SAVE_CONTENT);
  if (!block) throw new Error("SAVEABLE_CONTENT not found in SaveContentButton.tsx");
  return Array.from(block[1]!.matchAll(/kind:\s*"([^"]+)"/g), (x) => x[1]!);
}

describe("Save button kinds match the /api/saved routes", () => {
  it("discovers the four saved routes (sanity)", () => {
    expect(routeKinds).toEqual(new Set(["prayers", "saints", "apparitions", "devotions"]));
  });

  it("SaveKind union exactly matches the existing routes (no orphans either way)", () => {
    expect(saveKindUnion()).toEqual(routeKinds);
  });

  it('no longer declares the routeless "parishes" kind', () => {
    expect(saveKindUnion().has("parishes")).toBe(false);
  });

  it("every saveable content type maps to a kind with a real route", () => {
    const kinds = saveableKinds();
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) expect(routeKinds.has(kind)).toBe(true);
  });
});

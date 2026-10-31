/**
 * @vitest-environment node
 *
 * The crucifix logo is the SAME artwork in both themes (no light/dark swap), so
 * every white in the drawing — Christ's perizoma and the INRI titulus board —
 * must be OPAQUE in the PNG. Background removal once knocked those whites out to
 * transparency: the light theme's cream showed through and hid it, but the dark
 * theme's near-black showed through too, so the loincloth and the sign turned
 * black. The regions below sit well inside the cloth and the board.
 *
 * The converse is pinned as well: the background around the cross stays
 * transparent, so the fix can never become an opaque cream box in dark mode.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "public");
const LOGO = path.join(PUBLIC_DIR, "crucifix-logo.png");

// Coordinates are in the artwork's own 360×491 canvas.
const WHITE_MATERIAL: Record<string, sharp.Region> = {
  "INRI titulus board": { left: 152, top: 18, width: 56, height: 40 },
  "perizoma waist band": { left: 148, top: 254, width: 74, height: 14 },
  "perizoma left flap": { left: 152, top: 288, width: 12, height: 36 },
  "perizoma right knot": { left: 212, top: 262, width: 12, height: 30 },
};
const BACKGROUND: Record<string, sharp.Region> = {
  "top-left corner": { left: 0, top: 0, width: 20, height: 60 },
  "bottom-left corner": { left: 0, top: 400, width: 100, height: 80 },
};

async function alphaCounts(file: string, region: sharp.Region) {
  const data = await sharp(file).ensureAlpha().extract(region).raw().toBuffer();
  let opaque = 0;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 255) opaque++;
    else if (data[i] === 0) transparent++;
  }
  return { opaque, transparent, total: region.width * region.height };
}

describe("crucifix logo artwork", () => {
  it("keeps its 360×491 canvas (the regions below are in its coordinates)", async () => {
    const meta = await sharp(LOGO).metadata();
    expect([meta.width, meta.height]).toEqual([360, 491]);
  });

  for (const [name, region] of Object.entries(WHITE_MATERIAL)) {
    it(`the ${name} is opaque, so the dark theme cannot show through it`, async () => {
      const { opaque, total } = await alphaCounts(LOGO, region);
      expect(opaque).toBe(total);
    });
  }

  for (const [name, region] of Object.entries(BACKGROUND)) {
    it(`the ${name} stays transparent, so there is no box behind the cross`, async () => {
      const { transparent, total } = await alphaCounts(LOGO, region);
      expect(transparent).toBe(total);
    });
  }

  it("the unused -dark copy stays identical, so neither file carries the old artwork", async () => {
    const [light, dark] = await Promise.all([
      readFile(LOGO),
      readFile(path.join(PUBLIC_DIR, "crucifix-logo-dark.png")),
    ]);
    expect(light.equals(dark)).toBe(true);
  });
});

/**
 * @vitest-environment node
 *
 * The share-image route renders the branded Open Graph card (the crucifix mark
 * with the content item's title in it) that a shared link unfurls as. These
 * tests pin that it produces a real PNG for normal, long, accented, and missing
 * titles — so a shared card always shows the title, never a broken/blank image.
 */
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/og/route";

const PNG_MAGIC = "89504e47";

async function render(query: string) {
  const res = GET(new Request(`https://etviafidei.com/api/og${query}`));
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
}

describe("share image route (/api/og)", () => {
  it("renders a PNG card for a content title", async () => {
    const { res, buf } = await render("?title=Litany+of+Humility&type=Litany");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age");
    expect(buf.subarray(0, 4).toString("hex")).toBe(PNG_MAGIC);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("renders even with no title (the branded default)", async () => {
    const { res, buf } = await render("");
    expect(res.status).toBe(200);
    expect(buf.subarray(0, 4).toString("hex")).toBe(PNG_MAGIC);
  });

  it("handles a very long title and an accented title without failing", async () => {
    const long = await render(
      `?title=${encodeURIComponent("The Most Holy Rosary of the Blessed Virgin Mary and Its Joyful Mysteries")}&type=Guide`,
    );
    expect(long.res.status).toBe(200);
    expect(long.buf.subarray(0, 4).toString("hex")).toBe(PNG_MAGIC);

    const accent = await render(
      `?title=${encodeURIComponent("Saint Thérèse of the Child Jesus")}&type=Saint`,
    );
    expect(accent.res.status).toBe(200);
    expect(accent.buf.subarray(0, 4).toString("hex")).toBe(PNG_MAGIC);
  });
});

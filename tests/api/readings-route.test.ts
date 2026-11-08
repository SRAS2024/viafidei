/**
 * /api/readings answers the liturgical calendar with one Mass's readings: what that
 * Mass's own readings page would show, asked for with the page's own parameters.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/client", () => ({
  prisma: { dailyReading: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { GET } from "@/app/api/readings/route";
import type { ReadingsView } from "@/app/liturgy/readings/readings-view";

const ask = (query: string) =>
  GET(new NextRequest(new Request(`http://localhost/api/readings?${query}`)));

async function view(query: string): Promise<ReadingsView> {
  const res = await ask(query);
  expect(res.status).toBe(200);
  return (await res.json()) as ReadingsView;
}

describe("/api/readings", () => {
  it("refuses a date the calendar does not cover", async () => {
    for (const date of ["", "garbage", "2026-02-30", "1850-01-01"]) {
      expect((await ask(`date=${date}`)).status, date).toBe(400);
    }
  });

  it("answers with the day's own Mass, as its page would show it", async () => {
    const saturday = await view("date=2026-11-07");
    expect(saturday.isVigil).toBe(false);
    expect(saturday.lectionaryNumber).toBe("490");
    expect(saturday.href).toBe("/liturgy/readings?date=2026-11-07&mass=day");
    expect(saturday.sections.length).toBeGreaterThan(0);
  });

  it("gives the evening's Mass to a visitor's afternoon, on a date that has one", async () => {
    const saturday = await view("date=2026-11-07&prefer=evening");
    expect(saturday.isVigil).toBe(true);
    expect(saturday.title).toBe("Vigil of the 32nd Sunday in Ordinary Time");
    expect(saturday.href).toBe("/liturgy/readings?date=2026-11-07&mass=vigil");

    // A Thursday has no evening Mass: its own is the answer, whatever the hour.
    const thursday = await view("date=2026-11-05&prefer=evening");
    expect(thursday.isVigil).toBe(false);
  });

  it("lets a named Mass win over the afternoon", async () => {
    const own = await view("date=2026-11-07&mass=day&prefer=evening");
    expect(own.isVigil).toBe(false);
    expect(own.lectionaryNumber).toBe("490");
  });

  it("reads the readings page's other choices", async () => {
    const night = await view("date=2026-12-25&variant=night");
    expect(night.activeVariant).toBe("night");
    const thursday = await view("date=2027-05-06&ascension=thursday");
    expect(thursday.title).toBe("The Ascension of the Lord");
    // A formulary the tables could not name is left out, not passed on.
    const odd = await view("date=2026-12-25&variant=%3Cscript%3E");
    expect(odd.activeVariant).not.toBe("<script>");
  });

  it("lets a shared cache keep a date's readings for a while", async () => {
    const res = await ask("date=2026-11-07");
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=600, stale-while-revalidate=3600",
    );
  });
});

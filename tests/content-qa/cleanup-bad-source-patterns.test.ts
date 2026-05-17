/**
 * Bad-source pattern coverage. Section 12 of the strict QA spec
 * requires explicit tests proving each bad-source example is deleted:
 *
 *   - prayer livestream
 *   - saint parish page
 *   - novena event announcement
 *   - sacrament registration page
 *   - rosary livestream
 *   - history news article
 *   - liturgy mass schedule
 *   - parish staff page
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runStrictContentCleanup } from "@/lib/content-qa/cleanup";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
    prismaMock.dailyLiturgy,
  ]) {
    m.findMany.mockResolvedValue([]);
    m.delete.mockResolvedValue({});
    m.update.mockResolvedValue({});
  }
  prismaMock.rejectedContentLog.createMany.mockResolvedValue({ count: 0 });
  prismaMock.rejectedContentLog.create.mockResolvedValue({});
  prismaMock.dataManagementLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

async function runStrict() {
  return runStrictContentCleanup({
    policy: { deleteAllInvalid: true, mode: "all_catalog_rows" },
  });
}

describe("bad source patterns are deleted", () => {
  it("prayer livestream is deleted with wrong_content category", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-live",
        slug: "rosary-livestream",
        defaultTitle: "Watch Live: Rosary Tonight",
        body: "Join us live tonight on YouTube. Click here to register now for the livestream.",
        category: "Daily",
        prayerType: "Marian prayer",
        externalSourceKey: "https://www.vatican.va/x",
        sourceUrl: "https://www.vatican.va/x",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "plive",
      },
    ]);
    await runStrict();
    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p-live" } });
    const rejections = prismaMock.rejectedContentLog.createMany.mock.calls[0][0].data;
    expect(rejections[0].failureCategory).toBe("wrong_content");
  });

  it("saint parish page is deleted", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s-parish",
        slug: "saint-mary-parish",
        canonicalName: "Saint Mary Parish",
        biography:
          "Welcome to our parish bulletin. Office hours: Mon-Fri 9-5. Mass schedule: Sunday 8am, 10am, 12pm. Click here for the donation page.",
        patronages: [],
        feastDay: null,
        feastMonth: null,
        feastDayOfMonth: null,
        externalSourceKey: "https://parishesonline.com/mary",
        sourceUrl: "https://parishesonline.com/mary",
        sourceHost: "parishesonline.com",
        status: "PUBLISHED",
        contentChecksum: "sp",
      },
    ]);
    await runStrict();
    expect(prismaMock.saint.delete).toHaveBeenCalledWith({ where: { id: "s-parish" } });
  });

  it("novena event announcement is deleted", async () => {
    prismaMock.devotion.findMany.mockResolvedValue([
      {
        id: "n-event",
        slug: "novena-event-announcement",
        title: "Upcoming Novena Event - Register Now!",
        summary: "Join us for our parish novena event. Click here to register now for the event.",
        background: "Click here to register now for tickets. Event date Saturday.",
        practiceText: null,
        practiceInstructions: null,
        durationMinutes: null,
        devotionType: null,
        subtype: "Novena",
        packageMetadata: null,
        externalSourceKey: "https://parish.example/novena",
        sourceUrl: "https://parish.example/novena",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "nev",
      },
    ]);
    await runStrict();
    expect(prismaMock.devotion.delete).toHaveBeenCalledWith({ where: { id: "n-event" } });
  });

  it("sacrament registration page is deleted", async () => {
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([
      {
        id: "sac-reg",
        slug: "baptism-registration",
        title: "Baptism Class Registration",
        summary: "Register now for our parish baptism preparation classes. Click here to register.",
        bodyText:
          "Click here to register now for the upcoming baptism class. Tickets available, registration deadline March 1.",
        kind: "GENERAL",
        subtype: null,
        sacramentKey: null,
        sacramentGroup: null,
        steps: null,
        durationDays: null,
        packageMetadata: null,
        externalSourceKey: "https://parish.example/baptism",
        sourceUrl: "https://parish.example/baptism",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "sr",
      },
    ]);
    await runStrict();
    expect(prismaMock.spiritualLifeGuide.delete).toHaveBeenCalledWith({
      where: { id: "sac-reg" },
    });
  });

  it("rosary livestream guide is deleted", async () => {
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([
      {
        id: "ros-live",
        slug: "rosary-livestream",
        title: "Watch Live Rosary",
        summary: "Live rosary every Sunday. Watch on YouTube.",
        bodyText: "Click here to watch live on Facebook. Live broadcast every Sunday at 7pm.",
        kind: "ROSARY",
        subtype: "Rosary",
        sacramentKey: null,
        sacramentGroup: null,
        steps: null,
        durationDays: null,
        packageMetadata: null,
        externalSourceKey: "https://parish.example/rosary-live",
        sourceUrl: "https://parish.example/rosary-live",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "rl",
      },
    ]);
    await runStrict();
    expect(prismaMock.spiritualLifeGuide.delete).toHaveBeenCalledWith({
      where: { id: "ros-live" },
    });
  });

  it("history news article is deleted", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "h-news",
        slug: "pope-visits-city",
        title: "Pope Visits City - News Article",
        kind: "GENERAL",
        body: "Press release: The Pope visited the city today. Read more in our breaking news report and news story coverage.",
        summary: "Press release news article.",
        historyType: "Council",
        dateOrEra: "2024",
        packageMetadata: null,
        externalSourceKey: "https://example.com/news",
        sourceUrl: "https://example.com/news",
        sourceHost: "example.com",
        status: "PUBLISHED",
        contentChecksum: "hn",
      },
    ]);
    await runStrict();
    expect(prismaMock.liturgyEntry.delete).toHaveBeenCalledWith({ where: { id: "h-news" } });
  });

  it("liturgy mass schedule is deleted", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "l-mass",
        slug: "sunday-mass-times",
        title: "Sunday Mass Times - Parish Schedule",
        kind: "GENERAL",
        body: "Mass schedule: Sunday 8am, 10am, 12pm. Daily Mass times: 7am weekdays. Times of Mass posted weekly.",
        summary: "Mass schedule listings.",
        historyType: null,
        dateOrEra: null,
        packageMetadata: null,
        externalSourceKey: "https://parish.example/mass",
        sourceUrl: "https://parish.example/mass",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "lm",
      },
    ]);
    await runStrict();
    expect(prismaMock.liturgyEntry.delete).toHaveBeenCalledWith({ where: { id: "l-mass" } });
  });

  it("parish staff page is deleted", async () => {
    prismaMock.parish.findMany.mockResolvedValue([
      {
        id: "p-staff",
        slug: "parish-staff",
        name: "Staff Directory - Meet Our Team",
        address: null,
        city: null,
        region: null,
        country: null,
        diocese: null,
        websiteUrl: null,
        externalSourceKey: "https://parish.example/staff",
        sourceUrl: "https://parish.example/staff",
        sourceHost: "parish.example",
        status: "PUBLISHED",
        contentChecksum: "ps",
      },
    ]);
    await runStrict();
    expect(prismaMock.parish.delete).toHaveBeenCalledWith({ where: { id: "p-staff" } });
  });
});

describe("valid content with harmless context is NOT deleted", () => {
  it("a saint biography mentioning a parish is kept", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s-ok-parish",
        slug: "saint-john-vianney",
        canonicalName: "Saint John Vianney",
        biography:
          "Saint John Vianney, the Curé d'Ars, was born in 1786. He was assigned as pastor of the parish of Ars in 1818, where he spent the rest of his life as a priest. He was canonized in 1925 by Pope Pius XI and is the patron of parish priests.",
        patronages: ["parish priests"],
        feastDay: "August 4",
        feastMonth: 8,
        feastDayOfMonth: 4,
        externalSourceKey: "https://www.vatican.va/john-vianney",
        sourceUrl: "https://www.vatican.va/john-vianney",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "sjv",
      },
    ]);
    await runStrict();
    expect(prismaMock.saint.delete).not.toHaveBeenCalled();
    expect(prismaMock.saint.update).toHaveBeenCalledTimes(1);
  });

  it("a history entry that mentions a modern date but is not a news article is kept", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "h-ok-modern",
        slug: "second-vatican-council",
        title: "The Second Vatican Council",
        kind: "COUNCIL_TIMELINE",
        body: "The Second Vatican Council was held from 1962 to 1965. Convened by Pope John XXIII in 1962 AD, it was the twenty-first ecumenical council of the Catholic Church and promulgated sixteen documents on the liturgy, the Church, and revelation. The council shaped Catholic doctrine and life for decades to come.",
        summary: "The Second Vatican Council, 1962-1965.",
        historyType: "Council",
        dateOrEra: "1962-1965",
        packageMetadata: null,
        externalSourceKey: "https://www.vatican.va/council2",
        sourceUrl: "https://www.vatican.va/council2",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "hvm",
      },
    ]);
    await runStrict();
    expect(prismaMock.liturgyEntry.delete).not.toHaveBeenCalled();
  });

  it("a liturgy entry that mentions 'Mass' as part of liturgical formation is kept", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "l-ok-mass",
        slug: "order-of-mass",
        title: "The Order of Mass",
        kind: "GENERAL",
        body: "The Order of Mass is the structure that governs the celebration of the Eucharist. The Mass is divided into the Liturgy of the Word and the Liturgy of the Eucharist. The Eucharistic prayer is the heart of the Mass.",
        summary: "Liturgical formation on the structure of the Mass.",
        historyType: null,
        dateOrEra: null,
        packageMetadata: null,
        externalSourceKey: "https://www.vatican.va/order-mass",
        sourceUrl: "https://www.vatican.va/order-mass",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "lom",
      },
    ]);
    await runStrict();
    expect(prismaMock.liturgyEntry.delete).not.toHaveBeenCalled();
  });
});

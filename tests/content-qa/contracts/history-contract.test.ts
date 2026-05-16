import { describe, expect, it } from "vitest";
import { validateHistoryPackage } from "@/lib/content-qa/contracts/history";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const VATICAN = staticPurposesForHost("vatican.va");

describe("HistoryPackage contract", () => {
  it("accepts a council package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "council-of-trent",
        title: "Council of Trent",
        sourceUrl: "https://www.vatican.va/council-of-trent",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Council",
          title: "Council of Trent",
          dateOrEra: "1545-1563",
          authorityOrInstitution: "Pope Paul III",
          summary: "An ecumenical council that responded to the Protestant Reformation.",
          body: "The Council of Trent was the 19th ecumenical council of the Catholic Church. Convened in 1545 by Pope Paul III, it issued decrees on doctrine and reform. Its teachings remain part of the magisterium of the Church.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("accepts an encyclical package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "encyclical-laudato-si",
        title: "Laudato si'",
        sourceUrl: "https://www.vatican.va/laudato-si",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Encyclical",
          title: "Laudato si'",
          dateOrEra: "2015",
          authorityOrInstitution: "Pope Francis",
          summary: "An encyclical on the care of our common home.",
          body: "Encyclical letter of Pope Francis published in 2015. The pope addresses ecological concerns from a Catholic perspective. The encyclical draws on Catholic social doctrine.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("accepts a schism package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "east-west-schism",
        title: "East-West Schism",
        sourceUrl: "https://www.vatican.va/schism",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Schism",
          title: "East-West Schism",
          dateOrEra: "1054 AD",
          authorityOrInstitution: "Patriarch Michael Cerularius and Pope Leo IX",
          summary: "The Great Schism of 1054 between East and West.",
          body: "In 1054 AD, the schism between the Eastern Orthodox Church and the Catholic Church became formal. The pope and the patriarch excommunicated each other. The schism continues to this day.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("accepts a religious order founding package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "founding-of-the-jesuits",
        title: "Founding of the Society of Jesus",
        sourceUrl: "https://www.vatican.va/jesuit-founding",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Religious order founding",
          title: "Founding of the Society of Jesus",
          dateOrEra: "1540",
          authorityOrInstitution: "Pope Paul III",
          summary: "Founding of the Jesuits by Saint Ignatius of Loyola.",
          body: "Founded in 1540 by Saint Ignatius of Loyola. The pope approved the order. The Jesuit order has played a major historical role in the Catholic Church and the founding of schools and missions.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("accepts a catechism package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "catechism-of-the-catholic-church",
        title: "Catechism of the Catholic Church",
        sourceUrl: "https://www.vatican.va/catechism",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Catechism",
          title: "Catechism of the Catholic Church",
          dateOrEra: "1992",
          authorityOrInstitution: "Pope John Paul II",
          summary: "The official summary of Catholic doctrine.",
          body: "Published in 1992 by Pope John Paul II. The catechism of the catholic church is the official summary of the doctrine taught by the magisterium.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("accepts a canon law package", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "code-of-canon-law-1983",
        title: "1983 Code of Canon Law",
        sourceUrl: "https://www.vatican.va/canon-law",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Code of Canon Law",
          title: "1983 Code of Canon Law",
          dateOrEra: "1983",
          authorityOrInstitution: "Pope John Paul II",
          summary: "The current code of canon law.",
          body: "Promulgated in 1983 by Pope John Paul II. The code of canon law governs the discipline of the Catholic Church and reflects the doctrine of the magisterium.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes a news article", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "news-article",
        title: "Pope visits Africa",
        sourceUrl: "https://www.vatican.va/news",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Major Church event",
          title: "Pope visits Africa",
          dateOrEra: "2026",
          summary: "Breaking news: Pope's visit.",
          body: "Breaking news story: the pope's visit to Africa is reported by news agencies worldwide. Published today by news outlets.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a parish event", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "parish-fundraiser",
        title: "Parish Fundraiser",
        sourceUrl: "https://www.vatican.va/event",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Major Church event",
          title: "Parish Fundraiser",
          dateOrEra: "2026",
          summary: "Parish fundraising event.",
          body: "Annual parish fundraiser. Conference registration available.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a local parish council meeting", () => {
    const result = validateHistoryPackage(
      {
        contentType: "History",
        slug: "parish-council",
        title: "Parish Council Meeting",
        sourceUrl: "https://www.vatican.va/local",
        sourceHost: "vatican.va",
        payload: {
          historyType: "Council",
          title: "Parish Council Meeting",
          dateOrEra: "2026",
          summary: "Local parish council meeting minutes.",
          body: "Minutes from the parish council meeting. The parish council voted on the budget.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });
});

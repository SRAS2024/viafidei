import { describe, expect, it } from "vitest";
import { strictValidate } from "@/lib/ingestion/strict-validate";
import type {
  IngestedPrayer,
  IngestedSaint,
  IngestedParish,
  IngestedLiturgy,
  IngestedGuide,
} from "@/lib/ingestion/types";

const validPrayer: IngestedPrayer = {
  kind: "prayer",
  slug: "our-father",
  defaultTitle: "Our Father",
  category: "traditional",
  body: "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done on earth as it is in heaven. Amen.",
  externalSourceKey: "vatican.va:our-father",
};

const validSaint: IngestedSaint = {
  kind: "saint",
  slug: "saint-augustine",
  canonicalName: "Saint Augustine of Hippo",
  feastDay: "August 28",
  feastMonth: 8,
  feastDayOfMonth: 28,
  patronages: ["theologians", "philosophers"],
  biography:
    "Saint Augustine of Hippo was a Christian theologian and philosopher of Berber origin. He was the bishop of Hippo Regius and one of the most important Church Fathers in Western Christianity.",
  externalSourceKey: "vatican.va:saint-augustine",
};

const validParish: IngestedParish = {
  kind: "parish",
  slug: "st-marys-rome",
  name: "St. Mary's",
  address: "Piazza S. Pietro",
  city: "Rome",
  region: "Lazio",
  country: "Italy",
  diocese: "Diocese of Rome",
  externalSourceKey: "vatican.va:parishes:st-marys",
};

describe("strictValidate — prayers", () => {
  it("accepts a well-formed prayer", () => {
    const result = strictValidate(validPrayer);
    expect(result.decision).toBe("accept");
  });
  it("rejects when body is too short", () => {
    const result = strictValidate({ ...validPrayer, body: "Short." });
    expect(result.decision).toBe("reject");
  });
  it("reviews when source is missing", () => {
    const result = strictValidate({ ...validPrayer, externalSourceKey: undefined });
    expect(result.decision).toBe("review");
  });
});

describe("strictValidate — saints", () => {
  it("accepts a well-formed saint", () => {
    const result = strictValidate(validSaint);
    expect(result.decision).toBe("accept");
  });
  it("rejects when biography is too short", () => {
    const result = strictValidate({ ...validSaint, biography: "He was a saint." });
    expect(result.decision).toBe("reject");
  });
  it("reviews when patronages are empty", () => {
    const result = strictValidate({ ...validSaint, patronages: [] });
    expect(result.decision).toBe("review");
  });
  it("reviews when feast month is invalid", () => {
    const result = strictValidate({
      ...validSaint,
      feastMonth: 13,
    });
    expect(result.decision).toBe("review");
  });
});

describe("strictValidate — parishes", () => {
  it("accepts a well-formed parish", () => {
    const result = strictValidate(validParish);
    expect(result.decision).toBe("accept");
  });
  it("reviews when address is missing", () => {
    const result = strictValidate({ ...validParish, address: undefined });
    expect(result.decision).toBe("review");
  });
  it("reviews when US parish has no region", () => {
    const result = strictValidate({
      ...validParish,
      country: "USA",
      region: undefined,
    });
    expect(result.decision).toBe("review");
  });
});

describe("strictValidate — church documents", () => {
  const validDoc: IngestedLiturgy = {
    kind: "liturgy",
    slug: "encyclical-laudato-si",
    liturgyKind: "GENERAL",
    title: "Laudato Si'",
    body: `Encyclical letter of the Holy Father Pope Francis on care for our common home, dated 24 May 2015. The encyclical addresses the urgent challenges to the world. The Pope writes from the magisterium of the Catholic Church about creation and human responsibility for the environment. This document is part of the official Catholic teaching tradition.`,
    externalSourceKey: "vatican.va:laudato-si",
  };
  it("accepts a well-formed church document", () => {
    const result = strictValidate(validDoc);
    expect(result.decision).toBe("accept");
  });
  it("reviews when authoring-authority vocabulary is missing", () => {
    // Long enough to pass the 200-char minimum, but with no authority
    // vocabulary so it gets diverted to review.
    const noAuthorityBody = `${"This is a long piece of text about random topics. There are no signal words here whatsoever. ".repeat(4)}`;
    const result = strictValidate({
      ...validDoc,
      body: noAuthorityBody,
    });
    expect(result.decision).toBe("review");
  });
});

describe("strictValidate — sacraments / consecrations", () => {
  const validGuide: IngestedGuide = {
    kind: "guide",
    slug: "sacrament-baptism",
    guideKind: "GENERAL",
    title: "Sacrament of Baptism",
    summary:
      "Baptism is the sacrament of initiation through which we receive sanctifying grace and the indwelling of the Holy Spirit, becoming a member of the Catholic Church.",
    externalSourceKey: "vatican.va:sacrament-baptism",
  };
  it("accepts a well-formed sacrament guide", () => {
    const result = strictValidate(validGuide);
    expect(result.decision).toBe("accept");
  });
  it("reviews when doctrinal vocabulary is absent", () => {
    const result = strictValidate({
      ...validGuide,
      summary:
        "This is a summary about something general that does not mention any Catholic concepts or doctrinal terms whatsoever to fail the heuristic check.",
    });
    expect(result.decision).toBe("review");
  });
});

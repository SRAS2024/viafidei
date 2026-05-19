/**
 * Real source fixtures for every major content type (spec §5).
 *
 * Each major content type carries three named fixture buckets:
 *
 *   - valid    — 5 real-shaped source documents that should produce
 *                a complete public package.
 *   - invalid  — 5 source documents that should fail with a precise
 *                wrong_content / missing-field reason.
 *   - messy    — 5 source documents that include real-world noise
 *                (intros, footers, repeated titles, livestream
 *                callouts) and should produce a complete package
 *                AFTER normalization strips the noise.
 *
 * Fixtures here power:
 *   - the canary builder (one per content type)
 *   - the builder weakness panel (which fixtures fail repeatedly?)
 *   - the deployment-verification gate (no deploy goes out unless
 *     every "valid" fixture builds + every "invalid" fixture
 *     rejects + every "messy" fixture builds after normalization).
 */

import type { ContentTypeKey, SourceDocumentSnapshot } from "./types";

export type BuilderFixtureKind = "valid" | "invalid" | "messy";

export type BuilderFixture = {
  name: string;
  kind: BuilderFixtureKind;
  contentType: ContentTypeKey;
  document: SourceDocumentSnapshot;
  /** Expected build outcome for the "valid" case (built_complete_package). */
  expectedOutcome?: string;
  /** Optional expected failure reason for the "invalid" case. */
  expectedFailureReason?: string;
};

function doc(opts: {
  url: string;
  host: string;
  title: string;
  body: string;
  purpose: string;
  paragraphs?: ReadonlyArray<string>;
  headings?: ReadonlyArray<{ level: number; text: string }>;
}): SourceDocumentSnapshot {
  return {
    sourceUrl: opts.url,
    sourceHost: opts.host,
    sourceTitle: opts.title,
    rawBody: opts.body,
    cleanedBody: opts.body,
    headings: opts.headings ?? [{ level: 1, text: opts.title }],
    paragraphs: opts.paragraphs ?? opts.body.split(/\n\n+/),
    sourcePurposes: { [opts.purpose]: true },
  };
}

// ─── Prayer ──────────────────────────────────────────────────────────
export const PRAYER_FIXTURES: ReadonlyArray<BuilderFixture> = [
  // Valid
  {
    name: "our-father",
    kind: "valid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/our-father",
      host: "vatican.va",
      title: "Our Father",
      body:
        "Our Father, who art in heaven, hallowed be thy name. " +
        "Thy kingdom come, thy will be done on earth as it is in heaven. " +
        "Give us this day our daily bread, and forgive us our trespasses, " +
        "as we forgive those who trespass against us. Amen.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "hail-mary",
    kind: "valid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/hail-mary",
      host: "vatican.va",
      title: "Hail Mary",
      body:
        "Hail Mary, full of grace, the Lord is with thee. " +
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. " +
        "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "glory-be",
    kind: "valid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/glory-be",
      host: "vatican.va",
      title: "Glory Be",
      body:
        "Glory be to the Father, and to the Son, and to the Holy Spirit. " +
        "As it was in the beginning, is now, and ever shall be, world without end. Amen.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "apostles-creed",
    kind: "valid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/apostles-creed",
      host: "vatican.va",
      title: "The Apostles' Creed",
      body:
        "I believe in God, the Father almighty, Creator of heaven and earth, " +
        "and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, " +
        "born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; " +
        "he descended into hell; on the third day he rose again from the dead; " +
        "he ascended into heaven, and is seated at the right hand of God the Father almighty; " +
        "from there he will come to judge the living and the dead. Amen.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "act-of-contrition",
    kind: "valid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/act-of-contrition",
      host: "vatican.va",
      title: "Act of Contrition",
      body:
        "O my God, I am heartily sorry for having offended Thee, and I detest all my sins " +
        "because I dread the loss of heaven and the pains of hell, but most of all because they " +
        "offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, " +
        "with the help of Thy grace, to confess my sins, to do penance, and to amend my life. Amen.",
      purpose: "canIngestPrayers",
    }),
  },
  // Invalid
  {
    name: "livestream-page",
    kind: "invalid",
    contentType: "Prayer",
    document: doc({
      url: "https://parish.example/livestream",
      host: "parish.example",
      title: "Watch Live: Daily Rosary",
      body:
        "Watch live every day at 7pm as our parish prays the Rosary together. " +
        "Click here to register for tonight's livestream. Join us on YouTube.",
      purpose: "canIngestPrayers",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "article-about-prayer",
    kind: "invalid",
    contentType: "Prayer",
    document: doc({
      url: "https://blog.example/why-prayer-matters",
      host: "blog.example",
      title: "Why Prayer Matters",
      body:
        "According to scholars, prayer has been practised for thousands of years. " +
        "Have you ever wondered why we pray? In this article, we explore the history. " +
        "Click here to subscribe to our newsletter for more.",
      purpose: "canIngestPrayers",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestPrayers",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "parish-event-listing",
    kind: "invalid",
    contentType: "Prayer",
    document: doc({
      url: "https://parish.example/events",
      host: "parish.example",
      title: "Prayer Service Tonight",
      body:
        "Join us tonight at 7pm for a special prayer service in the parish hall. " +
        "Light refreshments will be served afterward. RSVP required.",
      purpose: "canIngestPrayers",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Prayer",
    document: doc({
      url: "https://random.example/prayer",
      host: "random.example",
      title: "Some Prayer",
      body: "Some text.",
      purpose: "", // no purpose flag
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy (should build after normalization)
  {
    name: "noisy-our-father",
    kind: "messy",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/our-father-messy",
      host: "vatican.va",
      title: "Our Father",
      body:
        "Below is the prayer:\n" +
        "Our Father\n" +
        "Our Father, who art in heaven, hallowed be thy name. Amen!!\n" +
        "© 2024 EWTN\n" +
        "All rights reserved.\n" +
        "Visit https://ewtn.com for more.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "intro-and-footer",
    kind: "messy",
    contentType: "Prayer",
    document: doc({
      url: "https://catholic.org/prayers/hail-mary-messy",
      host: "catholic.org",
      title: "Hail Mary",
      body:
        "Pray this with reverence:\n" +
        "Hail Mary, full of grace, the Lord is with thee. Amen.\n" +
        "Source: Vatican.va\n" +
        "Imprimatur: Bishop John Doe, 1965",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "repeated-title",
    kind: "messy",
    contentType: "Prayer",
    document: doc({
      url: "https://usccb.org/prayers/glory-be-messy",
      host: "usccb.org",
      title: "Glory Be",
      body:
        "Glory Be\n" +
        "Glory Be\n" +
        "Glory be to the Father, and to the Son, and to the Holy Spirit. Amen.\n" +
        "Used with permission.",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "punctuation-runs",
    kind: "messy",
    contentType: "Prayer",
    document: doc({
      url: "https://vatican.va/prayers/credo-messy",
      host: "vatican.va",
      title: "Apostles' Creed",
      body: "I believe in God, the Father almighty!!! Creator of heaven and earth!!!! Amen!!",
      purpose: "canIngestPrayers",
    }),
  },
  {
    name: "trailing-paragraph-spam",
    kind: "messy",
    contentType: "Prayer",
    document: doc({
      url: "https://catholicculture.org/prayers/contrition-messy",
      host: "catholicculture.org",
      title: "Act of Contrition",
      body:
        "O my God, I am heartily sorry for having offended Thee. Amen.\n\n\n\n" +
        "Read more at https://catholicculture.org\n" +
        "Subscribe to our newsletter.\n",
      purpose: "canIngestPrayers",
    }),
  },
];

// ─── Saint ───────────────────────────────────────────────────────────
export const SAINT_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "thomas-aquinas",
    kind: "valid",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/thomas-aquinas",
      host: "vatican.va",
      title: "St. Thomas Aquinas",
      body:
        "St. Thomas Aquinas was a Dominican friar and Doctor of the Church. " +
        "He was canonized in 1323. His feast day is January 28. " +
        "He is the patron saint of theologians and Catholic universities. " +
        "He was born in 1225 and died in 1274.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "francis-of-assisi",
    kind: "valid",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/francis-of-assisi",
      host: "vatican.va",
      title: "St. Francis of Assisi",
      body:
        "St. Francis of Assisi was a Franciscan friar and founder of the Franciscan order. " +
        "He was canonized in 1228. His feast day is October 4. " +
        "He is the patron saint of animals, the environment, and Italy.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "therese-of-lisieux",
    kind: "valid",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/therese-of-lisieux",
      host: "vatican.va",
      title: "St. Thérèse of Lisieux",
      body:
        "St. Thérèse of Lisieux was a Carmelite nun. " +
        "She was canonized in 1925 and declared a Doctor of the Church in 1997. " +
        "Her feast day is October 1. She is the patron saint of missionaries.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "ignatius-of-loyola",
    kind: "valid",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/ignatius-of-loyola",
      host: "vatican.va",
      title: "St. Ignatius of Loyola",
      body:
        "St. Ignatius of Loyola was the founder of the Society of Jesus (the Jesuits). " +
        "He was canonized in 1622. His feast day is July 31.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "padre-pio",
    kind: "valid",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/padre-pio",
      host: "vatican.va",
      title: "St. Padre Pio",
      body:
        "St. Padre Pio was a Capuchin friar, known for the stigmata. " +
        "He was canonized in 2002. His feast day is September 23.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "st-patricks-cathedral",
    kind: "invalid",
    contentType: "Saint",
    document: doc({
      url: "https://stpatricks.example/about",
      host: "stpatricks.example",
      title: "St. Patrick's Cathedral",
      body: "St. Patrick's Cathedral is a famous Catholic church in midtown Manhattan.",
      purpose: "canIngestSaints",
    }),
    expectedFailureReason: "institution",
  },
  {
    name: "st-thomas-school",
    kind: "invalid",
    contentType: "Saint",
    document: doc({
      url: "https://stthomas.example/admissions",
      host: "stthomas.example",
      title: "St. Thomas Aquinas Catholic School",
      body: "Welcome to our school. Enrollment for the 2026 school year is now open.",
      purpose: "canIngestSaints",
    }),
    expectedFailureReason: "institution",
  },
  {
    name: "st-joseph-hospital",
    kind: "invalid",
    contentType: "Saint",
    document: doc({
      url: "https://sjh.example",
      host: "sjh.example",
      title: "St. Joseph Hospital",
      body: "St. Joseph Hospital is a 250-bed acute care medical center.",
      purpose: "canIngestSaints",
    }),
    expectedFailureReason: "institution",
  },
  {
    name: "staff-directory",
    kind: "invalid",
    contentType: "Saint",
    document: doc({
      url: "https://parish.example/staff",
      host: "parish.example",
      title: "St. Mary's Parish — Staff Directory",
      body:
        "Father John Doe — Pastor. Phone: (212) 555-1234. Email: father@stmarys.org. " +
        "Office hours: Monday-Friday. Mass schedule: Saturday 5pm, Sunday 9am.",
      purpose: "canIngestSaints",
    }),
    expectedFailureReason: "staff_or_bulletin",
  },
  {
    name: "parish-livestream",
    kind: "invalid",
    contentType: "Saint",
    document: doc({
      url: "https://parish.example/live",
      host: "parish.example",
      title: "St. Mary's Parish — Watch Live",
      body: "Join us live every Sunday at 10am. Click here to register for tonight's livestream.",
      purpose: "canIngestSaints",
    }),
    expectedFailureReason: "livestream",
  },
  // Messy
  {
    name: "messy-aquinas",
    kind: "messy",
    contentType: "Saint",
    document: doc({
      url: "https://vatican.va/saints/aquinas-messy",
      host: "vatican.va",
      title: "St. Thomas Aquinas",
      body:
        "Below you'll find a profile of St. Thomas Aquinas.\n\n" +
        "St. Thomas Aquinas was a Dominican friar and Doctor of the Church. " +
        "Feast day: January 28. Patron saint of theologians.\n\n" +
        "© 2024 EWTN. All rights reserved.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "messy-francis",
    kind: "messy",
    contentType: "Saint",
    document: doc({
      url: "https://catholic.org/saints/francis-messy",
      host: "catholic.org",
      title: "St. Francis of Assisi",
      body:
        "Subscribe to our newsletter!\n\n" +
        "St. Francis of Assisi was the founder of the Franciscan order. " +
        "He was canonized in 1228. Feast day: October 4. Patron of animals.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "messy-therese",
    kind: "messy",
    contentType: "Saint",
    document: doc({
      url: "https://usccb.org/saints/therese-messy",
      host: "usccb.org",
      title: "St. Thérèse of Lisieux",
      body:
        "Used with permission.\n\n" +
        "St. Thérèse of Lisieux, the Little Flower, was a Carmelite nun. " +
        "She was canonized in 1925. Feast: October 1. Patron of missionaries.",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "messy-ignatius",
    kind: "messy",
    contentType: "Saint",
    document: doc({
      url: "https://catholicculture.org/saints/ignatius-messy",
      host: "catholicculture.org",
      title: "St. Ignatius of Loyola",
      body:
        "Click here to read more about St. Ignatius.\n\n" +
        "St. Ignatius of Loyola founded the Jesuits and was canonized in 1622. " +
        "Feast day: July 31.\n\n" +
        "Source: Vatican.va",
      purpose: "canIngestSaints",
    }),
  },
  {
    name: "messy-padre-pio",
    kind: "messy",
    contentType: "Saint",
    document: doc({
      url: "https://catholic.org/saints/padre-pio-messy",
      host: "catholic.org",
      title: "St. Padre Pio",
      body:
        "Read more at catholic.org/saints!!!\n\n" +
        "St. Padre Pio was a Capuchin friar known for the stigmata. " +
        "Canonized 2002. Feast day September 23.",
      purpose: "canIngestSaints",
    }),
  },
];

/**
 * Index of every fixture set, keyed by content type. Tests and the
 * canary runner iterate this.
 */
export const ALL_BUILDER_FIXTURES: Readonly<Record<string, ReadonlyArray<BuilderFixture>>> = {
  Prayer: PRAYER_FIXTURES,
  Saint: SAINT_FIXTURES,
};

export function fixturesForContentType(contentType: ContentTypeKey): ReadonlyArray<BuilderFixture> {
  return ALL_BUILDER_FIXTURES[contentType as string] ?? [];
}

export function fixturesByKind(
  contentType: ContentTypeKey,
  kind: BuilderFixtureKind,
): ReadonlyArray<BuilderFixture> {
  return fixturesForContentType(contentType).filter((f) => f.kind === kind);
}

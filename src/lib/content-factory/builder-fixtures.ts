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

// ─── Devotion ────────────────────────────────────────────────────────
export const DEVOTION_FIXTURES: ReadonlyArray<BuilderFixture> = [
  // Valid
  {
    name: "divine-mercy",
    kind: "valid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/divine-mercy",
      host: "vatican.va",
      title: "Divine Mercy Devotion",
      body:
        "The Divine Mercy devotion was given by Jesus to St. Faustina Kowalska in the 1930s. " +
        "Practice: Recite the Divine Mercy Chaplet daily at 3:00 PM, the Hour of Mercy. " +
        "Begin with the Sign of the Cross, then pray the Our Father, Hail Mary, and Apostles' Creed.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "sacred-heart",
    kind: "valid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/sacred-heart",
      host: "vatican.va",
      title: "Devotion to the Sacred Heart",
      body:
        "Devotion to the Sacred Heart of Jesus is one of the most widely practiced Catholic devotions. " +
        "Practice: Recite the Litany of the Sacred Heart daily. Begin with the Sign of the Cross.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "immaculate-heart",
    kind: "valid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/immaculate-heart",
      host: "vatican.va",
      title: "Devotion to the Immaculate Heart of Mary",
      body:
        "Devotion to the Immaculate Heart of Mary was promoted by St. Louis de Montfort and the Fatima apparitions. " +
        "Practice: Pray five decades of the Rosary daily. Begin with the Apostles' Creed.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "miraculous-medal",
    kind: "valid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/miraculous-medal",
      host: "vatican.va",
      title: "The Miraculous Medal Novena",
      body:
        "The Miraculous Medal devotion was given by Our Lady to St. Catherine Labouré in 1830. " +
        "Practice: Wear the medal and recite the prayer daily — O Mary conceived without sin, " +
        "pray for us who have recourse to thee. Begin every day with the Sign of the Cross.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "stations-of-the-cross",
    kind: "valid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/stations-of-the-cross",
      host: "vatican.va",
      title: "The Stations of the Cross",
      body:
        "The Stations of the Cross is a Lenten devotion that traces Christ's path to Calvary. " +
        "Practice: Begin with the Sign of the Cross. At each station, recite the traditional prayer: " +
        "We adore Thee, O Christ, and we bless Thee, because by Thy holy Cross Thou hast redeemed the world.",
      purpose: "canIngestDevotions",
    }),
  },
  // Invalid
  {
    name: "livestream",
    kind: "invalid",
    contentType: "Devotion",
    document: doc({
      url: "https://parish.example/livestream",
      host: "parish.example",
      title: "Watch Live: Divine Mercy",
      body: "Watch live every day at 3pm. Click here to register for tonight's livestream.",
      purpose: "canIngestDevotions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "history-article",
    kind: "invalid",
    contentType: "Devotion",
    document: doc({
      url: "https://blog.example/history-of-devotion",
      host: "blog.example",
      title: "The History of the Sacred Heart Devotion",
      body:
        "According to scholars, the devotion has a long history beginning in the 17th century. " +
        "As theologian John Smith writes in his book, this is a fascinating history.",
      purpose: "canIngestDevotions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "retreat-registration",
    kind: "invalid",
    contentType: "Devotion",
    document: doc({
      url: "https://parish.example/retreat",
      host: "parish.example",
      title: "Marian Devotion Retreat",
      body: "Register for our weekend retreat to deepen your devotion to Mary.",
      purpose: "canIngestDevotions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Devotion",
    document: doc({
      url: "https://vatican.va/devotions/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestDevotions",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Devotion",
    document: doc({
      url: "https://random.example/devotion",
      host: "random.example",
      title: "Some Devotion",
      body: "Some text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-divine-mercy",
    kind: "messy",
    contentType: "Devotion",
    document: doc({
      url: "https://catholicculture.org/devotions/divine-mercy-messy",
      host: "catholicculture.org",
      title: "Divine Mercy Devotion",
      body:
        "Below is the devotion:\n\n" +
        "The Divine Mercy devotion was given by Jesus to St. Faustina. " +
        "Practice: Recite the Chaplet daily at 3pm. Begin with the Sign of the Cross.\n\n" +
        "© 2024 EWTN. All rights reserved.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "messy-sacred-heart",
    kind: "messy",
    contentType: "Devotion",
    document: doc({
      url: "https://catholic.org/devotions/sacred-heart-messy",
      host: "catholic.org",
      title: "Sacred Heart Devotion",
      body:
        "Subscribe to our newsletter!\n\n" +
        "Devotion to the Sacred Heart. Practice: Recite the Litany daily. " +
        "Begin with the Sign of the Cross.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "messy-immaculate-heart",
    kind: "messy",
    contentType: "Devotion",
    document: doc({
      url: "https://usccb.org/devotions/immaculate-heart-messy",
      host: "usccb.org",
      title: "Immaculate Heart Devotion",
      body:
        "Used with permission.\n\n" +
        "Devotion to the Immaculate Heart of Mary. Practice: pray five decades of the Rosary daily.",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "messy-miraculous-medal",
    kind: "messy",
    contentType: "Devotion",
    document: doc({
      url: "https://catholicculture.org/devotions/miraculous-medal-messy",
      host: "catholicculture.org",
      title: "Miraculous Medal",
      body:
        "Click here to read more.\n\n" +
        "Miraculous Medal devotion. Practice: wear the medal daily and recite the prayer.\n\n" +
        "Source: Vatican.va",
      purpose: "canIngestDevotions",
    }),
  },
  {
    name: "messy-stations",
    kind: "messy",
    contentType: "Devotion",
    document: doc({
      url: "https://catholic.org/devotions/stations-messy",
      host: "catholic.org",
      title: "Stations of the Cross",
      body:
        "Read more at catholic.org/stations!!!\n\n" +
        "The Stations of the Cross. Practice: begin with the Sign of the Cross. " +
        "At each station, recite the traditional prayer.",
      purpose: "canIngestDevotions",
    }),
  },
];

// ─── Sacrament ───────────────────────────────────────────────────────
export const SACRAMENT_FIXTURES: ReadonlyArray<BuilderFixture> = [
  // Valid
  {
    name: "baptism",
    kind: "valid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/baptism",
      host: "vatican.va",
      title: "The Sacrament of Baptism",
      body:
        "Baptism is the first of the seven sacraments and the gateway to the Christian life. " +
        "The Sacrament of Baptism is one of the three sacraments of Initiation. " +
        "Through baptism we are freed from sin and reborn as children of God.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "eucharist",
    kind: "valid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/eucharist",
      host: "vatican.va",
      title: "The Sacrament of the Eucharist",
      body:
        "The Eucharist is the source and summit of the Christian life. " +
        "The Sacrament of the Eucharist is one of the three sacraments of Initiation. " +
        "Christ is truly present in the Eucharistic elements.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "confirmation",
    kind: "valid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/confirmation",
      host: "vatican.va",
      title: "The Sacrament of Confirmation",
      body:
        "Confirmation completes baptismal grace. The Sacrament of Confirmation is one of " +
        "the three sacraments of Initiation. Confirmation perfects the gift of the Holy Spirit.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "reconciliation",
    kind: "valid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/reconciliation",
      host: "vatican.va",
      title: "The Sacrament of Reconciliation",
      body:
        "The Sacrament of Reconciliation, also called Penance or Confession, is the sacrament " +
        "of healing in which the faithful confess their sins to a priest. Reconciliation is one " +
        "of the two sacraments of Healing.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "matrimony",
    kind: "valid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/matrimony",
      host: "vatican.va",
      title: "The Sacrament of Matrimony",
      body:
        "Matrimony is the sacrament of marriage. The Sacrament of Matrimony is one of the two " +
        "sacraments of Service. The matrimonial covenant unites man and woman in a lifelong partnership.",
      purpose: "canIngestSacraments",
    }),
  },
  // Invalid
  {
    name: "schedule-page",
    kind: "invalid",
    contentType: "Sacrament",
    document: doc({
      url: "https://parish.example/confession-schedule",
      host: "parish.example",
      title: "Confession Schedule",
      body: "Confessions are heard Saturdays at 3:30pm and by appointment.",
      purpose: "canIngestSacraments",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "registration-page",
    kind: "invalid",
    contentType: "Sacrament",
    document: doc({
      url: "https://parish.example/baptism-registration",
      host: "parish.example",
      title: "Baptism Registration",
      body: "Register your child for baptism. Click here to fill out the registration form.",
      purpose: "canIngestSacraments",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Sacrament",
    document: doc({
      url: "https://vatican.va/sacrament/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestSacraments",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "non-sacrament-content",
    kind: "invalid",
    contentType: "Sacrament",
    document: doc({
      url: "https://blog.example/article",
      host: "blog.example",
      title: "Random blog post about parish life",
      body: "Some random content with no sacramental teaching.",
      purpose: "canIngestSacraments",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Sacrament",
    document: doc({
      url: "https://random.example/sacrament",
      host: "random.example",
      title: "Some Sacrament",
      body: "Some text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-baptism",
    kind: "messy",
    contentType: "Sacrament",
    document: doc({
      url: "https://catholicculture.org/sacrament/baptism-messy",
      host: "catholicculture.org",
      title: "The Sacrament of Baptism",
      body:
        "Read more at catholicculture.org\n\n" +
        "Baptism is the first of the seven sacraments. The Sacrament of Baptism is one of " +
        "the three sacraments of Initiation. Through baptism we are freed from sin.\n\n" +
        "© 2024 Catholic Culture",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "messy-eucharist",
    kind: "messy",
    contentType: "Sacrament",
    document: doc({
      url: "https://usccb.org/sacrament/eucharist-messy",
      host: "usccb.org",
      title: "The Eucharist",
      body:
        "Subscribe to our newsletter!\n\n" +
        "The Eucharist is the source and summit of the Christian life. " +
        "The Sacrament of the Eucharist is one of the sacraments of Initiation.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "messy-confirmation",
    kind: "messy",
    contentType: "Sacrament",
    document: doc({
      url: "https://catholic.org/sacrament/confirmation-messy",
      host: "catholic.org",
      title: "Confirmation",
      body:
        "Click here to read more.\n\n" +
        "Confirmation completes baptismal grace. The Sacrament of Confirmation is one of " +
        "the three sacraments of Initiation.\n\n" +
        "Source: Vatican.va",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "messy-reconciliation",
    kind: "messy",
    contentType: "Sacrament",
    document: doc({
      url: "https://catholicculture.org/sacrament/reconciliation-messy",
      host: "catholicculture.org",
      title: "Sacrament of Reconciliation",
      body:
        "Used with permission.\n\n" +
        "The Sacrament of Reconciliation, also called Penance. " +
        "Reconciliation is one of the two sacraments of Healing.",
      purpose: "canIngestSacraments",
    }),
  },
  {
    name: "messy-matrimony",
    kind: "messy",
    contentType: "Sacrament",
    document: doc({
      url: "https://catholic.org/sacrament/matrimony-messy",
      host: "catholic.org",
      title: "Sacrament of Matrimony",
      body:
        "Read more at catholic.org!!!\n\n" +
        "Matrimony is the sacrament of marriage. The Sacrament of Matrimony is one of the " +
        "two sacraments of Service. The matrimonial covenant unites man and woman.",
      purpose: "canIngestSacraments",
    }),
  },
];

// ─── Novena ──────────────────────────────────────────────────────────
export const NOVENA_FIXTURES: ReadonlyArray<BuilderFixture> = [
  // Valid
  {
    name: "divine-mercy-novena",
    kind: "valid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/divine-mercy",
      host: "praymorenovenas.com",
      title: "Divine Mercy Novena",
      body:
        "Day 1\nToday bring to Me all mankind.\nPrayer: Eternal God, in whom mercy is endless, look kindly upon us. Amen.\n\n" +
        "Day 2\nToday bring to Me the souls of priests and religious.\nPrayer: Most Merciful Jesus, bless these souls. Amen.\n\n" +
        "Day 3\nToday bring to Me all devout and faithful souls.\nPrayer: Most Merciful Jesus, from the treasury of mercy. Amen.\n\n" +
        "Day 4\nToday bring to Me those who do not believe in Jesus and those who do not yet know Me.\nPrayer: Most Compassionate Jesus, You are the Light of the world. Amen.\n\n" +
        "Day 5\nToday bring to Me the souls of separated brethren.\nPrayer: Most Merciful Jesus, Goodness Itself. Amen.\n\n" +
        "Day 6\nToday bring to Me the meek and humble souls.\nPrayer: Most Merciful Jesus, You yourself have said. Amen.\n\n" +
        "Day 7\nToday bring to Me the souls who especially venerate and glorify My mercy.\nPrayer: Most Merciful Jesus, Whose Heart is Love Itself. Amen.\n\n" +
        "Day 8\nToday bring to Me the souls who are detained in purgatory.\nPrayer: Most Merciful Jesus, You Yourself have said. Amen.\n\n" +
        "Day 9\nToday bring to Me souls who have become lukewarm.\nPrayer: Most Compassionate Jesus, you are Compassion Itself. Amen.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "st-jude-novena",
    kind: "valid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/st-jude",
      host: "praymorenovenas.com",
      title: "St. Jude Novena",
      body:
        "Day 1: Most holy Apostle, St. Jude, hear my prayer. Pray the Lord's Prayer.\n\n" +
        "Day 2: Most holy Apostle, St. Jude. Pray the Hail Mary.\n\n" +
        "Day 3: Most holy Apostle, St. Jude. Pray the Glory Be.\n\n" +
        "Day 4: Most holy Apostle, St. Jude. Pray the Lord's Prayer.\n\n" +
        "Day 5: Most holy Apostle, St. Jude. Pray the Hail Mary.\n\n" +
        "Day 6: Most holy Apostle, St. Jude. Pray the Glory Be.\n\n" +
        "Day 7: Most holy Apostle, St. Jude. Pray the Lord's Prayer.\n\n" +
        "Day 8: Most holy Apostle, St. Jude. Pray the Hail Mary.\n\n" +
        "Day 9: Most holy Apostle, St. Jude. Pray the Glory Be.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "st-anthony-novena",
    kind: "valid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/st-anthony",
      host: "praymorenovenas.com",
      title: "St. Anthony Novena",
      body:
        "Day 1: Holy St. Anthony, gentlest of saints. Pray three Our Fathers.\n\n" +
        "Day 2: Holy St. Anthony. Pray three Hail Marys.\n\n" +
        "Day 3: Holy St. Anthony. Pray three Glory Bes.\n\n" +
        "Day 4: Holy St. Anthony. Pray three Our Fathers.\n\n" +
        "Day 5: Holy St. Anthony. Pray three Hail Marys.\n\n" +
        "Day 6: Holy St. Anthony. Pray three Glory Bes.\n\n" +
        "Day 7: Holy St. Anthony. Pray three Our Fathers.\n\n" +
        "Day 8: Holy St. Anthony. Pray three Hail Marys.\n\n" +
        "Day 9: Holy St. Anthony. Pray three Glory Bes.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "immaculate-conception-novena",
    kind: "valid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/immaculate-conception",
      host: "praymorenovenas.com",
      title: "Immaculate Conception Novena",
      body:
        "Day 1: Immaculate Mary, our Mother. Pray three Hail Marys.\n\n" +
        "Day 2: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 3: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 4: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 5: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 6: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 7: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 8: Immaculate Mary. Pray three Hail Marys.\n\n" +
        "Day 9: Immaculate Mary, on this last day we beg your intercession. Pray three Hail Marys.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "sacred-heart-novena",
    kind: "valid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/sacred-heart",
      host: "praymorenovenas.com",
      title: "Sacred Heart Novena",
      body:
        "Day 1: O most holy Heart of Jesus. Pray the Our Father.\n\n" +
        "Day 2: O most holy Heart of Jesus. Pray the Hail Mary.\n\n" +
        "Day 3: O most holy Heart of Jesus. Pray the Glory Be.\n\n" +
        "Day 4: O most holy Heart of Jesus. Pray the Our Father.\n\n" +
        "Day 5: O most holy Heart of Jesus. Pray the Hail Mary.\n\n" +
        "Day 6: O most holy Heart of Jesus. Pray the Glory Be.\n\n" +
        "Day 7: O most holy Heart of Jesus. Pray the Our Father.\n\n" +
        "Day 8: O most holy Heart of Jesus. Pray the Hail Mary.\n\n" +
        "Day 9: O most holy Heart of Jesus, on this last day we beseech you. Pray the Glory Be.",
      purpose: "canIngestNovenas",
    }),
  },
  // Invalid — partial novenas, articles, livestreams
  {
    name: "partial-only-3-days",
    kind: "invalid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/partial",
      host: "praymorenovenas.com",
      title: "Partial Novena",
      body:
        "Day 1: First day prayer.\n\n" +
        "Day 2: Second day prayer.\n\n" +
        "Day 3: Third day prayer.",
      purpose: "canIngestNovenas",
    }),
    expectedFailureReason: "build_failed_missing_required_fields",
  },
  {
    name: "article-about-novenas",
    kind: "invalid",
    contentType: "Novena",
    document: doc({
      url: "https://blog.example/novena-history",
      host: "blog.example",
      title: "The History of Novenas",
      body:
        "According to scholars, novenas have a long history. As theologian John Smith writes, " +
        "the practice of nine-day prayer cycles dates back to the early Church.",
      purpose: "canIngestNovenas",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "novena-livestream",
    kind: "invalid",
    contentType: "Novena",
    document: doc({
      url: "https://parish.example/novena-livestream",
      host: "parish.example",
      title: "Watch Live: Divine Mercy Novena",
      body: "Join us live every day at 7pm. Click here to register for tonight's livestream.",
      purpose: "canIngestNovenas",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/empty",
      host: "praymorenovenas.com",
      title: "Empty",
      body: "",
      purpose: "canIngestNovenas",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Novena",
    document: doc({
      url: "https://random.example/novena",
      host: "random.example",
      title: "Some Novena",
      body: "Day 1, Day 2, Day 3 prayer text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy — full novenas with noise around the days
  {
    name: "messy-divine-mercy-with-intro",
    kind: "messy",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/divine-mercy-messy",
      host: "praymorenovenas.com",
      title: "Divine Mercy Novena",
      body:
        "Below is the novena:\n\n" +
        "Day 1: Today bring to Me all mankind. Pray the Chaplet.\n\n" +
        "Day 2: Today bring to Me priests. Pray the Chaplet.\n\n" +
        "Day 3: Today bring to Me devout souls. Pray the Chaplet.\n\n" +
        "Day 4: Today bring to Me unbelievers. Pray the Chaplet.\n\n" +
        "Day 5: Today bring to Me separated brethren. Pray the Chaplet.\n\n" +
        "Day 6: Today bring to Me humble souls. Pray the Chaplet.\n\n" +
        "Day 7: Today bring to Me venerators of mercy. Pray the Chaplet.\n\n" +
        "Day 8: Today bring to Me souls in purgatory. Pray the Chaplet.\n\n" +
        "Day 9: Today bring to Me lukewarm souls. Pray the Chaplet.\n\n" +
        "© 2024 All rights reserved.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "messy-st-jude-roman-numerals",
    kind: "messy",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/st-jude-roman",
      host: "praymorenovenas.com",
      title: "St. Jude Novena",
      body:
        "I. Holy St. Jude, pray for me. Our Father.\n\n" +
        "II. Holy St. Jude. Hail Mary.\n\n" +
        "III. Holy St. Jude. Glory Be.\n\n" +
        "IV. Holy St. Jude. Our Father.\n\n" +
        "V. Holy St. Jude. Hail Mary.\n\n" +
        "VI. Holy St. Jude. Glory Be.\n\n" +
        "VII. Holy St. Jude. Our Father.\n\n" +
        "VIII. Holy St. Jude. Hail Mary.\n\n" +
        "IX. Holy St. Jude. Glory Be.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "messy-anthony-written-numerals",
    kind: "messy",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/st-anthony-written",
      host: "praymorenovenas.com",
      title: "St. Anthony Novena",
      body:
        "First Day: Holy St. Anthony. Pray Our Fathers.\n\n" +
        "Second Day: Holy St. Anthony. Pray Hail Marys.\n\n" +
        "Third Day: Holy St. Anthony. Pray Glory Bes.\n\n" +
        "Fourth Day: Holy St. Anthony. Pray Our Fathers.\n\n" +
        "Fifth Day: Holy St. Anthony. Pray Hail Marys.\n\n" +
        "Sixth Day: Holy St. Anthony. Pray Glory Bes.\n\n" +
        "Seventh Day: Holy St. Anthony. Pray Our Fathers.\n\n" +
        "Eighth Day: Holy St. Anthony. Pray Hail Marys.\n\n" +
        "Ninth Day: Holy St. Anthony. Pray Glory Bes.",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "messy-immaculate-with-footers",
    kind: "messy",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/immaculate-messy",
      host: "praymorenovenas.com",
      title: "Immaculate Conception Novena",
      body:
        "Subscribe to our newsletter!\n\n" +
        "Day 1: Immaculate Mary. Hail Mary.\n\n" +
        "Day 2: Immaculate Mary. Hail Mary.\n\n" +
        "Day 3: Immaculate Mary. Hail Mary.\n\n" +
        "Day 4: Immaculate Mary. Hail Mary.\n\n" +
        "Day 5: Immaculate Mary. Hail Mary.\n\n" +
        "Day 6: Immaculate Mary. Hail Mary.\n\n" +
        "Day 7: Immaculate Mary. Hail Mary.\n\n" +
        "Day 8: Immaculate Mary. Hail Mary.\n\n" +
        "Day 9: Immaculate Mary. Hail Mary.\n\n" +
        "Source: Praymore Novenas. Read more at praymorenovenas.com",
      purpose: "canIngestNovenas",
    }),
  },
  {
    name: "messy-sacred-heart-day-one-style",
    kind: "messy",
    contentType: "Novena",
    document: doc({
      url: "https://praymorenovenas.com/sacred-heart-day-one",
      host: "praymorenovenas.com",
      title: "Sacred Heart Novena",
      body:
        "Day One: O Sacred Heart of Jesus. Our Father.\n\n" +
        "Day Two: O Sacred Heart. Hail Mary.\n\n" +
        "Day Three: O Sacred Heart. Glory Be.\n\n" +
        "Day Four: O Sacred Heart. Our Father.\n\n" +
        "Day Five: O Sacred Heart. Hail Mary.\n\n" +
        "Day Six: O Sacred Heart. Glory Be.\n\n" +
        "Day Seven: O Sacred Heart. Our Father.\n\n" +
        "Day Eight: O Sacred Heart. Hail Mary.\n\n" +
        "Day Nine: O Sacred Heart. Glory Be.",
      purpose: "canIngestNovenas",
    }),
  },
];

// ─── Marian Apparition ───────────────────────────────────────────────
export const MARIAN_APPARITION_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "lourdes",
    kind: "valid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/lourdes",
      host: "vatican.va",
      title: "Our Lady of Lourdes",
      body:
        "Our Lady of Lourdes appeared to St. Bernadette Soubirous in Lourdes, France in 1858. " +
        "The Church declared the apparition worthy of belief in 1862 after careful investigation by the local bishop.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "fatima",
    kind: "valid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/fatima",
      host: "vatican.va",
      title: "Our Lady of Fatima",
      body:
        "Our Lady of Fatima appeared to three shepherd children in Fatima, Portugal in 1917. " +
        "The Church officially approved the apparition as worthy of belief in 1930.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "guadalupe",
    kind: "valid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/guadalupe",
      host: "vatican.va",
      title: "Our Lady of Guadalupe",
      body:
        "Our Lady of Guadalupe appeared to St. Juan Diego in Mexico in 1531. " +
        "The apparition is approved by the Church and the tilma remains an object of veneration.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "knock",
    kind: "valid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/knock",
      host: "vatican.va",
      title: "Our Lady of Knock",
      body:
        "Our Lady of Knock appeared at the Church of St. John in Knock, Ireland in 1879. " +
        "The Church approved the apparition after diocesan investigation in 1879 and 1936.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "rue-du-bac",
    kind: "valid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/rue-du-bac",
      host: "vatican.va",
      title: "Our Lady of the Miraculous Medal",
      body:
        "Our Lady appeared to St. Catherine Labouré at the Rue du Bac in Paris, France in 1830. " +
        "The Church approved the apparition and the Miraculous Medal devotion.",
      purpose: "canIngestApparitions",
    }),
  },
  // Invalid
  {
    name: "unapproved-apparition",
    kind: "invalid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://blog.example/unapproved",
      host: "blog.example",
      title: "Mary Appeared in My Kitchen",
      body: "A personal account of a Marian apparition that the Church has never investigated.",
      purpose: "canIngestApparitions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "livestream-apparition",
    kind: "invalid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://parish.example/livestream",
      host: "parish.example",
      title: "Watch Live: Fatima Live Stream",
      body: "Watch live every day at 8pm. Click here to join the live stream of the Marian shrine.",
      purpose: "canIngestApparitions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "article-about-apparitions",
    kind: "invalid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://blog.example/marian-history",
      host: "blog.example",
      title: "History of Marian Apparitions",
      body:
        "According to scholars, Marian apparitions have a long history. As theologian John Smith writes in his book, " +
        "many apparitions remain disputed.",
      purpose: "canIngestApparitions",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://vatican.va/apparitions/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestApparitions",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "MarianApparition",
    document: doc({
      url: "https://random.example/apparition",
      host: "random.example",
      title: "Some Apparition",
      body: "Some text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-lourdes",
    kind: "messy",
    contentType: "MarianApparition",
    document: doc({
      url: "https://catholicculture.org/apparitions/lourdes-messy",
      host: "catholicculture.org",
      title: "Our Lady of Lourdes",
      body:
        "Read more at catholicculture.org\n\n" +
        "Our Lady of Lourdes appeared to St. Bernadette in Lourdes, France in 1858. " +
        "The Church approved the apparition as worthy of belief in 1862.\n\n" +
        "© 2024",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "messy-fatima",
    kind: "messy",
    contentType: "MarianApparition",
    document: doc({
      url: "https://catholic.org/apparitions/fatima-messy",
      host: "catholic.org",
      title: "Our Lady of Fatima",
      body:
        "Subscribe to our newsletter!\n\n" +
        "Our Lady of Fatima appeared at Fatima, Portugal in 1917. " +
        "The Church approved the apparition in 1930.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "messy-guadalupe",
    kind: "messy",
    contentType: "MarianApparition",
    document: doc({
      url: "https://usccb.org/apparitions/guadalupe-messy",
      host: "usccb.org",
      title: "Our Lady of Guadalupe",
      body:
        "Click here to read more.\n\n" +
        "Our Lady of Guadalupe appeared at Tepeyac, Mexico in 1531. The apparition is approved by the Church.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "messy-knock",
    kind: "messy",
    contentType: "MarianApparition",
    document: doc({
      url: "https://catholic.org/apparitions/knock-messy",
      host: "catholic.org",
      title: "Our Lady of Knock",
      body:
        "Used with permission.\n\n" +
        "Our Lady of Knock appeared at Knock, Ireland in 1879. " +
        "The Church approved the apparition after diocesan investigation.",
      purpose: "canIngestApparitions",
    }),
  },
  {
    name: "messy-rue-du-bac",
    kind: "messy",
    contentType: "MarianApparition",
    document: doc({
      url: "https://catholicculture.org/apparitions/rue-du-bac-messy",
      host: "catholicculture.org",
      title: "Our Lady of the Miraculous Medal",
      body:
        "Read more at catholicculture.org!!!\n\n" +
        "Our Lady appeared to St. Catherine Labouré at Rue du Bac, Paris in 1830. " +
        "The Church approved the apparition and devotion.",
      purpose: "canIngestApparitions",
    }),
  },
];

// ─── History ─────────────────────────────────────────────────────────
export const HISTORY_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "nicaea-325",
    kind: "valid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/nicaea-325",
      host: "vatican.va",
      title: "First Council of Nicaea",
      body:
        "The First Council of Nicaea took place in AD 325, convened by Emperor Constantine I. " +
        "Authority: Roman Emperor and ecumenical council. " +
        "Produced the original Nicene Creed and is considered the first ecumenical council of the Church.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "trent",
    kind: "valid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/trent",
      host: "vatican.va",
      title: "Council of Trent",
      body:
        "The Council of Trent took place from 1545 to 1563. " +
        "Authority: ecumenical council convened by Pope Paul III. " +
        "Produced major doctrinal definitions in response to the Reformation.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "vatican-i",
    kind: "valid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/vatican-i",
      host: "vatican.va",
      title: "First Vatican Council",
      body:
        "The First Vatican Council took place from 1869 to 1870. " +
        "Authority: ecumenical council convened by Pope Pius IX. " +
        "Defined the dogma of papal infallibility.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "vatican-ii",
    kind: "valid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/vatican-ii",
      host: "vatican.va",
      title: "Second Vatican Council",
      body:
        "The Second Vatican Council took place from 1962 to 1965. " +
        "Authority: ecumenical council convened by Pope John XXIII. " +
        "Produced four constitutions and twelve other documents reforming Church practice.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "east-west-schism",
    kind: "valid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/east-west-schism",
      host: "vatican.va",
      title: "East-West Schism",
      body:
        "The East-West Schism took place in 1054 AD. " +
        "Authority: Patriarch Michael Cerularius of Constantinople and Pope Leo IX of Rome. " +
        "The mutual excommunications formalized the split between Catholic and Orthodox churches.",
      purpose: "canIngestHistory",
    }),
  },
  // Invalid
  {
    name: "news-article",
    kind: "invalid",
    contentType: "History",
    document: doc({
      url: "https://blog.example/news",
      host: "blog.example",
      title: "Pope Announces New Initiative",
      body:
        "By John Doe | June 15, 2024. Breaking news from the Vatican. Click here to read more. " +
        "Subscribe to our newsletter.",
      purpose: "canIngestHistory",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "blog-post-no-dates",
    kind: "invalid",
    contentType: "History",
    document: doc({
      url: "https://blog.example/musings",
      host: "blog.example",
      title: "Some Thoughts on Church History",
      body:
        "We sometimes wonder why the Church has so many councils. " +
        "Click here to subscribe to our newsletter for more thoughts.",
      purpose: "canIngestHistory",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "no-date-marker",
    kind: "invalid",
    contentType: "History",
    document: doc({
      url: "https://blog.example/general",
      host: "blog.example",
      title: "Random Church Topic",
      body: "An unspecified topic without any era or date marker.",
      purpose: "canIngestHistory",
    }),
    expectedFailureReason: "build_failed_missing_required_fields",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "History",
    document: doc({
      url: "https://vatican.va/history/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestHistory",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "History",
    document: doc({
      url: "https://random.example/history",
      host: "random.example",
      title: "Some History",
      body: "Some text about 325 AD.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-nicaea",
    kind: "messy",
    contentType: "History",
    document: doc({
      url: "https://catholicculture.org/history/nicaea-messy",
      host: "catholicculture.org",
      title: "First Council of Nicaea",
      body:
        "Read more at catholicculture.org\n\n" +
        "The First Council of Nicaea took place in AD 325. " +
        "Authority: Roman Emperor and ecumenical council. " +
        "Produced the original Nicene Creed.\n\n" +
        "© 2024",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "messy-trent",
    kind: "messy",
    contentType: "History",
    document: doc({
      url: "https://usccb.org/history/trent-messy",
      host: "usccb.org",
      title: "Council of Trent",
      body:
        "Subscribe to our newsletter!\n\n" +
        "The Council of Trent took place 1545-1563. " +
        "Authority: ecumenical council convened by Pope Paul III.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "messy-vatican-i",
    kind: "messy",
    contentType: "History",
    document: doc({
      url: "https://catholic.org/history/vatican-i-messy",
      host: "catholic.org",
      title: "First Vatican Council",
      body:
        "Click here to read more.\n\n" +
        "The First Vatican Council 1869-1870. " +
        "Authority: ecumenical council convened by Pope Pius IX.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "messy-vatican-ii",
    kind: "messy",
    contentType: "History",
    document: doc({
      url: "https://newadvent.org/history/vatican-ii-messy",
      host: "newadvent.org",
      title: "Second Vatican Council",
      body:
        "Used with permission.\n\n" +
        "The Second Vatican Council 1962-1965. " +
        "Authority: ecumenical council convened by Pope John XXIII.",
      purpose: "canIngestHistory",
    }),
  },
  {
    name: "messy-schism",
    kind: "messy",
    contentType: "History",
    document: doc({
      url: "https://catholic.org/history/schism-messy",
      host: "catholic.org",
      title: "East-West Schism",
      body:
        "Read more at catholic.org!!!\n\n" +
        "The East-West Schism took place in 1054. " +
        "Authority: Patriarch Michael Cerularius and Pope Leo IX.",
      purpose: "canIngestHistory",
    }),
  },
];

// ─── Parish ──────────────────────────────────────────────────────────
export const PARISH_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "st-patricks-nyc",
    kind: "valid",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/saint-patricks-cathedral-new-york-ny",
      host: "parishesonline.com",
      title: "Saint Patrick's Cathedral",
      body: "Saint Patrick's Cathedral\n5 East 51st Street\nNew York, NY\nUnited States\nArchdiocese of New York\nWebsite: https://saintpatrickscathedral.org",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "st-marys-cambridge",
    kind: "valid",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/st-marys-cambridge-ma",
      host: "parishesonline.com",
      title: "St. Mary's Parish",
      body: "St. Mary's Parish\n4 Norfolk Street\nCambridge, MA\nUnited States\nArchdiocese of Boston\nWebsite: https://stmaryscambridge.org",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "holy-trinity-georgetown",
    kind: "valid",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/holy-trinity-georgetown",
      host: "parishesonline.com",
      title: "Holy Trinity Parish",
      body: "Holy Trinity Parish\n3513 N Street NW\nWashington, DC\nUnited States\nArchdiocese of Washington",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "st-pauls-london",
    kind: "valid",
    contentType: "Parish",
    document: doc({
      url: "https://gcatholic.org/parish/st-pauls-london",
      host: "gcatholic.org",
      title: "St Paul's Catholic Church",
      body: "St Paul's Catholic Church\nWood Lane\nLondon\nUnited Kingdom\nDiocese of Westminster",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "st-josephs-toronto",
    kind: "valid",
    contentType: "Parish",
    document: doc({
      url: "https://gcatholic.org/parish/st-josephs-toronto",
      host: "gcatholic.org",
      title: "St. Joseph's Church",
      body: "St. Joseph's Church\n171 Leslie Street\nToronto\nCanada\nArchdiocese of Toronto",
      purpose: "canIngestParishes",
    }),
  },
  // Invalid
  {
    name: "school-page",
    kind: "invalid",
    contentType: "Parish",
    document: doc({
      url: "https://school.example/about",
      host: "school.example",
      title: "St. Mary's Catholic Elementary School",
      body: "Welcome to our school. Enrollment for next year is now open.",
      purpose: "canIngestParishes",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "bulletin-page",
    kind: "invalid",
    contentType: "Parish",
    document: doc({
      url: "https://parish.example/bulletin",
      host: "parish.example",
      title: "Weekly Bulletin",
      body: "This week's bulletin from St. Mary's Parish.",
      purpose: "canIngestParishes",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "donation-page",
    kind: "invalid",
    contentType: "Parish",
    document: doc({
      url: "https://parish.example/donate",
      host: "parish.example",
      title: "Give Now",
      body: "Donate now to support our parish stewardship program.",
      purpose: "canIngestParishes",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/empty",
      host: "parishesonline.com",
      title: "Empty",
      body: "",
      purpose: "canIngestParishes",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Parish",
    document: doc({
      url: "https://random.example/parish",
      host: "random.example",
      title: "Some Parish",
      body: "Some text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-st-patricks",
    kind: "messy",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/st-patricks-messy",
      host: "parishesonline.com",
      title: "Saint Patrick's Cathedral",
      body:
        "Click here to learn more!\n\n" +
        "Saint Patrick's Cathedral\n5 East 51st Street\nNew York, NY\nUnited States\nArchdiocese of New York\n\n" +
        "© 2024 Parishes Online",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "messy-st-marys",
    kind: "messy",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/st-marys-messy",
      host: "parishesonline.com",
      title: "St. Mary's Parish",
      body:
        "Subscribe to our newsletter!\n\n" +
        "St. Mary's Parish\n4 Norfolk Street\nCambridge, MA\nUnited States\nArchdiocese of Boston",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "messy-holy-trinity",
    kind: "messy",
    contentType: "Parish",
    document: doc({
      url: "https://parishesonline.com/holy-trinity-messy",
      host: "parishesonline.com",
      title: "Holy Trinity Parish",
      body:
        "Used with permission.\n\n" +
        "Holy Trinity Parish\n3513 N Street NW\nWashington, DC\nUnited States\nArchdiocese of Washington",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "messy-st-pauls",
    kind: "messy",
    contentType: "Parish",
    document: doc({
      url: "https://gcatholic.org/parish/st-pauls-messy",
      host: "gcatholic.org",
      title: "St Paul's Catholic Church",
      body:
        "Read more at gcatholic.org\n\n" +
        "St Paul's Catholic Church\nWood Lane\nLondon\nUnited Kingdom\nDiocese of Westminster",
      purpose: "canIngestParishes",
    }),
  },
  {
    name: "messy-st-josephs",
    kind: "messy",
    contentType: "Parish",
    document: doc({
      url: "https://gcatholic.org/parish/st-josephs-messy",
      host: "gcatholic.org",
      title: "St. Joseph's Church",
      body:
        "Read more at gcatholic.org!!!\n\n" +
        "St. Joseph's Church\n171 Leslie Street\nToronto\nCanada\nArchdiocese of Toronto",
      purpose: "canIngestParishes",
    }),
  },
];

// ─── Rosary ──────────────────────────────────────────────────────────
export const ROSARY_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "joyful-mysteries",
    kind: "valid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/joyful-mysteries",
      host: "rosary-center.org",
      title: "The Joyful Mysteries",
      body:
        "The Joyful Mysteries are prayed on Mondays and Saturdays. " +
        "First: The Annunciation. Second: The Visitation. Third: The Nativity. " +
        "Fourth: The Presentation in the Temple. Fifth: The Finding in the Temple. " +
        "Begin with the Sign of the Cross and the Apostles' Creed.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "sorrowful-mysteries",
    kind: "valid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/sorrowful-mysteries",
      host: "rosary-center.org",
      title: "The Sorrowful Mysteries",
      body:
        "The Sorrowful Mysteries are prayed on Tuesdays and Fridays. " +
        "First: The Agony in the Garden. Second: The Scourging at the Pillar. " +
        "Third: The Crowning with Thorns. Fourth: The Carrying of the Cross. " +
        "Fifth: The Crucifixion. Begin with the Sign of the Cross.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "glorious-mysteries",
    kind: "valid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/glorious-mysteries",
      host: "rosary-center.org",
      title: "The Glorious Mysteries",
      body:
        "The Glorious Mysteries are prayed on Wednesdays and Sundays. " +
        "First: The Resurrection. Second: The Ascension. Third: The Descent of the Holy Spirit. " +
        "Fourth: The Assumption of Mary. Fifth: The Coronation of Mary.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "luminous-mysteries",
    kind: "valid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/luminous-mysteries",
      host: "rosary-center.org",
      title: "The Luminous Mysteries",
      body:
        "The Luminous Mysteries are prayed on Thursdays. " +
        "First: The Baptism in the Jordan. Second: The Wedding at Cana. " +
        "Third: The Proclamation of the Kingdom. Fourth: The Transfiguration. " +
        "Fifth: The Institution of the Eucharist.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "how-to-pray-rosary",
    kind: "valid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/how-to-pray",
      host: "rosary-center.org",
      title: "How to Pray the Rosary",
      body:
        "Begin with the Sign of the Cross. Pray the Apostles' Creed. " +
        "On each large bead pray the Our Father. On each small bead pray the Hail Mary. " +
        "At the end of each decade pray the Glory Be. Each decade meditates on a Mystery.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  // Invalid
  {
    name: "rosary-livestream",
    kind: "invalid",
    contentType: "Rosary",
    document: doc({
      url: "https://parish.example/rosary-live",
      host: "parish.example",
      title: "Watch Live: Daily Rosary",
      body: "Watch live every day at 7pm as we pray the Rosary together. Click here to join.",
      purpose: "canIngestRosaryGuides",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "article-about-rosary",
    kind: "invalid",
    contentType: "Rosary",
    document: doc({
      url: "https://blog.example/rosary-history",
      host: "blog.example",
      title: "History of the Rosary",
      body:
        "According to scholars, the Rosary developed over many centuries. " +
        "As theologian John Smith writes in his book on the Rosary, the prayer is...",
      purpose: "canIngestRosaryGuides",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "rosary-event-registration",
    kind: "invalid",
    contentType: "Rosary",
    document: doc({
      url: "https://parish.example/rosary-rally",
      host: "parish.example",
      title: "Rosary Rally Event",
      body: "Register for our annual Rosary Rally event. Click here to sign up.",
      purpose: "canIngestRosaryGuides",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/empty",
      host: "rosary-center.org",
      title: "Empty",
      body: "",
      purpose: "canIngestRosaryGuides",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Rosary",
    document: doc({
      url: "https://random.example/rosary",
      host: "random.example",
      title: "Some Rosary",
      body: "Some text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-joyful",
    kind: "messy",
    contentType: "Rosary",
    document: doc({
      url: "https://catholicculture.org/rosary/joyful-messy",
      host: "catholicculture.org",
      title: "Joyful Mysteries",
      body:
        "Read more at catholicculture.org\n\n" +
        "The Joyful Mysteries: Annunciation, Visitation, Nativity, Presentation, Finding in the Temple.\n\n" +
        "© 2024",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "messy-sorrowful",
    kind: "messy",
    contentType: "Rosary",
    document: doc({
      url: "https://catholic.org/rosary/sorrowful-messy",
      host: "catholic.org",
      title: "Sorrowful Mysteries",
      body:
        "Subscribe to our newsletter!\n\n" +
        "Sorrowful Mysteries: Agony, Scourging, Crowning, Carrying, Crucifixion.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "messy-glorious",
    kind: "messy",
    contentType: "Rosary",
    document: doc({
      url: "https://ewtn.com/rosary/glorious-messy",
      host: "ewtn.com",
      title: "Glorious Mysteries",
      body:
        "Click here to read more.\n\n" +
        "Glorious Mysteries: Resurrection, Ascension, Descent of Holy Spirit, Assumption, Coronation.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "messy-luminous",
    kind: "messy",
    contentType: "Rosary",
    document: doc({
      url: "https://catholicculture.org/rosary/luminous-messy",
      host: "catholicculture.org",
      title: "Luminous Mysteries",
      body:
        "Used with permission.\n\n" +
        "Luminous Mysteries: Baptism in the Jordan, Wedding at Cana, Proclamation of the Kingdom, " +
        "Transfiguration, Institution of the Eucharist.",
      purpose: "canIngestRosaryGuides",
    }),
  },
  {
    name: "messy-how-to-pray",
    kind: "messy",
    contentType: "Rosary",
    document: doc({
      url: "https://rosary-center.org/how-to-pray-messy",
      host: "rosary-center.org",
      title: "How to Pray the Rosary",
      body:
        "Read more at rosary-center.org!!!\n\n" +
        "Begin with the Sign of the Cross. Pray the Apostles' Creed. " +
        "Pray Our Father on each large bead, Hail Mary on each small bead, Glory Be after each decade.",
      purpose: "canIngestRosaryGuides",
    }),
  },
];

// ─── Consecration ────────────────────────────────────────────────────
export const CONSECRATION_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "33-day-marian-consecration",
    kind: "valid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/33-days-to-morning-glory",
      host: "marian.org",
      title: "33-Day Consecration to Jesus through Mary",
      body:
        "Day 1 of 33: Begin with the Spirit of the World meditation. " +
        "Day 2 of 33: Pray the Litany. Day 3 of 33: meditate on knowledge of self. " +
        "Day 33 of 33: this is the consecration day.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "consecration-to-sacred-heart",
    kind: "valid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/consecration-sacred-heart",
      host: "marian.org",
      title: "Consecration to the Sacred Heart",
      body:
        "Day 1: Begin with prayer. Day 2: Continue with meditation. Day 3: pray the Litany. " +
        "Day 9 of 9: final consecration to the Sacred Heart.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "consecration-to-st-joseph",
    kind: "valid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/consecration-st-joseph",
      host: "marian.org",
      title: "33-Day Consecration to St. Joseph",
      body:
        "Day 1: Begin with the meditation on St. Joseph's life. " +
        "Day 2: continue with prayer. Day 3 of 33: meditate on St. Joseph's virtues. " +
        "Day 33: final consecration day.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "consecration-de-montfort",
    kind: "valid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/de-montfort",
      host: "marian.org",
      title: "True Devotion to Mary Consecration",
      body:
        "Day 1: knowledge of self. Day 2: knowledge of the world. " +
        "Day 3: knowledge of Mary. Day 33 of 33: act of total consecration to Jesus through Mary.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "divine-mercy-consecration",
    kind: "valid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/divine-mercy-consecration",
      host: "marian.org",
      title: "Consecration to Divine Mercy",
      body:
        "Day 1 of 9: meditate on the mercy of God. Day 2: pray the Chaplet. " +
        "Day 3: receive the Sacrament of Reconciliation. " +
        "Day 9 of 9: act of consecration to Divine Mercy.",
      purpose: "canIngestConsecrations",
    }),
  },
  // Invalid
  {
    name: "no-day-structure",
    kind: "invalid",
    contentType: "Consecration",
    document: doc({
      url: "https://blog.example/about-consecration",
      host: "blog.example",
      title: "About Marian Consecration",
      body: "Marian consecration is the act of dedicating oneself to Jesus through Mary.",
      purpose: "canIngestConsecrations",
    }),
    expectedFailureReason: "build_failed_missing_required_fields",
  },
  {
    name: "consecration-retreat-registration",
    kind: "invalid",
    contentType: "Consecration",
    document: doc({
      url: "https://parish.example/retreat",
      host: "parish.example",
      title: "Marian Consecration Retreat",
      body: "Register for our weekend retreat to consecrate yourself to Mary.",
      purpose: "canIngestConsecrations",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "consecration-article",
    kind: "invalid",
    contentType: "Consecration",
    document: doc({
      url: "https://blog.example/consecration-history",
      host: "blog.example",
      title: "History of Marian Consecration",
      body:
        "According to scholars, the practice of Marian consecration has a long history. " +
        "As theologian John Smith writes in his book...",
      purpose: "canIngestConsecrations",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/empty",
      host: "marian.org",
      title: "Empty",
      body: "",
      purpose: "canIngestConsecrations",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Consecration",
    document: doc({
      url: "https://random.example/consecration",
      host: "random.example",
      title: "Some Consecration",
      body: "Day 1, Day 2, Day 3 text.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-33-day",
    kind: "messy",
    contentType: "Consecration",
    document: doc({
      url: "https://marian.org/33-days-messy",
      host: "marian.org",
      title: "33-Day Marian Consecration",
      body:
        "Read more at marian.org\n\n" +
        "33-Day Consecration: Day 1 of 33: spirit of the world. " +
        "Day 2 of 33: meditation. Day 3 of 33: knowledge of self. " +
        "Day 33: consecration day.\n\n" +
        "© 2024",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "messy-sacred-heart",
    kind: "messy",
    contentType: "Consecration",
    document: doc({
      url: "https://catholic.org/consecration/sacred-heart-messy",
      host: "catholic.org",
      title: "Consecration to the Sacred Heart",
      body:
        "Subscribe to our newsletter!\n\n" +
        "9-day consecration: Day 1: prayer. Day 2: meditation. Day 3: Litany. " +
        "Day 9 of 9: act of consecration.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "messy-st-joseph",
    kind: "messy",
    contentType: "Consecration",
    document: doc({
      url: "https://ewtn.com/consecration/st-joseph-messy",
      host: "ewtn.com",
      title: "St. Joseph Consecration",
      body:
        "Click here to read more.\n\n" +
        "33-Day Consecration to St. Joseph: Day 1 meditation. Day 2 prayer. " +
        "Day 3 of 33: meditate on virtues. Day 33: consecration day.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "messy-de-montfort",
    kind: "messy",
    contentType: "Consecration",
    document: doc({
      url: "https://catholicculture.org/consecration/de-montfort-messy",
      host: "catholicculture.org",
      title: "De Montfort True Devotion",
      body:
        "Used with permission.\n\n" +
        "33-day total consecration. Day 1: self-knowledge. Day 2: world. " +
        "Day 3: Mary. Day 33 of 33: total consecration.",
      purpose: "canIngestConsecrations",
    }),
  },
  {
    name: "messy-divine-mercy-consecration",
    kind: "messy",
    contentType: "Consecration",
    document: doc({
      url: "https://catholic.org/consecration/divine-mercy-messy",
      host: "catholic.org",
      title: "Divine Mercy Consecration",
      body:
        "Read more at catholic.org!!!\n\n" +
        "9-day consecration to Divine Mercy. Day 1 of 9: mercy of God. " +
        "Day 2: Chaplet. Day 9 of 9: act of consecration.",
      purpose: "canIngestConsecrations",
    }),
  },
];

// ─── Liturgy ─────────────────────────────────────────────────────────
export const LITURGY_FIXTURES: ReadonlyArray<BuilderFixture> = [
  {
    name: "order-of-the-mass",
    kind: "valid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/order-of-mass",
      host: "vatican.va",
      title: "Order of the Mass",
      body:
        "The Mass is divided into the Introductory Rites, the Liturgy of the Word, " +
        "the Liturgy of the Eucharist, and the Concluding Rites. " +
        "Each part forms a single act of worship.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "liturgical-year",
    kind: "valid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/liturgical-year",
      host: "vatican.va",
      title: "The Liturgical Year",
      body:
        "The liturgical year is structured around the major seasons: " +
        "Advent, Christmas, Lent, Easter, and Ordinary Time. " +
        "The liturgical seasons mark the salvation history of Christ.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "marriage-rite",
    kind: "valid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/marriage-rite",
      host: "vatican.va",
      title: "The Rite of Marriage",
      body:
        "The Rite of Marriage is celebrated within Mass. " +
        "Begins with introductory rites, followed by the Liturgy of the Word, " +
        "then the exchange of consent and nuptial blessing.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "funeral-rite",
    kind: "valid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/funeral-rite",
      host: "vatican.va",
      title: "The Funeral Rite",
      body:
        "The Catholic funeral rite consists of three principal parts: " +
        "the Vigil, the Funeral Mass, and the Rite of Committal. " +
        "Each part forms part of a single liturgy of Christian funeral.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "liturgical-symbolism",
    kind: "valid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/symbolism",
      host: "vatican.va",
      title: "Liturgical Symbolism",
      body:
        "The Catholic liturgy uses sacramentals — vestments, gestures, vessels, and seasonal " +
        "colors. The liturgical colors mark the seasons of the liturgical year. " +
        "Each symbol carries a specific theological meaning.",
      purpose: "canIngestLiturgy",
    }),
  },
  // Invalid
  {
    name: "mass-schedule",
    kind: "invalid",
    contentType: "Liturgy",
    document: doc({
      url: "https://parish.example/mass-schedule",
      host: "parish.example",
      title: "Mass Schedule",
      body: "Sunday: 8am, 10am, 12pm. Daily Masses at 7am. Mass schedule for this week.",
      purpose: "canIngestLiturgy",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "parish-bulletin",
    kind: "invalid",
    contentType: "Liturgy",
    document: doc({
      url: "https://parish.example/bulletin",
      host: "parish.example",
      title: "Weekly Bulletin",
      body: "This week's bulletin from St. Mary's Parish.",
      purpose: "canIngestLiturgy",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "liturgy-livestream",
    kind: "invalid",
    contentType: "Liturgy",
    document: doc({
      url: "https://parish.example/mass-live",
      host: "parish.example",
      title: "Watch Mass Live",
      body: "Watch Mass live every Sunday at 10am.",
      purpose: "canIngestLiturgy",
    }),
    expectedFailureReason: "wrong_content",
  },
  {
    name: "empty-body",
    kind: "invalid",
    contentType: "Liturgy",
    document: doc({
      url: "https://vatican.va/liturgy/empty",
      host: "vatican.va",
      title: "Empty",
      body: "",
      purpose: "canIngestLiturgy",
    }),
    expectedFailureReason: "not_supported_by_source",
  },
  {
    name: "unapproved-source",
    kind: "invalid",
    contentType: "Liturgy",
    document: doc({
      url: "https://random.example/liturgy",
      host: "random.example",
      title: "Some Liturgy",
      body: "Some text about the Mass.",
      purpose: "",
    }),
    expectedFailureReason: "source_not_allowed",
  },
  // Messy
  {
    name: "messy-order-of-mass",
    kind: "messy",
    contentType: "Liturgy",
    document: doc({
      url: "https://adoremus.org/liturgy/order-messy",
      host: "adoremus.org",
      title: "Order of the Mass",
      body:
        "Read more at adoremus.org\n\n" +
        "The Mass is divided into the Introductory Rites, the Liturgy of the Word, " +
        "the Liturgy of the Eucharist, and the Concluding Rites.\n\n© 2024",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "messy-liturgical-year",
    kind: "messy",
    contentType: "Liturgy",
    document: doc({
      url: "https://usccb.org/liturgy/year-messy",
      host: "usccb.org",
      title: "Liturgical Year",
      body:
        "Subscribe to our newsletter!\n\n" +
        "The liturgical year is structured around Advent, Christmas, Lent, Easter, and Ordinary Time. " +
        "The liturgical seasons mark salvation history.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "messy-marriage-rite",
    kind: "messy",
    contentType: "Liturgy",
    document: doc({
      url: "https://catholicculture.org/liturgy/marriage-messy",
      host: "catholicculture.org",
      title: "Rite of Marriage",
      body:
        "Click here to read more.\n\n" +
        "The Rite of Marriage is celebrated within Mass. " +
        "Begins with introductory rites, then Liturgy of the Word, then exchange of consent.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "messy-funeral-rite",
    kind: "messy",
    contentType: "Liturgy",
    document: doc({
      url: "https://adoremus.org/liturgy/funeral-messy",
      host: "adoremus.org",
      title: "Funeral Rite",
      body:
        "Used with permission.\n\n" +
        "Catholic funeral rite: Vigil, Funeral Mass, Rite of Committal. " +
        "Each part forms the liturgy of Christian funeral.",
      purpose: "canIngestLiturgy",
    }),
  },
  {
    name: "messy-symbolism",
    kind: "messy",
    contentType: "Liturgy",
    document: doc({
      url: "https://catholic.org/liturgy/symbolism-messy",
      host: "catholic.org",
      title: "Liturgical Symbolism",
      body:
        "Read more at catholic.org!!!\n\n" +
        "Catholic liturgy uses sacramentals — vestments, gestures, vessels, and seasonal colors. " +
        "Liturgical colors mark the seasons of the liturgical year.",
      purpose: "canIngestLiturgy",
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
  Devotion: DEVOTION_FIXTURES,
  Sacrament: SACRAMENT_FIXTURES,
  Novena: NOVENA_FIXTURES,
  MarianApparition: MARIAN_APPARITION_FIXTURES,
  History: HISTORY_FIXTURES,
  Parish: PARISH_FIXTURES,
  Rosary: ROSARY_FIXTURES,
  Consecration: CONSECRATION_FIXTURES,
  Liturgy: LITURGY_FIXTURES,
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

import type { CuratedEntry } from "../index";

/**
 * Guides — sections H (Lent), I (Advent & Christmas) and J (Becoming Catholic).
 *
 * Everything here mirrors the Church's actual practice: the fast and
 * abstinence norms are the ones the USCCB publishes for the Latin Church in
 * the United States, the Holy Week and Easter Vigil steps follow the Roman
 * Missal, the household blessings follow the shape of the Book of Blessings
 * (without reproducing its texts), and the OCIA guides follow the periods and
 * steps of the Order of Christian Initiation of Adults with the US National
 * Statutes. Where a custom is only a custom (a white Christmas candle, keeping
 * the crib until Candlemas) it is named as one. Prayer names are spelled out
 * exactly as their entries are titled so PrayerLinkedText can expand them.
 */

// USCCB pages (verified in a browser on 2026-09-06; the site blocks non-browser
// clients, and several of the plan's legacy /liturgical-year/… paths now 404).
const U_LENT = "https://www.usccb.org/lent";
const U_FAST =
  "https://www.usccb.org/prayer-and-worship/liturgical-year/lent/catholic-information-on-lenten-fast-and-abstinence";
const U_TRID = "https://www.usccb.org/triduum";
const U_ADVENT = "https://www.usccb.org/advent";
const U_XMAS = "https://www.usccb.org/prayer-and-worship/liturgical-year/christmas";
const U_LOTH = "https://www.usccb.org/prayer-and-worship/liturgy-of-the-hours";
const U_BAPT = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/baptism";
const U_OCIA =
  "https://www.usccb.org/beliefs-and-teachings/who-we-teach/rite-of-christian-initiation-of-adults";
const U_SACR = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals";
const U_PEN = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance";

// Vatican documents (all verified 200).
const V_PAEN =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19660217_paenitemini.html";
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_SC =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html";
const V_AS =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20191201_admirabile-signum.html";
// Code of Canon Law, Book IV: penitential days (cann. 1244-1253); Baptism
// (cann. 834-878); Confirmation and the Eucharist (cann. 879-958).
const V_CIC_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";
const V_CIC_BAPT =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann834-878_en.html";
const V_CIC_EUCH =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann879-958_en.html";
// Catechism (IntraText edition): Baptism, art. 1 (1213 ff.); "How is the
// sacrament of Baptism celebrated?" — Christian initiation and the
// catechumenate (1229 ff.); the precepts of the Church (2041-2043); the
// penitential seasons (1438).
const V_CCC_BAPT = "https://www.vatican.va/archive/ENG0015/__P3G.HTM";
const V_CCC_INIT = "https://www.vatican.va/archive/ENG0015/__P3J.HTM";
const V_CCC_PRECEPTS = "https://www.vatican.va/archive/ENG0015/__P75.HTM";
const V_CCC_PENANCE_SEASONS = "https://www.vatican.va/archive/ENG0015/__P4B.HTM";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "lent_preparation" | "advent_preparation" | "ocia";
  sacramentKey?: "baptism" | "confirmation" | "eucharist" | "reconciliation";
  authorityLevel: "USCCB" | "VATICAN";
  citations: string[];
  intro: string;
  whatYouNeed: string[];
  whenToPray: string;
  tips: string[];
  steps: Step[];
  durationMinutes: number;
  relatedPrayers: string[];
  relatedDevotions?: string[];
  relatedPractices?: string[];
  relatedSaints?: string[];
}

function guide(g: GuideInput): CuratedEntry {
  return {
    contentType: "GUIDE",
    slug: g.slug,
    authorityLevel: g.authorityLevel,
    citations: g.citations,
    payload: {
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      kind: g.kind,
      ...(g.sacramentKey ? { sacramentKey: g.sacramentKey } : {}),
      intro: g.intro,
      whatYouNeed: g.whatYouNeed,
      whenToPray: g.whenToPray,
      tips: g.tips,
      steps: g.steps,
      durationMinutes: g.durationMinutes,
      relatedPrayers: g.relatedPrayers,
      relatedDevotions: g.relatedDevotions ?? [],
      relatedPractices: g.relatedPractices ?? [],
      relatedSaints: g.relatedSaints ?? [],
      citations: g.citations,
    },
  };
}

/** The US fasting norm, stated once and quoted where a guide needs it. */
const FAST_RULE =
  "one full meal, and two smaller meals that together do not add up to a full meal, with nothing eaten between meals (liquids are permitted)";

export const seasonsAndOciaGuides: CuratedEntry[] = [
  // ─────────────────────────────── H. LENT ───────────────────────────────
  guide({
    slug: "lent-preparation-guide",
    title: "How to Prepare for Lent",
    summary:
      "An overview of the forty days: what Lent is for, how to choose your prayer, fasting and almsgiving, the dates to mark, when to go to confession, and how to keep going after you fail.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_LENT, V_PAEN, V_CCC_PENANCE_SEASONS],
    intro:
      "Lent is the Church's forty-day preparation for Easter, running from Ash Wednesday to the evening of Holy Thursday, when the Easter Triduum begins. It has two faces: it is the season in which the catechumens make their final preparation for Baptism, and the season in which the already baptized return to the grace of their own Baptism through penance. The Gospel read on Ash Wednesday names its three practices: prayer, fasting and almsgiving. A good Lent is not a heroic one but a planned one, chosen in the days before Ash Wednesday rather than improvised on the day.",
    whatYouNeed: [
      "A calendar with Ash Wednesday, the Fridays of Lent, Holy Week and Easter marked",
      "The Mass and confession times of your parish (the bulletin or website)",
      "A short written plan: one prayer, one fast, one work of mercy",
      "A Bible or missal for the Lenten readings",
    ],
    whenToPray:
      "Make the plan in the week before Ash Wednesday. Lent itself begins on Ash Wednesday and ends before the evening Mass of the Lord's Supper on Holy Thursday.",
    tips: [
      "The six Sundays of Lent are not days of fast; they remain the Lord's Day. Do not treat a Sunday rest from your fast as a failure.",
      "Choose practices you can actually keep for forty days. A small fast kept every day does more than a great one abandoned in the second week.",
      "Two solemnities usually fall inside Lent, Saint Joseph on 19 March and the Annunciation on 25 March; if either lands on a Friday the law of abstinence does not bind that day.",
      "Put confession on the calendar now; Holy Week confession lines are long, and the sacrament is the heart of the season.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["our-father", "act-of-contrition", "de-profundis"],
    relatedDevotions: ["stations-of-the-cross", "holy-rosary"],
    relatedPractices: ["fasting", "almsgiving"],
    steps: [
      {
        order: 1,
        title: "Understand what Lent is for",
        body: "Lent exists for Easter. For forty days the Church unites herself to Jesus' forty days in the desert, so that at the Easter Vigil the catechumens may be baptized and the rest of us may renew our baptismal promises with clean hearts. That is why the season is marked by penance: not gloom for its own sake, but the work of turning back to God. The liturgy shows it in violet vestments, the silence of the Gloria and the Alleluia, and readings that call us to conversion. Keep Easter in view from the first day; every practice you choose is a way of getting there.",
      },
      {
        order: 2,
        title: "Choose your prayer",
        body: "Pick one prayer practice you do not already keep and hold to it every day of Lent. Good choices are a weekday Mass, the Stations of the Cross on Fridays, a daily decade or full Rosary with the Sorrowful Mysteries, fifteen minutes with the day's Mass readings, or Morning or Evening Prayer from the Liturgy of the Hours. The De Profundis (Psalm 130) is a traditional Lenten psalm that takes two minutes to pray. One practice, kept, is the goal; if you add more, add it after the first is steady.",
      },
      {
        order: 3,
        title: "Choose your fast",
        body: "The Church asks a minimum of every Catholic: fast and abstain from meat on Ash Wednesday and Good Friday, and abstain from meat on every Friday of Lent (the How to Fast and Abstain guide gives the details and who is bound). Beyond that minimum, choose one voluntary self-denial for the whole season: a food, a drink, a screen, a habit. The point is not self-improvement but hunger, a bodily reminder that we do not live by bread alone. Choose something you will actually feel.",
      },
      {
        order: 4,
        title: "Choose your almsgiving",
        body: "Fasting and almsgiving belong together: what you do not spend on yourself is meant to reach the poor. Decide now on a concrete gift of money to your parish's Lenten collection, a Catholic charity or a person you know is in need, and a concrete gift of time, such as visiting someone who is sick or lonely. The corporal and spiritual works of mercy are the traditional list to choose from. Almsgiving done quietly is the kind the Lord praises in the Ash Wednesday Gospel.",
      },
      {
        order: 5,
        title: "Mark the calendar",
        body: "Write into your calendar: Ash Wednesday (fast and abstinence); every Friday of Lent (abstinence, and usually Stations of the Cross at the parish); the Fourth Sunday, Laetare Sunday, when rose vestments mark a moment of joy halfway through; the solemnities of Saint Joseph and the Annunciation; Palm Sunday, which opens Holy Week; and the Triduum, Holy Thursday evening to Easter Sunday. Look up your parish's Holy Week schedule as soon as it is published and decide now to be there for the Mass of the Lord's Supper, the Celebration of the Passion and the Easter Vigil.",
      },
      {
        order: 6,
        title: "Plan your confession",
        body: "The Church asks every Catholic to confess grave sins at least once a year, and Lent is the natural time. Parishes add confession times and many dioceses hold Lenten penance services with several priests. Choose a date in the first half of the season, prepare with the Examination of Conscience guide, and learn or print the Act of Contrition. If you have been away from the sacrament for years, the How to Go to Confession guide walks through exactly what to say; the priest will help with the rest.",
      },
      {
        order: 7,
        title: "Pray the Stations and the Rosary",
        body: "Two devotions carry the season. The Stations of the Cross, prayed publicly in most parishes on Lenten Fridays, walk with Christ from his condemnation to his burial; the How to Pray the Stations of the Cross guide gives the fourteen stations with their versicles. The Rosary's Sorrowful Mysteries, the agony in the garden, the scourging, the crowning with thorns, the carrying of the cross and the crucifixion, are the natural Lenten mysteries and can be prayed on any day. Choose at least one of these to keep weekly.",
      },
      {
        order: 8,
        title: "Keep going after failing",
        body: "You will break your fast, skip your prayer, or forget your alms at some point, and that is not the end of Lent. The season is a school of conversion, and conversion is learned by beginning again. Say a short Act of Contrition, pray the Our Father with its petition for forgiveness, and take up the practice again the next day without renegotiating it. The measure of a good Lent is not an unbroken record but a heart that keeps returning to God, which is exactly what Easter is about.",
      },
    ],
  }),

  guide({
    slug: "how-to-observe-ash-wednesday",
    title: "How to Observe Ash Wednesday",
    summary:
      "The first day of Lent: who fasts and abstains and what that means, going to Mass or a Liturgy of the Word, receiving the ashes and the words that go with them, wearing them, and beginning your Lenten plan.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_FAST, U_LENT, V_DPP],
    intro:
      "Ash Wednesday opens Lent with the oldest and plainest sign of penance: ashes on the forehead. The ashes come from the palms blessed on the previous Palm Sunday, burned and blessed again, and they are placed on us with words drawn from the Gospel and from Genesis. It is a day of fast and abstinence for the whole Latin Church, and although it is not a holy day of obligation, Catholics fill their churches on it more than on almost any other weekday of the year. Everything about the day is meant to begin something: the ashes are the first step of forty days.",
    whatYouNeed: [
      "The time of Mass or the Liturgy of the Word with distribution of ashes at your parish",
      "A plan for the day's two small meals and one full meal",
      "Your written Lenten plan: one prayer, one fast, one work of mercy",
    ],
    whenToPray:
      "Ash Wednesday, forty-six days before Easter Sunday (between 4 February and 10 March). Ashes are distributed at every Mass of the day and often at a midday or evening Liturgy of the Word.",
    tips: [
      "Ashes are a sacramental, not a sacrament. There is no requirement to be in a state of grace, or even to be Catholic, to receive them; bring your children and anyone who wants to come.",
      "Fasting is required of Catholics aged 18 to 59 and abstinence from meat of everyone 14 and older; the sick, and pregnant or nursing women, are not bound. Common sense governs.",
      "Do not eat your full meal before Mass if you are going in the evening; many people fast through the day and eat after.",
      "The Gospel of the day warns against practising piety to be seen. Wear the ashes, but do not wear them for show.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["act-of-contrition", "de-profundis"],
    relatedPractices: ["fasting"],
    steps: [
      {
        order: 1,
        title: "Know who fasts and who abstains",
        body: "Ash Wednesday is one of the two obligatory days of both fasting and abstinence in the year (Good Friday is the other). Fasting binds Catholics of the Latin Church from their eighteenth birthday until their sixtieth; abstinence from meat binds everyone from their fourteenth birthday. Those who are ill, including people with chronic conditions such as diabetes, and women who are pregnant or nursing, are excused from fasting, and no one should harm their health to keep it. Members of the Eastern Catholic Churches follow the discipline of their own Church.",
      },
      {
        order: 2,
        title: "Know what the fast means in practice",
        body: `The Church's fast is not a total fast. It permits ${FAST_RULE}. Abstinence means no meat from warm-blooded animals, that is mammals and birds; fish and other seafood, eggs and dairy are permitted. Plan the day's food before it begins so that hunger becomes a prayer rather than a scramble, and keep the meals simple: a plate of fish and chips is within the letter but not the spirit.`,
      },
      {
        order: 3,
        title: "Go to Mass, or to a Liturgy of the Word",
        body: "Ashes are blessed and distributed after the homily at every Mass of Ash Wednesday, and many parishes add a Liturgy of the Word with distribution of ashes at midday or in the evening for those who cannot come to Mass. Going to Mass is the fuller way to begin Lent, because you also receive the Eucharist, but both are the Church's liturgy. Arrive early; the churches are full. The readings are Joel's call to rend your hearts and not your garments, Psalm 51, Saint Paul's 'now is the acceptable time', and the Gospel of Matthew 6 on almsgiving, prayer and fasting done in secret.",
      },
      {
        order: 4,
        title: "Receive the ashes and hear the words",
        body: "Come forward as you would for Communion. The priest, deacon or minister dips a thumb in the ashes and traces a cross on your forehead, saying either 'Repent, and believe in the Gospel' or 'Remember that you are dust, and to dust you shall return.' No response is prescribed; you may answer 'Amen' quietly or simply bow your head and return to your place. Both formulas are the Church's own: one is Jesus' first preaching, the other is God's word to Adam after the fall. Take whichever you are given as the word spoken to you this Lent.",
      },
      {
        order: 5,
        title: "Wear the ashes",
        body: "There is no rule about how long to keep the ashes on. Most people leave them until they wear off or wash them at the end of the day; others wipe them after Mass. What matters is the reason. Worn through a working day they are a quiet witness that you are a sinner who intends to repent, and they often open conversations. Worn to be admired they contradict the Gospel you just heard. Decide before you leave the church, and then stop thinking about them.",
      },
      {
        order: 6,
        title: "Pray the day's psalm and an Act of Contrition",
        body: "Before the day ends, pray Psalm 51, the day's responsorial psalm, or the De Profundis (Psalm 130), the Church's other great psalm of repentance, slowly and in your own name. Then make an Act of Contrition, not for a list of sins but for the whole drift of your life away from God. This is the interior ash: the sorrow that the exterior sign stands for. If you already know you need confession, look up the Lenten confession times tonight and choose a date.",
      },
      {
        order: 7,
        title: "Begin your Lenten plan",
        body: "Ash Wednesday is day one, so begin the three practices today rather than on Thursday. Keep the fast and abstinence, make your chosen prayer, and set aside the first gift of alms, even a small one. Write the plan somewhere you will see it every morning, and remember that the first Friday of Lent, a day of abstinence, is only two days away. The How to Prepare for Lent guide helps you choose the three practices if you have not yet done so.",
      },
    ],
  }),

  guide({
    slug: "how-to-fast-and-abstain-during-lent",
    title: "How to Fast and Abstain During Lent",
    summary:
      "The Church's law of fasting and abstinence as it binds Catholics in the United States: which days, who is bound, what a fast day allows, what abstinence means, who is excused, and how to keep it as prayer rather than a diet.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_FAST, V_CIC_TIMES, V_PAEN],
    intro:
      "Fasting and abstinence are the Church's oldest bodily penance, and since Pope Paul VI's apostolic constitution Paenitemini (1966) the universal law has asked very little in quantity so that the faithful might give more in freedom. The Code of Canon Law sets the days and the ages; the bishops' conference of each country may adapt them, and the USCCB has done so for the United States. This guide gives the law as it actually stands, so that you can keep it exactly, and then go beyond it with a free heart. Those bound by different disciplines, the Eastern Catholic Churches in particular, follow the law of their own Church.",
    whatYouNeed: [
      "The dates of Ash Wednesday, the Fridays of Lent and Good Friday this year",
      "An honest look at your age, health and work, which decide whether the fast binds you",
      "A plan for what you will do with what the fast saves",
    ],
    whenToPray:
      "Fast and abstinence on Ash Wednesday and Good Friday; abstinence on every Friday of Lent. The Church also commends keeping the paschal fast through Holy Saturday until the Easter Vigil.",
    tips: [
      "If a solemnity falls on a Friday of Lent (Saint Joseph, 19 March, or the Annunciation, 25 March), abstinence does not bind that day.",
      "Friday penance continues all year round, not only in Lent. In the United States you may substitute another penance for abstinence on Fridays outside Lent, but Fridays remain penitential days.",
      "Fasting and abstinence are minimums, not the whole of Lenten self-denial; the Church expects you to add a voluntary penance of your own.",
      "If you are unsure whether you are bound, ask a priest. Scrupulosity is not the point of the law.",
    ],
    durationMinutes: 10,
    relatedPrayers: ["our-father", "act-of-love"],
    relatedPractices: ["fasting", "almsgiving", "christian-mortification"],
    steps: [
      {
        order: 1,
        title: "Know the days of fast and abstinence",
        body: "Ash Wednesday and Good Friday are days of both fasting and abstinence from meat. Every Friday of Lent is a day of abstinence from meat. Those are the only obligatory days. The Church also strongly commends, without commanding, that the Good Friday fast be continued through Holy Saturday until the Easter Vigil, so that the whole Church comes to the Resurrection with 'uplifted and welcoming heart', as the Second Vatican Council put it. Write these dates down before Lent starts.",
      },
      {
        order: 2,
        title: "Know who is bound",
        body: "The law of fasting binds those who have completed their eighteenth year until the beginning of their sixtieth, that is, from the eighteenth birthday through age fifty-nine. The law of abstinence binds everyone who has completed their fourteenth year. Parents and pastors are asked to teach children who are not yet bound the real meaning of penance, so a family can keep the Friday abstinence together even where the youngest are not obliged. These are the norms for the Latin Church in the United States; the Eastern Catholic Churches keep their own.",
      },
      {
        order: 3,
        title: "Know what counts as a fast",
        body: `A fast day permits ${FAST_RULE}. The two smaller meals may be taken at any time of day; what is excluded is snacking. Water, coffee, tea, milk and juice are permitted. That is the whole of the law; anyone able to keep a stricter fast, such as bread and water, is free to, but nothing more is required, and the sick should not attempt it.`,
      },
      {
        order: 4,
        title: "Know what abstinence means",
        body: "Abstinence means not eating meat, understood as the flesh of warm-blooded animals: beef, pork, lamb, poultry and the like. Fish and shellfish, eggs, milk, cheese and butter are permitted, as are products derived from animals that do not have the taste of meat, such as broth-based soups, gravies and gelatin. The law asks for simplicity, though, and a lavish seafood dinner keeps the letter while missing the point. A plain meatless meal, eaten with gratitude, is what the discipline intends.",
      },
      {
        order: 5,
        title: "Know who is excused",
        body: "Those who are physically or mentally ill, including people with chronic conditions such as diabetes, and women who are pregnant or nursing, are excused from fasting and, where necessary, from abstinence. So are those whose heavy work or circumstances make the fast a real danger to health. In every case common sense prevails, and no one should jeopardise their health in order to fast. Someone excused from fasting is still invited to keep the Friday abstinence if it is safe, and to offer another penance if it is not.",
      },
      {
        order: 6,
        title: "Make it a prayer, not a diet",
        body: "The law gives the form; you give the heart. Begin each fast day by offering it to God, and when hunger comes, turn it into a short prayer: the Our Father, or an Act of Love. Give what the fast saves, in money or time, to someone poorer than you; from the beginning the Church has joined fasting to almsgiving. Do not weigh yourself, do not announce it, and do not compare your fast with anyone else's. A fast kept quietly for love of God is worth more than a stricter one kept for its own sake.",
      },
    ],
  }),

  guide({
    slug: "how-to-make-lenten-resolutions",
    title: "How to Choose Prayer, Fasting and Almsgiving for Lent",
    summary:
      "How to choose concrete, realistic Lenten practices from your actual life: one prayer, one fast, one work of mercy, written down, shared with one person, reviewed each Sunday, and carried through Holy Week.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_LENT, V_DPP],
    intro:
      "The Gospel of Ash Wednesday gives Lent its three practices, prayer, fasting and almsgiving, and the Church's tradition has always seen them as one thing seen from three sides: turning to God, turning away from self, turning toward one's neighbour. The trouble most people have with Lent is not a lack of good will but a plan that is either vague ('be better') or impossible ('daily Mass, no coffee, no phone, and a novena'). This guide is a method for choosing three practices you can keep for forty days, which is what makes them fruitful.",
    whatYouNeed: [
      "Fifteen quiet minutes in the week before Ash Wednesday",
      "Something to write on that you will see every day",
      "One person you trust enough to tell",
    ],
    whenToPray:
      "Choose the practices in the days before Ash Wednesday; begin them on Ash Wednesday; review them every Sunday of Lent; complete them in Holy Week.",
    tips: [
      "Choose from your real life, not an imagined one. The prayer you can keep on a Tuesday in March is the right one.",
      "Make each practice specific enough that you know at bedtime whether you kept it.",
      "If one of the three proves impossible after the first week, replace it on Sunday rather than abandoning the whole plan.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["morning-offering", "our-father"],
    relatedPractices: ["fasting", "almsgiving", "ignatian-examen"],
    steps: [
      {
        order: 1,
        title: "Start from your actual life",
        body: "Before you choose anything, look honestly at the next six weeks: your work, your family, your health, your commutes and your evenings. Ask two questions. Where is God being crowded out, and by what? And who around me is in need that I could reach? The answers point to your fast (what crowds God out) and your almsgiving (who needs you). Do not begin from what a saint did or what someone on the internet is doing; begin from where you are, because that is where God is going to meet you.",
      },
      {
        order: 2,
        title: "Choose one prayer practice",
        body: "Pick one thing you will do every day, at a fixed time, that you do not do now. It might be praying the Morning Offering the moment you wake, ten minutes with the day's Gospel before breakfast, a decade of the Rosary on the way to work, the Our Father prayed slowly at noon, or Night Prayer before bed. If you already pray daily, choose a weekly addition instead, such as a weekday Mass or Friday Stations. The test is not how impressive it is but whether it has a time and a place.",
      },
      {
        order: 3,
        title: "Choose one fast",
        body: "Beyond the Church's required days, choose one voluntary self-denial for the whole of Lent. The best fasts touch a real attachment: a food or drink you reach for without thinking, an app, television, shopping, complaining, the snooze button. Say exactly what the fast is ('no alcohol on weekdays', 'no phone after nine') so that it cannot quietly shrink. A fast should be felt but not dangerous, and it should free time or money, because the next step depends on it.",
      },
      {
        order: 4,
        title: "Choose one work of mercy",
        body: "Decide how the time or money your fast frees will reach someone else. Choose one corporal or spiritual work of mercy and make it concrete: a weekly gift to your parish's Lenten appeal or a Catholic charity, a visit each week to someone sick or housebound, a meal cooked for a struggling family, an apology owed, patient help with a colleague's work, praying by name for someone who has hurt you. Almsgiving in the Church's sense is any gift of self to a neighbour in need, but it must have a name and a date.",
      },
      {
        order: 5,
        title: "Write them down",
        body: "Write the three practices on a card or a note you will see every morning, with the exact time and place of each. Write the date of your Lenten confession beside them. Unwritten resolutions dissolve by the second Friday; written ones can be kept or, if necessary, honestly revised. Some people place the card in their missal or on the bathroom mirror; the place does not matter so long as the eyes fall on it daily.",
      },
      {
        order: 6,
        title: "Tell one person",
        body: "Tell one person, a spouse, a friend, a confessor or spiritual director, what you have chosen, and ask them to ask you about it in a few weeks. This is not boasting, which the Ash Wednesday Gospel warns against; it is accountability, which the same Gospel's community of disciples took for granted. Choose someone who will actually ask. If you are married, consider making the almsgiving a shared practice for the household.",
      },
      {
        order: 7,
        title: "Review each Sunday",
        body: "Every Sunday of Lent, take five minutes to look back over the week: which practices were kept, which slipped, and why. Thank God for what held and ask forgiveness for what did not, then decide whether anything needs adjusting. Sundays are not fast days, so this review is a moment of rest, not a second penance. Laetare Sunday, the fourth, is the traditional midpoint; it is a good day to notice that you are halfway to Easter.",
      },
      {
        order: 8,
        title: "Finish with Holy Week",
        body: "Do not let the practices trail off after the fifth week. Plan to keep them through Holy Week and to be present at the Triduum: the Mass of the Lord's Supper on Holy Thursday, the Celebration of the Lord's Passion on Good Friday and the Easter Vigil on Holy Saturday night. Many people find that the best fruit of their Lenten fast is the freedom to spend those three days in church. When Easter comes, ask which of the three practices should stay; a Lent that changes nothing permanently was only a season.",
      },
    ],
  }),

  guide({
    slug: "how-to-observe-holy-week",
    title: "How to Observe Holy Week",
    summary:
      "Palm Sunday through Holy Saturday, day by day: the palms, the Chrism Mass and confession, the Mass of the Lord's Supper and adoration, the Celebration of the Passion, the silence of Holy Saturday, with practical notes on what to bring and on bringing children.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_TRID, V_DPP, V_SC],
    intro:
      "Holy Week is the week the whole liturgical year is built around. It opens with Palm Sunday, when the Church enters Jerusalem with Christ and then hears the story of his Passion, and it culminates in the Easter Triduum, the three days from the evening of Holy Thursday to Easter Sunday evening that the Church celebrates as one single liturgy of the Lord's death and resurrection. Nothing else in the year is like it, and no one who has kept it fully is unmoved. This guide walks through the week in order so that you can arrange your life around it rather than fitting it in.",
    whatYouNeed: [
      "Your parish's Holy Week schedule, including the Chrism Mass at the cathedral",
      "Time off or an early finish on Holy Thursday and Good Friday if you can arrange it",
      "A plan for the Good Friday fast and, if possible, the Holy Saturday fast",
      "Comfortable shoes; several of the liturgies involve standing and processions",
    ],
    whenToPray:
      "From Palm Sunday to Holy Saturday. The Triduum liturgies are the evening Mass of the Lord's Supper on Holy Thursday, the Celebration of the Passion on Good Friday (usually around three in the afternoon), and the Easter Vigil after nightfall on Holy Saturday.",
    tips: [
      "The three Triduum liturgies are one celebration. Try to attend all three; if you can only manage one, most priests would point you to the Easter Vigil.",
      "There is no Mass on Good Friday or during the day on Holy Saturday anywhere in the Church; do not be surprised by the empty tabernacle and the bare altar.",
      "Go to confession early in the week. Many parishes offer extended hours on Monday, Tuesday and Wednesday and few or none from Thursday on.",
      "Bring last year's palms back to the parish before Lent; they are burned to make the ashes of Ash Wednesday.",
    ],
    durationMinutes: 30,
    relatedPrayers: ["prayer-before-a-crucifix", "anima-christi", "stabat-mater"],
    relatedDevotions: ["stations-of-the-cross", "seven-sorrows-of-mary"],
    relatedPractices: ["fasting"],
    steps: [
      {
        order: 1,
        title: "Palm Sunday: enter Jerusalem and hear the Passion",
        body: "Palm Sunday of the Passion of the Lord begins, where possible, outside or at the church door with the blessing of palms and the Gospel of Jesus' entry into Jerusalem, followed by a procession into the church while the people sing. Hold your palm up during the blessing and carry it in the procession. The Mass then turns sharply: the Passion according to Matthew, Mark or Luke, depending on the year, is read, often with the congregation taking the crowd's lines. Take your palm home and place it behind a crucifix or holy picture; it is a blessed object, and when it is replaced it should be burned or buried, not thrown away.",
      },
      {
        order: 2,
        title: "Monday to Wednesday: confession, Tenebrae and the Chrism Mass",
        body: "The first three days of the week are quiet in the liturgy and busy in the parish. Go to confession on one of these days if you have not already done so this Lent; it is the ordinary way to prepare for Easter. In many cathedrals and parishes the Office of Readings and Morning Prayer of the last three days are sung publicly, a service traditionally called Tenebrae, with candles extinguished one by one; it is worth finding. The Chrism Mass, at which the bishop blesses the oils of the sick and of catechumens and consecrates the chrism, and the priests renew their promises, is celebrated at the cathedral, usually on Holy Thursday morning or earlier in the week; all the faithful are welcome.",
      },
      {
        order: 3,
        title: "Holy Thursday: the Mass of the Lord's Supper and the watch",
        body: "Lent ends and the Triduum begins with the evening Mass of the Lord's Supper. The Gloria returns, the bells ring during it, and then fall silent until the Vigil. The Gospel is Jesus washing his disciples' feet, and after the homily the priest may wash the feet of some of the people. After Communion the Blessed Sacrament is carried in procession to a place of repose, and the faithful are invited to stay and keep watch in adoration, as the apostles were asked to in Gethsemane; solemn adoration continues until midnight but not beyond it. The altar is then stripped bare. Stay for an hour if you can; an Anima Christi (Soul of Christ) prayed before the altar of repose is a fitting way to end the day.",
      },
      {
        order: 4,
        title: "Good Friday: the fast and the Celebration of the Passion",
        body: "Good Friday is a day of fast and abstinence and, wherever possible, of silence. No Mass is celebrated anywhere. The Celebration of the Passion of the Lord, usually at three in the afternoon or, for pastoral reasons, later, has three parts: the Liturgy of the Word, with the Passion according to John and the Solemn Intercessions for the Church and the world; the Adoration of the Holy Cross, when a single cross is unveiled with the words 'Behold the wood of the Cross, on which hung the salvation of the world' and the people answer 'Come, let us adore', and then come forward one by one to venerate it; and Holy Communion from the hosts consecrated the night before. The How to Keep Good Friday guide walks through the whole day. Many parishes also pray the Stations of the Cross in the morning or evening.",
      },
      {
        order: 5,
        title: "Holy Saturday: keep silence and wait for the Vigil",
        body: "Holy Saturday is the day the Church waits at the tomb. There is no Mass, the altar is bare, Communion is given only as Viaticum to the dying, and the Church commends continuing the fast of Good Friday until the Vigil. It is the one day of the year for doing nothing in particular: silence, the Office, a walk, the Stabat Mater or the Rosary's Sorrowful Mysteries prayed with Our Lady of Sorrows. In the morning the parish's elect gather for their preparation rites. The Easter Vigil, the greatest liturgy of the year, begins after nightfall and must not begin before dark; check the time, because it varies with the sunset.",
      },
      {
        order: 6,
        title: "Easter Sunday: keep the feast",
        body: "Easter Sunday morning Masses celebrate the same Resurrection the Vigil announced, with the renewal of baptismal promises and sprinkling often replacing the Creed. If you were at the Vigil, you have already fulfilled the Sunday obligation, but the Church keeps the feast for fifty days, and Easter Sunday itself is only the first of the eight days of the Octave, each celebrated as a solemnity. Eat well, ring what bells you have, and pray the Regina Caeli in place of the Angelus from now until Pentecost.",
      },
      {
        order: 7,
        title: "What to bring and how to dress",
        body: "Bring a missal or the parish's worship aid, because these liturgies are long and unfamiliar even to regular Mass-goers, and bring a little money for the Good Friday collection for the Holy Land, taken in every Catholic church that day. Dress as you would for Sunday Mass, with shoes you can stand and walk in: Palm Sunday and Holy Thursday have processions, Good Friday has the veneration line, and the Vigil begins outdoors around a fire. On Holy Thursday and at the Vigil the church may be dark for long stretches; keep a small light in your pocket for reading if you need one.",
      },
      {
        order: 8,
        title: "Bringing children",
        body: "Children can keep Holy Week well if it is explained beforehand and kept short where it must be. Palm Sunday, with its palms and procession, and the washing of feet on Holy Thursday speak to them directly. On Good Friday, the veneration of the Cross, which they can do themselves, is the moment they remember; the Passion reading is long, and a picture book of the story read at home that morning helps. The Vigil is late and lasts two to three hours; older children love the fire and the candles, and younger ones can come to Mass on Easter morning instead. Let them fast in a small way, by giving up a treat, so the feast means something.",
      },
    ],
  }),

  guide({
    slug: "how-to-keep-good-friday",
    title: "How to Keep Good Friday",
    summary:
      "The one day of the year without Mass: the fast and abstinence, keeping the day quiet, the three o'clock hour, the Celebration of the Lord's Passion, venerating the Cross, the Stations, and Holy Communion from the reserved Sacrament.",
    kind: "lent_preparation",
    authorityLevel: "USCCB",
    citations: [U_TRID, U_FAST, V_DPP],
    intro:
      "Good Friday is the day of the Lord's death, and the Church keeps it unlike any other day. No Mass is celebrated; the altar is bare, the tabernacle empty, the church stripped. In place of Mass, the Church gathers, usually at three in the afternoon, the hour Jesus died, for the Celebration of the Passion of the Lord: the Word, the Cross and Communion. It is a day of fast and abstinence for every Catholic, and a day for silence. Kept properly, it is one of the most beautiful days of the year, precisely because nothing on it is comfortable.",
    whatYouNeed: [
      "The time of the Celebration of the Passion at your parish, and of any Stations of the Cross",
      "A plan for the fast: one full meal, two small ones, no meat",
      "A crucifix at home, to pray before in the morning and evening",
      "Money for the Good Friday collection for the Holy Places",
    ],
    whenToPray:
      "Good Friday, the Friday before Easter. The Celebration of the Passion is normally at three in the afternoon; parishes may hold it later for those at work, but never in the morning. The Divine Mercy Novena also begins on this day.",
    tips: [
      "Ask for the afternoon off, or the whole day, well ahead. Good Friday is not a public holiday in most of the United States, and the liturgy is at three.",
      "Keep the fast through Holy Saturday until the Easter Vigil if you can; the Church specifically commends this paschal fast.",
      "Turn off music, television and social media for the day. Silence is the Church's own way of keeping Good Friday.",
      "Do not expect to receive absolution during the liturgy; confess on Monday, Tuesday or Wednesday of Holy Week instead.",
    ],
    durationMinutes: 30,
    relatedPrayers: ["prayer-before-a-crucifix", "anima-christi", "stabat-mater"],
    relatedDevotions: ["stations-of-the-cross", "divine-mercy-chaplet", "seven-sorrows-of-mary"],
    relatedPractices: ["fasting"],
    relatedSaints: ["saint-faustina-kowalska"],
    steps: [
      {
        order: 1,
        title: "Keep the fast and abstinence",
        body: `Good Friday is one of the two days of obligatory fasting and abstinence in the year. Fasting binds Catholics aged 18 to 59 and permits ${FAST_RULE}; abstinence from meat binds everyone 14 and older. The sick, and pregnant or nursing women, are excused. Make the fast a real one: eat the small meals plainly and let the hunger of the day remind you of the One who thirsted on the cross. Many families keep the full meal until after the afternoon liturgy.`,
      },
      {
        order: 2,
        title: "Keep the day quiet",
        body: "Begin the morning before a crucifix, praying the Prayer Before a Crucifix slowly, and decide then what the day will not contain: no music, no screens beyond what work requires, no shopping, no entertaining. Good Friday has no obligation to attend the liturgy, but it has a spirit, and the spirit is mourning. If you must work, keep an inner silence and take a few minutes at three o'clock wherever you are. If you are free, the traditional way to pass the morning is the Stations of the Cross, the Sorrowful Mysteries or the reading of the Passion from Saint John's Gospel at home.",
      },
      {
        order: 3,
        title: "Mark the three o'clock hour",
        body: "Jesus died at the ninth hour, three in the afternoon. Wherever you are at three o'clock, stop, and at least pray the Anima Christi (Soul of Christ) or an act of love for the dying Lord. Good Friday is also the day on which, at Jesus' request to Saint Faustina Kowalska, the Divine Mercy Novena begins, running the nine days to Divine Mercy Sunday, and the three o'clock Hour of Mercy she was asked to keep is fitting on this day above all. If your parish's liturgy is at three, this is the hour you will be in church; if it is later, keep the hour privately and go in the evening.",
      },
      {
        order: 4,
        title: "Take part in the Celebration of the Lord's Passion",
        body: "The liturgy begins in silence: the ministers enter without music and the priest prostrates himself before the bare altar while everyone kneels. The Liturgy of the Word follows, with Isaiah's Suffering Servant, Psalm 31, the Letter to the Hebrews, and the Passion according to John, read or sung with the people taking part. Then come the Solemn Intercessions, ten prayers for the Church, the Pope, the clergy and faithful, catechumens, Christian unity, the Jewish people, those who do not believe in Christ or in God, those in public office, and those in tribulation, each with a call to kneel and to stand. Stay attentive; this is the Church praying for the whole world on the day the world was redeemed.",
      },
      {
        order: 5,
        title: "Venerate the Cross",
        body: "A single cross is brought forward, unveiled in three stages or carried through the church, and shown to the people while the priest sings 'Behold the wood of the Cross, on which hung the salvation of the world', and all reply 'Come, let us adore' and kneel a moment in silence. Then everyone comes forward in procession to venerate it: approach, make a genuflection or a profound bow, and kiss the cross or touch it with your hand, as the parish's custom is, and then return to your place. While the line moves, the choir sings the Reproaches and the ancient hymns of the Cross. Devout participation in this adoration of the Cross in the Good Friday liturgy carries a plenary indulgence under the usual conditions.",
      },
      {
        order: 6,
        title: "Receive Holy Communion from the reserved Sacrament",
        body: "Since no Mass is celebrated, the Blessed Sacrament consecrated at the Mass of the Lord's Supper is brought from the place of repose to the altar. All pray the Our Father together, the priest shows the Host with 'Behold the Lamb of God', and Communion is distributed as usual, under the form of bread alone. Receive with the same reverence and the same conditions as at any Mass: in a state of grace and having fasted for an hour, which today is no difficulty. There is no blessing at the end; the ministers leave in silence, and the church is left bare until the Vigil.",
      },
      {
        order: 7,
        title: "Pray the Stations of the Cross",
        body: "On no day are the Stations more at home. Most parishes pray them publicly on Good Friday, in the morning, at noon, or after the afternoon liturgy, and many walk them outdoors. Go if you can, or pray them at home with the How to Pray the Stations of the Cross guide, kneeling at each station for the versicle 'We adore you, O Christ, and we praise you' with its response 'Because by your holy Cross you have redeemed the world.' The Stabat Mater, sung between the stations, gives Our Lady's place at the foot of the Cross its voice.",
      },
      {
        order: 8,
        title: "End the day in silence",
        body: "Keep the evening as you kept the day. If you have not yet had your one full meal, take it simply now. Pray the Stabat Mater or the Seven Sorrows with Mary, who kept this night, and go to bed early; tomorrow the Church waits at the tomb, and tomorrow night she keeps the Vigil. Consider continuing the fast through Holy Saturday, as the Church commends, so that the first food of Easter tastes like what it is.",
      },
    ],
  }),

  guide({
    slug: "how-to-fulfil-your-easter-duty",
    title: "How to Fulfil Your Easter Duty",
    summary:
      "The Church's precepts to receive Holy Communion at least once a year, in the Easter season, and to confess grave sins at least once a year: what they require, when the window falls, and how to prepare and go beyond the minimum.",
    kind: "lent_preparation",
    sacramentKey: "reconciliation",
    authorityLevel: "VATICAN",
    citations: [V_CIC_EUCH, V_CCC_PRECEPTS, U_PEN],
    intro:
      "The precepts of the Church set the floor beneath which a Catholic life cannot go and still be a practising one. Two of them concern the sacraments: every Catholic who has made first Communion is bound to receive the Eucharist at least once a year, and to do so in the Easter season; and every Catholic who has reached the age of discretion is bound to confess grave sins at least once a year. Because the two are usually fulfilled together in Lent and Eastertide, they have long been called the 'Easter duty'. This guide explains what the law actually says and how to fulfil it well, as a beginning rather than an end.",
    whatYouNeed: [
      "The dates of Lent and the Easter season this year, and your parish's confession times",
      "An examination of conscience (the Examination of Conscience guide on this site)",
      "The Act of Contrition",
    ],
    whenToPray:
      "The Easter season runs from Easter Sunday to Pentecost Sunday, fifty days. In the United States the time for the Easter Communion has long been reckoned more generously, from the First Sunday of Lent to Trinity Sunday.",
    tips: [
      "The annual confession precept binds strictly only for grave sins; if you are not conscious of any, you are not obliged, but the Church earnestly recommends regular confession of venial sins.",
      "You may not receive Communion while conscious of grave sin without first going to confession, whatever the season. The Easter precept does not override that.",
      "If you cannot fulfil the Easter Communion in the season for a just cause, the law allows it at another time of year.",
      "Many parishes hold Lenten penance services with several confessors; they are the easiest way to fulfil the precept if it has been a long time.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["confiteor", "act-of-contrition"],
    relatedPractices: ["ignatian-examen"],
    steps: [
      {
        order: 1,
        title: "Know what the precepts say",
        body: "The Catechism lists the precepts of the Church, among them: 'You shall confess your sins at least once a year' and 'You shall receive the sacrament of the Eucharist at least during the Easter season.' Canon law gives them their exact form. Canon 920 obliges every member of the faithful, after first Communion, to receive the Eucharist at least once a year, during the Easter season unless for a just cause it is done at another time. Canon 989 obliges everyone who has reached the age of discretion to confess grave sins faithfully at least once a year. These are minimums that keep a Catholic in living contact with the sacraments, not a description of a full sacramental life.",
      },
      {
        order: 2,
        title: "Know the Easter season window",
        body: "The Easter season proper runs from the Easter Vigil to Pentecost Sunday, fifty days. In the United States, by a long-standing concession, the time for fulfilling the Easter Communion has been reckoned from the First Sunday of Lent to Trinity Sunday, the Sunday after Pentecost, which gives about fourteen weeks. Choose a Sunday inside that window now, ideally Easter Sunday itself or one of the Sundays of the Octave, and plan confession for the week or two before it.",
      },
      {
        order: 3,
        title: "Prepare with an examination of conscience",
        body: "Set aside fifteen minutes in a quiet place. Ask the Holy Spirit to show you the truth about yourself, then go through your life since your last confession using the Ten Commandments, the Beatitudes and the precepts of the Church; the Examination of Conscience guide walks through them one by one. Note every grave sin, by kind and roughly by number, and the venial sins that weigh on you most. Then pray the Confiteor, which is the Church's own short act of confession, and go the same day or the next, before the resolve fades.",
      },
      {
        order: 4,
        title: "Go to confession",
        body: "Go at your parish's regular time or to a Lenten penance service. Begin with the Sign of the Cross and 'Bless me, Father, for I have sinned; it has been (however long) since my last confession', say your sins plainly, listen to the priest's counsel and accept the penance, pray the Act of Contrition, and receive absolution. The How to Go to Confession guide gives the whole form, and the How to Return to Confession After Many Years guide is written for exactly that case. Do your penance as soon as you can afterward.",
      },
      {
        order: 5,
        title: "Receive Holy Communion",
        body: "Go to Mass on the Sunday you chose, in a state of grace, having kept the hour's fast from food and drink other than water and medicine, and receive the Eucharist. That receiving fulfils the precept; but receive it as what it is, the Body of Christ given at Easter, and make a thanksgiving afterward in your place, with the Anima Christi or in your own words. If for a just cause you cannot receive in the season, the law allows another time, but do not let the year pass.",
      },
      {
        order: 6,
        title: "Continue beyond the minimum",
        body: "The precepts mark the least that keeps a Catholic alive in the sacraments; the Church's hope is far more. Sunday Mass every week is itself a precept, and Communion at every Mass one attends, in a state of grace, is the ordinary practice the Church encourages. Regular confession, monthly for many, keeps the conscience clear and the will strong even when there is no grave sin to confess. Having fulfilled the Easter duty, decide when you will next go to confession and write it down; the duty is meant to open a door, not to close one.",
      },
    ],
  }),

  // ──────────────────────── I. ADVENT & CHRISTMAS ────────────────────────
  guide({
    slug: "advent-preparation-guide",
    title: "How to Prepare for Advent",
    summary:
      "The season of waiting: what Advent is and how its two halves differ, the wreath, confession before Christmas, the Advent readings and the Immaculate Conception, fasting from the rush, the O Antiphons and Christmas Eve.",
    kind: "advent_preparation",
    authorityLevel: "USCCB",
    citations: [U_ADVENT, V_DPP, U_XMAS],
    intro:
      "Advent opens the Church's year. It begins on the evening before the Sunday nearest 30 November and ends on the afternoon of 24 December, four Sundays and up to four weeks of waiting for Christ: for his coming in the flesh at Bethlehem, which Christmas celebrates, and for his coming in glory at the end of time, which the season's first weeks keep before us. It is a season of devout and joyful expectation rather than of penance in Lent's sense, though it wears violet and holds its joy in reserve. The whole difficulty of Advent is that the world around it is already keeping Christmas; the whole art of it is to wait anyway.",
    whatYouNeed: [
      "A calendar with the four Sundays of Advent, 8 December and 17 December marked",
      "An Advent wreath with three violet candles and one rose candle",
      "A Bible or missal for the Advent readings from Isaiah and the Gospels",
      "The confession times at your parish before Christmas",
    ],
    whenToPray:
      "From the First Sunday of Advent (between 27 November and 3 December) to the afternoon of 24 December; the last eight days, 17 to 24 December, are the immediate preparation for Christmas.",
    tips: [
      "Advent has two halves. Until 16 December the readings look toward the Lord's second coming; from 17 December they turn to the events before his birth. Let your prayer follow that shift.",
      "Do not begin the Christmas carols at home until Christmas Eve if you can bear it; Advent has hymns of its own, above all 'O Come, O Come, Emmanuel'.",
      "The Immaculate Conception on 8 December is a holy day of obligation in the United States; check your parish's Mass times early in the week.",
      "Fast from the rush: decide before the season which invitations, purchases and commitments you will decline.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["angelus", "magnificat", "benedictus-canticle-of-zechariah"],
    relatedDevotions: ["liturgy-of-the-hours", "holy-rosary"],
    relatedPractices: ["lectio-divina"],
    steps: [
      {
        order: 1,
        title: "Understand what Advent is",
        body: "Advent, from the Latin adventus, 'coming', is the four-week season that begins the liturgical year and prepares for Christmas. The Church keeps it as a time of expectation with two objects: the memory of the Son of God's first coming among us, and the longing for his second coming at the end of time. It wears violet, omits the Gloria at Sunday Mass so that the angels' song may return fresh at Christmas, and reads Isaiah, John the Baptist and the Virgin Mary week by week. Advent is not Lent: fasting is not required, and its spirit is joyful. But it is not Christmas either, and keeping the difference is the whole of this guide.",
      },
      {
        order: 2,
        title: "Keep the two halves",
        body: "The liturgy divides the season at 17 December. From the First Sunday until 16 December the readings and prayers look toward the Lord's coming in glory, with Isaiah's promises and John the Baptist's call to prepare the way; the third Sunday, Gaudete Sunday, wears rose and tells us to rejoice, for the Lord is near. From 17 to 24 December everything turns to the immediate preparation for his birth: the Gospels of the annunciations to Zechariah, Mary and Joseph, the Visitation, the birth of John, and at Vespers the great O Antiphons. Read the day's Gospel each morning and you will feel the season change under you.",
      },
      {
        order: 3,
        title: "Set up and light the wreath",
        body: "The Advent wreath, a circle of evergreen with four candles, three violet and one rose, has become the season's sign in Catholic homes as well as in churches. Bless it on or just before the First Sunday of Advent and light one candle that week, two the second, three (adding the rose) the third, and all four in the last week, at the evening meal or at family prayer. The How to Make and Bless an Advent Wreath guide gives the blessing and the weekly order. Its growing light through the darkest weeks of the year says what the season says: the Light is coming.",
      },
      {
        order: 4,
        title: "Go to confession before Christmas",
        body: "The Church has always joined the joy of Christmas to the purification of the heart; John the Baptist, whom Advent hears twice, preached a baptism of repentance to make ready. Go to confession during Advent, ideally in the first two weeks, before the parish schedules fill with Christmas preparations. Prepare with the Examination of Conscience guide and pray the Act of Contrition. If it has been years, the How to Return to Confession After Many Years guide is written for you, and Advent is a good time to come home.",
      },
      {
        order: 5,
        title: "Keep the Advent readings and the Immaculate Conception",
        body: "Advent's weekday Mass readings are almost all from Isaiah, and reading them at home, even five minutes a day, is the simplest Advent practice there is. Within the season fall the Solemnity of the Immaculate Conception on 8 December, a holy day of obligation and the patronal feast of the United States, and the feast of Our Lady of Guadalupe on 12 December. Both belong to Advent's meaning: the Mother who waited for the Child. Pray The Angelus at noon through the season; it is the Advent prayer par excellence, telling the Incarnation three times a day.",
      },
      {
        order: 6,
        title: "Fast from the rush",
        body: "The world's December is loud, full and finished by the twenty-fourth; Advent is quiet, empty and only beginning. Choose now what you will not do this year: which parties to decline, which shopping to finish early or drop, which evenings to keep free, which screens to switch off after dinner. Give the time to the readings, the wreath and the people who will be alone at Christmas. If you keep a small fast, from sweets or from music, until Christmas Eve, the feast will be a feast. Advent's penance, such as it is, is mostly the penance of waiting.",
      },
      {
        order: 7,
        title: "Pray the O Antiphons",
        body: "From 17 to 23 December the Church sings, before the Magnificat at Evening Prayer, seven ancient antiphons that call on Christ by his prophetic titles: Wisdom, Lord, Root of Jesse, Key of David, Dawn, King of the Nations, Emmanuel. Each begins with 'O' and ends with 'come'. The hymn 'O Come, O Come, Emmanuel' is a paraphrase of them. Pray one each evening with the Magnificat, or with the whole of Evening Prayer; the How to Pray the O Antiphons guide gives each one. These seven days are the heart of Advent.",
      },
      {
        order: 8,
        title: "Keep Christmas Eve",
        body: "Advent ends on the afternoon of 24 December, and Christmas begins with the evening's first Vespers and the Vigil Mass. Spend the day finishing, not starting: the last candle, the crib set up with the manger still empty, the house made quiet. At Evening Prayer the Church sings the Benedictus (Canticle of Zechariah) at Morning Prayer and the Magnificat at evening every day of the year, but on this day their words about the dawn from on high and the promise to our fathers come true. Go to the Vigil Mass, the Mass during the Night or the Mass at Dawn, and place the Child in the manger when you come home.",
      },
    ],
  }),

  guide({
    slug: "how-to-make-and-bless-an-advent-wreath",
    title: "How to Make and Bless an Advent Wreath",
    summary:
      "Making the wreath with evergreen and three violet and one rose candle, blessing it at home at the start of Advent, the order of lighting week by week, the prayer to say each evening, and the Christmas custom of the white candle.",
    kind: "advent_preparation",
    authorityLevel: "USCCB",
    citations: [U_ADVENT, V_DPP],
    intro:
      "The Advent wreath began in the homes of German-speaking Christians and has become one of the most loved signs of the season in churches and households alike. The Church's Directory on Popular Piety welcomes it: its evergreen circle speaks of eternity and the four candles of the four weeks of waiting, with their growing light marking the approach of the Light of the world. The Book of Blessings provides an order for blessing the wreath in church and another for the home, led by a parent. This guide gives the practical making, the shape of the household blessing, and the week-by-week lighting.",
    whatYouNeed: [
      "A circular base and fresh or artificial evergreen (fir, pine, holly, laurel)",
      "Four candles: three violet and one rose, in holders set into the wreath",
      "A Bible, for the short reading from Isaiah at the blessing",
      "Catholic Household Blessings and Prayers (USCCB) or the Book of Blessings, for the blessing text",
    ],
    whenToPray:
      "Bless the wreath on the First Sunday of Advent or on the Saturday evening before it. Light the candles daily, at the evening meal or family prayer, through 24 December.",
    tips: [
      "The colours match the vestments of the four Sundays: violet for the first, second and fourth, rose for Gaudete Sunday, the third.",
      "Keep real evergreen away from the flames and never leave lit candles unattended; a wreath on the dinner table, lit only while the family is there, is the safest custom.",
      "If a candle burns down early, replace it; there is no rule that says the first candle must be the shortest by Christmas, though it usually is.",
      "In church the wreath is blessed once, at the first Mass of Advent, and its candles are lit before Mass thereafter without further ceremony.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["our-father", "angelus"],
    steps: [
      {
        order: 1,
        title: "Gather what you need",
        body: "You need a base, a circle of wire, foam or wood with four candle holders; enough evergreen to cover it, real or artificial; and the four candles, three violet and one rose. Florists and parish shops sell candle sets in Advent, and many parishes hold a wreath-making afternoon on the Saturday before the First Sunday. A wreath can be as simple as four candles set in a ring of greenery on a plate, and there is no rule about size, so long as the four candles and the evergreen are there.",
      },
      {
        order: 2,
        title: "Make the wreath",
        body: "Fasten the greenery around the base so that it forms an unbroken circle; the circle without beginning or end is part of the sign. Set the four candles evenly around it, upright and firm, with the rose candle in the position you will light third. Trim the greenery well back from the wicks. Place the finished wreath where the household actually gathers, most often the centre of the table where you eat in the evening, so that it is lit at a moment when everyone is present.",
      },
      {
        order: 3,
        title: "Bless the wreath at the start of Advent",
        body: "On the First Sunday of Advent, or the evening before, gather the household around the unlit wreath. The Book of Blessings gives the order for the home, which a parent leads: all make the Sign of the Cross; one member reads a short passage from Isaiah, such as the promise of the people who walked in darkness seeing a great light; the leader says the prayer of blessing, asking God to bless the wreath and the family that gathers around it as they wait for Christ; and then the first candle is lit. The full text is in the USCCB's Catholic Household Blessings and Prayers. Blessing the wreath is done once; from then on you simply light it.",
      },
      {
        order: 4,
        title: "Light the candles in order, week by week",
        body: "In the first week, light one violet candle. In the second week, light that candle and a second violet one. In the third week, from Gaudete Sunday, light the two violet candles and the rose candle. In the fourth week, light all four. Light them in the same order each evening so that the first candle burns down furthest, and light them from the previous week's candles when you can, letting the light grow. Blow them out when the meal or the prayer is finished.",
      },
      {
        order: 5,
        title: "Say the weekly prayer",
        body: "When the candles are lit, pray together. The simplest form is the Collect of that Sunday's Mass, printed in any missal, followed by the Our Father; many families pray The Angelus, which tells the Incarnation the season is waiting for, or sing a verse of 'O Come, O Come, Emmanuel' and then read the day's Gospel. Keep it short enough to repeat every evening, and let the children light the candles and lead the prayer as they are able. The wreath's whole purpose is that the family should pray at it.",
      },
      {
        order: 6,
        title: "Keep the wreath through Christmas",
        body: "The wreath's four candles belong to Advent and are lit for the last time on the evening of 24 December. Many households then keep the wreath for the Christmas season, replacing the violet and rose candles with white ones or setting a single white candle in the centre for Christ, and lighting it at the evening meal until the Baptism of the Lord. This is a household custom rather than part of the Church's rite, and a good one: the green circle that measured the waiting now frames the feast.",
      },
    ],
  }),

  guide({
    slug: "how-to-pray-the-o-antiphons",
    title: "How to Pray the O Antiphons",
    summary:
      "The seven ancient antiphons sung before the Magnificat at Evening Prayer from 17 to 23 December, each calling on Christ by a title from Isaiah: what they are, one for each evening, and how to pray them with the Magnificat.",
    kind: "advent_preparation",
    authorityLevel: "USCCB",
    citations: [U_LOTH, U_ADVENT, V_DPP],
    intro:
      "In the last seven days before Christmas Eve the Church's Evening Prayer changes its voice. Before and after the Magnificat, from 17 to 23 December, it sings one of the seven 'O Antiphons', short prayers of great age (they were known in Rome by the eighth century) that address the coming Christ by titles the prophets gave him and end each time with the cry 'Come'. Taken in order they gather the whole longing of the Old Testament into a week. The hymn 'O Come, O Come, Emmanuel' is their paraphrase, and the Alleluia verse at Mass on these days uses them too. They are the simplest way to keep the last week of Advent as the Church keeps it.",
    whatYouNeed: [
      "The Magnificat, in a missal, a Liturgy of the Hours volume, or from the prayer list below",
      "The seven antiphons (below, and as the O Antiphons prayer entry)",
      "Five quiet minutes at evening, ideally by the Advent wreath",
    ],
    whenToPray:
      "One antiphon each evening, 17 to 23 December, before and after the Magnificat at Evening Prayer (Vespers), which is prayed at dusk or after the evening meal.",
    tips: [
      "Each antiphon has the same shape: the title, what Scripture says of it, and 'Come'. Say the 'Come' as your own.",
      "Read backwards, the first letters of the Latin titles (Sapientia, Adonai, Radix, Clavis, Oriens, Rex, Emmanuel) spell ERO CRAS, 'Tomorrow I will be there', a play on words the medieval Church delighted in.",
      "If you pray the full Liturgy of the Hours, the antiphons are already in place; if you do not, the antiphon and the Magnificat alone are a complete Advent evening prayer.",
      "Sing 'O Come, O Come, Emmanuel' with the verse that matches the day's antiphon.",
    ],
    durationMinutes: 10,
    relatedPrayers: ["o-antiphons", "magnificat"],
    relatedDevotions: ["liturgy-of-the-hours"],
    steps: [
      {
        order: 1,
        title: "Understand what the O Antiphons are",
        body: "An antiphon is a short verse sung before and after a psalm or canticle. At Evening Prayer the canticle is always the Magnificat, Mary's song from Luke's Gospel, and from 17 to 23 December its antiphon is one of the seven 'Great O's', each beginning with the exclamation 'O' and a title of the Messiah drawn from Isaiah and the prophets: Wisdom, Lord, Root of Jesse, Key of David, Dawn, King of the Nations, Emmanuel. Each recalls what Scripture promises under that title and ends by begging Christ to come. To pray them is to stand in Israel's long waiting on the evenings just before it ends.",
      },
      {
        order: 2,
        title: "17 December: O Wisdom (O Sapientia)",
        body: "O Wisdom, who came forth from the mouth of the Most High, reaching from end to end and ordering all things mightily and sweetly: come, and teach us the way of prudence. The title is from the Wisdom books, where God's Wisdom is present at creation and reaches across the whole world, and from Isaiah's promise that the Spirit of wisdom and understanding will rest on the shoot of Jesse. Pray it before the Magnificat, then the Magnificat, then the antiphon once more, and end with a Glory Be.",
      },
      {
        order: 3,
        title: "18 December: O Lord (O Adonai)",
        body: "O Adonai and leader of the house of Israel, who appeared to Moses in the flame of the burning bush and gave him the law on Sinai: come, and redeem us with outstretched arm. Adonai is the Hebrew word Israel spoke in place of the divine name; the antiphon confesses that the Child of Bethlehem is the God of Exodus. Pray it with the Magnificat as before, remembering that the arm stretched out to save will be stretched out on the Cross.",
      },
      {
        order: 4,
        title: "19 December: O Root of Jesse (O Radix Jesse)",
        body: "O Root of Jesse, who stand as a sign among the peoples, before whom kings will keep silence and to whom the nations will make their prayer: come, and deliver us, and do not delay. Jesse was David's father, and Isaiah promised that from his stump a shoot would spring, a sign raised for all the nations. The Magnificat's 'he has helped his servant Israel, remembering his promise' is the answer to this antiphon.",
      },
      {
        order: 5,
        title: "20 December: O Key of David (O Clavis David)",
        body: "O Key of David and sceptre of the house of Israel, who open and no one can shut, who shut and no one can open: come, and lead out the captive from the prison, sitting in darkness and the shadow of death. The image is from Isaiah's promise to Eliakim and is taken up in the book of Revelation for Christ himself. Pray it with the Magnificat for anyone you know who is imprisoned in any sense, and for the souls in purgatory.",
      },
      {
        order: 6,
        title: "21 December: O Dawn (O Oriens)",
        body: "O Radiant Dawn, splendour of eternal light and sun of justice: come, and enlighten those who sit in darkness and the shadow of death. This antiphon falls near the shortest day of the year in the northern hemisphere, and the Church chose it for that reason; Zechariah's Benedictus (Canticle of Zechariah) calls the coming Christ 'the dawn from on high'. Pray it at dusk with the Magnificat, by candlelight if you can.",
      },
      {
        order: 7,
        title: "22 December: O King of the Nations (O Rex Gentium)",
        body: "O King of the nations and their desire, the cornerstone who make both one: come, and save the human race, whom you formed from the clay. Isaiah's cornerstone and Saint Paul's 'he has made both one' describe a King whose kingdom has no border; the clay is Genesis. Pray it with the Magnificat, which sings that God 'has cast down the mighty from their thrones and lifted up the lowly', and remember that this King's throne is a manger.",
      },
      {
        order: 8,
        title: "23 December: O Emmanuel",
        body: "O Emmanuel, our King and Lawgiver, the hope of the nations and their Saviour: come, and save us, O Lord our God. The last title is Isaiah's word to Ahaz, 'God with us', which Matthew's Gospel will apply to the Child of Mary. All seven petitions come to rest here: the coming God is God with us. Pray it with the Magnificat, and let the 'Come' be the whole prayer of the last full day of Advent.",
      },
      {
        order: 9,
        title: "Pray them with the Magnificat",
        body: "The antiphons are made to frame the Magnificat, so the full form each evening is: the day's antiphon; the Magnificat, 'My soul proclaims the greatness of the Lord'; a Glory Be; and the antiphon again. If you are praying Evening Prayer in full, it is already there; if not, this alone takes three minutes and is a real Advent Vespers. Pray it standing, with the Sign of the Cross at the Magnificat's first words, as the Church does, and sing it if you can. On 24 December Advent ends at the afternoon, and Evening Prayer is already the first Vespers of Christmas.",
      },
    ],
  }),

  guide({
    slug: "how-to-set-up-and-bless-a-nativity-scene",
    title: "How to Set Up and Bless a Nativity Scene",
    summary:
      "The crib at home in the tradition of Saint Francis at Greccio: where to place it, setting the figures in order, keeping the manger empty until Christmas, the household blessing, placing the Child on Christmas Eve and the Magi at Epiphany.",
    kind: "advent_preparation",
    authorityLevel: "VATICAN",
    citations: [V_AS, V_DPP],
    intro:
      "The Christmas crib, or nativity scene, goes back to Saint Francis of Assisi, who in 1223 at Greccio set up a manger with an ox and an ass and had Mass celebrated before it so that the people could see with their own eyes the poverty of the Child of Bethlehem. Pope Francis's apostolic letter Admirabile signum (2019) calls the crib a living Gospel and asks that the custom never be lost in homes, schools, workplaces and public squares. The Church's Directory on Popular Piety commends the family crib in the same terms and the Book of Blessings gives an order for blessing it at home. This guide is for setting one up so that it is prayed at, not only looked at.",
    whatYouNeed: [
      "A set of figures: Mary, Joseph, the Child, shepherds and sheep, the ox and the ass, an angel, and the three Magi with their camels",
      "A stable or cave and a manger, bought or made",
      "A Bible, for Saint Luke's account of the birth at the blessing",
      "Catholic Household Blessings and Prayers (USCCB) or the Book of Blessings, for the blessing text",
    ],
    whenToPray:
      "Set up the crib during Advent, bless it on Christmas Eve or when it is set up, place the Child at Christmas, add the Magi at Epiphany, and keep it through the Christmas season.",
    tips: [
      "Let the children build it. Pope Francis notes that the crib is where children first learn the Gospel, and a scene they have arranged is one they will pray at.",
      "A home-made stable from a box and moss is entirely in the spirit of Greccio; expensive figures are not the point, poverty is.",
      "Keep the Child hidden, wrapped in a cloth in a drawer, until Christmas Eve, and let the youngest place him.",
      "The Christmas season ends with the Baptism of the Lord; an older custom keeps the crib until the Presentation on 2 February, as Saint Peter's Square does.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["our-father", "glory-be"],
    relatedSaints: ["saint-francis-of-assisi"],
    steps: [
      {
        order: 1,
        title: "Understand why the crib",
        body: "Saint Francis wanted people to see the hardship of the Child's birth, and the crib has taught the Incarnation to the eyes ever since. Pope Francis draws out its lessons in Admirabile signum: the night sky and the poor landscape say that God comes into our real world; the ruined stable says that he comes to rebuild what sin has broken; the shepherds say that the poor are the first invited; the ox and the ass, from Isaiah's 'the ox knows its owner', say that all creation recognises him; and Mary and Joseph say that God entrusts himself to a family. Setting up a crib is a way of preaching the Gospel in your own house.",
      },
      {
        order: 2,
        title: "Choose where to place it",
        body: "Put the crib where the household lives and prays, a mantel, a side table, the base of the Christmas tree, or a low table where children can reach it. It should be visible from where you sit in the evening, so that it can be the place of a short prayer, and safe from candles and pets. If the house has a prayer corner with a crucifix and an image of Our Lady, the crib belongs there through the season. A nativity scene in the window or the front garden, where neighbours see it, is an old and good custom too.",
      },
      {
        order: 3,
        title: "Set the figures in order",
        body: "Build the scene from the back: the stable or cave, the landscape and the starry sky, then the animals inside, then Mary and Joseph beside the empty manger, and the shepherds and sheep on the hillside a little way off, as if still on their way. The angel goes above the stable or over the shepherds. Set the three Magi far away at the edge of the room, and move them a little closer each day of the Christmas season; children love this. A star can be added on Christmas Eve. Leave the manger empty.",
      },
      {
        order: 4,
        title: "Keep the manger empty until Christmas",
        body: "The one rule the custom has is that the Child is not placed in the manger until Christmas. Through Advent the empty manger is itself the prayer: the whole scene is waiting, as the Church is waiting. Keep the figure of the Child wrapped and put away, and if there are children in the house let them know he is coming and when. This small discipline teaches Advent better than any explanation, because the children will ask every day whether it is time yet.",
      },
      {
        order: 5,
        title: "Bless the crib",
        body: "The Book of Blessings gives an Order for the Blessing of a Christmas Manger or Nativity Scene, with a form for the home led by a parent or another member of the family; it may be used on Christmas Eve or, if the scene is set up earlier, when it is completed. All gather before the crib and make the Sign of the Cross; one member reads Saint Luke's account of the birth of Jesus, from the census in Bethlehem to the laying of the Child in the manger; the leader says the prayer of blessing, asking God to bless the scene and all who look on it; and all end with the Our Father and a Glory Be. The text is in the USCCB's Catholic Household Blessings and Prayers.",
      },
      {
        order: 6,
        title: "Place the Child on Christmas Eve",
        body: "On Christmas Eve, after nightfall, or on returning from the Vigil Mass or the Mass during the Night, gather the household at the crib and let the youngest, or the eldest, place the Child in the manger while the others sing a carol, 'Silent Night' or 'O Come, All Ye Faithful', or say the Glory Be. If you have not yet blessed the crib, bless it now. From this evening the empty manger is full, and the crib is the place to pray the Our Father together each evening of the Christmas season.",
      },
      {
        order: 7,
        title: "Add the Magi at Epiphany",
        body: "On the Epiphany, celebrated in the United States on the Sunday between 2 and 8 January, the Magi arrive: move them, with their camels and gifts, into the stable before the Child, and read the account from Saint Matthew's Gospel of the wise men, the star and the three gifts. Many families mark the day with the traditional chalk blessing of the front door with the year and the initials C+M+B. The crib then stays until the Baptism of the Lord, the Sunday after Epiphany, which ends the Christmas season; if you keep the older custom, until the Presentation of the Lord on 2 February. Pack the figures away with care; the same crib, set up year after year, becomes part of a family's memory of the faith.",
      },
    ],
  }),

  guide({
    slug: "how-to-pray-the-christmas-novena",
    title: "How to Pray the Christmas Novena",
    summary:
      "The nine days before Christmas, 16 to 24 December: what the novena is and why the Church encourages it, choosing a form rooted in the liturgy, the daily pattern of Scripture, prayer and antiphon, confession within the nine days, and the Christmas Eve conclusion.",
    kind: "advent_preparation",
    authorityLevel: "VATICAN",
    citations: [V_DPP, U_ADVENT],
    intro:
      "A novena is nine days of prayer before a feast, and the Christmas novena is among the oldest and most widely kept, prayed from 16 December to Christmas Eve in parishes and homes across the Catholic world. The Church's Directory on Popular Piety notes that it began as a way of bringing the riches of the liturgy to the people, and asks that it be kept and, where necessary, brought closer to the liturgy of Advent's last days: the O Antiphons, the Gospels of 17 to 24 December and the Magnificat. This guide gives a form that does exactly that, and room for the traditions of your own family or community.",
    whatYouNeed: [
      "A Bible or missal, for the Gospel of each day from 17 to 24 December",
      "The O Antiphons and the Magnificat (below and in the prayer list)",
      "A fixed time each evening and, ideally, the Advent wreath or the empty crib to pray before",
    ],
    whenToPray:
      "Every day from 16 to 24 December, at the same hour, most naturally in the evening; from the 17th the O Antiphon of the day is included.",
    tips: [
      "Nine days at the same time each day is the whole discipline. Choose an hour the household can keep and do not move it.",
      "Many parishes pray the novena publicly at Evening Prayer or before evening Mass; praying with the parish is the fuller form.",
      "Where a traditional form is kept, the Latin American Novena de Aguinaldos, the Posadas of 16 to 24 December, or an Italian parish novena, keep it; the Church asks only that its Scripture and prayers stay close to the liturgy.",
      "Put confession inside the nine days so that Christmas Communion is made with a clean heart.",
    ],
    durationMinutes: 10,
    relatedPrayers: ["magnificat", "o-antiphons", "angelus", "hail-mary"],
    relatedDevotions: ["liturgy-of-the-hours", "holy-rosary"],
    steps: [
      {
        order: 1,
        title: "Understand what the novena is",
        body: "The nine days from 16 to 24 December are the Church's immediate preparation for Christmas: from the 17th the Mass readings leave the general theme of the Lord's coming and tell the story leading up to his birth, and Evening Prayer sings the O Antiphons. The Christmas novena grew out of the people's wish to pray these days together, and it takes many forms, from sung parish Vespers to family devotions with a Hispanic or Italian heritage. What they share is nine evenings of Scripture, prayer and song that walk the last days to Bethlehem. Keep the count: nine days, ending on Christmas Eve.",
      },
      {
        order: 2,
        title: "Choose the form",
        body: "If your parish holds a novena, join it. If you are praying at home, choose one form and keep it for all nine days: either the liturgical form given in the next steps (the day's Gospel, an O Antiphon, the Magnificat), or a traditional novena of your family or culture, such as the Novena de Aguinaldos, with its daily prayers and carols, or Las Posadas, in which the household or neighbourhood re-enacts Mary and Joseph's search for lodging each of the nine nights. Any sound form will have Scripture, prayer to the coming Christ, and Mary in it; the Directory asks only that the novena not drift from the liturgy it was born to serve.",
      },
      {
        order: 3,
        title: "Gather at a fixed hour",
        body: "Set a time, the evening meal or just after, and a place, before the Advent wreath or the empty crib. Light the wreath's candles, make the Sign of the Cross, and begin with a short invocation to the coming Lord: the Church's own is 'Come, Lord Jesus'. On 16 December, before the O Antiphons begin, read Isaiah's promise of the child to be born or the Annunciation from Saint Luke. Keep the whole thing to ten minutes so it survives nine busy December evenings.",
      },
      {
        order: 4,
        title: "Each day: the Scripture, the prayer and the antiphon",
        body: "From 17 December the pattern is fixed. Read the Gospel of the day's Mass: the genealogy of Jesus (17th), the annunciation to Joseph (18th), the annunciation to Zechariah (19th), the annunciation to Mary (20th), the Visitation (21st), the Magnificat (22nd), the birth of John the Baptist (23rd), and the Benedictus (24th). Then pray the day's O Antiphon, the Magnificat, and the antiphon again, as at Evening Prayer; the How to Pray the O Antiphons guide gives each one. End with a Hail Mary for the Mother who is nearly at Bethlehem, and a carol of Advent, 'O Come, O Come, Emmanuel' above all.",
      },
      {
        order: 5,
        title: "Go to confession within the nine days",
        body: "The novena's purpose is that Christmas should find us ready, and the Church's ordinary means of readiness is the Sacrament of Penance. Choose a day within the nine and go, using the Examination of Conscience guide beforehand and the Act of Contrition at the sacrament. Parishes add confession times in the last week of Advent, and the whole household going together on the same evening, then praying that night's novena at home, is a fine tradition. Do not leave it to Christmas Eve, when priests are least available.",
      },
      {
        order: 6,
        title: "Conclude on Christmas Eve",
        body: "The ninth day is 24 December. Pray the novena for the last time in the afternoon or early evening, with the Gospel of the Benedictus and, in place of an O Antiphon, the Church's own first Vespers of Christmas or simply The Angelus, which tells the mystery about to be celebrated. Then place the Child in the crib, sing the first carol of Christmas, and go to the Vigil Mass, the Mass during the Night or the Mass at Dawn. The novena ends where the feast begins; that is its whole design.",
      },
    ],
  }),

  // ────────────────────────── J. BECOMING CATHOLIC ──────────────────────────
  guide({
    slug: "ocia-rcia-overview",
    title: "OCIA: How Adults Become Catholic",
    summary:
      "The Order of Christian Initiation of Adults, formerly called the RCIA, from first inquiry to the Easter Vigil and beyond: who it is for, the periods and rites in order, what happens at each, and how long it takes.",
    kind: "ocia",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_OCIA, U_BAPT, V_CCC_INIT],
    intro:
      "Every Easter Vigil, in parishes across the world, adults are baptized, confirmed and receive the Eucharist for the first time, and other adults already baptized in other Christian communities are received into full communion with the Catholic Church. The path that brings them there is the Order of Christian Initiation of Adults, the OCIA, known in English until recently as the Rite of Christian Initiation of Adults or RCIA. It is not a class but a journey in stages, each marked by a liturgical rite, that restores the ancient catechumenate of the early Church. This guide gives the whole road in order, so that an inquirer, a sponsor or a parishioner can see where each step leads.",
    whatYouNeed: [
      "A parish: the OCIA is always lived in a particular community, not online or alone",
      "A willingness to take part in Sunday Mass from the beginning, even before you can receive Communion",
      "Your baptismal certificate, if you were baptized in another Christian community",
      "Patience: the journey is measured in seasons, not weeks",
    ],
    whenToPray:
      "Inquiry can begin at any time of year. The Rite of Election is celebrated on the First Sunday of Lent, the scrutinies on the third, fourth and fifth Sundays of Lent, the sacraments of initiation at the Easter Vigil, and mystagogy through the Easter season.",
    tips: [
      "There are three different situations: the unbaptized (catechumens), baptized non-Catholic Christians (candidates for reception), and baptized Catholics never catechised or confirmed. Ask which one you are; the rites differ.",
      "A valid baptism is never repeated. If you were baptized with water in the name of the Father, the Son and the Holy Spirit, you will not be baptized again.",
      "The United States norms envisage about a year of formation for catechumens, usually from one Easter season to the next, but the length is set by your readiness, not the calendar.",
      "Raise any previous marriage, yours or your spouse's, at the first meeting; it may need to be addressed and is better begun early.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["apostles-creed", "our-father", "nicene-creed"],
    relatedSaints: [
      "saint-augustine-of-hippo",
      "saint-john-henry-newman",
      "saint-elizabeth-ann-seton",
    ],
    steps: [
      {
        order: 1,
        title: "Know who the OCIA is for",
        body: "The Order is written first for adults who have never been baptized; they are called inquirers, then catechumens, then the elect, and they receive all three sacraments of initiation, Baptism, Confirmation and Eucharist, at the Easter Vigil. It is adapted for baptized Christians of other communities who seek full communion with the Catholic Church; they are called candidates, are never re-baptized, and are received by a profession of faith followed by Confirmation and the Eucharist, which need not be at the Vigil. It is adapted again for baptized Catholics who were never taught the faith or confirmed, who prepare for Confirmation and first Communion. Children of catechetical age follow the same path in a form suited to them.",
      },
      {
        order: 2,
        title: "The period of inquiry",
        body: "The first period, called evangelization and precatechumenate, has no fixed length and no rite to begin it. Inquirers meet with the parish's OCIA team, ask their questions, hear the Gospel proclaimed, come to Sunday Mass, and begin to know Catholics. Nothing is asked of them but honesty and attendance. Its purpose is initial conversion: coming to want to follow Christ in his Church. When an inquirer and the parish agree that this has happened, the inquirer asks to be accepted as a catechumen. Someone from the parish, a sponsor, accompanies them from this point.",
      },
      {
        order: 3,
        title: "The Rite of Acceptance into the Order of Catechumens",
        body: "The first liturgical step, usually celebrated at a Sunday Mass, is the Rite of Acceptance. The inquirers gather at the church door with their sponsors, are asked what they seek from God's Church ('Faith'), and what faith offers ('Eternal life'), and promise to follow the way of the Gospel; the priest signs their forehead, and often their ears, eyes, lips, heart, shoulders, hands and feet, with the cross, and they are welcomed into the church for the Liturgy of the Word. From this day they are catechumens, joined to the Church, with a right to Christian burial and to marriage in the Church. Baptized candidates celebrate instead a Rite of Welcoming, without the signing at the door.",
      },
      {
        order: 4,
        title: "The catechumenate",
        body: "The catechumenate is the long central period: formation in the four dimensions the Order names, catechesis in the whole of Catholic teaching, familiarity with the Christian way of life through the community, the liturgy, and apostolic witness. Catechumens attend Sunday Mass with the community and, in most parishes, are dismissed after the homily to reflect on the Word together, since they cannot yet share in the Eucharist. Blessings, minor exorcisms and anointings with the oil of catechumens mark the period. The United States norms ask that it last at least a year. When a catechumen is judged ready, the parish presents them to the bishop.",
      },
      {
        order: 5,
        title: "The Rite of Election",
        body: "On the First Sunday of Lent, usually at the cathedral, the bishop celebrates the Rite of Election or Enrollment of Names. The godparents, chosen by now, testify that the catechumens have listened to God's word, walked in his way and joined in the community's prayer; the catechumens write or have their names written in the Book of the Elect; and the bishop declares them elect, chosen by God for the Easter sacraments. From this day they are called the elect. Baptized candidates may take part in a parallel Call to Continuing Conversion. The rite marks the turn from formation to final preparation.",
      },
      {
        order: 6,
        title: "Purification and enlightenment: the scrutinies",
        body: "Lent is the period of purification and enlightenment, kept with the whole Church. On the third, fourth and fifth Sundays of Lent the elect celebrate the three scrutinies, rites of self-searching and repentance with the Gospels of the Samaritan woman, the man born blind and the raising of Lazarus, in which the community prays for them and the priest prays the exorcism and lays hands on each. In the same weeks the Church hands on to them the Creed and the Lord's Prayer in the two presentations. The How to Participate in the Scrutinies guide gives these rites in detail. On Holy Saturday morning the elect gather for the preparation rites and keep the day in prayer and fasting.",
      },
      {
        order: 7,
        title: "The Easter Vigil: Baptism, Confirmation and Eucharist",
        body: "On Holy Saturday night, at the Easter Vigil, after the fire, the Paschal candle, the Exsultet and the readings of salvation history, the elect are called forward. The Litany of the Saints is sung, the water blessed, and each renounces sin and professes the faith in the words of the Apostles' Creed, is baptized in the name of the Father, and of the Son, and of the Holy Spirit, is clothed in a white garment and given a candle lit from the Paschal candle, and is confirmed with sacred chrism. The whole assembly renews its own baptismal promises. Then, for the first time, the newly baptized receive the Body and Blood of Christ. Candidates for reception, if received that night, make their profession of faith and are confirmed at this point. The How to Prepare for the Easter Vigil guide walks through the night.",
      },
      {
        order: 8,
        title: "Mystagogy",
        body: "Initiation does not end at the Vigil. The Easter season, from Easter to Pentecost, is the period of mystagogy, in which the neophytes, the newly baptized, deepen their grasp of the mysteries they have received by living them: Sunday Mass with the community, especially the Masses of the Easter season, reflection on the sacraments, and a growing share in the parish's life and mission. In the United States the parish is asked to keep gathering the neophytes for at least a year after their initiation. Baptism is a beginning; the neophyte's first year is where the Church learns whether it has made a disciple or only performed a rite.",
      },
    ],
  }),

  guide({
    slug: "how-to-become-catholic",
    title: "How to Become Catholic",
    summary:
      "Practical first steps for an adult drawn to the Catholic Church: praying and asking, contacting a parish, what the first meeting is like, attending Mass, joining inquiry, the seasons of formation, choosing a sponsor and a saint's name, and the Easter Vigil.",
    kind: "ocia",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_OCIA, V_CCC_BAPT, U_SACR],
    intro:
      "People come to the Catholic Church by a thousand roads: a spouse, a friend, a book, a church visited on holiday, a grief, a long argument with God. Whatever the road, the door is the same: a parish, and the Order of Christian Initiation of Adults through which the Church welcomes adults. This guide is about the practical first steps, from the moment you think you might want this to the night you are baptized or received. It assumes nothing about what you already know or believe, except that you are willing to find out.",
    whatYouNeed: [
      "The name, address and phone number of a Catholic parish near you",
      "Your baptismal certificate, or the name and place of the church, if you were baptized as a Christian",
      "A Sunday morning free most weeks",
      "Honesty about your questions and your situation, including any previous marriage",
    ],
    whenToPray:
      "Any time of year is the right time to begin; most parishes receive inquirers continuously and celebrate the sacraments of initiation at the Easter Vigil.",
    tips: [
      "There is no charge, no test to pass and no obligation to continue; you may stop at any point, and many people take more than one run at it.",
      "If you were baptized in another Christian church with water and the Trinitarian formula, your baptism is valid and will not be repeated.",
      "Do not wait until you have all your questions answered. The questions are what inquiry is for.",
      "If a parish does not respond, try another; parishes vary, and the Church is bigger than any one of them.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["our-father", "prayer-to-the-holy-spirit", "apostles-creed"],
    relatedPractices: ["spiritual-direction"],
    relatedSaints: ["saint-augustine-of-hippo", "saint-john-henry-newman"],
    steps: [
      {
        order: 1,
        title: "Pray and ask",
        body: "Before anything else, ask God plainly for what you want: to know whether he is calling you into the Catholic Church, and for the courage to follow if he is. Pray the Our Father every day; it is the prayer the Church will hand to you formally in Lent, and there is no reason not to begin now. Pray Come, Holy Spirit, since it is the Holy Spirit who draws people to Christ. Ask a Catholic you trust to pray for you, and read one of the Gospels, Mark or Luke, from beginning to end.",
      },
      {
        order: 2,
        title: "Contact a parish",
        body: "Find a Catholic parish near you, the one nearest your home or one a friend belongs to, and call or email the office saying that you are interested in becoming Catholic and would like to speak to someone about the OCIA. Most parishes have a priest, deacon or lay coordinator responsible for adult initiation, and they hear this request often. If you have a Catholic friend or spouse, ask them to make the introduction; but you can walk in alone, and many do. Diocesan websites list every parish with contact details.",
      },
      {
        order: 3,
        title: "The first meeting",
        body: "The first meeting is a conversation, not an interview. Expect to be asked about your background, whether you have been baptized and where, your family situation, and what has drawn you to the Church; expect to be able to ask anything in return. Bring your baptismal certificate if you have one. Be frank about a previous marriage, your own or your spouse's, because the Church may need to look at it before you can be received, and that is much better begun now than in Lent. Nothing said in this meeting commits you to anything.",
      },
      {
        order: 4,
        title: "Attend Mass",
        body: "Begin going to Sunday Mass now, every week, at the parish where you are inquiring. You will not receive Communion until you are baptized or received, and you are not expected to; stay in your place, or come forward with your arms crossed over your chest for a blessing where that is the custom. Follow along with the missal, stand and kneel with the people, and let the liturgy teach you. Catholics are formed by the Mass more than by any book, and the OCIA is built around the Sunday assembly.",
      },
      {
        order: 5,
        title: "Join the inquiry sessions",
        body: "Most parishes gather inquirers weekly, in the evening or after a Sunday Mass, for the period of inquiry: sessions in which the Gospel is proclaimed, Catholic belief and life are introduced, and questions are welcomed. There is no syllabus you must complete and no test; the sessions continue until you and the team agree that you want to go further. Meet the other inquirers; the people who begin with you, and their sponsors, become the community you are initiated into.",
      },
      {
        order: 6,
        title: "The seasons of formation",
        body: "When you ask to go further, you are accepted as a catechumen (if unbaptized) or welcomed as a candidate (if baptized), in a rite at Sunday Mass, and the catechumenate begins: fuller instruction in Catholic teaching, prayer, the liturgy and Christian life, week by week, through the seasons. For catechumens the United States norms envisage about a year. Lent brings the Rite of Election with the bishop and the three scrutinies; the OCIA overview guide gives every stage in order. Candidates already baptized may be received sooner, at a time the parish judges right, and go to confession before their reception.",
      },
      {
        order: 7,
        title: "Choose a sponsor and, if you wish, a saint's name",
        body: "During the catechumenate you choose a godparent (for the unbaptized) or a sponsor (for the baptized): a practising Catholic, at least sixteen, confirmed, who has received the Eucharist and lives the faith, and who is not your parent. They stand with you at the rites and, more importantly, walk with you afterward. Many people also choose a saint's name, taken at Baptism or Confirmation as a patron, a custom rather than a requirement. Read the lives of a few saints and pick one whose story speaks to yours; the saints of this site are a good place to begin.",
      },
      {
        order: 8,
        title: "The Easter Vigil, and after",
        body: "On the night of Holy Saturday, at the Easter Vigil, catechumens are baptized, confirmed and receive first Communion, and candidates make their profession of faith, saying the Apostles' Creed and the Church's form of assent, and are confirmed and receive the Eucharist. It is the most beautiful liturgy of the year and you will be at the centre of it. Then comes mystagogy, the Easter season and the first year in which you learn to live as a Catholic within the community. Becoming Catholic ends at the Vigil; being Catholic begins there.",
      },
    ],
  }),

  guide({
    slug: "how-to-be-an-ocia-sponsor",
    title: "How to Be an OCIA Sponsor",
    summary:
      "The role, requirements and duties of a sponsor or godparent for a catechumen or candidate: who may serve, what the role involves, attending sessions and rites, praying for your candidate, the Rite of Election and scrutinies, the Easter Vigil, and staying present afterward.",
    kind: "ocia",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_BAPT, V_CIC_BAPT, U_OCIA],
    intro:
      "No one becomes Catholic alone. The Order of Christian Initiation of Adults gives each inquirer a sponsor from the parish who accompanies them through inquiry and the catechumenate, and each catechumen a godparent, who may be the same person, chosen for the Rite of Election, the Easter Vigil and the years after. Candidates already baptized have a sponsor for their reception and Confirmation. It is one of the most important lay ministries in the Church, and one of the least visible: the sponsor's work is mostly conversation, presence and prayer. This guide sets out who may serve and what the role asks, so that you can say yes with your eyes open.",
    whatYouNeed: [
      "To be a confirmed, practising Catholic at least sixteen years old who has received the Eucharist",
      "One evening a week for the sessions, and the dates of the rites through Lent and Easter",
      "A habit of praying for your candidate by name, daily",
      "Willingness to stay in touch for at least a year after the Vigil",
    ],
    whenToPray:
      "From the first inquiry sessions through the Easter Vigil and the year of mystagogy that follows; the Rite of Election is on the First Sunday of Lent and the scrutinies on the third, fourth and fifth Sundays.",
    tips: [
      "You do not have to be a theologian. Your candidate has teachers; what they need from you is a Catholic friend who lives the faith and will answer honestly, including 'I don't know, let's ask'.",
      "A parent may not be a godparent for their own child, and a baptized non-Catholic Christian may serve only as a Christian witness alongside a Catholic godparent.",
      "The godparent for Baptism is ideally also the sponsor at Confirmation, so that one person stands with the candidate throughout.",
      "Keep the confidences your candidate shares. Much of what you hear is spoken because you are trusted.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["our-father", "prayer-to-the-holy-spirit"],
    relatedSaints: ["saint-monica", "saint-augustine-of-hippo"],
    steps: [
      {
        order: 1,
        title: "Know who may sponsor",
        body: "Canon law sets the requirements for a godparent, and the Church applies them to OCIA sponsors: a Catholic who has completed sixteen years of age (the bishop or pastor may allow an exception), has been confirmed and has received the Eucharist, leads a life in harmony with the faith and the role, is not bound by any canonical penalty, and is not the father or mother of the one to be baptized. A married Catholic must be in a marriage recognised by the Church. There is one godparent, or one of each sex. A baptized non-Catholic Christian may stand as a Christian witness together with a Catholic godparent but may not be the godparent. The candidate usually chooses their own; the parish confirms the choice.",
      },
      {
        order: 2,
        title: "Understand what a sponsor does",
        body: "The Order describes the godparent's task as showing the candidate how to practise the Gospel in personal and social life, sustaining them in doubt and anxiety, bearing witness for them, and watching over their progress in the baptismal life. In practice this means: being there, at sessions and at Mass; talking, about what was taught and about what is happening in their life; answering questions or finding someone who can; praying for them; and, at the rites, testifying before the Church that they are ready. It is accompaniment, not instruction. The sponsor in the early period may be a different person from the godparent chosen for Election and the Vigil, but continuity is best.",
      },
      {
        order: 3,
        title: "Attend the sessions and the rites",
        body: "Go to the weekly sessions with your candidate whenever you can; the parish will tell you which ones require sponsors. Sit with them at Sunday Mass and, where catechumens are dismissed after the homily, know that they are leaving to reflect on the Word, not being sent away. Be present for every rite: the Rite of Acceptance or Welcoming, at which you present them and trace the cross on their senses with the priest; the Rite of Election; the three scrutinies; the Holy Saturday preparation rites; and the Easter Vigil. Put the dates in your calendar as soon as the parish publishes them.",
      },
      {
        order: 4,
        title: "Pray for your candidate",
        body: "Pray for your candidate by name every day, from the first meeting to long after the Vigil. Ask the Holy Spirit to finish in them what he has begun: Come, Holy Spirit is the Church's prayer for exactly this. Offer a Mass for them, or a Rosary, at each stage of the journey. Fast for them on the Fridays of Lent. Saint Monica prayed for years for her son Augustine, who was baptized at the Easter Vigil in Milan in 387; there is no better patroness for a sponsor. Tell your candidate that you pray for them; they will need to know it.",
      },
      {
        order: 5,
        title: "The Rite of Election and the scrutinies",
        body: "On the First Sunday of Lent, at the cathedral, the bishop will ask you whether your candidate has faithfully listened to God's word, responded to it and walked in his way, and joined in the community's prayer; you answer 'They have' for the whole Church to hear. Do not answer lightly; it is the one moment the Order asks for your testimony. At the three scrutinies on the following Sundays you stand behind your candidate with a hand on their shoulder while the community prays and the priest lays hands on them. Between the rites, talk with them about what they are experiencing; Lent is the most intense part of the journey.",
      },
      {
        order: 6,
        title: "The Easter Vigil",
        body: "At the Vigil you stand beside your candidate through the baptismal liturgy. You are named with them before the Litany of the Saints, you stand as witness while they renounce sin, profess the faith and are baptized, you may help them into the white garment, you light their candle from the Paschal candle and hand it to them, and at Confirmation you place your right hand on their shoulder as the priest anoints them with chrism. Then you kneel beside them as they receive Holy Communion for the first time. Bring nothing but yourself and a handkerchief; the night is long and most sponsors weep.",
      },
      {
        order: 7,
        title: "Stay present after Easter",
        body: "The weeks after the Vigil are when new Catholics most easily drift, and the sponsor is the Church's answer to that. Sit with your neophyte at the Sunday Masses of Easter, come to the mystagogy gatherings, and keep meeting for coffee once the formal sessions end. Help them find a place in the parish: a ministry, a group, a work of mercy. Be the person they call when the first difficulty with the Church or with a Catholic comes, as it will. The United States norms ask parishes to accompany the newly baptized for a full year; the sponsor's promise is longer than that.",
      },
    ],
  }),

  guide({
    slug: "how-to-participate-in-the-scrutinies",
    title: "How to Participate in the Scrutinies",
    summary:
      "The three Lenten scrutinies for the elect on the third, fourth and fifth Sundays of Lent, with the Gospels of the Samaritan woman, the man born blind and Lazarus; the exorcism prayers and laying on of hands; the presentations of the Creed and the Our Father; and the final preparation for the Vigil.",
    kind: "ocia",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_OCIA, V_CCC_INIT, U_LENT],
    intro:
      "The scrutinies are the heart of the elect's Lent. On three Sundays the Church gathers around those who will be baptized at Easter and prays over them, that whatever is weak or sinful in them may be healed and whatever is good may be strengthened. Each scrutiny is built on one of the three great baptismal Gospels of Saint John, read at these Masses in every year: the Samaritan woman at the well, the man born blind, and the raising of Lazarus. They are not examinations and no one fails them; they are rites of self-searching and repentance, and the whole community shares in them, because the whole community is being readied for Easter too.",
    whatYouNeed: [
      "The dates of the third, fourth and fifth Sundays of Lent, and which Mass the parish uses for the scrutinies",
      "The three Gospels: John 4, John 9 and John 11, read at home in the week before each scrutiny",
      "The Apostles' Creed and the Our Father, which are presented to the elect in these weeks",
      "For godparents: a hand free for your candidate's shoulder",
    ],
    whenToPray:
      "The third, fourth and fifth Sundays of Lent, at a Sunday Mass of the parish, after the homily; the presentations of the Creed and the Lord's Prayer are usually at weekday Masses of the third and fifth weeks.",
    tips: [
      "The elect kneel or bow their heads while the community prays for them in silence; the silence is part of the rite, not a pause.",
      "Godparents stand behind the elect with a right hand on the shoulder throughout the intercessions and exorcism.",
      "The rest of the assembly is not a spectator. Search your own conscience during the scrutiny; the Church intends it for you too.",
      "Elect and parishioners alike should read the Sunday's Gospel beforehand; the scrutiny makes little sense without it.",
    ],
    durationMinutes: 15,
    relatedPrayers: ["apostles-creed", "our-father"],
    relatedPractices: ["ignatian-examen"],
    steps: [
      {
        order: 1,
        title: "Understand what a scrutiny is",
        body: "A scrutiny is a rite celebrated within Sunday Mass after the homily, in which the elect come forward with their godparents; the community prays for them in silence and then in intercessions; the priest prays an exorcism, first to the Father and then, after laying hands in silence on each of the elect, to Christ; and the elect are then dismissed to reflect on the Word. Its purpose, in the Order's words, is to uncover and heal all that is weak, defective or sinful in the hearts of the elect, and to bring out and strengthen all that is upright, strong and good. It presumes that the elect have already come to know Christ and are being freed for him.",
      },
      {
        order: 2,
        title: "The third Sunday: the Samaritan woman",
        body: "The first scrutiny is celebrated with the Gospel of the Samaritan woman at the well (John 4), to whom Jesus offers living water and who leaves her jar behind to tell the town. The theme is thirst: for the elect, the thirst for God that brought them here and the thirsts that have led them elsewhere. The intercessions pray that the elect may thirst for the living water, and the exorcism asks the Father to free them from the spirit of deceit and lead them to the water of Baptism. Read the Gospel during the week and ask what you have been drinking instead of God.",
      },
      {
        order: 3,
        title: "The fourth Sunday: the man born blind",
        body: "The second scrutiny, on Laetare Sunday, is celebrated with the Gospel of the man born blind (John 9), whom Jesus heals and who comes step by step to see who healed him, while those who claim sight remain blind. The theme is light: Baptism was called 'enlightenment' by the early Church. The intercessions pray that the elect may be freed from the darkness that blinds them, and the exorcism asks Christ, the true light, to free them from the darkness of sin. Ask, that week, where you have refused to see.",
      },
      {
        order: 4,
        title: "The fifth Sunday: Lazarus",
        body: "The third scrutiny is celebrated with the Gospel of the raising of Lazarus (John 11), in which Jesus, weeping, calls a dead man out of the tomb. The theme is life out of death, which is what Baptism is: dying and rising with Christ. The intercessions pray that the elect may be raised from the death of sin, and the exorcism asks Christ, who raised Lazarus, to free them from the power of death and to bring them through the waters of Baptism to life. It is the last scrutiny; two weeks remain to the Vigil.",
      },
      {
        order: 5,
        title: "The exorcism prayers and the laying on of hands",
        body: "After the intercessions, the priest, facing the elect, prays the first exorcism prayer to the Father; then he lays hands on each of the elect in silence, an ancient gesture of the Church's prayer and of Christ's healing; then, with hands outstretched over them all, he prays the second exorcism to Christ. These are 'minor exorcisms', prayers for deliverance from the power of sin and the evil one over a person's life, not the rite used in cases of possession. The elect receive them in silence with bowed heads; godparents keep a hand on the shoulder; the assembly prays. No response is spoken until the closing Amen.",
      },
      {
        order: 6,
        title: "The presentations of the Creed and the Our Father",
        body: "In the same weeks the Church 'hands over' to the elect the two texts every Christian must have by heart. The Presentation of the Creed is celebrated in the week after the first scrutiny: the elect stand while the priest and community recite the Apostles' Creed, or the Nicene Creed, to them, and they are charged to learn it and to give it back on Holy Saturday. The Presentation of the Lord's Prayer follows the third scrutiny: the Gospel is Matthew 6, and the elect hear the Our Father proclaimed as the prayer Jesus gave, which they will pray for the first time with the faithful at the Vigil Mass. Learn both texts, in the words the Church uses.",
      },
      {
        order: 7,
        title: "Prepare for the Vigil",
        body: "After the third scrutiny come Holy Week and the final preparation. On Holy Saturday morning the elect gather with their godparents for the preparation rites: the recitation, or 'giving back', of the Creed; the ephphetha rite, in which the priest touches their ears and lips with the words Jesus spoke to the deaf man, 'Be opened'; and, where it is the custom, the choosing of a baptismal name and the anointing with the oil of catechumens. The elect are asked to spend Holy Saturday in prayer and, as far as they can, in fasting. The How to Prepare for the Easter Vigil guide takes it from there.",
      },
    ],
  }),

  guide({
    slug: "how-to-prepare-for-the-easter-vigil-as-a-catechumen",
    title: "How to Prepare for the Easter Vigil",
    summary:
      "The night of initiation for the elect: the Holy Saturday preparation rites, fasting and rest, what to bring and wear, the service of light, the Liturgy of the Word, Baptism, Confirmation and first Communion, and the beginning of mystagogy.",
    kind: "ocia",
    sacramentKey: "baptism",
    authorityLevel: "USCCB",
    citations: [U_TRID, V_CCC_INIT, U_OCIA],
    intro:
      "The Easter Vigil, kept on the night of Holy Saturday, is the mother of all vigils and the night on which the Church has baptized since the earliest centuries. For the elect it is the end of a long road and the beginning of everything: they are baptized, confirmed and receive the Eucharist in a single celebration that stretches from a fire in the dark to the first Communion of Easter. It is long, often two and a half to three hours, and it is unlike any liturgy they have yet attended. This guide, written for the elect and their godparents, tells them what will happen and how to be ready in body and soul.",
    whatYouNeed: [
      "The time the Vigil begins at your parish (it must begin after nightfall, so it varies with the sunset)",
      "Clothes you can be baptized in: dark, modest, and if the parish baptizes by immersion, something that can get wet, with a towel and a change of clothes",
      "Your godparent, and the white garment and candle if the parish has asked you to bring them",
      "A rested body: Holy Saturday is for prayer and quiet, not errands",
    ],
    whenToPray:
      "Holy Saturday night, after dark. The preparation rites are usually on Holy Saturday morning; the paschal fast is kept through the day.",
    tips: [
      "The unbaptized do not go to confession before Baptism; Baptism forgives every sin. Candidates already baptized do go to confession before their reception.",
      "Ask the parish exactly what it provides (garment, candle, towel) and what you bring; parishes differ.",
      "Do not schedule an Easter party for before the Vigil. Keep the day quiet and eat afterward.",
      "The parish will rehearse the movements with you, usually on Holy Saturday morning; if it does not, ask your godparent to walk you through where you will stand.",
    ],
    durationMinutes: 20,
    relatedPrayers: ["litany-of-the-saints", "apostles-creed", "our-father", "te-deum"],
    relatedSaints: ["saint-augustine-of-hippo"],
    steps: [
      {
        order: 1,
        title: "The Holy Saturday preparation rites",
        body: "On Holy Saturday morning the elect gather with their godparents, usually in the church, for the last rites before Baptism. You give back the Creed, reciting the Apostles' Creed which was presented to you in Lent; the priest performs the ephphetha rite, touching your ears and lips with the words 'Ephphetha, that is, be opened', so that you may hear and profess the faith; and, where it is the custom, a baptismal name is chosen and you are anointed with the oil of catechumens. Most parishes also use this morning to rehearse the night's movements. Come, even if you are tired; the rites are short and they are yours.",
      },
      {
        order: 2,
        title: "Fast and rest",
        body: "The Order asks the elect to refrain on Holy Saturday from their usual activities, to spend the day in prayer and reflection, and, as far as they can, to fast; the Church commends the same paschal fast to all the faithful. Eat lightly, keep away from screens and work, read the readings of the Vigil in advance, and pray the Our Father slowly, since you will pray it for the first time with the faithful tonight. Sleep in the afternoon if you can; the Vigil is late and long, and you will want to be awake for all of it.",
      },
      {
        order: 3,
        title: "What to bring and how to dress",
        body: "Wear something dark, modest and comfortable; the white garment, if the parish provides one, goes over it after Baptism. If your parish baptizes by immersion, wear clothes that can be soaked, and bring a towel and a full change of clothes, including shoes; there will be a place to change, and your godparent will help. Bring your candle if you were asked to, and nothing else you would mind getting wet. Arrive well before the start, since the elect usually sit together near the front with their godparents, and find the restrooms before the fire is lit.",
      },
      {
        order: 4,
        title: "The service of light",
        body: "The Vigil begins outside, or at the church door, in darkness, with the blessing of a new fire. The Paschal candle is prepared and lit from it, and carried into the dark church while the deacon or priest sings three times 'The Light of Christ' and all answer 'Thanks be to God', lighting their small candles from the Paschal candle as it passes. Then the Exsultet, the Easter Proclamation, is sung before the candle: a long, ancient hymn to this night, on which Christ broke the chains of death. Stand with your candle lit and listen; the words 'O truly blessed night' are about the night you are being baptized.",
      },
      {
        order: 5,
        title: "The Liturgy of the Word",
        body: "Candles out, the church still dim, the Church sits to hear the story of salvation: up to seven readings from the Old Testament, creation, the sacrifice of Isaac, the crossing of the Red Sea (which is never omitted), and the prophets, each with a psalm and a prayer. Then the lights come up, the Gloria is sung with bells for the first time since Holy Thursday, the Epistle from Romans tells you what is about to happen to you, 'we were buried with him by baptism into death', the Alleluia returns after forty days, and the Gospel of the Resurrection is proclaimed. The homily follows. Then you will be called.",
      },
      {
        order: 6,
        title: "Baptism, Confirmation and first Communion",
        body: "The elect are called by name and come to the font with their godparents. The Litany of the Saints is sung over you; the water is blessed with the Paschal candle plunged into it. Then each of you renounces sin ('Do you renounce Satan?' 'I do') and professes the faith in the three questions of the Apostles' Creed ('Do you believe in God, the Father almighty?' 'I do'), and is baptized: 'N., I baptize you in the name of the Father, and of the Son, and of the Holy Spirit', with water poured three times or three immersions. You are clothed in the white garment, and your godparent lights your candle from the Paschal candle and gives it to you. Then the priest confirms you, anointing your forehead with chrism: 'N., be sealed with the Gift of the Holy Spirit.' 'Amen.' 'Peace be with you.' 'And with your spirit.' The whole assembly renews its baptismal promises and is sprinkled. At the Liturgy of the Eucharist you pray the Our Father with the faithful for the first time and receive the Body and Blood of Christ, often under both kinds, at the front of the line.",
      },
      {
        order: 7,
        title: "Give thanks",
        body: "After Communion, kneel and give thanks in whatever words come; if none come, the Te Deum, the Church's great hymn of thanksgiving, says everything. Saint Augustine, baptized at this Vigil in Milan in 387, wrote later that he wept at the singing of the Church that night. When the Mass ends, the parish will want to greet you; let it. Eat something, sleep, and come back on Easter morning or during the Octave wearing your white garment, as the newly baptized do, to Mass with the community that is now yours.",
      },
      {
        order: 8,
        title: "Mystagogy begins",
        body: "You are now a neophyte, and the Easter season is your period of mystagogy: fifty days, from Easter to Pentecost, of entering more deeply into the mysteries you have received, by the Masses of Easter, by reflection on the sacraments with the parish's OCIA team, and by taking a share in the life and mission of the community. The parish is asked to keep gathering the neophytes for a year. Keep your baptismal candle to light on the anniversary of your Baptism, keep going to confession regularly now that you can, and keep praying the Our Father as you did on Holy Saturday, slowly, since it is now yours.",
      },
    ],
  }),
];

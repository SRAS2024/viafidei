import type { CuratedEntry } from "../index";

/**
 * Guides — section K (Sacraments), second half: the holy days of obligation,
 * the Anointing of the Sick and the sacraments of the dying, Christian
 * funerals and prayer for the dead, and Matrimony.
 *
 * Every step is written to be used, not merely read: the words of the rites
 * are given as the Church's books give them, the canon-law requirements are
 * stated as the Code states them, and pastoral practice is described as it is
 * actually found in parishes of the United States. Where a detail varies from
 * diocese to diocese (waiting periods, fees, tribunal procedure) the guide says
 * so and sends the reader to the parish rather than inventing a norm.
 */

// USCCB pages (verified in a browser; the site blocks non-browser clients).
const U_ANOINT =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/anointing-of-the-sick";
const U_FUN = "https://www.usccb.org/prayer-and-worship/bereavement-and-funerals";
// The plan's ".../sacraments-and-sacramentals/marriage" page no longer exists;
// the USCCB's marriage material lives under Marriage and Family Life Ministries.
const U_MFL = "https://www.usccb.org/topics/marriage-and-family-life-ministries";
const U_MARR_PREP =
  "https://www.usccb.org/topics/marriage-and-family-life-ministries/marriage-preparation";
// The plan's ".../prayer-and-worship/liturgical-year" page no longer exists; the
// Secretariat of Divine Worship's liturgical calendar page is the closest.
const U_LITCAL = "https://www.usccb.org/committees/divine-worship/liturgical-calendar";

// Vatican documents (all verified 200).
// Catechism (IntraText edition): Part 2, Section 2, Article 5, The Anointing of the Sick.
const V_CCC_ANOINT = "https://www.vatican.va/archive/ENG0015/__P4J.HTM";
// Catechism: Part 2, Section 2, Article 7, The Sacrament of Matrimony.
const V_CCC_MATR = "https://www.vatican.va/archive/ENG0015/__P50.HTM";
// Catechism: Part 2, Section 2, Chapter 4, Article 2, Christian Funerals.
const V_CCC_FUNERALS = "https://www.vatican.va/archive/ENG0015/__P5A.HTM";
// Code of Canon Law, Book IV: cann. 1244-1253 (feast days and days of penance).
const V_CIC_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";
// Code of Canon Law, Book IV: cann. 998-1165 (Anointing of the Sick, Orders, Marriage).
const V_CIC_MATR =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann998-1165_en.html";
const V_SD =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1984/documents/hf_jp-ii_apl_11021984_salvifici-doloris.html";
const V_IND =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_pro_20000129_indulgence_en.html";
const V_AL =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia.html";
const V_FC =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const V_MIDI =
  "https://www.vatican.va/content/francesco/en/motu_proprio/documents/papa-francesco-motu-proprio_20150815_mitis-iudex-dominus-iesus.html";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  sacramentKey?: "eucharist" | "anointing_of_the_sick" | "matrimony";
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
      kind: "general",
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

export const sacramentGuidesTwo: CuratedEntry[] = [
  // ─────────────────────── Eucharist and Mass (cont.) ───────────────────────
  guide({
    slug: "holy-days-of-obligation-guide",
    title: "How to Keep the Holy Days of Obligation",
    summary:
      "The six holy days of obligation observed in the United States, how the Saturday and Monday rule works, when a vigil Mass counts, and how to plan the year so none of them takes you by surprise.",
    sacramentKey: "eucharist",
    authorityLevel: "USCCB",
    citations: [U_LITCAL, V_CIC_TIMES],
    intro:
      "Besides every Sunday, the Church sets aside a small number of feasts on which Catholics are bound to take part in Mass and to rest from work that would hinder worship, just as on the Lord's Day. The universal law names ten such days; each conference of bishops may, with the approval of the Holy See, reduce the number or move some to a Sunday, and the bishops of the United States have done both. This guide gives the list as it is kept in the United States and the practical rules that go with it.",
    whatYouNeed: [
      "A calendar you actually look at (paper, phone, or the parish's own)",
      "Your parish's Mass schedule for holy days, usually printed in the bulletin the week before",
      "A note of the ecclesiastical province you live in, since the Ascension is kept on different days in different places",
    ],
    whenToPray:
      "On the day itself or at a Mass on the evening before. In the United States: 1 January, the Ascension, 15 August, 1 November, 8 December and 25 December, subject to the rules below.",
    tips: [
      "When in doubt, ask the parish office or check the bulletin: the parish always knows whether the obligation binds this year.",
      "Treat a holy day like a Sunday in miniature: Mass first, then a real rest, a good meal, and some time with the feast's own prayers.",
      "If you cannot get to Mass because of illness, work you cannot leave, or care of the sick, the obligation does not bind you; make a spiritual communion and pray the readings of the day instead.",
      "Christmas and the Immaculate Conception are never dropped, whatever weekday they fall on.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Know the six holy days kept in the United States",
        body: "Canon 1246 lists ten holy days for the universal Church. In the dioceses of the United States, six are kept as days of obligation: the Solemnity of Mary, Mother of God (1 January); the Ascension of the Lord (Thursday of the sixth week of Easter, or the following Sunday where it has been transferred); the Assumption of the Blessed Virgin Mary (15 August); All Saints (1 November); the Immaculate Conception (8 December); and the Nativity of the Lord, Christmas (25 December). The other four universal days are handled differently here: the Epiphany is celebrated on the Sunday between 2 and 8 January and Corpus Christi on the Sunday after Trinity Sunday, while Saint Joseph (19 March) and Saints Peter and Paul (29 June) remain solemnities but are not days of obligation in the United States.",
      },
      {
        order: 2,
        title: "Learn the Saturday and Monday rule",
        body: "By a decree of the United States bishops confirmed by the Holy See in 1992, whenever 1 January, 15 August or 1 November falls on a Saturday or a Monday, the obligation to attend Mass is lifted for that year. The feast is still celebrated, and going to Mass is still a fine thing to do, but you are not bound. The rule does not apply to the Immaculate Conception or to Christmas, which always oblige. When 8 December falls on a Sunday of Advent, the solemnity is moved to Monday, 9 December, and the Holy See has confirmed that the obligation moves with it.",
      },
      {
        order: 3,
        title: "Find out how your province keeps the Ascension",
        body: "The Ascension falls on a Thursday forty days after Easter. Most ecclesiastical provinces of the United States have transferred it to the following Sunday, the Seventh Sunday of Easter, so that in those places the Thursday is an ordinary weekday and the obligation is simply the Sunday obligation. A few provinces in the Northeast and in Nebraska keep the Thursday as a holy day of obligation. Your parish bulletin will say which applies to you; if you travel that week, the obligation follows the place where you are.",
      },
      {
        order: 4,
        title: "Use the vigil Mass when it helps",
        body: "Canon 1248 provides that the obligation is satisfied by taking part in Mass celebrated anywhere in a Catholic rite either on the holy day itself or in the evening of the preceding day. So a Mass on the evening of 31 October fulfils the obligation for All Saints, and a Mass on the evening of 24 December fulfils it for Christmas. Note that one Mass does not fulfil two obligations: when a holy day falls on a Saturday, a Saturday evening Mass counts either for the holy day or for the Sunday, not both, and you would need to attend Mass twice that weekend.",
      },
      {
        order: 5,
        title: "Rest from work as far as you are able",
        body: "Canon 1247 asks the faithful on Sundays and holy days not only to take part in Mass but to abstain from those works and affairs which hinder the worship to be rendered to God, the joy proper to the Lord's Day, or the suitable relaxation of mind and body. In the United States most holy days fall on working days, so do what you reasonably can: ask for the morning off, keep the evening free, share a meal, and set aside the chores that can wait. Where an employer or family need makes rest impossible, the Church's law does not ask the impossible; keep the Mass and keep the spirit of the day.",
      },
      {
        order: 6,
        title: "Keep the day with the prayers of the feast",
        body: "Each holy day has its own character, and a few minutes of prayer make it more than an extra Mass. On the Solemnity of Mary pray the Hail Mary and the Salve Regina and entrust the new year to her. On the Ascension and at Christmas the Te Deum is the Church's own song of thanksgiving. On All Saints ask the intercession of your patron saints; on the Assumption and the Immaculate Conception pray the Magnificat with Mary. End the day, as every day, with the Our Father.",
      },
      {
        order: 7,
        title: "Plan the whole year once",
        body: "At the start of each year, or when the parish calendar comes out, write the six days into your calendar with a reminder the week before, check the weekday each fixed date falls on to see whether the Saturday-or-Monday rule applies, and note your province's practice for the Ascension. The USCCB's Secretariat of Divine Worship publishes the liturgical calendar for the dioceses of the United States each year, and it settles every question about dates and transfers. Ten minutes of planning in January means that no holy day arrives unnoticed in August.",
      },
    ],
    relatedPrayers: ["our-father", "hail-mary", "salve-regina", "te-deum", "magnificat"],
    relatedDevotions: ["liturgy-of-the-hours"],
  }),

  // ──────────────────── Anointing, dying and death ────────────────────
  guide({
    slug: "how-to-request-anointing-of-the-sick",
    title: "How to Request the Anointing of the Sick",
    summary:
      "Who may receive the Anointing of the Sick, why you should not wait until the last hour, how to arrange it with a parish or hospital chaplain, and what happens in the rite.",
    sacramentKey: "anointing_of_the_sick",
    authorityLevel: "USCCB",
    citations: [U_ANOINT, V_CCC_ANOINT],
    intro:
      "The Anointing of the Sick is the sacrament by which Christ strengthens those who are seriously ill or weakened by age, uniting their suffering to his own Passion, giving them peace and courage, forgiving their sins, and, if it is God's will, restoring their health. It is not a sacrament only for the dying: the Second Vatican Council asked that it no longer be thought of as 'extreme unction', and the Catechism says it should be received as soon as a member of the faithful begins to be in danger of death from sickness or old age. Only a priest can anoint, so the practical task is to ask in time.",
    whatYouNeed: [
      "The phone number of your parish, or of the Catholic chaplain at the hospital or nursing home",
      "A quiet room with a small table, a cloth, and, if you have them, a crucifix and a candle",
      "The sick person's wish to receive the sacrament, or, if they cannot express it, the reasonable assumption that they would want it",
      "A short account for the priest of the person's situation and whether they would also like to go to confession and receive Communion",
    ],
    whenToPray:
      "As soon as an illness or the frailty of old age becomes serious: before a major operation, at a grave diagnosis, on entering hospice care, or whenever an elderly person grows notably weaker. It may be received again if the person recovers and falls ill anew, or if the same illness worsens.",
    tips: [
      "Do not wait for the last hour. A person who can still speak, pray and receive Communion gets far more from the sacrament than one who is unconscious.",
      "Many parishes celebrate a communal Anointing at a Mass once or twice a year; the chronically ill and the elderly are welcome to come forward at it.",
      "Hospitals do not automatically call a priest. Ask the nursing staff to page the Catholic chaplain, or call the parish yourself.",
      "The sacrament is for the living. If the person has already died when the priest arrives, he will not anoint but will pray for them and with the family.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Know who may be anointed",
        body: "Canon 1004 provides that the Anointing of the Sick can be administered to any member of the faithful who, having reached the use of reason, begins to be in danger because of illness or old age. That includes a person facing serious surgery, someone with a grave or chronic condition that has taken a serious turn, and the elderly who are notably weakened even without a named illness. Children who are old enough to understand the sacrament may receive it. It is not given for minor ailments, and it is not given to the dead. If there is doubt whether the person has reached the use of reason, is dangerously ill, or is still alive, the priest may anoint conditionally.",
      },
      {
        order: 2,
        title: "Do not wait",
        body: "The Catechism (1514) is explicit that the Anointing is not a sacrament only for those at the point of death; as soon as a member of the faithful begins to be in danger of death from sickness or old age, the fitting time to receive it has certainly arrived. Ask early, while the sick person can still take part: confess, answer the prayers, and receive Communion. The Rite of Anointing itself tells us that a careful judgment about the serious nature of the illness is enough, and the USCCB says plainly that there is no need to wait until a person is at the point of death.",
      },
      {
        order: 3,
        title: "Call the parish or the hospital chaplain",
        body: "Telephone the parish office, or after hours the emergency number most parishes list on their voicemail, and say that a member of the family is seriously ill and would like the Anointing of the Sick. Give the person's name, where they are, how urgent the situation is, and whether they would also like confession and Holy Communion. In a hospital or nursing home, tell the nurses that the patient is Catholic and ask them to contact the Catholic chaplain; you may still call your own parish as well. Any Catholic priest may anoint; you do not need your own pastor.",
      },
      {
        order: 4,
        title: "Prepare the room",
        body: "Clear a small table near the bed and cover it with a clean cloth. If you have them, set out a crucifix, a candle, and a glass of water for the sick person to drink after Communion. Turn off the television, invite the family to gather, and, if the sick person wishes to confess, be ready to leave the room for a few minutes when the priest arrives. None of this is required, but it helps everyone present understand that a sacrament is being celebrated, not a visit paid.",
      },
      {
        order: 5,
        title: "Take part in the rite",
        body: "The priest greets the sick person and those present, and may sprinkle them with holy water. If the sick person wishes to confess, this happens now, privately; otherwise there is a penitential act in which everyone may pray the Confiteor. A short passage of Scripture is read. Then the priest lays his hands on the sick person's head in silence, gives thanks over the oil of the sick, and anoints the forehead, saying: 'Through this holy anointing may the Lord in his love and mercy help you with the grace of the Holy Spirit.' All answer: 'Amen.' He anoints the hands, saying: 'May the Lord who frees you from sin save you and raise you up.' All answer: 'Amen.' A prayer follows, then the Our Father, Holy Communion if it is being given, and a blessing.",
      },
      {
        order: 6,
        title: "Let the grace do its work",
        body: "The Catechism (1520-1523) names the effects of the sacrament: a particular gift of the Holy Spirit that gives strength, peace and courage against discouragement and fear; union with the Passion of Christ, so that suffering becomes a share in his saving work; the forgiveness of sins if the sick person was not able to obtain it through Penance; the restoration of health, if it is conducive to salvation; and preparation for the final journey. Encourage the sick person to offer their suffering with Christ, to pray the Anima Christi after Communion, and to make a simple Act of Contrition each night.",
      },
      {
        order: 7,
        title: "Receive it again when the situation calls for it",
        body: "Canon 1004 §2 provides that the sacrament can be repeated if the sick person, after recovering, again becomes seriously ill, or if the condition becomes more serious during the same illness. So an elderly parent anointed in the spring may be anointed again in the winter; a patient anointed before surgery may be anointed again if complications follow. The Anointing is also often given together with Viaticum when death draws near; see the guide on Viaticum and the last rites.",
      },
    ],
    relatedPrayers: ["confiteor", "act-of-contrition", "our-father", "anima-christi"],
    relatedSaints: ["saint-camillus-de-lellis", "saint-john-of-god"],
  }),

  guide({
    slug: "how-to-prepare-for-viaticum-and-the-last-rites",
    title: "How to Prepare for Viaticum and the Last Rites",
    summary:
      "The sacraments the Church gives to the dying — Penance, the Anointing of the Sick, and Viaticum, the last Holy Communion — with the apostolic pardon and the prayers of commendation, and how to arrange them in time.",
    sacramentKey: "anointing_of_the_sick",
    authorityLevel: "VATICAN",
    citations: [V_CCC_ANOINT, U_ANOINT],
    intro:
      "What Catholics call 'the last rites' is not a single rite but the Church's whole care for a person who is dying: the Sacrament of Penance, the Anointing of the Sick, and above all Viaticum, Holy Communion received as food for the journey from this life to the Father. The Catechism (1524-1525) calls Viaticum the sacrament of those departing, and says that Penance, Anointing and the Eucharist as Viaticum together form, at the end of Christian life, the sacraments that prepare for our heavenly homeland. This guide explains what each part is, so that a family knows what to ask for and a sick person knows what to expect.",
    whatYouNeed: [
      "A priest, called in time; a deacon or an extraordinary minister of Holy Communion may bring Viaticum if no priest is available, but only a priest can hear a confession and anoint",
      "A small table by the bed with a cloth, a crucifix, a candle, and a glass of water",
      "The family gathered, so far as possible, and a quiet room",
      "The sick person's baptismal promises: the rite asks them to renew them, and it helps to know the words of the Apostles' Creed",
    ],
    whenToPray:
      "As soon as death appears to be approaching: when hospice care begins, when the doctors speak of days or weeks rather than months, or when a sudden decline makes death likely. Viaticum may be received even if the person has already received Communion that day.",
    tips: [
      "Ask for Viaticum by name. Families often ask only for the Anointing; the priest will bring both, but Viaticum is the sacrament proper to the dying.",
      "The one-hour Eucharistic fast does not bind the sick, the elderly, or those caring for them, so a person may receive even after eating.",
      "If the person can no longer swallow the Host, a small fragment or the Precious Blood may be given; if they cannot receive at all, the priest will still anoint and pray the commendation.",
      "Where a priest cannot reach the person in time, the Church still provides: the Church grants a plenary indulgence at the moment of death to a Catholic who is properly disposed and has been in the habit of praying during life, and a crucifix or cross is recommended for it.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Understand what the last rites are",
        body: "The Church's book, Pastoral Care of the Sick: Rites of Anointing and Viaticum, provides for the dying a continuous rite in which Penance, Anointing and Viaticum are celebrated together, and a separate rite of Viaticum for a person who has already been anointed. The heart of it is Viaticum, from the Latin for provisions for a journey: the Body of Christ given to a Christian who is leaving this life, in the words of the Catechism the seed of eternal life and the power of resurrection. Around it the Church places the forgiveness of sins, the strengthening of the Anointing, the renewal of baptismal promises, the apostolic pardon, and the prayers that commend the dying person to God.",
      },
      {
        order: 2,
        title: "Call the priest in time",
        body: "Do not wait for the final hours. Canon 921 says the Christian faithful who are in danger of death from any cause are to be nourished by Viaticum, and that while the danger lasts it is fitting for it to be given repeatedly, on different days; canon 922 adds that Viaticum is not to be delayed too long, and that those with the care of souls are to be vigilant that the dying receive it while they are fully conscious. Telephone the parish or the hospital chaplain, say clearly that the person is dying and would like confession, the Anointing and Viaticum, and give the address and the best time. A deacon or an extraordinary minister may bring Viaticum if no priest can come, but only a priest can absolve and anoint, so ask for a priest first.",
      },
      {
        order: 3,
        title: "Make a confession",
        body: "If the dying person is able, the rite begins with the Sacrament of Penance, celebrated privately: the family steps out, the sick person confesses as much as they can, prays an Act of Contrition, and receives absolution. A person who can no longer speak but can show sorrow, by a gesture or a squeeze of the hand, can still be absolved. If confession is not possible, the priest leads a penitential act in which everyone prays the Confiteor. Where a person has lived long apart from the Church, this is often the moment of reconciliation they have been waiting for; a family member's gentle encouragement beforehand is a great kindness.",
      },
      {
        order: 4,
        title: "Receive the Anointing",
        body: "If the person has not already been anointed during this illness, or if the illness has become much more serious, the priest lays his hands on their head in silence and anoints the forehead and hands with the oil of the sick, saying: 'Through this holy anointing may the Lord in his love and mercy help you with the grace of the Holy Spirit.' All answer: 'Amen.' 'May the Lord who frees you from sin save you and raise you up.' 'Amen.' In the continuous rite the Anointing comes before Viaticum, so that the person is strengthened in body and soul before receiving the Lord.",
      },
      {
        order: 5,
        title: "Renew your baptismal promises and receive Viaticum",
        body: "The rite of Viaticum asks the dying person to renew the promises of Baptism, answering 'I do' to the questions of the Apostles' Creed: Do you believe in God, the Father almighty? Do you believe in Jesus Christ, his only Son, our Lord? Do you believe in the Holy Spirit? The priest or minister then shows the Host and says, 'Behold the Lamb of God...', and all answer, 'Lord, I am not worthy...'. The dying person receives, and the minister adds the words proper to Viaticum: 'May the Lord Jesus Christ protect you and lead you to eternal life.' 'Amen.' A moment of silence follows; the Anima Christi is a fitting prayer for it. If the person can receive only a small fragment, or only the Precious Blood, that is Viaticum in full.",
      },
      {
        order: 6,
        title: "Receive the apostolic pardon",
        body: "In the rite of Viaticum the priest may impart the apostolic pardon, a plenary indulgence for the hour of death which the Church attaches to the sacraments of the dying. One of the forms the rite gives is: 'Through the holy mysteries of our redemption, may almighty God release you from all punishment in this life and in the life to come. May he open to you the gates of paradise and welcome you to everlasting joy.' All answer: 'Amen.' The dying person need only be sorry for their sins and willing to receive it; no further action is asked of someone at the point of death.",
      },
      {
        order: 7,
        title: "Pray the prayers of commendation",
        body: "When death is near the Church prays the Commendation of the Dying: short texts of Scripture that the dying person may repeat inwardly, a litany of the saints, and the prayer 'Go forth, Christian soul, from this world, in the name of God the almighty Father, who created you...'. These prayers may be led by a priest, a deacon, or any member of the family; the Commendation of the Dying on this site gives them in full. Keep praying quietly even when the person no longer responds, since hearing is often the last sense to go. After death, pray together: 'Eternal rest grant unto them, O Lord, and let perpetual light shine upon them. May they rest in peace. Amen.'",
      },
    ],
    relatedPrayers: [
      "act-of-contrition",
      "confiteor",
      "apostles-creed",
      "anima-christi",
      "commendation-of-the-dying",
      "eternal-rest",
    ],
    relatedSaints: ["saint-joseph"],
  }),

  guide({
    slug: "how-to-pray-with-someone-who-is-dying",
    title: "How to Pray with Someone Who Is Dying",
    summary:
      "Prayers and presence at a deathbed when no priest is present: short prayers the dying person knows, the psalms, the Litany of the Saints, the Divine Mercy Chaplet, the commendation, and the prayers said after death.",
    sacramentKey: "anointing_of_the_sick",
    authorityLevel: "VATICAN",
    citations: [V_SD, U_FUN],
    intro:
      "The Church does not leave the dying to the priest alone. Pastoral Care of the Sick gives a whole rite, the Commendation of the Dying, that a family member, a friend or a nurse may lead, and it says plainly that the presence of those who love the dying person, praying with them, is itself part of the Church's ministry. Saint John Paul II wrote in Salvifici Doloris that suffering unleashes love in those who witness it; at a deathbed that love takes the form of staying, and of praying words the dying person has known all their life. Call the priest first, for the sacraments; then stay and pray.",
    whatYouNeed: [
      "Yourself, present and unhurried; silence and touch are as much prayer as words",
      "A crucifix or a small cross the person can see or hold, and if possible a candle",
      "A Bible or a card with a few psalms, and the Commendation of the Dying (on this site)",
      "A rosary, for the family's decades and the Divine Mercy Chaplet",
      "The number of the parish or hospital chaplain, so that a priest is called for confession, the Anointing and Viaticum",
    ],
    whenToPray:
      "From the moment death seems near until it comes, and in the minutes after. Pray in short pieces, with rests; the dying tire quickly, and the family needs the pauses too.",
    tips: [
      "Speak to the person, not about them. Hearing usually remains; say their name, tell them who is there, and pray aloud even when they cannot answer.",
      "Choose what they know: the Our Father, the Hail Mary, the Glory Be. Familiar words carry a person when new ones cannot.",
      "You may lead every prayer in this guide. Nothing in the Commendation of the Dying is reserved to a priest, though the sacraments are.",
      "Take turns. A deathbed watch is long; two people praying quietly, relieving one another, is better than a crowded room.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Be present, and call the priest",
        body: "Sit close, hold the person's hand, and let them know you are there. If a priest has not yet come, call the parish or ask the hospital to page the Catholic chaplain, asking for confession, the Anointing of the Sick and Viaticum. While you wait, do not fill the room with talk. Moisten their lips, keep the light soft, place a crucifix where they can see it, and pray a slow Sign of the Cross with them. The Church's rite says that the dying person should be helped to accept death in union with Christ's own death, and that begins with someone simply staying.",
      },
      {
        order: 2,
        title: "Pray the short prayers they know",
        body: "Pastoral Care of the Sick suggests short texts that can be said slowly, one at a time, with silence between, and repeated: 'Jesus, Mary and Joseph.' 'Lord Jesus, receive my spirit.' 'Into your hands, Lord, I commend my spirit.' 'Holy Mary, pray for me.' 'Jesus, I trust in you.' 'My Lord and my God.' Say them quietly near the person's ear so they can join inwardly. Between them, pray the Our Father, the Hail Mary and the Glory Be, which most Catholics can still follow when little else reaches them. If the person is able, help them make an Act of Contrition, even a whispered 'Jesus, have mercy on me, a sinner.'",
      },
      {
        order: 3,
        title: "Read the psalms and the Gospel",
        body: "The rite draws on a small number of psalms and Gospel passages, and any of them may be read slowly: Psalm 23, 'The Lord is my shepherd'; Psalm 25, 'To you, O Lord, I lift up my soul'; Psalm 91, 'He who dwells in the shelter of the Most High'; Psalm 121, 'I lift up my eyes to the mountains'; and Psalm 130, the De Profundis, 'Out of the depths I cry to you, O Lord.' From the Gospels, John 14:1-6, 'In my Father's house there are many dwelling places,' and Luke 23:42-43, the good thief's prayer and Christ's promise of Paradise. One reading at a time is enough; then silence.",
      },
      {
        order: 4,
        title: "Pray the Litany of the Saints",
        body: "The Commendation of the Dying includes a short Litany of the Saints, and it is among the most consoling prayers at a deathbed, because it names the company the dying person is going to join. Lead it slowly, with the response after each name: 'Holy Mary, Mother of God, pray for him (her). Saint Joseph, pray for him. Saint Michael, pray for him. Holy angels of God, pray for him. Saint John the Baptist, pray for him. Saint Peter and Saint Paul, pray for him. All holy men and women, pray for him.' Add the person's own baptismal or confirmation saint and any saint they loved. End: 'Lord, be merciful; Lord, save your people. From every evil; Lord, save your people. Christ, hear us; Christ, graciously hear us.'",
      },
      {
        order: 5,
        title: "Pray the Divine Mercy Chaplet",
        body: "The Chaplet of Divine Mercy is prayed on ordinary rosary beads and takes about seven minutes, which makes it well suited to the bedside; Saint Faustina recorded Our Lord's wish that it be prayed at the side of the dying, and the Church has approved the devotion. Begin with the Our Father, the Hail Mary and the Apostles' Creed. On each large bead pray: 'Eternal Father, I offer you the Body and Blood, Soul and Divinity of your dearly beloved Son, our Lord Jesus Christ, in atonement for our sins and those of the whole world.' On each of the ten small beads: 'For the sake of his sorrowful Passion, have mercy on us and on the whole world.' After the five decades, pray three times: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.' The guide to the Divine Mercy Chaplet on this site gives the closing prayer.",
      },
      {
        order: 6,
        title: "Pray the commendation as death draws near",
        body: "When breathing changes and the end is close, pray the prayer of commendation from the rite, which anyone may lead: 'Go forth, Christian soul, from this world, in the name of God the almighty Father, who created you, in the name of Jesus Christ, the Son of the living God, who suffered for you, in the name of the Holy Spirit, who was poured out upon you. Go forth, faithful Christian! May you live in peace this day, may your home be with God in Zion, with Mary, the Virgin Mother of God, with Joseph, and all the angels and saints.' The Commendation of the Dying on this site gives the full text with the prayers that follow it. Then be quiet, and let the person go with a blessing: trace a small cross on their forehead, as was done at their Baptism.",
      },
      {
        order: 7,
        title: "Pray after death",
        body: "Immediately after death the rite gives this prayer: 'Saints of God, come to his (her) aid! Come to meet him, angels of the Lord!' Response: 'Receive his soul and present him to God the Most High.' 'May Christ, who called you, take you to himself; may angels lead you to Abraham's side.' Response: 'Receive his soul and present him to God the Most High.' 'Give him eternal rest, O Lord, and may your light shine on him for ever.' Then pray together: 'Eternal rest grant unto him, O Lord, and let perpetual light shine upon him. May he rest in peace. Amen.' The Nunc Dimittis, Simeon's 'Now, Master, you may let your servant go in peace,' and the De Profundis are fitting in the hours that follow. Then call the parish about the funeral; see the guide to planning a Catholic funeral.",
      },
    ],
    relatedPrayers: [
      "our-father",
      "hail-mary",
      "glory-be",
      "act-of-contrition",
      "de-profundis",
      "litany-of-the-saints",
      "divine-mercy-chaplet-prayers",
      "commendation-of-the-dying",
      "eternal-rest",
      "nunc-dimittis",
    ],
    relatedDevotions: ["divine-mercy-chaplet"],
    relatedSaints: ["saint-joseph", "saint-faustina-kowalska"],
  }),

  guide({
    slug: "how-to-plan-a-catholic-funeral",
    title: "How to Plan a Catholic Funeral",
    summary:
      "The three rites of the Order of Christian Funerals — the vigil, the Funeral Mass and the committal — with how to choose readings and music, what the Church asks about eulogies and cremation, and how to keep praying afterward.",
    sacramentKey: "anointing_of_the_sick",
    authorityLevel: "USCCB",
    citations: [U_FUN, V_CCC_FUNERALS],
    intro:
      "A Catholic funeral is not a celebration of a life so much as the Church's prayer for a baptised Christian who has died, offered in the hope of the resurrection. The Order of Christian Funerals, the Church's book for these rites, sets out three moments: the Vigil for the Deceased, the Funeral Liturgy (ordinarily a Mass), and the Rite of Committal at the grave or the place of entombment. The parish will guide you through all of it; this guide tells you what to expect and what to decide, so that the choices can be made calmly and in faith.",
    whatYouNeed: [
      "The parish's phone number; the funeral home will usually contact the parish, but a call from the family helps",
      "A few facts the parish will ask for: the person's full name, date of death, parish of Baptism if known, and whether they wished to be buried or cremated",
      "The Order of Christian Funerals readings list, which the parish will give you, to choose the Scripture readings",
      "Names of family and friends willing to read, to bring up the gifts, and to serve as pallbearers",
    ],
    whenToPray:
      "The vigil is usually held the evening before the funeral; the Funeral Mass on a weekday morning or Saturday; the committal immediately after the Mass. Funeral Masses are not celebrated on Sundays, on holy days of obligation, on Holy Thursday, or during the Easter Triduum.",
    tips: [
      "Let the priest or deacon lead. He has done this many times and knows what comforts a grieving family and what the rite provides.",
      "Choose readings and hymns that speak of Christ's death and resurrection; the parish musician will help find sacred music that suits, and secular songs belong at the reception rather than in church.",
      "If a Mass is not possible, the Funeral Liturgy outside Mass is a full Catholic funeral, led by a priest or deacon with the same readings, prayers and final commendation.",
      "Remember the days after. A Mass on the month's mind and on the anniversary, and All Souls' Day each November, continue the prayer the funeral began.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Contact the parish",
        body: "As soon as you can after the death, call the parish, ideally the parish the deceased belonged to; a Catholic is entitled to a funeral from the Church and the parish will find a way even for someone who had drifted from practice. The funeral home will coordinate dates, but the parish sets the time of Mass, assigns the priest or deacon, and provides a planning sheet with the readings and music. Tell them if the person was to be cremated and whether the remains will be present at the Mass. If the family is far from the deceased's parish, any Catholic parish may celebrate the funeral with the pastor's consent.",
      },
      {
        order: 2,
        title: "Know the three rites",
        body: "The Order of Christian Funerals provides three principal rites. The Vigil for the Deceased, often called the wake, is a Liturgy of the Word held at the funeral home or the church, usually the evening before; the Rosary is often prayed at it, and it is the natural place for words of remembrance from family and friends. The Funeral Liturgy is the central act, ordinarily the Funeral Mass, in which the Church offers the sacrifice of Christ for the deceased and commends them to God in the final commendation. The Rite of Committal, at the grave, mausoleum or columbarium, is the last farewell and the blessing of the place of rest. Each may be celebrated separately, and the parish will fit them to the family's circumstances.",
      },
      {
        order: 3,
        title: "Choose the readings",
        body: "The Funeral Mass has a First Reading, usually from the Old Testament (during Easter Time from the Acts of the Apostles or Revelation), a Responsorial Psalm, a Second Reading from the New Testament, and a Gospel, each chosen from the selections given in the Order of Christian Funerals. Among the most loved: Wisdom 3:1-9, 'The souls of the just are in the hand of God'; Psalm 23, 'The Lord is my shepherd'; Romans 8:31-39, 'Nothing can separate us from the love of Christ'; 1 Thessalonians 4:13-18; John 11:17-27, 'I am the resurrection and the life'; John 14:1-6, 'In my Father's house there are many dwelling places.' Ask family members who can read clearly to proclaim the first two readings; the Gospel is read by the deacon or priest.",
      },
      {
        order: 4,
        title: "Choose the music",
        body: "Music at a Catholic funeral is sacred music, chosen to express the paschal faith of the Church and to let the assembly sing: an entrance hymn, the responsorial psalm, the Mass parts, a Communion hymn and a hymn at the final commendation. The parish's musician will suggest settings and hymns the congregation knows, and many parishes keep a list of approved funeral music. Favourite popular or secular songs, however dear, are not used in the liturgy; they can be played at the vigil, the graveside gathering or the reception, and the parish will tell you where the line falls.",
      },
      {
        order: 5,
        title: "Understand the homily and the words of remembrance",
        body: "At the Funeral Mass the priest or deacon gives a homily on the readings and the Christian meaning of death; the Order of Christian Funerals directs that there is never to be a eulogy in its place. That does not mean the person's life goes unspoken: the rite allows a member or a friend of the family to speak briefly in remembrance of the deceased before the final commendation, and the vigil is the fuller opportunity for stories and tributes. Parishes differ on how they handle the words of remembrance at Mass, so ask, keep them brief and written down, and choose a speaker who can hold together.",
      },
      {
        order: 6,
        title: "Decide about cremation and burial",
        body: "The Church earnestly recommends that the bodies of the dead be buried in cemeteries or other sacred places, but cremation is permitted unless it was chosen for reasons contrary to Christian teaching. The Church prefers that the body be present for the Funeral Mass and cremation follow; where cremation comes first, the cremated remains may be present at the Mass in the dioceses of the United States, treated with the same respect as the body. The remains must then be buried in a grave or placed in a mausoleum or columbarium: the Church does not permit them to be scattered, divided among relatives, kept at home, or made into keepsakes. The committal prayers are the same for a casket and for an urn.",
      },
      {
        order: 7,
        title: "Take part in the Funeral Mass and the committal",
        body: "At the church door the priest sprinkles the coffin with holy water in memory of Baptism and the white pall is placed over it, the sign of the baptismal garment; a family member may place the pall. The Mass proceeds with the readings, the homily, the prayers of the faithful and the Liturgy of the Eucharist, with family members bringing up the bread and wine if they wish. After Communion comes the final commendation: silence, the sprinkling and incensing of the body, and the song of farewell, 'May the angels lead you into paradise.' At the grave the priest blesses the place of rest and leads the committal, ending with the prayer everyone can pray: 'Eternal rest grant unto him (her), O Lord, and let perpetual light shine upon him. May he rest in peace. Amen.'",
      },
      {
        order: 8,
        title: "Have Masses offered afterward",
        body: "The funeral is the beginning of the Church's prayer for the dead, not its end. Ask the parish to offer Mass for the deceased on the month's mind (a month after death) and on the anniversary; a small offering, called a stipend, customarily accompanies the request, but no one is refused for want of it. Have their name entered in the parish's Book of the Dead for All Souls' Day, visit the grave, and pray the De Profundis and the Salve Regina for them; the guide on praying for the dead on this site gives more. Grief has its own timetable, and the Church's practice of continued prayer is one of her mercies for the living as well as the dead.",
      },
    ],
    relatedPrayers: ["eternal-rest", "de-profundis", "salve-regina"],
    relatedDevotions: ["devotion-to-the-holy-souls"],
  }),

  guide({
    slug: "how-to-pray-for-the-dead",
    title: "How to Pray for the Dead",
    summary:
      "Praying for the holy souls in purgatory: why the Church does it, the Eternal Rest and the psalms, having a Mass offered, All Souls' Day and the month of November, the cemetery indulgence, and enrolling the dead in a society of prayer.",
    authorityLevel: "VATICAN",
    citations: [V_IND, U_FUN],
    intro:
      "From the earliest centuries the Church has prayed for her dead, following the example the Book of Maccabees praises when Judas Maccabeus made atonement for the fallen 'that they might be freed from this sin' (2 Maccabees 12:46). The Catechism teaches that those who die in God's grace but still imperfectly purified are assured of salvation yet undergo a purification, and that the Church commends them to God's mercy above all in the Eucharistic sacrifice, and also by almsgiving, indulgences and works of penance. This guide gathers the ordinary ways a Catholic prays for the dead, from a single Eternal Rest to the practices of November.",
    whatYouNeed: [
      "A list of the dead you want to pray for by name: family, friends, and the forgotten souls no one else remembers",
      "The Eternal Rest, the De Profundis (Psalm 130) and the prayer of Saint Gertrude, all on this site",
      "Your parish's Mass intention book or office, to have Masses offered",
      "A calendar note for 2 November and for the first eight days of November",
    ],
    whenToPray:
      "Daily, briefly, at night prayer or grace after meals; at every Mass, when the priest prays for the dead in the Eucharistic Prayer; on the anniversary of a death; and especially on All Souls' Day and throughout November.",
    tips: [
      "Add one line to your night prayers: 'Eternal rest grant unto them, O Lord...' Small and daily outlasts grand and occasional.",
      "Pray for the forgotten: the souls with no one left to remember them. This is a work of mercy that costs nothing and reaches far.",
      "Do not treat an indulgence as a transaction. It is the Church applying the merits of Christ and the saints to a soul, at your prayer; the conditions exist to make sure your heart is in it.",
      "Grief and prayer belong together. Praying for someone you have lost is also how you stay close to them.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand why we pray for the dead",
        body: "The Church teaches that those who die in friendship with God but still bear the remains of sin undergo a purification, which she calls purgatory, before entering the joy of heaven, and that our prayers can help them. Prayer for the dead rests on the communion of saints: the faithful on earth, the souls being purified, and the saints in heaven are one Body in Christ, and the love that binds them can be exchanged as prayer. The Second Book of Maccabees calls it a holy and pious thought to pray for the dead. It is also a comfort: the one you have lost is not beyond your reach.",
      },
      {
        order: 2,
        title: "Pray the Eternal Rest",
        body: "The Church's own short prayer for the dead is the Requiem aeternam: 'Eternal rest grant unto them, O Lord, and let perpetual light shine upon them. May they rest in peace. Amen.' For one person, say 'him' or 'her' and use their name. Pray it whenever a death comes to mind, when you pass a cemetery or hear a siren, at the end of the Rosary, and at night. Add the De Profundis, Psalm 130, 'Out of the depths I cry to you, O Lord,' which the Church has prayed for the dead for over a thousand years, and, if you wish, the prayer attributed to Saint Gertrude the Great: 'Eternal Father, I offer you the most precious Blood of your divine Son, Jesus, in union with the Masses said throughout the world today, for all the holy souls in purgatory...'",
      },
      {
        order: 3,
        title: "Have a Mass offered",
        body: "The greatest prayer for the dead is the Mass, in which Christ's own sacrifice is offered for them; every Eucharistic Prayer contains a petition for the dead, and a Mass may be offered for a particular soul. Go to the parish office and ask for a Mass to be said for the person by name, on a date that matters if one is free; a small offering is customary, and no one is turned away for lack of it. Many religious orders and mission societies also accept Mass intentions. Attend the Mass yourself if you can, and receive Communion for the soul you are praying for.",
      },
      {
        order: 4,
        title: "Keep All Souls' Day and the month of November",
        body: "The Commemoration of All the Faithful Departed, All Souls' Day, is 2 November, the day after All Saints, and the whole month of November is devoted to the holy souls. Go to Mass on All Souls' Day; every priest may celebrate three Masses that day. Write the names of your dead in the parish's Book of the Dead or on the All Souls envelope, so they are remembered at every Mass of the month. At home, light a candle by their photograph and pray the Eternal Rest and the De Profundis together as a family. The Church also grants a plenary indulgence, applicable only to the souls in purgatory, to those who on All Souls' Day devoutly visit a church or oratory and pray the Our Father and the Creed there.",
      },
      {
        order: 5,
        title: "Visit a cemetery, especially 1 to 8 November",
        body: "The Manual of Indulgences grants a plenary indulgence, applicable only to the souls in purgatory, to the faithful who devoutly visit a cemetery and pray, even if only mentally, for the dead on each day from 1 to 8 November, and a partial indulgence on any other day of the year. The usual conditions for a plenary indulgence apply: sacramental confession within about a week before or after, Holy Communion, prayer for the Pope's intentions (an Our Father and a Hail Mary suffice), and freedom from attachment to any sin, even venial. Go to the grave of someone you love, or to any Catholic cemetery, and pray the Eternal Rest for those buried there, especially the ones no one visits.",
      },
      {
        order: 6,
        title: "Enrol the dead in a society of prayer",
        body: "Many religious orders and Catholic associations keep perpetual enrolments, in which a person, living or dead, is remembered in the Masses and prayers of the community forever; a Mass card or enrolment certificate from the Franciscans, the Carmelites, the Benedictines, the Society for the Propagation of the Faith or a purgatorial society is a fitting gift to a bereaved family. Ask your parish which societies it trusts. Enrolment is not a substitute for your own prayer, but it means that when you are gone, someone will still be praying for the one you loved.",
      },
      {
        order: 7,
        title: "Ask the holy souls to pray for you",
        body: "Devotion to the holy souls has always been two-sided: we pray for them, and the Church's tradition holds that they, being certain of salvation, pray for us. Make them your companions. Offer a decade of the Rosary for them each day, pray the Eternal Rest at the end of grace after meals, and ask their intercession in your own needs. Saint Gertrude, Saint Catherine of Siena and Saint Faustina all wrote of their love for the souls in purgatory, and the Church honours that love as a real work of mercy.",
      },
    ],
    relatedPrayers: [
      "eternal-rest",
      "de-profundis",
      "saint-gertrude-prayer",
      "our-father",
      "hail-mary",
    ],
    relatedDevotions: ["devotion-to-the-holy-souls"],
    relatedSaints: [
      "saint-gertrude-the-great",
      "saint-catherine-of-siena",
      "saint-faustina-kowalska",
    ],
  }),

  // ───────────────────────────── Matrimony ─────────────────────────────
  guide({
    slug: "preparing-for-marriage",
    title: "How to Prepare for Marriage in the Church",
    summary:
      "From engagement to the wedding day: contacting the parish in good time, the marriage preparation program, the documents, mixed marriages and dispensations, choosing the form of the celebration, confession, the rehearsal and the vows.",
    sacramentKey: "matrimony",
    authorityLevel: "USCCB",
    citations: [U_MARR_PREP, V_CIC_MATR],
    intro:
      "For two baptised Christians marriage is a sacrament: the couple themselves are its ministers, and the consent they exchange before the Church's minister and two witnesses makes them one for life and a sign of Christ's love for the Church. Because it is a sacrament the Church asks couples to prepare well, and the bishops of the United States, in Amoris Laetitia's spirit, speak of preparation as a path rather than a form to fill in. This guide walks through what a parish in the United States will ask of you, from the first phone call to the words of consent, so that nothing surprises you and everything has time.",
    whatYouNeed: [
      "A first conversation with the parish at least six months before the date you hope for; some dioceses ask for more",
      "A recent baptismal certificate for each Catholic party, issued within the past six months and showing any notations of confirmation or prior marriage",
      "Proof of freedom to marry: usually sworn statements from a parent or a long-time friend of each of you",
      "Your civil marriage licence, obtained in the weeks before the wedding according to state law",
      "A willingness to do the preparation program honestly, together",
    ],
    whenToPray:
      "Throughout the engagement, and especially the night before the wedding: a good confession, and the Prayer to the Holy Spirit asked together.",
    tips: [
      "Book the church before the reception. Parishes fill up, and the priest's availability sets the date, not the venue's.",
      "Do the preparation as a couple, not as a hurdle. The inventories and conversations often surface what you have not yet said to each other.",
      "If either of you has been married before, tell the priest at the first meeting: a prior marriage must be examined before a date can be set, and it can take time.",
      "Keep the Mass simple and keep it prayerful. The most beautiful weddings are the ones where the couple are visibly praying.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Contact the parish at least six months ahead",
        body: "Call or visit the parish where you would like to marry, usually the parish of the bride or the groom, and ask to meet the priest or deacon who prepares couples. Most dioceses of the United States ask for at least six months' notice, and some for a year, so make this call before you book anything else. At the first meeting the priest will ask about your faith, your families, whether either of you has been married before, and what date you hope for, and will explain the diocese's program. He is not there to test you; he is there to help you marry well.",
      },
      {
        order: 2,
        title: "Take part in the preparation program",
        body: "Every diocese requires a course of preparation, and it takes several forms: an Engaged Encounter weekend, a series of Pre-Cana evenings, or meetings with a sponsor couple from the parish, usually together with a premarital inventory such as FOCCUS or Prepare-Enrich that the two of you answer separately and then discuss with a mentor. The topics are those a marriage is built of: communication, money, faith, family of origin, sexuality and openness to children, and the Church's teaching on the sacrament. Many couples also take a course in natural family planning. Give it your time, and use it to talk.",
      },
      {
        order: 3,
        title: "Gather the documents",
        body: "The parish will assemble a prenuptial file. A Catholic party needs a baptismal certificate issued within the last six months by the church of Baptism, since the certificate's notations show confirmation and any prior marriage; a baptised non-Catholic supplies a baptismal record if one exists. Each of you gives evidence of freedom to marry, usually sworn affidavits from a parent or someone who has known you since before you were of marriageable age. You will fill in a prenuptial questionnaire with the priest, and, if either of you belongs to another parish or diocese, permissions are obtained by the parish. The civil licence is obtained from the county clerk shortly before the wedding, according to the law of your state.",
      },
      {
        order: 4,
        title: "Ask about mixed marriages and dispensations",
        body: "A Catholic may marry a baptised non-Catholic with the permission of the bishop, which the parish requests; this is a mixed marriage. A Catholic may marry an unbaptised person with a dispensation from the impediment of disparity of worship. In both cases canon 1125 asks the Catholic party to declare that they are prepared to remove dangers of defecting from the faith and to make a sincere promise to do all in their power to have all the children baptised and brought up in the Catholic Church, and the other party is to be informed of that promise. The non-Catholic party makes no promise. If you wish to marry in the other party's church, a dispensation from canonical form may be requested through the parish.",
      },
      {
        order: 5,
        title: "Choose the form of the celebration",
        body: "The Order of Celebrating Matrimony offers the celebration within Mass and the celebration without Mass. When both parties are Catholic, marriage within Mass is the norm and the fitting choice. When one party is a baptised non-Catholic the rite recommends the celebration without Mass, so that the whole wedding party can take part in everything, though a Mass is possible with the bishop's permission; when one party is unbaptised, the rite for marriage between a Catholic and a catechumen or a non-Christian is used, without Mass. Talk it through with the priest with the guests in mind, not only yourselves; the guide on planning a Catholic wedding liturgy on this site covers the readings and music.",
      },
      {
        order: 6,
        title: "Go to confession",
        body: "The Church strongly recommends that Catholics approach the Sacrament of Penance before marriage, so that they receive the sacrament of Matrimony, and Holy Communion at their wedding Mass, in the state of grace. Go in the last week before the wedding, both of you if both are Catholic; if it has been years, say so and the priest will help. This is also a good time for an honest examination of the engagement itself, so that you go to the altar with nothing hidden from God or from each other. Pray the Act of Contrition, and afterward the Prayer to the Holy Spirit, asking for the gifts the marriage will need.",
      },
      {
        order: 7,
        title: "Attend the rehearsal",
        body: "A day or two before the wedding the parish holds a rehearsal, usually led by the priest, deacon or the parish's wedding coordinator, for the couple, their parents, the wedding party, the readers and anyone bringing up the gifts. It walks through the entrance, where everyone stands and sits, the readings, the questions before consent, the exchange of consent and rings, and the recessional. Bring the licence and any remaining paperwork, arrive on time and sober, and listen to the parish's rules about photography, flowers and music; they exist to keep the church a church.",
      },
      {
        order: 8,
        title: "Give your consent",
        body: "The heart of the rite is the consent, which the two of you give to each other in the presence of the Church's minister and two witnesses. After asking whether you have come freely, whether you are prepared to love and honour each other for life, and whether you are prepared to accept children lovingly from God, the priest invites you to join your right hands and declare your consent. The groom says: 'I, N., take you, N., to be my wife. I promise to be faithful to you, in good times and in bad, in sickness and in health, to love you and to honour you all the days of my life.' The bride says the same, taking him as her husband. The priest receives the consent: 'What God has joined, let no one put asunder.' Then the rings are blessed and exchanged: 'N., receive this ring as a sign of my love and fidelity. In the name of the Father, and of the Son, and of the Holy Spirit.' Pray the Our Father together at the Mass as your first prayer as husband and wife.",
      },
    ],
    relatedPrayers: ["act-of-contrition", "prayer-to-the-holy-spirit", "our-father", "hail-mary"],
    relatedSaints: ["saint-joseph"],
  }),

  guide({
    slug: "how-to-plan-a-catholic-wedding-liturgy",
    title: "How to Plan a Catholic Wedding Liturgy",
    summary:
      "Planning the celebration itself from the Order of Celebrating Matrimony: Mass or Liturgy of the Word, choosing the readings, sacred music, the questions and consent, the rings, Communion, the nuptial blessing, and the parish's practical rules.",
    sacramentKey: "matrimony",
    authorityLevel: "USCCB",
    citations: [U_MFL, V_CCC_MATR],
    intro:
      "The wedding liturgy is a celebration of the Church, not a private ceremony, and the Order of Celebrating Matrimony gives it a clear shape: the couple are received at the church, the Word of God is proclaimed, the couple give their consent and exchange rings, the Church prays the nuptial blessing over them, and, at a Mass, they receive the Body and Blood of Christ together for the first time as husband and wife. Within that shape there are real choices to make, and this guide sets them out in the order the parish will ask about them.",
    whatYouNeed: [
      "The parish's wedding planning booklet, which lists the readings, prayers and music the rite provides",
      "Readers (usually two), and gift bearers if the wedding is a Mass",
      "The parish musician's contact details, and a meeting with them early",
      "Two witnesses of age, usually the best man and maid or matron of honour, who need not be Catholic",
      "The rings, and the civil licence delivered to the parish before the day",
    ],
    whenToPray:
      "The liturgy is normally celebrated on a Saturday or a weekday; weddings on Sundays and the great solemnities are discouraged, and during Lent the decoration and music are restrained in keeping with the season.",
    tips: [
      "Choose readings you can hear yourselves in, and at least one that speaks of marriage directly, as the rite asks.",
      "The unity candle, sand ceremonies and similar customs are not part of the Catholic rite; most parishes ask that they be kept for the reception.",
      "Ask your readers to practise aloud, and to read from the Lectionary at the ambo rather than from a phone.",
      "Photographers and florists work within the parish's rules; give them the rules early so the day is not spent negotiating.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Decide between Mass and the Liturgy of the Word",
        body: "The Order of Celebrating Matrimony provides two full forms. The celebration of Matrimony within Mass is the norm for two Catholics: the rite of marriage follows the homily, and the couple and the congregation receive Holy Communion. The celebration of Matrimony without Mass has the same Liturgy of the Word, consent, rings and nuptial blessing, followed by the Our Father and a blessing, and it is recommended when one party is not Catholic, so that the two families share equally in the whole celebration. Neither is 'more married' than the other; the sacrament is the consent. Decide with the priest, looking at who will be in the pews.",
      },
      {
        order: 2,
        title: "Choose the readings",
        body: "The rite provides a Lectionary of Old Testament readings, psalms, New Testament readings and Gospels, and asks that at least one reading explicitly speak of marriage. Couples commonly choose Genesis 1:26-28, 31 or Genesis 2:18-24; Tobit 8:4b-8, the prayer of Tobias and Sarah on their wedding night; Psalm 128 or Psalm 33; 1 Corinthians 12:31-13:8a, 'Love is patient, love is kind'; Ephesians 5:2a, 21-33; Colossians 3:12-17; 1 John 4:7-12; and the Gospels of the wedding at Cana (John 2:1-11), the Beatitudes (Matthew 5:1-12a), the house built on rock (Matthew 7:21, 24-29), and 'This is my commandment: love one another' (John 15:9-12). One Old Testament reading, a psalm, one New Testament reading and a Gospel is the usual pattern, and the parish booklet will have the full list.",
      },
      {
        order: 3,
        title: "Plan the music",
        body: "Meet the parish musician early. Music at a wedding is liturgical music: an entrance hymn or instrumental processional, the responsorial psalm sung, the Gospel acclamation, and at a Mass the Holy, Holy, memorial acclamation, Amen and Lamb of God, with a Communion hymn and a recessional. The rite allows the couple's own choices within the sacred repertoire, and parishes generally keep a list of hymns and settings the assembly can sing. Secular songs, however meaningful to the two of you, belong at the reception; a hymn to Mary, such as the Salve Regina, may be sung if the couple wish to bring flowers to her image, and the parish will tell you where in the rite it fits.",
      },
      {
        order: 4,
        title: "Prepare for the questions and the consent",
        body: "After the homily the priest addresses the couple: 'N. and N., have you come here to enter into Marriage without coercion, freely and wholeheartedly?' Each answers: 'I have.' 'Are you prepared, as you follow the path of Marriage, to love and honour each other for as long as you both shall live?' 'I am.' 'Are you prepared to accept children lovingly from God and to bring them up according to the law of Christ and his Church?' 'I am.' (This third question is omitted if the couple are advanced in years.) Then, joining right hands, each declares: 'I, N., take you, N., to be my wife (husband). I promise to be faithful to you, in good times and in bad, in sickness and in health, to love you and to honour you all the days of my life.' Learn these words by heart; the priest will prompt you, but they are yours to say.",
      },
      {
        order: 5,
        title: "Exchange the rings",
        body: "The priest receives your consent, saying: 'May the Lord in his kindness strengthen the consent you have declared before the Church, and graciously bring to fulfilment his blessing within you. What God has joined, let no one put asunder.' All answer: 'Amen.' He then blesses the rings: 'May the Lord bless these rings, which you will give to each other as a sign of love and fidelity.' The husband places the ring on his wife's finger, saying: 'N., receive this ring as a sign of my love and fidelity. In the name of the Father, and of the Son, and of the Holy Spirit.' The wife does the same. A hymn or canticle of praise may follow, and then the Universal Prayer, the intercessions, which the couple may help compose.",
      },
      {
        order: 6,
        title: "Receive the nuptial blessing and Communion",
        body: "At a Mass the liturgy continues with the preparation of the gifts, which the couple's parents or friends may bring forward, and the Eucharistic Prayer. After the Our Father, the priest turns to the couple and prays the Nuptial Blessing over them, a long and beautiful prayer asking that they be faithful, fruitful, blessed with children and with a long life, and reach at last the kingdom of heaven. The couple then receive Holy Communion, under both kinds where that is the parish's practice; the Catholic guests receive too, and the non-Catholic guests are invited to pray. At a celebration without Mass the Nuptial Blessing follows the Our Father in the same way, and the rite ends with the solemn blessing.",
      },
      {
        order: 7,
        title: "Settle the parish's practical rules",
        body: "Every parish has its own house rules and they save a wedding from a great deal of friction: where photographers may stand and whether flash is allowed; what flowers may be placed and whether they stay for the parish's use; no rice, confetti or petals inside; whether an aisle runner is used; how many musicians and where they sit; the offering for the church, the musician and the servers; and the time the church must be cleared. Give the rules to your vendors in writing, appoint one friend to be the parish's contact on the day, and let the wedding coordinator run the church while you pray. Ask the parish whether the Creed belongs in your liturgy: the Order of Celebrating Matrimony (no. 69) has the Symbol or Creed said after the Universal Prayer if the rubrics of the day require it, which means it is said when the wedding falls on a Sunday or a solemnity and is omitted on the ordinary weekdays and Saturdays when most weddings are celebrated.",
      },
    ],
    relatedPrayers: ["our-father", "hail-mary", "salve-regina"],
  }),

  guide({
    slug: "how-to-pray-as-a-married-couple",
    title: "How to Pray as a Married Couple",
    summary:
      "Simple, sustainable prayer for spouses: starting small, a morning offering together, grace at meals, a decade of the Rosary at night, Mass and confession together, and renewing your vows.",
    sacramentKey: "matrimony",
    authorityLevel: "VATICAN",
    citations: [V_AL, V_FC],
    intro:
      "Pope Francis writes in Amoris Laetitia that a few minutes of prayer together each day can be found, and that in it a couple can thank God, ask for what they need, and entrust one another to him. Saint John Paul II said in Familiaris Consortio that conjugal prayer is the shared response to God's own initiative in the sacrament. None of this asks a couple to become a monastery; it asks for a small, honest habit that survives children, shift work and tiredness. This guide gives one that many couples have found they can keep.",
    whatYouNeed: [
      "Five minutes at a fixed point in the day, agreed on together; the point matters more than the length",
      "A rosary, or ten fingers",
      "A crucifix or an image of the Holy Family somewhere you both see it",
      "Patience with each other: one of you will usually be more inclined to this than the other",
    ],
    whenToPray:
      "Morning, at meals and at night, in whatever measure you can keep; Sunday Mass together every week; confession together a few times a year; your vows renewed on your anniversary.",
    tips: [
      "Start smaller than you think you should. A Glory Be at the bedroom door every night is worth more than a Holy Hour once.",
      "Pray for each other out loud, briefly and specifically. It is disarming, and it changes how you argue.",
      "Do not use prayer to make a point to your spouse. God is the one you are talking to.",
      "When one of you does not want to pray, the other prays quietly for both. Prayer is never a battleground.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Start small and fix the time",
        body: "Choose one moment you already share every day, going to bed, the first coffee, the drive to Mass, and attach one short prayer to it. Agree the time out loud so it is a decision and not a hope. The Sign of the Cross and a Glory Be together at the end of the day is a complete beginning; if that holds for a month, add a Hail Mary and a line of thanks for the day. Amoris Laetitia says that family prayer is a means of expressing and strengthening the faith of the whole household, and its first cell is the two of you.",
      },
      {
        order: 2,
        title: "Make a morning offering together",
        body: "Before the day scatters you, stand together for a moment and pray the Morning Offering: 'O Jesus, through the Immaculate Heart of Mary, I offer you my prayers, works, joys and sufferings of this day...'. Say it as 'we' if you like, or each say it quietly while holding hands. Add one intention aloud for the other: 'for your meeting', 'for your mother', 'for patience with the baby'. Thirty seconds is enough, and it means the day's work is offered before it is done.",
      },
      {
        order: 3,
        title: "Say grace at every meal you share",
        body: "Grace before meals is the easiest prayer to keep and the first one children learn: 'Bless us, O Lord, and these thy gifts, which we are about to receive from thy bounty, through Christ our Lord. Amen.' Take turns leading it. After the meal, when you can, add the Grace after Meals: 'We give thee thanks, almighty God, for all thy benefits, who livest and reignest for ever and ever. Amen. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.' Say it in restaurants too, quietly, and in front of guests; it is a small public witness and a private habit at once.",
      },
      {
        order: 4,
        title: "Pray a decade of the Rosary at night",
        body: "The full Rosary takes twenty minutes, which is often too long for two tired people; one decade takes three. Before bed, one of you announces a mystery, the day's set or the one you both love, and you pray the Our Father, ten Hail Marys and the Glory Be together, with the Fatima Prayer if you wish. Add an intention: your marriage, your children, the one of you who is struggling. Saint John Paul II asked families to pray the Rosary and said that a family that prays together stays together, quoting Father Patrick Peyton; a decade a night is how most families actually manage it. On the nights you have more, pray the whole thing.",
      },
      {
        order: 5,
        title: "Go to Mass together",
        body: "Sunday Mass is the one prayer no Catholic couple should pray apart. Go together, sit together, and receive Communion together; if one of you is not Catholic, or not yet able to receive, come together anyway and pray for each other at Communion, praying the Act of Spiritual Communion. When a couple can, a weekday Mass on the anniversary of the wedding, or on a morning that suits, becomes a quiet renewal of what was begun at the altar. Talk about the readings afterward, even for a minute in the car.",
      },
      {
        order: 6,
        title: "Go to confession together",
        body: "A few times a year, before Christmas and Easter at least, go to confession on the same afternoon. You confess separately, as always, but going together says something: that you both know you fall short, that the marriage needs mercy, and that you would rather begin again than keep score. Pray the Act of Contrition beforehand, and afterward, if you can, sit together in the church for a moment and pray the Litany of Humility, which is a marriage prayer if ever there was one. Familiaris Consortio calls the Sacrament of Penance a source of forgiveness and reconciliation for the whole family.",
      },
      {
        order: 7,
        title: "Renew your vows",
        body: "On your anniversary, and at any family Mass where the parish offers it, renew your consent to each other. There is no set formula; many couples simply say again, quietly, at home or at the altar after Mass, the words they said at their wedding: 'I promise to be faithful to you, in good times and in bad, in sickness and in health, to love you and to honour you all the days of my life.' The Church offers a blessing for married couples on their anniversary in the Book of Blessings, and many parishes hold an anniversary Mass each year; ask for it. Then pray the Our Father together, and the Hail Mary, entrusting the next year to Mary and Joseph.",
      },
    ],
    relatedPrayers: [
      "morning-offering",
      "grace-before-meals",
      "grace-after-meals",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "act-of-spiritual-communion",
      "act-of-contrition",
      "litany-of-humility",
    ],
    relatedDevotions: ["holy-rosary"],
    relatedSaints: ["saint-joseph", "saint-gianna-molla", "saint-louis-ix"],
  }),

  guide({
    slug: "how-to-have-a-marriage-convalidated",
    title: "How to Have a Marriage Convalidated",
    summary:
      "Bringing a civil marriage into the Church: what convalidation is and why it is needed, contacting the parish, dealing with any prior marriages, the preparation, the rite of consent, and living the sacrament afterward.",
    sacramentKey: "matrimony",
    authorityLevel: "VATICAN",
    citations: [V_CIC_MATR, U_MFL],
    intro:
      "A Catholic is bound to marry according to the Church's form: before a bishop, priest or deacon and two witnesses. A Catholic who married only civilly, or in another church without a dispensation, is therefore not yet validly married in the eyes of the Church, whatever the state says, and cannot receive Holy Communion until the situation is set right. Convalidation is the Church's remedy: the couple, now free and willing, give their consent before the Church's minister, and from that moment a true and sacramental marriage exists. It is a common request in every parish, handled with kindness, and it is usually simpler than couples fear.",
    whatYouNeed: [
      "A meeting with the parish priest or deacon, who will explain the process in your case",
      "A recent baptismal certificate for each Catholic party, and a baptismal record for a baptised non-Catholic if one exists",
      "Your civil marriage certificate",
      "Documents about any prior marriage of either of you: a death certificate, or a declaration of nullity from a Church tribunal",
      "Two witnesses for the rite, who need not be Catholic",
    ],
    whenToPray:
      "Throughout the process, and above all at the rite itself, which may be a quiet weekday ceremony with family or a celebration within Mass, as the couple choose.",
    tips: [
      "Convalidation is not 'blessing' an existing marriage. It is the moment the marriage comes into being before God; treat it with the seriousness of a wedding, however small.",
      "Nothing about your civil marriage changes: you keep your names, your licence and your legal status. The Church adds the sacrament.",
      "If your spouse is reluctant, tell the priest. He can explain what is being asked, and there is a further remedy, radical sanation, that the diocese can consider in some cases.",
      "Do not stay away from the parish out of embarrassment. Priests receive this request constantly and are glad of it.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Understand what convalidation is",
        body: "Canon 1108 requires that a Catholic marry before the local ordinary, the pastor, or a priest or deacon delegated by them, and before two witnesses; a marriage attempted otherwise, without a dispensation, is invalid. Canons 1156 to 1160 provide for its convalidation: the party or parties who gave defective consent, or who were bound by the form, renew their consent according to the canonical form, and the marriage is valid from that moment, not retroactively. Because the consent is new, the Church treats it as what it is, a real celebration of Matrimony, and the couple are married sacramentally from the day of the rite.",
      },
      {
        order: 2,
        title: "Contact the parish",
        body: "Make an appointment with the priest or deacon of the parish you attend, or would like to attend, and tell him plainly that you were married civilly and wish to have the marriage convalidated. He will ask when and where you married, whether either of you has been married before, whether both are baptised, and where you stand with the Church now. He will explain the diocese's requirements, which vary a little from place to place, and what documents to gather. Bring your civil certificate to the first meeting; it saves a second one.",
      },
      {
        order: 3,
        title: "Resolve any prior marriages",
        body: "This is the step that most often takes time. If either of you was previously married, to anyone, in any form, civil or religious, the Church presumes that marriage valid until a tribunal declares otherwise, and no convalidation can take place until the prior bond is shown to be ended by death or declared null. A prior marriage of a Catholic who married outside the Church without a dispensation can usually be handled quickly by a documentary process for lack of canonical form; other cases require a formal petition to the diocesan tribunal. The guide on petitioning for a declaration of nullity on this site explains what that involves. Begin it at once; the parish will help.",
      },
      {
        order: 4,
        title: "Do the preparation",
        body: "Because a convalidation is a true celebration of marriage, the Church asks for preparation, though a parish will adapt it to a couple who have already been living together for years; a full Pre-Cana program is rarely required, and the priest may instead meet with you several times to talk about the sacrament, the promises, and your life of faith. If one of you is not Catholic, the same permissions and promises apply as for any mixed marriage: the Catholic party promises to do all in their power to have the children baptised and raised Catholic. Both of you fill in the prenuptial questionnaire. A Catholic party goes to confession before the rite, so as to receive the sacrament and Holy Communion in the state of grace.",
      },
      {
        order: 5,
        title: "Celebrate the rite",
        body: "The convalidation uses the Order of Celebrating Matrimony, within Mass or without, and may be as simple or as full as you wish: many couples choose a weekday afternoon in the church with their children, parents and two witnesses; others choose a Saturday with family and friends; some renew their consent at a Sunday parish Mass. The priest asks the questions before consent, and then you give your consent to each other: 'I, N., take you, N., to be my wife (husband). I promise to be faithful to you, in good times and in bad, in sickness and in health, to love you and to honour you all the days of my life.' The rings you already wear may be blessed and given again. The priest then prays the Nuptial Blessing over you, and the marriage is recorded in the parish register and notified to the church of your Baptism.",
      },
      {
        order: 6,
        title: "Live the sacrament",
        body: "From the day of the convalidation you are married in Christ, and the Church's whole sacramental life is open to you: return to Holy Communion together, keep Sunday Mass, and let your children see that their parents pray. Take up some small daily prayer as a couple, the Our Father at night or grace at meals; the guide on praying as a married couple on this site suggests a simple rule. Consider having your marriage blessed again on its anniversary, and thank God for the grace that brought you back. Pray the Prayer to the Holy Spirit for the gifts the marriage will need, and the Hail Mary, entrusting the home to the Mother of God.",
      },
    ],
    relatedPrayers: ["act-of-contrition", "our-father", "prayer-to-the-holy-spirit", "hail-mary"],
    relatedSaints: ["saint-joseph"],
  }),

  guide({
    slug: "how-to-petition-for-a-declaration-of-nullity",
    title: "How to Petition for a Declaration of Nullity",
    summary:
      "The tribunal process explained pastorally: what an annulment is and is not, who to contact, gathering testimony, the formal petition, the process and its timeline since Mitis Iudex, the decision, and how to move forward.",
    sacramentKey: "matrimony",
    authorityLevel: "VATICAN",
    citations: [V_MIDI, V_CIC_MATR],
    intro:
      "A declaration of nullity, commonly called an annulment, is a judgement by a Church tribunal that what looked like a marriage was, from the beginning, not the lifelong bond the Church means by that word, because something essential was missing when consent was given. It is not a Catholic divorce, it does not end a marriage, and it says nothing about the legitimacy of children. Pope Francis reformed the process in 2015 with Mitis Iudex Dominus Iesus to make it quicker, simpler and, as far as possible, free, and he asked bishops to see the tribunal as a work of mercy. This guide describes the process as it works in the dioceses of the United States, so that a person who has been through a divorce knows what to expect.",
    whatYouNeed: [
      "A conversation with your parish priest, deacon or the parish's trained advocate, who will help you through everything that follows",
      "Your marriage certificate (civil and, if you married in church, the Church record), and the final divorce decree",
      "Baptismal certificates for the parties, where they exist",
      "The names and addresses of several people who knew you both around the time of the wedding and are willing to answer the tribunal's questions",
      "Time and honesty: your written account of the courtship, the wedding and the marriage is the core of the case",
    ],
    whenToPray:
      "Before the first meeting and throughout: the Prayer to the Holy Spirit for truth and courage, the Litany of Humility against bitterness, and the Our Father for your former spouse.",
    tips: [
      "A civil divorce must be final before a petition is accepted, because the tribunal must be sure the civil marriage is over.",
      "Your former spouse will be contacted and has the right to take part; the case can proceed even if they refuse to respond.",
      "Do not guess at the grounds. Tell the truth about what happened and let the tribunal identify the canonical grounds.",
      "Do not set a wedding date on the strength of a petition. No new marriage can be planned until a declaration is given.",
    ],
    durationMinutes: 30,
    steps: [
      {
        order: 1,
        title: "Understand what a declaration of nullity is, and is not",
        body: "The Church holds that a valid marriage between baptised persons, consummated, cannot be dissolved by any human power. A declaration of nullity does not dissolve anything; it finds that a valid marriage never came into being, because at the moment of consent something essential was lacking. Canons 1095 to 1107 describe the defects of consent that can make a marriage null: a grave lack of discretion of judgement about the essential rights and duties of marriage, an incapacity to assume its essential obligations for psychological reasons, the deliberate exclusion of fidelity, permanence or children, marriage entered through force or grave fear, and certain kinds of error or deceit. A marriage can also be null because of an impediment or, for a Catholic, because it was not celebrated in the Church's form. Canon 1137 is explicit that children of a marriage later declared null are legitimate.",
      },
      {
        order: 2,
        title: "Contact the parish or the tribunal",
        body: "Begin with your parish. Every diocese has a tribunal, and most parishes have a priest, deacon or trained lay advocate who helps petitioners prepare a case and acts as their contact with it. At a first meeting they will listen to your story, tell you whether a case appears possible and of what kind, and give you the diocese's forms. Many dioceses now charge no fee at all, following the Pope's wish that the process be free as far as possible; where a contribution is asked, no one is refused for inability to pay. Ask at the outset, so that money never becomes a reason for silence.",
      },
      {
        order: 3,
        title: "Gather your testimony and witnesses",
        body: "The heart of a formal case is your own written account, answering the tribunal's questionnaire: your family background and your former spouse's, how you met, the courtship, any doubts or pressures before the wedding, the wedding itself, the early years of the marriage, and how it ended. Write it honestly and fully; the tribunal is looking for what was true at the time of consent, not for who was to blame. You will also name witnesses, usually three to five people who knew one or both of you around the time of the wedding, parents, siblings, close friends, and they will be sent their own questionnaires. Warn them, and ask them to answer promptly; slow witnesses are the commonest cause of delay.",
      },
      {
        order: 4,
        title: "Submit the formal petition",
        body: "Your advocate helps you draft the petition, called the libellus, which is submitted to the competent tribunal: since Mitis Iudex that may be the tribunal of the place where the marriage was celebrated, where either party lives, or where most of the evidence is to be found. The tribunal reviews the petition, accepts it, and formally notifies your former spouse, the respondent, who may take part, decline, or simply not answer; the case proceeds in any event. A judge or panel of judges then formulates the doubt, the precise question the tribunal will answer, naming the canonical grounds. The defender of the bond, an official whose task is to argue for the validity of the marriage, takes part in every case, so that the truth is tested from both sides.",
      },
      {
        order: 5,
        title: "Understand the kinds of process and the timeline",
        body: "There are three paths. A documentary process handles cases proved by documents alone, most commonly a Catholic who married outside the Church without a dispensation (lack of canonical form), and it usually takes a few weeks. The ordinary process, for most cases of defective consent, gathers the testimony, allows both parties to review the acts, hears the defender of the bond, and ends in a written sentence; Mitis Iudex removed the former requirement that every affirmative decision be confirmed by a second tribunal, so a single affirmative sentence now suffices unless an appeal is lodged. The briefer process before the bishop is available when both parties petition or consent and the nullity is manifest from evidence that needs no lengthy investigation, and it is meant to take a few months. Tribunals in the United States generally tell petitioners to expect a year or more for an ordinary case; ask yours for its own estimate.",
      },
      {
        order: 6,
        title: "Receive the decision",
        body: "The tribunal's judges reach their decision on the basis of moral certainty and issue a written sentence explaining it, which is sent to both parties. If the marriage is declared null, and no appeal is made within the time allowed, the declaration becomes effective and both parties are free to marry in the Church, unless the sentence attaches a prohibition (a vetitum) requiring one party to consult the bishop or a counsellor before a new marriage, which is done for that person's good. If the tribunal finds that nullity has not been proved, the marriage is presumed valid, and the petitioner may appeal or, later, bring a new case on other grounds. Either way, the decision is a judgement about the past, not a verdict on you as a person.",
      },
      {
        order: 7,
        title: "Move forward in faith",
        body: "Whatever the outcome, a person who has honestly gone through this process has done something brave. A divorced Catholic who has not remarried remains a full member of the Church and may receive the sacraments; the Church's discipline concerning Communion arises only when a person has entered a new civil union while a prior bond stands, and even then Pope Francis in Amoris Laetitia asks that such persons be accompanied, not excluded. Pray for your former spouse, by name, in the Our Father each day; it is hard and it heals. Pray the Litany of Humility against bitterness and the Prayer to the Holy Spirit for a clear heart. If you are free to marry again, prepare for it as for a first marriage; the guide on preparing for marriage in the Church on this site begins there.",
      },
    ],
    relatedPrayers: ["prayer-to-the-holy-spirit", "litany-of-humility", "our-father"],
  }),
];

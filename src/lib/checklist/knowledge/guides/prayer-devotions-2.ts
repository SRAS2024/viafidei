import type { CuratedEntry } from "../index";

/**
 * Guides — section L (Prayer, Devotions & Sacramentals), second half.
 *
 * Catalogue entries 88-94: the Five First Saturdays, the Brown Scapular,
 * blessing the home and using holy water, the May crowning, Friday penance
 * through the year, All Saints' and All Souls' Days, and returning to the
 * Church after time away. Every step body is written to be read from the
 * page while actually doing the thing: versicles and responses are given in
 * full, prayer names are spelled out so PrayerLinkedText can make them
 * expandable, and nothing is presented as a norm that the Church does not
 * actually ask for. Private-revelation promises (Fatima, the scapular) are
 * given as what the seer recorded and the Church has permitted, never as
 * doctrine, and the indulgence conditions follow the Apostolic Penitentiary's
 * own explanation.
 */

// USCCB pages. The site blocks non-browser clients; both of these are the
// same constants sibling guide files verified in a browser on 2026-09-06.
const U_PEN = "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance";
// The plan's ".../prayer-and-worship/liturgical-year" page no longer exists; the
// Secretariat of Divine Worship's liturgical calendar page is the closest.
const U_LITCAL = "https://www.usccb.org/committees/divine-worship/liturgical-calendar";

// Vatican documents (all verified 200 on 2026-09-07).
const V_DPP =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const V_RVM =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const V_MC =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const V_IND =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_pro_20000129_indulgence_en.html";
const V_PAEN =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19660217_paenitemini.html";
// The plan's "ordine-carmelitano" filename 404s; this is the same message of
// John Paul II to the Carmelite family for the 750th anniversary of the
// scapular (25 March 2001), at its live filename.
const V_CARMEL =
  "https://www.vatican.va/content/john-paul-ii/en/messages/pont_messages/2001/documents/hf_jp-ii_mes_20010326_ordine-carmelo.html";
// The plan's "apost_letters" path for Misericordiae Vultus 404s; the bull
// lives under /bulls/.
const V_MV =
  "https://www.vatican.va/content/francesco/en/bulls/documents/papa-francesco_bolla_20150411_misericordiae-vultus.html";
// The plan's cann1205-1253 file does not exist; the live edition splits the
// canons, and cann. 1244-1253 (feast days and days of penance) are here.
const V_CIC_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";
// The plan's ccc_css URL no longer resolves; this is the same article in the
// Vatican's IntraText edition of the Catechism.
// Part 2, Section 2, Chapter 4, Article 1: Sacramentals (CCC 1667-1679).
const V_CCC_SACRAMENTALS = "https://www.vatican.va/archive/ENG0015/__P58.HTM";

type Step = { order: number; title: string; body: string };

interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  kind: "general";
  category: "devotion" | "sacraments";
  sacramentKey?: "eucharist" | "reconciliation";
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
      category: g.category,
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

export const prayerAndDevotionGuidesTwo: CuratedEntry[] = [
  // ──────────── 88. THE FIVE FIRST SATURDAYS ────────────
  guide({
    slug: "how-to-make-the-five-first-saturdays",
    title: "How to Make the Five First Saturdays",
    summary:
      "The Fatima devotion of reparation to the Immaculate Heart of Mary: confession, Communion, five decades of the Rosary and fifteen minutes of meditation on the first Saturday of five consecutive months.",
    kind: "general",
    category: "devotion",
    sacramentKey: "eucharist",
    authorityLevel: "VATICAN",
    citations: [V_DPP, V_RVM],
    intro:
      "At Fatima on 13 July 1917 Our Lady told the three shepherd children that she would come to ask for the Communion of reparation on the First Saturdays, and on 10 December 1925, at Pontevedra in Spain, she made the request to Sister Lucia: confession, Holy Communion, five decades of the Rosary and fifteen minutes of company with her while meditating on the mysteries, on the first Saturday of five consecutive months, with the intention of making reparation to her Immaculate Heart. She promised to assist at the hour of death, with the graces needed for salvation, those who do this. The apparitions were judged worthy of belief by the Bishop of Leiria in 1930, and the devotion has been kept in parishes ever since; the promise remains private revelation, and the Church commends the devotion for what it plainly is — five months of confession, Communion, the Rosary and quiet meditation, offered in love to the Mother of God.",
    whatYouNeed: [
      "A rosary and the list of the mysteries",
      "A calendar with the first Saturday of the next five months marked",
      "A parish with Saturday Mass, or a plan for reaching Communion that day",
      "Fifteen unhurried minutes, in church or at home, for the meditation",
    ],
    whenToPray:
      "On the first Saturday of five consecutive months. Many parishes keep First Saturday with morning Mass, confessions and the Rosary; the devotion sits naturally beside the Nine First Fridays, and its feast is the Memorial of the Immaculate Heart of Mary, the Saturday after the Solemnity of the Sacred Heart.",
    tips: [
      "The four parts are confession, Communion, the Rosary and the meditation — the fifteen minutes of meditation are separate from the Rosary, not the Rosary itself. Give them their own time.",
      "Sister Lucia recorded that the confession may be made within the days before or after the Saturday, provided you are in the state of grace when you receive Communion and the intention of reparation is kept.",
      "Say the intention out loud at least once each First Saturday: 'in reparation for the offences against the Immaculate Heart of Mary.' The intention is what makes these five Saturdays this devotion.",
      "Having finished the five, many Catholics simply continue every First Saturday. The devotion was never meant to be a one-time transaction but a habit of the heart.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Understand what Our Lady asked",
        body: "Sister Lucia recorded Our Lady's words at Pontevedra: to all who, on the first Saturday of five consecutive months, go to confession, receive Holy Communion, recite five decades of the Rosary and keep her company for fifteen minutes while meditating on the mysteries of the Rosary, with the intention of making reparation to her, she promised to assist at the hour of death with the graces necessary for salvation. Lucia later explained that the number five corresponds to five kinds of offence against the Immaculate Heart: against her Immaculate Conception, her perpetual virginity, her divine motherhood, the teaching of her to children, and insult to her images. Read this once, slowly, so that you know what you are undertaking: four simple acts, five months running, one intention.",
      },
      {
        order: 2,
        title: "Go to confession",
        body: "Make a good confession — the guide 'How to Go to Confession' walks through it — in the days around the First Saturday, and make your Act of Contrition with the added intention of reparation to the Immaculate Heart of Mary. Sister Lucia recorded that the Lord accepted the confession being made earlier or later than the Saturday itself, so long as you are in the state of grace for Communion and keep the intention; many parishes hear confessions on Saturday morning before Mass, which makes the timing simple. If you go to confession only at the start of the five months and remain in grace, that is enough, though most people confess monthly while keeping the devotion.",
      },
      {
        order: 3,
        title: "Receive Holy Communion",
        body: "On the First Saturday go to Mass and receive Holy Communion in reparation to the Immaculate Heart. Before receiving, renew the intention in a sentence: 'Mother of God, I receive your Son today in reparation for the offences committed against your Immaculate Heart.' After Communion, make a real thanksgiving; the Anima Christi or a few minutes of silence is enough. If Saturday morning Mass is impossible, a Saturday evening Mass fulfils the devotion — the day, not the hour, is what matters — but a vigil Mass of Sunday is still a Mass celebrated on Saturday, so Communion received there counts for the Saturday.",
      },
      {
        order: 4,
        title: "Pray five decades of the Rosary",
        body: "Pray a full five-decade Rosary, in church after Mass or at home, with the same intention of reparation. Open with the Sign of the Cross, the Apostles' Creed, an Our Father, three Hail Marys and a Glory Be; then for each mystery an Our Father, ten Hail Marys, a Glory Be and the Fatima Prayer, which Our Lady gave the children at Fatima: 'O my Jesus, forgive us our sins, save us from the fires of hell, and lead all souls to heaven, especially those most in need of thy mercy.' Close with the Salve Regina. Saturday's mysteries are the Joyful, but any set may be prayed; the guide 'How to Pray the Rosary' has the full order.",
      },
      {
        order: 5,
        title: "Keep Our Lady company for fifteen minutes",
        body: "This is the part most often forgotten. Set aside fifteen minutes, distinct from the Rosary, to meditate on one or several of the mysteries of the Rosary while keeping Our Lady company — Sister Lucia's phrase. The simplest way is to take one mystery, read the Gospel passage that belongs to it (the Annunciation in Luke 1:26-38, for instance), and stay with it: picture the scene, notice what Mary does and says, and speak to her about it as you would to a mother. It is meditation, not study; when the fifteen minutes are up, thank her and go. Kneeling before the Blessed Sacrament is the ideal place, but a quiet corner at home is fully acceptable.",
      },
      {
        order: 6,
        title: "Keep five consecutive months",
        body: "The Saturdays must be the first Saturday of five months in a row. Mark them now, and plan around holidays and travel; a First Saturday that falls on a feast day or on a journey still counts if the four acts are done. If a month is missed, the traditional understanding is that the five begin again from the next First Saturday. Do not be discouraged by that — the months already offered were not wasted, and the Mother who asked for this is not counting against you. Simply begin again, and tell someone you are doing it; the devotion is far easier kept with a companion.",
      },
      {
        order: 7,
        title: "Hold to the intention of reparation",
        body: "What makes these five Saturdays the devotion Our Lady asked for is the intention: reparation to her Immaculate Heart for the offences against her. Renew it explicitly at each of the four acts — before confession, before Communion, before the Rosary, before the meditation — even in a single sentence. Reparation is also lived, not only prayed: a habit of speaking of Our Lady with reverence, of teaching children to love her, of treating her images with honour, is the reparation continued into the week. Consecration to the Immaculate Heart, which the guide 'How to Consecrate Yourself to the Immaculate Heart of Mary' describes, is the natural fruit of the five months.",
      },
    ],
    relatedPrayers: [
      "act-of-contrition",
      "anima-christi",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
    ],
    relatedDevotions: ["five-first-saturdays", "devotion-immaculate-heart-of-mary", "holy-rosary"],
  }),

  // ──────────── 89. THE BROWN SCAPULAR ────────────
  guide({
    slug: "how-to-be-enrolled-in-the-brown-scapular",
    title: "How to Be Enrolled in the Brown Scapular",
    summary:
      "The Scapular of Our Lady of Mount Carmel: what it is, how to ask a priest for enrolment, what the rite says, how to wear and replace it, and the Marian life it commits you to.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_CARMEL, V_DPP],
    intro:
      "The Brown Scapular is a small garment of two pieces of brown wool cloth joined by cords and worn over the shoulders, front and back — a miniature of the scapular that forms part of the Carmelite habit. Wearing it is a sign of belonging to the family of Carmel and of entrusting oneself to the Blessed Virgin, whom the Carmelites honour under the title of Our Lady of Mount Carmel. Tradition holds that Our Lady gave the scapular to Saint Simon Stock in 1251 with the promise of her protection, and the Church has approved the devotion for centuries while teaching, in the Directory on Popular Piety and the Liturgy, that the scapular is a sign of consecration to Mary, to be worn with a real commitment to live as she lived, and never a charm. Saint John Paul II, who wore it from his youth, wrote to the Carmelites in 2001 that it holds two truths together: Mary's constant protection, and the wearer's resolve to imitate her.",
    whatYouNeed: [
      "A cloth Brown Scapular — a religious-goods shop, a Carmelite community or many parishes will have one",
      "A priest or deacon willing to enrol you, using the approved rite",
      "A few minutes after Mass, or an appointment; the rite itself is short",
      "A resolve to wear it and to pray daily to Our Lady",
    ],
    whenToPray:
      "Enrolment can happen at any time; parishes and Carmelite churches often enrol groups on 16 July, the Memorial of Our Lady of Mount Carmel, or at the close of a Marian devotion. Once enrolled, you wear the scapular always and keep some daily prayer to Our Lady.",
    tips: [
      "Enrolment is once for life. When the cloth wears out you simply put on a new scapular; it does not need to be blessed or the enrolment repeated, though many like to have the new one blessed.",
      "After enrolment with the cloth scapular, a scapular medal — the Sacred Heart on one side, Our Lady on the other — may be worn instead, by a concession of Saint Pius X in 1910. The cloth remains the fuller sign.",
      "The scapular commits you, it does not replace you. A wearer who lives in serious sin without repentance should not expect the cloth to do what only grace and conversion do.",
      "If you cannot find a priest quickly, ask at the parish office: any priest may enrol, and Carmelite communities enrol regularly.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand what the scapular is",
        body: "The scapular is a sacramental — a sacred sign instituted by the Church which disposes us to receive grace — and specifically a sign of consecration to the Blessed Virgin under her title of Our Lady of Mount Carmel. The Directory on Popular Piety and the Liturgy describes it as an external sign of the filial relationship between the Mother of God and the faithful who entrust themselves to her, and asks that it be worn with a true Marian devotion and an effort to live the Gospel. The tradition of the promise to Saint Simon Stock — that Our Lady would protect those who die wearing her scapular — has been permitted by the popes as an expression of confidence in her intercession; it is not a doctrine, and no cloth substitutes for a life of faith. What the Church offers you in the scapular is a habit, in the old sense: a garment that says whose you are.",
      },
      {
        order: 2,
        title: "Ask a priest to enrol you",
        body: "Anyone baptised may be enrolled. Obtain a cloth scapular and ask a priest — or a deacon — to enrol you using the rite of blessing and enrolment approved for the Carmelite scapular; any priest may do it, and Carmelite friars and nuns do it regularly. The simplest approach is to speak to your parish priest after Mass, say that you would like to be enrolled in the Brown Scapular, and ask when he could do it; the rite takes only a few minutes and is often done in the sacristy or before a Marian statue. Families are often enrolled together, and children who are old enough to understand what it means may be enrolled with their parents.",
      },
      {
        order: 3,
        title: "Receive the rite of enrolment",
        body: "The priest first blesses the scapular, then places it over your shoulders. In the approved rite he tells you to receive the scapular as a sign of your special relationship with Mary, the Mother of Jesus, whom you pledge to imitate; that it should remind you of your Christian dignity, of serving others and of following her example; and that you are to wear it as a sign of her protection and of your belonging to the family of Carmel, doing the will of God and working for a world true to his plan of justice and peace. He then prays that Our Lady of Mount Carmel, who clothes you with this sign, may bring you to the mountain which is Christ, and blesses you. You answer the prayers with 'Amen', and if the rite is held before the Blessed Sacrament or a statue of Our Lady, a Hail Mary or the Salve Regina is often sung to close.",
      },
      {
        order: 4,
        title: "Wear it",
        body: "Wear the scapular over the shoulders, one panel resting on the chest and the other on the back, under your clothing; it is meant to be worn continuously, day and night, and not carried in a pocket or hung on a wall. Make it a small daily act: when you put it on in the morning or feel it in the evening, say a Hail Mary or the Sub Tuum Praesidium — 'We fly to your protection, O holy Mother of God...' — and renew your entrustment to her. If it must be removed for surgery, sport or work, put it back on afterwards; taking it off for a reason and a time does not break the enrolment. Treat it with the reverence due to a blessed object.",
      },
      {
        order: 5,
        title: "Replace it when it wears out",
        body: "Cloth scapulars fray and the cords break; that is not a problem. Buy or ask for a new one and put it on: the enrolment was of you, not of the cloth, and it lasts for life, so a replacement needs no new enrolment and need not even be blessed, though it is a good custom to ask a priest to bless it. The old scapular, because it was blessed, should not simply be thrown in the rubbish; the usual practice is to burn or bury it. If you have been enrolled with the cloth scapular, you may also wear the scapular medal instead, particularly where the cloth is impractical, keeping the same intention.",
      },
      {
        order: 6,
        title: "Live the devotion",
        body: "The scapular is a commitment, and the Carmelites describe its content in three parts: to wear it, as a sign of belonging to Mary; to pray to her daily, most fittingly with the Rosary or at least a Hail Mary and the Salve Regina; and to live the chastity proper to your state of life and to imitate her virtues — her attentiveness to God's word, her charity, her humble faith. Keep 16 July, Our Lady of Mount Carmel, as a family feast. Saint Teresa of Avila, Saint John of the Cross and Saint Therese of Lisieux all wore this scapular; make their writings your companions, and let the small brown cloth do what it was given for: to keep you turned, day after day, toward Mary and through her toward Christ.",
      },
    ],
    relatedPrayers: ["hail-mary", "sub-tuum-praesidium", "salve-regina"],
    relatedDevotions: ["brown-scapular", "consecration-to-mary", "holy-rosary"],
    relatedSaints: ["saint-teresa-of-avila", "saint-john-of-the-cross", "saint-therese-of-lisieux"],
  }),

  // ──────────── 90. BLESSING THE HOME AND HOLY WATER ────────────
  guide({
    slug: "how-to-bless-your-home-and-use-holy-water",
    title: "How to Bless Your Home and Use Holy Water",
    summary:
      "Household blessings from the Book of Blessings, the right use of holy water at home, the Epiphany chalk blessing, blessing religious articles, and keeping a prayer corner.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_CCC_SACRAMENTALS, V_DPP],
    intro:
      "Sacramentals are sacred signs instituted by the Church — blessings, holy water, blessed objects — which prepare us to receive grace and sanctify the ordinary occasions of life. Among them the Catechism gives first place to blessings, and it notes that while some blessings are reserved to the ordained, lay people may preside over certain of them, above all parents over their children and households. The Church's Book of Blessings therefore gives an order for the blessing of a home, and Catholic tradition surrounds the home with holy water at the door, the Epiphany inscription over it, a crucifix and an image of Our Lady on the wall, and a corner where the family prays. None of these are magic; all of them are the faith made visible where you live.",
    whatYouNeed: [
      "Holy water, taken from the parish font or dispenser in a small bottle",
      "A crucifix and, if you wish, an image of Our Lady or a saint for the wall",
      "A copy of the household blessings — the Book of Blessings, or the USCCB's Catholic Household Blessings and Prayers",
      "For Epiphany, blessed chalk from the parish, or ordinary chalk you ask the priest to bless",
    ],
    whenToPray:
      "A home blessing by a priest or deacon is usually asked for when a family moves in, and many parishes bless homes during the Easter season; the Epiphany blessing is done in the days around 6 January. Holy water is used daily, at the door and at bedtime.",
    tips: [
      "Holy water is taken, not bought: parishes keep a dispenser or will fill a bottle from the font, especially after the Easter Vigil, when the baptismal water has just been blessed.",
      "When holy water is old or a blessed object is beyond use, pour the water onto the earth and burn or bury the object; blessed things are not put in the rubbish.",
      "A blessing by a lay person is a real blessing, but it is not the same rite as a priest's. Invite the priest for the house; bless your children yourself every night.",
      "Keep the prayer corner simple and used. One crucifix in front of which the family actually prays is worth more than a wall of unnoticed images.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Ask the parish for a house blessing",
        body: "Phone or visit the parish office and ask whether a priest or deacon could come to bless your home; most are glad to, and some parishes announce home blessings during the Easter season or around Epiphany. The Book of Blessings provides the order: a short greeting, a reading from Scripture (often Luke 19, Zacchaeus receiving Jesus into his house, or Luke 10, the disciples' greeting of peace), intercessions, the prayer of blessing asking that God's peace and protection rest on the house and all who live in it, and the sprinkling of the rooms with holy water. Have the family present, clear a table for a crucifix and candle, and walk with the minister from room to room; the blessing is of the household, not only of the walls.",
      },
      {
        order: 2,
        title: "Bless the home yourself when no minister can come",
        body: "The Book of Blessings allows a lay person, and especially a parent, to lead a household blessing with the shorter form it provides. Gather the family, make the Sign of the Cross, and read a short passage of Scripture, such as Luke 10:5-9 ('Into whatever house you enter, first say, Peace to this household'). Then pray in your own words or with the book — that Christ may be a guest in this home, that those who live here may be kept in his peace, and that all who visit may find him here — and end with the Our Father. Sprinkle each room with holy water, saying the Sign of the Cross. A lay person does not use the priest's blessing formula or gestures; the prayer is made with hands joined, and it is still a true blessing.",
      },
      {
        order: 3,
        title: "Keep and use holy water at home",
        body: "Bring holy water home in a clean bottle and keep some in a small font by the front door; the rest can be stored in the bottle. Use it as the Church uses it at the door of every church: bless yourself with it as you come and go, saying 'In the name of the Father, and of the Son, and of the Holy Spirit,' as a renewal of your Baptism. Parents may trace the cross with holy water on their children's foreheads at bedtime with the words 'May God bless you and keep you.' Holy water may be sprinkled in a sickroom, on a new bed or car, or around the house in times of fear, always with a prayer — an Our Father, or the Prayer to Saint Michael in the face of temptation. It is a reminder of Baptism and a sign of God's protection, not a substance with power of its own.",
      },
      {
        order: 4,
        title: "Make the Epiphany blessing of the door",
        body: "On or near the Solemnity of the Epiphany, families mark the lintel of the main door with blessed chalk, writing the year with the initials of the traditional names of the Magi — Caspar, Melchior and Balthasar — between crosses: for example 20 + C + M + B + 26. The letters are also read as the Latin Christus mansionem benedicat, 'May Christ bless this house.' Gather at the door, make the Sign of the Cross, read the Gospel of the Magi (Matthew 2:1-12), and pray that all who enter this home during the year may find Christ living here and may seek and serve him in everyone they meet; then write the inscription and sprinkle the door with holy water, and close with the Our Father. The chalk is blessed in many parishes at the Epiphany Masses; ask the priest to bless a box if it is not.",
      },
      {
        order: 5,
        title: "Have religious articles blessed",
        body: "Crucifixes, rosaries, medals, scapulars, statues and images become sacramentals when blessed, and the blessing is reserved to a priest or deacon. Bring the object to the sacristy after Mass and ask; the blessing is brief, and a deacon may give it. A blessed object is then treated with reverence: kept in a place of honour, not used as jewellery of no meaning, and when it is broken beyond repair, burned or buried rather than thrown away. The Directory on Popular Piety and the Liturgy reminds us that such objects are aids to prayer and signs of faith, and warns against treating them as charms; a blessed medal worn by someone who never prays is only a medal.",
      },
      {
        order: 6,
        title: "Keep a prayer corner",
        body: "Set aside one place in the home for prayer — a shelf, a small table, the corner of a room — with a crucifix, an image of Our Lady, a Bible, and if you like a candle and the holy water font. This is the home's 'little oratory,' the place where the Rosary is prayed, where the Advent wreath and the crib stand in their seasons, where the family gathers for grace on feast days and for the guardian angel prayer at bedtime. Keep it simple, keep it clean, and above all use it: a home is blessed once by the priest, but it is sanctified daily by the people who pray in it. The guide 'How to Begin and End the Day with Prayer' gives a simple rule to pray there.",
      },
    ],
    relatedPrayers: ["our-father", "prayer-to-saint-michael", "sub-tuum-praesidium", "guardian-angel-prayer"],
    relatedDevotions: ["enthronement-of-the-sacred-heart"],
  }),

  // ──────────── 91. THE MAY CROWNING ────────────
  guide({
    slug: "how-to-hold-a-may-crowning",
    title: "How to Hold a May Crowning",
    summary:
      "The May devotion to Mary and the parish or family crowning of her image: preparing the statue and crown, the procession and hymns, the crowning itself, the Litany of Loreto, and an act of consecration.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_DPP, V_MC],
    intro:
      "For centuries Catholics have kept May as the month of Mary, with daily prayers, the Rosary, flowers before her image and, in parishes and schools, a crowning: a child or a member of the community places a wreath of flowers on the head of a statue of Our Lady while the people sing. The Directory on Popular Piety and the Liturgy commends the May devotions while asking that they be kept in harmony with the Easter season, which most of May belongs to, and Paul VI's Marialis Cultus lays down the principles of all sound Marian devotion: rooted in Scripture and the liturgy, and always leading to Christ. The parish May crowning is a popular devotion, distinct from the solemn liturgical Order of Crowning an Image of the Blessed Virgin Mary, which is normally celebrated by the bishop for images of particular veneration; the family or parish version needs only a statue, flowers, and people who love her.",
    whatYouNeed: [
      "A statue or image of Our Lady, on a stand at a height a child can reach, or with a step",
      "A crown or wreath of fresh flowers, and flowers for the people to bring",
      "Hymns the congregation knows — 'Immaculate Mary', 'Hail Holy Queen Enthroned Above', 'Bring Flowers of the Rarest'",
      "The Litany of Loreto and a rosary, and a printed order of service if a group is large",
    ],
    whenToPray:
      "Any day in May; parishes often choose the first Sunday, the last Sunday, or a weekday evening, and schools a weekday afternoon. Because most of May falls in Eastertide, the Regina Caeli is prayed in place of the Angelus and the Easter alleluias belong in the hymns.",
    tips: [
      "Keep it in the Easter key: choose hymns with alleluias, pray the Regina Caeli, and let the readings speak of the Risen Christ and his Mother.",
      "Let the children do the crowning and bring the flowers; the May crowning is one of the ways a parish teaches its youngest members to love Our Lady.",
      "Do not compete with the liturgy. If the crowning follows Mass, hold it after the dismissal, as a devotion in its own right rather than an addition to the Eucharist.",
      "At home, a single flower placed before a statue each evening in May, with a Hail Mary, is the whole devotion in miniature.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Keep the month of May",
        body: "Begin the month by placing an image of Our Lady in a place of honour — in the church, the classroom, the prayer corner at home — with fresh flowers before it. Each day of May, pray something to her: the Rosary is the fullest form, but a single decade, the Salve Regina, or the Regina Caeli at noon is enough to keep the month. Paul VI wrote in Marialis Cultus that devotion to Mary must be Trinitarian, Christological, biblical and liturgical: praise her for what God has done in her, and let every prayer to her end in her Son. The crowning is the month's high point, not its whole content.",
      },
      {
        order: 2,
        title: "Prepare the image and the crown",
        body: "Choose the statue or image to be crowned and set it where the people can see it and a child can reach the head — on a stand with a small step, or brought forward on a table decorated with white and blue cloth. Make or order a crown of fresh flowers sized to the statue, and gather a bouquet or a basket of loose flowers; roses, lilies and whatever is blooming locally are traditional. Choose who will crown: in parishes usually a First Communion child or a confirmand, in schools a chosen pupil, at home the youngest who can manage it. Print or announce the order of service and the hymns, and rehearse the crowning with the child so that the moment is unhurried.",
      },
      {
        order: 3,
        title: "Process to the image",
        body: "Gather at the back of the church or outside, and process to the image singing a Marian hymn — 'Immaculate Mary' is the classic — with the children carrying flowers and the crown-bearer last, or immediately before the priest if he presides. A cross and candles may lead the procession as at any liturgical procession. Arriving at the image, the children lay their flowers at its foot one by one while the hymn continues. The procession is simple catechesis: we go to Mary together, bringing what is beautiful, because she brought Christ to us.",
      },
      {
        order: 4,
        title: "Pray the Rosary or a decade, and sing",
        body: "Before the crowning, pray at least a decade of the Rosary; a full five decades is customary when time allows, using the Glorious Mysteries in Eastertide and giving special attention to the fourth and fifth, the Assumption and the Coronation of Mary. A reading from Scripture may be added — the Annunciation (Luke 1:26-38), the Visitation with the Magnificat (Luke 1:39-56), or the Wedding at Cana (John 2:1-11) — followed by a short word from the priest, deacon or teacher on why we honour Mary. Between the prayers, sing: the singing is what people remember, and it is how the honour given to Mary becomes joy.",
      },
      {
        order: 5,
        title: "Crown the image",
        body: "The crown-bearer comes forward, is handed the crown, and places it on the head of the statue while the congregation sings — 'Bring Flowers of the Rarest', with its refrain 'O Mary, we crown thee with blossoms today, Queen of the Angels and Queen of the May', is the traditional hymn for this moment. The one presiding may introduce it with a sentence: 'We crown the image of Mary, Mother of God and our Mother, as a sign of the honour we give her and of her Son's kingship, which she shares.' Then all pray together the Regina Caeli, which is the Easter prayer to Mary: 'Queen of heaven, rejoice, alleluia. For he whom you did merit to bear, alleluia, has risen, as he said, alleluia. Pray for us to God, alleluia. V. Rejoice and be glad, O Virgin Mary, alleluia. R. For the Lord has truly risen, alleluia.'",
      },
      {
        order: 6,
        title: "Pray the Litany of Loreto",
        body: "After the crowning, pray the Litany of the Blessed Virgin Mary — the Litany of Loreto — with a leader giving the invocations and all answering 'pray for us'; sung, it is one of the loveliest things a parish does all year. It ends with the versicle 'Pray for us, O holy Mother of God,' the response 'That we may be made worthy of the promises of Christ,' and the closing prayer. The Litany gathers up the whole of the Church's praise of Mary — Mother of the Church, Virgin most prudent, Mirror of justice, Queen assumed into heaven — and is the natural theology of the crown just placed on her head. The guide 'How to Pray a Litany' explains the form for anyone leading for the first time.",
      },
      {
        order: 7,
        title: "Consecrate the family or community to Mary",
        body: "Close by entrusting those present to Our Lady. The priest or the leader reads an act of consecration or entrustment — many parishes use an act of consecration to the Immaculate Heart of Mary — and all answer 'Amen'; families may make it at home in their own words: 'Mary, our Mother, we give you our family; keep us close to your Son.' Sing the Magnificat or the Salve Regina as the final hymn, and if the priest presides he gives the blessing. Then, as the flowers fade over the following days, keep the month: the crowning was a promise to honour Mary, and the remaining evenings of May, with their decade and their single flower, are where it is kept.",
      },
    ],
    relatedPrayers: [
      "hail-mary",
      "glory-be",
      "regina-caeli",
      "litany-of-the-blessed-virgin-mary",
      "magnificat",
      "salve-regina",
    ],
    relatedDevotions: ["holy-rosary", "consecration-to-mary"],
  }),

  // ──────────── 92. FRIDAY PENANCE THROUGHOUT THE YEAR ────────────
  guide({
    slug: "how-to-keep-friday-penance-throughout-the-year",
    title: "How to Keep Friday Penance Throughout the Year",
    summary:
      "Every Friday of the year, not only in Lent, is a day of penance in memory of the Lord's Passion: what the Church's law asks, what the bishops of the United States allow in place of abstinence, and how to make it a habit.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_PAEN, V_CIC_TIMES],
    intro:
      "In the apostolic constitution Paenitemini of 1966, Paul VI renewed the Church's ancient discipline of penance and kept Friday as its weekly day, because Friday is the day Christ died. The Code of Canon Law repeats it: all Fridays of the year, and the season of Lent, are penitential days and times in the universal Church, and on Fridays abstinence from meat is to be observed unless a solemnity falls that day; the conference of bishops may substitute other forms of penance. In the United States the bishops did so in 1966: outside Lent, Catholics may replace Friday abstinence with another act of penance or charity, while the bishops asked that abstinence keep first place and hoped it would be freely kept. What no one abolished is the Friday itself. It remains, every week, a day on which a Catholic does something in memory of the Cross.",
    whatYouNeed: [
      "A clear decision about your Friday practice — abstinence from meat, or a named substitute",
      "A reminder: a note in the calendar, an alarm on Thursday night, or a family custom",
      "A crucifix to pray before, or the Stations of the Cross when the parish offers them",
    ],
    whenToPray:
      "Every Friday of the year, except a Friday on which a solemnity falls (Christmas, the Sacred Heart, and the others of the calendar), when the penance is lifted. In Lent the discipline is stricter and abstinence from meat is obligatory for all from age fourteen.",
    tips: [
      "Decide once, then keep it: a Friday practice chosen fresh each week is the one most easily dropped.",
      "Abstinence from meat is the Church's first preference and the simplest to keep, and it links you to Catholics across the world and across the centuries.",
      "If you substitute, substitute honestly. Skipping dessert you did not want is not penance; giving up something felt, or doing something costly for someone, is.",
      "Friday penance is a discipline of love, not a test. Missing a Friday outside Lent is not a sin; it is a Friday to make up for by beginning again the next.",
    ],
    durationMinutes: 10,
    steps: [
      {
        order: 1,
        title: "Understand that every Friday is penitential",
        body: "Canon 1250 declares all Fridays of the whole year, together with Lent, to be days and times of penance in the universal Church, and canon 1251 says that abstinence from meat is to be observed on all Fridays unless a solemnity falls on that day. Paenitemini explains why: penance is part of the Gospel, a sharing in the sufferings of Christ, and the Church binds it to Friday so that the week itself keeps the memory of the Passion. The obligation to do penance on Fridays is real and is not confined to Lent; what the bishops of the United States changed in 1966 was the form, allowing another act of penance or charity to replace abstinence outside Lent, not the day.",
      },
      {
        order: 2,
        title: "Choose abstinence or another penance",
        body: "The Church's own preference is abstinence from meat — flesh meat of warm-blooded animals; fish, eggs and dairy are permitted — and the United States bishops, while permitting substitution, gave abstinence 'first place' and asked that it be kept especially in memory of the Passion. Many Catholics simply keep it every Friday of the year, which needs no decision after the first. If you substitute, the alternative should be a real act of penance or charity: giving up something you would otherwise enjoy that day, fasting from a meal, an hour given to someone who needs it, or a sum given to the poor. Whatever it is, it should be something you would notice if you forgot.",
      },
      {
        order: 3,
        title: "Fix your Friday practice",
        body: "Decide your Friday penance concretely and, if you have a family, decide it together: meatless Friday suppers are the classic family form, and children keep them easily when they are simply how Friday is. Write the decision down, tell it to your spouse or a friend, and set a reminder for Thursday evening so that the shopping and the plans for Friday take it into account. Join a prayer to the penance if you can — the Prayer Before a Crucifix on Friday morning, a decade of the Sorrowful Mysteries, or the Stations of the Cross when the parish prays them, so that the going-without has a face: it is done for him who went without everything on that day.",
      },
      {
        order: 4,
        title: "Let the penance become charity",
        body: "Paenitemini teaches that penance has three classic forms — prayer, fasting and works of charity — and the United States bishops explicitly named works of charity and mercy as fitting Friday substitutes for abstinence. So a Friday penance may look outward: visiting someone sick or lonely, an hour of volunteering, a gift to the poor equal to what a meat meal would have cost, forgiving a wrong, or writing the letter you have been putting off. The measure is the same as for fasting: it should cost something and be done for Christ. Best of all is to combine them, keeping abstinence and giving its saving away, which is the ancient link between fasting and almsgiving.",
      },
      {
        order: 5,
        title: "Keep the Fridays of Lent differently",
        body: "In Lent the substitution does not apply. All Catholics from age fourteen are bound to abstain from meat on Ash Wednesday and every Friday of Lent, and those aged eighteen to fifty-nine to fast — one full meal, two smaller ones that together do not equal it, no eating between meals — on Ash Wednesday and Good Friday; the guide 'How to Fast and Abstain During Lent' gives the detail. Lenten Fridays are also the parish's day for the Stations of the Cross and, in many places, for fish suppers and confessions. Let the whole year's Friday practice be shaped by Lent's: what you keep for six Fridays with the whole Church, you can keep more lightly for the other forty-six.",
      },
      {
        order: 6,
        title: "Make it a habit and recognise the exceptions",
        body: "A Friday practice becomes easy only when it is unquestioned, so keep it for a year without renegotiating it each week; after that it will keep itself. Know the exceptions: on a Friday on which a solemnity falls — Christmas Day, the Solemnity of the Sacred Heart, Saints Peter and Paul, and the other solemnities of the calendar, including a parish's patronal solemnity — the penance is lifted by the law itself, and the day is kept as a feast. The sick, the elderly, the pregnant and those who must eat what they are given are not bound to abstinence. Everyone else is bound to Friday, and the reward of keeping it is a week that never quite forgets the Cross, and a small, steady share in the Lord's own Friday.",
      },
    ],
    relatedPrayers: ["prayer-before-a-crucifix", "act-of-contrition"],
    relatedDevotions: ["stations-of-the-cross"],
    relatedPractices: ["fasting", "almsgiving", "christian-mortification"],
  }),

  // ──────────── 93. ALL SAINTS' AND ALL SOULS' DAYS ────────────
  guide({
    slug: "how-to-keep-all-saints-and-all-souls-days",
    title: "How to Keep All Saints' and All Souls' Days",
    summary:
      "The first two days of November: Mass on the holy day of All Saints, prayer for the dead on All Souls, the cemetery visits from 1 to 8 November that carry a plenary indulgence for the departed, and keeping the whole month for the Holy Souls.",
    kind: "general",
    category: "devotion",
    authorityLevel: "VATICAN",
    citations: [V_IND, U_LITCAL],
    intro:
      "November opens with two days that belong together. On 1 November the Church keeps the Solemnity of All Saints, honouring in one feast the whole company of heaven, the canonised and the countless unknown; in the United States it is a holy day of obligation. On 2 November, the Commemoration of All the Faithful Departed, she turns to the dead who are still being purified, and prays for them; on that day every priest may celebrate Mass three times. Around the two days the Church has attached her indulgences — a plenary indulgence, applicable only to the souls in purgatory, for visiting a cemetery and praying for the dead on each day from 1 to 8 November, and for visiting a church on All Souls' Day and praying the Our Father and the Creed — so that the communion of saints becomes something the living actually do: they go to the graves, and they pray.",
    whatYouNeed: [
      "The Mass times for All Saints, and a note of whether the obligation binds this year",
      "The names of your own dead, written down, to be prayed for by name",
      "A plan to visit a cemetery between 1 and 8 November, with flowers or a candle if you wish",
      "For the indulgence: confession within a few days, Communion, and prayer for the Pope's intentions",
    ],
    whenToPray:
      "1 November (All Saints) and 2 November (All Souls), with cemetery visits any day from 1 to 8 November; the whole of November is traditionally devoted to the Holy Souls, and the Eternal Rest prayer belongs to every day of it.",
    tips: [
      "When 1 November falls on a Saturday or a Monday, the obligation to attend Mass is lifted in the United States, though the solemnity is still kept; check the parish bulletin.",
      "The cemetery indulgence can be gained once each day from 1 to 8 November, so eight visits could be offered for eight different people — but the conditions of confession, Communion and prayer for the Pope apply to each.",
      "Take children to the graves. Nothing teaches the communion of saints better than praying by name for a grandparent at the place where their body rests.",
      "Enrol your dead in the parish's November list, or bring an All Souls envelope: the Masses offered for them all month are the Church's greatest gift to the departed.",
    ],
    durationMinutes: 15,
    steps: [
      {
        order: 1,
        title: "Keep All Saints as a holy day",
        body: "Go to Mass on 1 November, the Solemnity of All Saints. It is a holy day of obligation in the United States, though when it falls on a Saturday or a Monday the obligation to attend is abrogated by the bishops' 1991 decision, and the solemnity is kept without the precept. The Mass honours the multitude no one can count from the vision of Revelation 7, and its Gospel is the Beatitudes: the saints are those who lived them. Pray the Te Deum in thanksgiving, and remember your own patrons, your confirmation saint, and the saints of your family; the vigil of the feast, All Hallows' Eve, is best kept by looking forward to it. This is a feast of joy, not of mourning — that comes tomorrow.",
      },
      {
        order: 2,
        title: "Pray for the dead on All Souls",
        body: "On 2 November the Church prays for all the faithful departed. Go to Mass if you can; it is not a day of obligation, but it is the day on which the whole Church prays for the dead, and priests may offer three Masses that day. Pray for your own dead by name — parents, grandparents, friends, those who died this year, and those no one remembers — with the Church's prayer: 'Eternal rest grant unto them, O Lord, and let perpetual light shine upon them. May they rest in peace. Amen.' Psalm 130, the De Profundis — 'Out of the depths I cry to you, O Lord' — is the Church's ancient psalm for the dead, and this is its day. Light a candle at home before the names of your dead, and keep it burning through the evening.",
      },
      {
        order: 3,
        title: "Visit a cemetery between 1 and 8 November",
        body: "On any day from 1 to 8 November, visit a cemetery and pray, even silently, for the dead; the Church's Manual of Indulgences grants a plenary indulgence, applicable only to the souls in purgatory, for this visit on each of those days, and a partial indulgence on any other day of the year. Go to the graves of your own family if you can, bringing flowers or a candle as is the custom; if they are buried far away, any Catholic cemetery, or any cemetery, will do, and you pray for those buried there and for your own dead together. At the grave, pray the Eternal Rest, an Our Father and a Hail Mary, and bless the grave with holy water if you have brought some. It is a short visit that the dead cannot make for themselves.",
      },
      {
        order: 4,
        title: "Have Mass offered for the dead",
        body: "The greatest prayer for the dead is the Mass. Ask the parish to offer a Mass for a deceased person by name — a small stipend is customary — or enrol your dead in the parish's November book of remembrance, for whom the Masses of the month are offered; many parishes provide All Souls envelopes for the names. The guide 'How to Pray for the Dead' explains the practice more fully. Attend the Mass if you can, and offer your Communion for them: the Church has always taught that the Eucharist offered for the dead helps them, and All Souls' Day is the day she does it most deliberately.",
      },
      {
        order: 5,
        title: "Fulfil the conditions of the indulgence",
        body: "A plenary indulgence, whether from the cemetery visit or from the All Souls' Day church visit with the Our Father and the Creed, requires more than the work itself: sacramental confession within about twenty days before or after, Holy Communion, prayer for the intentions of the Holy Father — an Our Father and a Hail Mary suffice — and complete detachment from all sin, even venial. One confession may serve for several plenary indulgences, but a separate Communion and a separate prayer for the Pope are needed for each, and only one plenary indulgence can be gained per day. The guide 'How to Gain a Plenary Indulgence' sets out the conditions step by step. In November, the indulgence may be applied only to the dead, which is exactly its point: the living do the work, and someone in purgatory receives the gift.",
      },
      {
        order: 6,
        title: "Pray the Litany of the Saints",
        body: "Some time in the two days, pray the Litany of the Saints — the Church's oldest litany, sung at the Easter Vigil, at ordinations and at the bedside of the dying. A leader calls each saint by name, 'Holy Mary, Mother of God,' 'Saint Michael,' 'Saint Peter and Saint Paul,' and all answer 'pray for us'; the petitions follow, 'Lord, be merciful — Lord, deliver us, we pray,' and it closes with prayer. On All Saints it is the roll-call of the feast; on All Souls it calls the whole court of heaven to pray with us for the dead. Add your own patron saints where the litany allows, and let the children hear their confirmation saints named.",
      },
      {
        order: 7,
        title: "Keep the whole month for the Holy Souls",
        body: "The two days open a month. Throughout November, pray daily for the dead: the Eternal Rest at the end of grace after meals, a decade of the Rosary offered for the Holy Souls, the De Profundis on Friday evenings, and the names of the dead kept somewhere visible in the prayer corner. Have Masses offered, visit the graves again, and teach the family that praying for the dead is a work of mercy — the Catechism counts it among them — and one that the dead will one day return. The month ends with the Solemnity of Christ the King and the first Sunday of Advent, which is right: we pray for the dead because we believe that he is coming, and that they and we will rise.",
      },
    ],
    relatedPrayers: [
      "te-deum",
      "eternal-rest",
      "de-profundis",
      "our-father",
      "hail-mary",
      "apostles-creed",
      "litany-of-the-saints",
    ],
    relatedDevotions: ["devotion-to-the-holy-souls"],
  }),

  // ──────────── 94. RETURNING TO THE CHURCH ────────────
  guide({
    slug: "how-to-return-to-the-church-as-a-lapsed-catholic",
    title: "How to Return to the Church",
    summary:
      "Coming back after months or years away: the truth that you can, the conversation with a priest, confession, the situations that need pastoral help — a marriage outside the Church, a Confirmation never received — and rebuilding the habit of Sunday Mass.",
    kind: "general",
    category: "sacraments",
    sacramentKey: "reconciliation",
    authorityLevel: "VATICAN",
    citations: [V_MV, U_PEN],
    intro:
      "A baptised Catholic who has drifted away has not stopped being a Catholic. Baptism cannot be undone, and the door back is never locked from the inside; it is opened by a conversation and a confession. In Misericordiae Vultus, the bull announcing the Jubilee of Mercy, Pope Francis wrote that the Church's very credibility depends on her showing merciful love, and asked that confessors be true signs of the Father's mercy, welcoming everyone who comes. Returning is usually simpler than people fear — one talk with a priest, one confession, and a Sunday — and where a situation is more complicated, a marriage outside the Church or a sacrament never received, there is a pastoral path for that too. This guide gives the steps in the order they usually come.",
    whatYouNeed: [
      "The name of a parish near you and its confession and Mass times",
      "A willingness to speak honestly with a priest, and about ten minutes to do it",
      "An examination of conscience — the guide of that name will help — and the Act of Contrition",
      "Patience with yourself: a habit lost over years is rebuilt over weeks, not in a day",
    ],
    whenToPray:
      "Whenever the desire comes; that desire is itself the beginning of grace. Lent and Advent are seasons when parishes hold extra confessions and welcome returners, but any Saturday afternoon confession time and any Sunday Mass will do.",
    tips: [
      "You do not need to have everything sorted out before you go. Go first; the sorting out is what the priest is for.",
      "Tell the priest plainly that you have been away a long time and are not sure how to begin. He has heard it many times and will lead you through.",
      "Until you have made your confession, come to Mass and stay in the pew at Communion time, or come forward with arms crossed for a blessing; you are still welcome at Mass.",
      "Find one person or group at the parish — a returning-Catholics programme, a Bible study, a friend who goes — and let them carry you for the first months.",
    ],
    durationMinutes: 20,
    steps: [
      {
        order: 1,
        title: "Know that you can come back",
        body: "Whatever the reason for leaving — drift, hurt, anger, a marriage, unbelief, or simply years that passed — the Church wants you home, and the way back is the same for everyone: repentance and the sacraments. You were not struck off any list. If you were baptised Catholic, you remain a member of the Church; even if you joined another church or none, you return by confession, not by a second baptism, though the priest may ask a few questions to understand your history. Pope Francis wrote that no one can be excluded from the mercy of God, and that the Church is the house that welcomes all and refuses no one. Read that sentence as addressed to you, because it is.",
      },
      {
        order: 2,
        title: "Talk to a priest",
        body: "Phone the parish office or catch the priest after Mass and ask for a time to talk; say that you have been away from the Church and want to come back. This conversation is not the confession, though it can lead straight into one; it is where you tell your story, ask the questions you have been carrying — about Communion, about a marriage, about children not baptised, about things you no longer believe — and hear what the next steps are. Priests are not shocked by long absences. If the first conversation goes badly, or the parish seems unwelcoming, try another parish; the Church is bigger than one office, and many dioceses have a 'Catholics Come Home' or 'Landings' programme made precisely for returners.",
      },
      {
        order: 3,
        title: "Make your confession",
        body: "The sacrament of Penance is how a Catholic is reconciled with God and the Church, and it is the heart of returning. Prepare with an examination of conscience, going back over the years without scrupulous detail — the guide 'How to Return to Confession After Many Years' walks through exactly this — and go to the parish's confession time or the appointment the priest offers. Begin: 'Bless me, Father, for I have sinned. It has been many years since my last confession, and I am not sure I remember how to do this.' The priest will help. Confess your serious sins in kind and, as best you can, in number; receive the penance and the absolution; and pray the Act of Contrition: 'O my God, I am heartily sorry for having offended you...' You leave forgiven. That is not a feeling to be waited for but a fact to be believed.",
      },
      {
        order: 4,
        title: "If you were married outside the Church",
        body: "A Catholic who married in a civil ceremony or in another church without the Church's permission is still welcome at Mass, but the marriage needs to be put right before returning to Communion, and this is the situation the priest most often helps with. If neither spouse has been married before, the usual remedy is a convalidation — a simple exchange of consent before the priest and two witnesses, described in the guide 'How to Have a Marriage Convalidated' — often arranged within a few months. If either spouse was married before, the priest will explain the process of a declaration of nullity, which examines whether the earlier marriage was valid; the guide 'How to Petition for a Declaration of Nullity' explains it. Neither path is a punishment; both are the Church taking your marriage seriously. Speak to the priest honestly and early, and let him guide the sequence of confession, convalidation and Communion.",
      },
      {
        order: 5,
        title: "If you never received Confirmation or First Communion",
        body: "Many returning Catholics were baptised and perhaps made First Communion but were never confirmed. Tell the priest; adults are confirmed every year, usually after a short period of preparation with the parish, and in many dioceses at a diocesan celebration around Pentecost or at the Easter Vigil. If you never made First Communion either, the parish will prepare you for both, typically alongside the adults in the OCIA process, though as a baptised Catholic your path is shorter. The guide 'Preparing for Confirmation' describes what the preparation covers. Completing your initiation is not a hurdle; it is the Church finishing what your Baptism began.",
      },
      {
        order: 6,
        title: "Find and join a parish",
        body: "Register at a parish — the office will have a form — so that you belong somewhere and are known. Ordinarily this is the parish of the place where you live, but the right parish for a returner is one where you can actually pray, hear the Word preached and find company; visit two or three if you need to. Learn its Mass and confession times, put your name on its list, and find one thing to join: a Bible study, a men's or women's group, the choir, a service project. Faith kept alone is fragile; the Church is a body, and the parish is where you are grafted back in. Consider also finding a spiritual director or a wise friend in the faith for the first year.",
      },
      {
        order: 7,
        title: "Rebuild the habit of Sunday Mass",
        body: "Come to Mass every Sunday and holy day of obligation; that is the one thing the Church asks of every Catholic, and it is the habit that makes all the others possible. For the first weeks, decide the time and the church on Saturday and go as if it were not optional, because it is not; after a couple of months it will carry itself. Follow the Mass with a missal or the parish's sheet — the guide 'How to Participate in Mass' explains the parts — and receive Communion once you have made your confession, going to confession again whenever you fall into serious sin and regularly in any case. Add a small daily prayer, the Our Father in the morning or the Prayer of Saint Francis at night, and keep the Easter duty of Communion at least once a year in the Easter season. You came back; now stay, one Sunday at a time.",
      },
    ],
    relatedPrayers: ["act-of-contrition", "confiteor", "our-father", "prayer-of-saint-francis"],
    relatedDevotions: ["divine-mercy-chaplet"],
    relatedPractices: ["spiritual-direction", "ignatian-examen"],
  }),
];

import type { CuratedEntry } from "../index";

/**
 * Spiritual practice group 1.
 *
 * Forty practices the Church actually teaches and that the cited pages
 * actually describe: the three expressions of prayer the Catechism names
 * (vocal, meditative, contemplative), the daily and weekly rhythms it
 * commends, the ascetical disciplines the Code of Canon Law and the Holy See
 * legislate or recommend, and a small number of practices proper to a
 * particular school of spirituality — Ignatian, Benedictine, Carmelite,
 * Dominican, Franciscan, Salesian, Montfortian, Opus Dei.
 *
 * Ground rules kept throughout:
 *
 *  - Where a practice belongs to a school, `tradition` says which, and the
 *    founding text is cited. Where a practice is simply the Church's own, no
 *    school is claimed for it.
 *  - Obligations are reported only where a law states them, and are quoted
 *    from the canon or the Holy See document cited — the Eucharistic fast
 *    (c. 919), Friday penance and abstinence (cc. 1250-1252), annual
 *    confession of grave sin (c. 989), the Sunday obligation (cc. 1246-1248),
 *    the conditions for indulgences (cc. 992-997 and Indulgentiarum
 *    Doctrina). Everything else is described as counsel, not precept.
 *  - No promise, indulgence or private revelation is reported that its cited
 *    source does not report, and no indulgence is described by paragraph
 *    number.
 *  - Durations and frequencies are the common counsel of the tradition, given
 *    as guidance rather than as law, and are omitted where the sources do not
 *    give one.
 *
 * The two entries the audit flagged as duplicated devotions — the Holy Hour
 * and the Stations of the Cross — are deliberately absent: both are carried
 * as DEVOTION / GUIDE content and are not repeated here.
 */

/* ------------------------------------------------------------------ */
/* Catechism, Part Four: Christian Prayer                              */
/* ------------------------------------------------------------------ */

const CCC_WELLSPRINGS_OF_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9D.HTM";
const CCC_WAY_OF_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9F.HTM";
const CCC_GUIDES_FOR_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9H.HTM";
const CCC_LIFE_OF_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9J.HTM";
const CCC_VOCAL_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9K.HTM";
const CCC_MEDITATION = "https://www.vatican.va/archive/ENG0015/__P9L.HTM";
const CCC_CONTEMPLATIVE_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9M.HTM";
const CCC_BATTLE_OF_PRAYER = "https://www.vatican.va/archive/ENG0015/__P9O.HTM";
const CCC_HUMBLE_VIGILANCE = "https://www.vatican.va/archive/ENG0015/__P9Q.HTM";
const CCC_PERSEVERING_IN_LOVE = "https://www.vatican.va/archive/ENG0015/__P9S.HTM";

/* ------------------------------------------------------------------ */
/* Holy See                                                            */
/* ------------------------------------------------------------------ */

const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const ORATIONIS_FORMAS =
  "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19891015_meditazione-cristiana_en.html";
const SACROSANCTUM_CONCILIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html";
const LUMEN_GENTIUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html";
const DEI_VERBUM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html";
const APOSTOLICAM_ACTUOSITATEM =
  "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651118_apostolicam-actuositatem_en.html";
const PAENITEMINI =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19660217_paenitemini.html";
const INDULGENTIARUM_DOCTRINA =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_01011967_indulgentiarum-doctrina.html";
const EVANGELII_NUNTIANDI =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19751208_evangelii-nuntiandi.html";
const MARIALIS_CULTUS =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const CATECHESI_TRADENDAE =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_16101979_catechesi-tradendae.html";
const LABOREM_EXERCENS =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091981_laborem-exercens.html";
const FAMILIARIS_CONSORTIO =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_19811122_familiaris-consortio.html";
const RECONCILIATIO_ET_PAENITENTIA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_02121984_reconciliatio-et-paenitentia.html";
const REDEMPTORIS_MATER =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_25031987_redemptoris-mater.html";
const CHRISTIFIDELES_LAICI =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_30121988_christifideles-laici.html";
const REDEMPTORIS_MISSIO =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_07121990_redemptoris-missio.html";
const PASTORES_DABO_VOBIS =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031992_pastores-dabo-vobis.html";
const VITA_CONSECRATA =
  "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_25031996_vita-consecrata.html";
const DIES_DOMINI =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/1998/documents/hf_jp-ii_apl_05071998_dies-domini.html";
const FIDES_ET_RATIO =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html";
const JPII_FAUSTINA_CANONIZATION =
  "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html";
const ROSARIUM_VIRGINIS_MARIAE =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const DEUS_CARITAS_EST =
  "https://www.vatican.va/content/benedict-xvi/en/encyclicals/documents/hf_ben-xvi_enc_20051225_deus-caritas-est.html";
const SACRAMENTUM_CARITATIS =
  "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20070222_sacramentum-caritatis.html";
const SPE_SALVI =
  "https://www.vatican.va/content/benedict-xvi/en/encyclicals/documents/hf_ben-xvi_enc_20071130_spe-salvi.html";
const VERBUM_DOMINI =
  "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20100930_verbum-domini.html";
const BXVI_ON_FRANCIS_DE_SALES =
  "https://www.vatican.va/content/benedict-xvi/en/audiences/2011/documents/hf_ben-xvi_aud_20110302.html";
const EVANGELII_GAUDIUM =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20131124_evangelii-gaudium.html";
const MISERICORDIAE_VULTUS =
  "https://www.vatican.va/content/francesco/en/bulls/documents/papa-francesco_bolla_20150411_misericordiae-vultus.html";
const LAUDATO_SI =
  "https://www.vatican.va/content/francesco/en/encyclicals/documents/papa-francesco_20150524_enciclica-laudato-si.html";
const AMORIS_LAETITIA =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia.html";
const MISERICORDIA_ET_MISERA =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20161120_misericordia-et-misera.html";
const GAUDETE_ET_EXSULTATE =
  "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20180319_gaudete-et-exsultate.html";
const APERUIT_ILLIS =
  "https://www.vatican.va/content/francesco/en/motu_proprio/documents/papa-francesco-motu-proprio-20190930_aperuit-illis.html";
const FRATELLI_TUTTI =
  "https://www.vatican.va/content/francesco/en/encyclicals/documents/papa-francesco_20201003_enciclica-fratelli-tutti.html";
const TOTUM_AMORIS_EST =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/20221228-totum-amoris-est.html";

/* Code of Canon Law (1983) */
const CIC_EUCHARIST =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann879-958_en.html";
const CIC_PENANCE_AND_INDULGENCES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann959-997_en.html";
const CIC_SACRAMENTALS =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1166-1190_en.html";
const CIC_SACRED_TIMES =
  "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1244-1253_en.html";

/* ------------------------------------------------------------------ */
/* USCCB                                                               */
/* ------------------------------------------------------------------ */

const USCCB_PRAYERS_AND_DEVOTIONS =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions";
const USCCB_PRAYERS = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers";
const USCCB_ROSARY = "https://www.usccb.org/how-to-pray-the-rosary";
const USCCB_LITURGY_OF_THE_HOURS = "https://www.usccb.org/prayer-and-worship/liturgy-of-the-hours";
const USCCB_EUCHARIST = "https://www.usccb.org/eucharist";
const USCCB_PENANCE =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance";
const USCCB_EXAMINATIONS_OF_CONSCIENCE =
  "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance/examinations-of-conscience";
const USCCB_PENANCE_AND_ABSTINENCE =
  "https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/lent/us-bishops-pastoral-statement-on-penance-and-abstinence";
const USCCB_FAST_AND_ABSTINENCE_CANONS =
  "https://www.usccb.org/beliefs-and-teachings/what-we-believe/canon-law/complementary-norms/canons-1252-and-1253-observance-of-fast-and-abstinence";
const USCCB_VOCATIONS = "https://www.usccb.org/beliefs-and-teachings/vocations";
const USCCB_MARRIAGE = "https://www.usccb.org/topics/marriage-and-family-life-ministries";
const USCCB_BEREAVEMENT = "https://www.usccb.org/prayer-and-worship/bereavement-and-funerals";

/* ------------------------------------------------------------------ */
/* Founding texts                                                      */
/* ------------------------------------------------------------------ */

const SPIRITUAL_EXERCISES = "https://www.ccel.org/ccel/ignatius/exercises.html";
const RULE_OF_ST_BENEDICT = "https://www.ccel.org/ccel/benedict/rule.html";
const INTRODUCTION_TO_THE_DEVOUT_LIFE = "https://www.ccel.org/ccel/desales/devout_life.html";
const WAY_OF_PERFECTION = "https://www.ccel.org/ccel/teresa/way.html";
const ASCENT_OF_MOUNT_CARMEL = "https://www.ccel.org/ccel/john_cross/ascent.html";
const TRUE_DEVOTION_TO_MARY = "https://www.ewtn.com/catholicism/library/true-devotion-to-mary-1129";

/* ------------------------------------------------------------------ */

type PracticeKind =
  | "contemplative_prayer"
  | "lectio_divina"
  | "examen"
  | "fasting"
  | "almsgiving"
  | "pilgrimage"
  | "stations_of_the_cross"
  | "spiritual_direction"
  | "discernment"
  | "vocation"
  | "mortification"
  | "vocal_prayer"
  | "liturgy_of_the_hours"
  | "spiritual_reading"
  | "penance"
  | "eucharistic"
  | "work"
  | "mercy"
  | "silence"
  | "family"
  | "other";

interface PracticeInput {
  slug: string;
  title: string;
  kind: PracticeKind;
  summary: string;
  instructions: string;
  background?: string;
  tradition?: string;
  durationMinutes?: number;
  frequency?: string;
  prayers?: string[];
  saints?: string[];
  authority: CuratedEntry["authorityLevel"];
  citations: string[];
}

function practice(input: PracticeInput): CuratedEntry {
  const citations = input.citations;
  return {
    contentType: "SPIRITUAL_PRACTICE",
    slug: input.slug,
    authorityLevel: input.authority,
    citations,
    payload: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      practiceKind: input.kind,
      instructions: input.instructions,
      ...(input.background ? { background: input.background } : {}),
      ...(input.tradition ? { tradition: input.tradition } : {}),
      ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.frequency ? { frequency: input.frequency } : {}),
      relatedPrayers: input.prayers ?? [],
      relatedSaints: input.saints ?? [],
      citations,
    },
  };
}

export const spiritualPracticeGroupOne: CuratedEntry[] = [
  /* ---------------------------------------------------------------- */
  /* Expressions of prayer                                             */
  /* ---------------------------------------------------------------- */

  practice({
    slug: "vocal-prayer",
    title: "Vocal Prayer",
    kind: "vocal_prayer",
    summary:
      "Prayer made in words — spoken aloud or formed silently on the lips — in which body and soul together turn to God. The Catechism calls vocal prayer an essential element of the Christian life and the most accessible of the three expressions of prayer.",
    instructions:
      "Fix the words and fix the time; both matter more than feeling. Begin with the Sign of the Cross and one line that places you before God. Then say the chosen prayer slowly enough to mean it, pausing wherever a phrase carries weight, and letting the body take part — standing, kneeling, bowing, hands joined — since we are body and spirit and pray with the whole of ourselves. When distraction comes, do not fight it: return to the words themselves, and to the One you are speaking to. A simple daily rule is enough to begin: on rising, the Our Father, the Hail Mary and the Glory Be; at noon, the Angelus; before sleep, an Act of Contrition and the prayer to your Guardian Angel. Add the prayers of the Church's own treasury as they become familiar. The Catechism notes that vocal prayer becomes an initial form of contemplative prayer to the extent that we become aware of him to whom we speak — so aim at attention, not at quantity.",
    background:
      "The Catechism treats vocal prayer in Part Four (CCC 2700-2704). Jesus himself taught his disciples a vocal prayer, the Our Father, prayed the liturgical prayers of the synagogue aloud, and raised his voice in personal prayer from the blessing of the Father to the agony of Gethsemane.",
    tradition: "The common practice of the whole Church",
    durationMinutes: 10,
    frequency: "Daily, morning and evening",
    prayers: [
      "our-father",
      "hail-mary",
      "glory-be",
      "angelus",
      "act-of-contrition",
      "guardian-angel-prayer",
    ],
    saints: ["saint-teresa-of-avila", "saint-john-chrysostom"],
    authority: "CATECHISM",
    citations: [CCC_VOCAL_PRAYER, CCC_LIFE_OF_PRAYER, USCCB_PRAYERS],
  }),

  practice({
    slug: "praying-the-liturgy-of-the-hours",
    title: "Praying the Liturgy of the Hours",
    kind: "liturgy_of_the_hours",
    summary:
      "The public prayer of the Church spread through the hours of the day — psalms, canticles, Scripture readings and intercessions — by which the whole course of the day and night is made holy. Bound on clergy and religious, it is warmly commended to every baptized Catholic.",
    instructions:
      'Get the four-volume Liturgy of the Hours, or the one-volume Christian Prayer, or use an approved app or website that follows the current calendar; the texts change daily. Begin with the two hours the Second Vatican Council calls the hinges of the Office: Morning Prayer (Lauds) and Evening Prayer (Vespers). Each hour follows the same shape, so it becomes easy quickly: the introductory verse ("O God, come to my assistance"), a hymn, two psalms and an Old or New Testament canticle with their antiphons, a short Scripture reading and responsory, the Gospel canticle — the Benedictus at Morning Prayer, the Magnificat at Evening Prayer, the Nunc Dimittis at Night Prayer — intercessions, the Our Father, and the concluding prayer. Say the psalms slowly, and aloud when you can; alternate the verses with anyone praying beside you. Add the Office of Readings, Daytime Prayer and Night Prayer as the rhythm settles. Night Prayer (Compline) closes with an examination of conscience and a Marian antiphon such as the Salve Regina or, in Eastertide, the Regina Caeli. On Sundays outside Lent, on solemnities and on feasts, the Te Deum is sung at the Office of Readings.',
    background:
      "Sacrosanctum Concilium (nn. 83-101) restored the Office to the rhythm of the true hours, named Lauds and Vespers its two hinges, and urged the laity to pray it, alone or in common, especially with their priests.",
    tradition: "Roman Rite — the Divine Office",
    durationMinutes: 15,
    frequency: "Daily; at minimum Morning and Evening Prayer",
    prayers: [
      "benedictus-canticle-of-zechariah",
      "magnificat",
      "nunc-dimittis",
      "salve-regina",
      "regina-caeli",
      "te-deum",
      "our-father",
    ],
    authority: "VATICAN",
    citations: [SACROSANCTUM_CONCILIUM, USCCB_LITURGY_OF_THE_HOURS, CCC_LIFE_OF_PRAYER],
  }),

  practice({
    slug: "nightly-examination-of-conscience",
    title: "Nightly Examination of Conscience",
    kind: "examen",
    summary:
      "A short, honest review of the day's thoughts, words, deeds and omissions made each night before God, measured against the commandments, the Beatitudes and the duties of one's state, and ending in contrition and one concrete resolution.",
    instructions:
      "Take five to ten minutes at a fixed hour, before you are too tired to be honest. 1. Place yourself in God's presence and ask the Holy Spirit for light — self-examination without grace becomes either flattery or despair. 2. Give thanks for the day's real gifts, naming them. 3. Walk through the day in order — morning, midday, evening — and ask where you loved and where you failed, in what you did and in what you left undone. Use a printed examination until the habit forms; the U.S. bishops publish several, keyed to the Ten Commandments and adapted for children, young adults and married persons. 4. Make an Act of Contrition, or the Confiteor. 5. Choose one concrete resolution for tomorrow — one situation, one person, one hour. Note any grave sin so that it is not forgotten before your next confession. Keep it brief and unsentimental: this is a nightly audit, not a rumination. It is the ascetical practice of self-examination, and it is related to but distinct from St Ignatius's Examen, which is prayed at midday and aims first at noticing God's action rather than at cataloguing faults.",
    background:
      "Reconciliatio et Paenitentia sets self-examination within the Church's whole ministry of penance and conversion; the Catechism places the humble vigilance of the heart at the centre of the battle of prayer.",
    tradition: "The common ascetical practice of the Latin Church",
    durationMinutes: 10,
    frequency: "Nightly",
    prayers: ["act-of-contrition", "confiteor"],
    authority: "USCCB",
    citations: [
      USCCB_EXAMINATIONS_OF_CONSCIENCE,
      RECONCILIATIO_ET_PAENITENTIA,
      CCC_HUMBLE_VIGILANCE,
    ],
  }),

  practice({
    slug: "ignatian-contemplation",
    title: "Ignatian Contemplation (Imaginative Prayer)",
    kind: "contemplative_prayer",
    summary:
      "Prayer in which the imagination and the senses are put at the service of faith: the one praying enters a scene of the Gospel, watches and listens, takes part in it, and speaks with the Lord who is present there. It is the characteristic prayer of the Second Week of the Spiritual Exercises.",
    instructions:
      "Choose the passage the night before and read it once, so that the morning is not spent hunting. Then: 1. Take a moment to recall that God is looking at you, and make the preparatory prayer, asking that everything in you be directed to his service and praise. 2. Make the composition of place — see the road, the room, the lake; put yourself somewhere in it. 3. Ask for the grace you actually want from this scene (St Ignatius calls it the id quod volo): to know Christ more intimately, to love him more, to follow him more closely. 4. Enter the scene with the senses: see the persons and what they do, hear what they say, notice what is happening to you as you watch. Do not analyse the text; be in it. 5. End with a colloquy, speaking to Christ, or to Our Lady, or to the Father, as one friend speaks to another, and close with an Our Father. 6. Afterwards — outside the prayer — spend two minutes reviewing how it went and note a line or two. Repetition is part of the method: return to the same scene later in the day or the next day, going back to the places where you found consolation or desolation rather than to fresh material.",
    background:
      "The method comes from the Spiritual Exercises of St Ignatius of Loyola (1548), where it structures the contemplations of the life of Christ. The Catechism describes meditation as a quest that engages thought, imagination, emotion and desire, and notes that there are as many methods as there are spiritual masters.",
    tradition: "Ignatian",
    durationMinutes: 30,
    frequency: "Daily",
    prayers: ["our-father", "prayer-to-the-holy-spirit"],
    saints: ["saint-ignatius-of-loyola"],
    authority: "RELIGIOUS_ORDER",
    citations: [SPIRITUAL_EXERCISES, CCC_MEDITATION, CCC_CONTEMPLATIVE_PRAYER],
  }),

  practice({
    slug: "the-spiritual-exercises",
    title: "The Spiritual Exercises of St Ignatius",
    kind: "other",
    summary:
      "A structured retreat in four Weeks composed by St Ignatius of Loyola, made either in thirty days of enclosed silence or, under his nineteenth annotation, spread over several months of daily prayer in the midst of ordinary life. Its purpose is to free the soul from disordered attachments and to seek and find God's will.",
    instructions:
      "The Exercises are made under a trained director, never from the book alone; the book is written for the one who gives them. The shape is fixed. They open with the Principle and Foundation, on why we exist and what indifference to created things means. The First Week considers sin and God's mercy, and often includes a general confession. The Second Week contemplates the life of Christ and includes the meditations on the Kingdom, the Two Standards, the Three Classes of Men and the Three Kinds of Humility, and it carries the Election — the decision the retreat exists to serve. The Third Week accompanies the Passion. The Fourth Week contemplates the Resurrection and ends with the Contemplation to Attain the Love of God. In the full thirty-day form the retreatant keeps silence, prays four or five hours a day in distinct periods, meets the director daily and reviews each period afterwards. In the nineteenth-annotation form — the retreat in daily life — the same material is given over eight or nine months with an hour of prayer a day and a weekly meeting with the director. Throughout, the Rules for the Discernment of Spirits govern how consolation and desolation are read, and the rule holds that no decision is made or reversed in desolation.",
    background:
      "St Ignatius composed the Exercises between 1522 and 1541; they were approved by Paul III in 1548 and have shaped the Ignatian school of spirituality ever since. The Catechism describes such schools of spirituality as essential guides for the faithful, refractions of the one light of the Holy Spirit.",
    tradition: "Ignatian",
    frequency: "Once, or at long intervals, in a lifetime",
    prayers: ["our-father", "anima-christi", "prayer-to-the-holy-spirit"],
    saints: ["saint-ignatius-of-loyola", "saint-francis-xavier"],
    authority: "RELIGIOUS_ORDER",
    citations: [SPIRITUAL_EXERCISES, CCC_GUIDES_FOR_PRAYER, CCC_BATTLE_OF_PRAYER],
  }),

  practice({
    slug: "carmelite-recollection",
    title: "Carmelite Recollection",
    kind: "contemplative_prayer",
    summary:
      "The gathering of the scattered faculties inward to the God who dwells within the soul — the prayer of recollection St Teresa of Ávila teaches in the Way of Perfection, in which the senses are drawn in and the will rests with the Lord who is nearer than any image of him.",
    instructions:
      "Keep the same hour and the same place daily; St Teresa is emphatic that determination matters more than talent. Sit still, close the eyes, and quiet the body. Then withdraw the senses inward and recall that the Lord is within you — Teresa speaks of the soul as a little heaven where he dwells. Do not strive to picture him at a distance; turn to him as present. Use a short vocal prayer to gather yourself back: Teresa proposes praying the Our Father slowly, one phrase at a time, staying with whatever phrase holds you. When thoughts scatter — and they will — do not argue with them; return gently, as often as necessary, without irritation at yourself. Ask for nothing in particular; simply remain with him who you know loves you. Expect dryness and keep the hour anyway: St John of the Cross teaches that the loss of sensible sweetness is often growth rather than failure, and Teresa warns against measuring prayer by consolation. Carry the recollection into the day by brief returns to that inner presence during work.",
    background:
      "St Teresa of Ávila sets out the prayer of recollection in the Way of Perfection (chapters 28-29), written for her Discalced Carmelite sisters. The Catechism quotes her definition of contemplative prayer — a close sharing between friends, taking time frequently to be alone with him who we know loves us.",
    tradition: "Carmelite (Discalced)",
    durationMinutes: 30,
    frequency: "Daily",
    prayers: ["our-father"],
    saints: ["saint-teresa-of-avila", "saint-john-of-the-cross", "saint-therese-of-lisieux"],
    authority: "RELIGIOUS_ORDER",
    citations: [WAY_OF_PERFECTION, CCC_CONTEMPLATIVE_PRAYER, ORATIONIS_FORMAS],
  }),

  practice({
    slug: "spiritual-reading",
    title: "Spiritual Reading",
    kind: "spiritual_reading",
    summary:
      "The steady, unhurried reading of the Fathers, the Doctors and proven spiritual writers as food for meditation and as a school of the interior life — distinct from lectio divina, which is the prayerful reading of Sacred Scripture itself.",
    instructions:
      "Keep exactly one book going, and read a fixed short portion of it every day — ten or fifteen minutes is enough, and is better than an hour once a month. Read slowly, with a pencil, marking the lines that convict you. When a sentence stops you, stop with it: close the book and turn the line into prayer, then go on. Keep a small notebook of the passages worth returning to. Choose from what the Church has proved rather than from what is new: the Confessions of St Augustine, the Imitation of Christ, St Francis de Sales's Introduction to the Devout Life, St Thérèse's Story of a Soul, the Catechism read straight through in short daily portions, a good life of a saint. Ask a confessor or spiritual director for the next book rather than choosing by mood, and reread the best ones — spiritual reading works by repetition, not by coverage. Never let it displace Scripture, which remains the first and greatest of these books.",
    background:
      "The Catechism, treating meditation, lists the books that assist it: the Sacred Scriptures and especially the Gospels, holy icons, the liturgical texts of the day, the writings of the spiritual fathers, works of spirituality, and the great books of creation and of history.",
    tradition: "The common practice of the whole Church",
    durationMinutes: 15,
    frequency: "Daily",
    authority: "CATECHISM",
    citations: [CCC_MEDITATION, VERBUM_DOMINI, DEI_VERBUM],
  }),

  practice({
    slug: "dominican-study-as-prayer",
    title: "Study as Prayer (Dominican)",
    kind: "spiritual_reading",
    summary:
      "Serious study undertaken as an act of worship and as a service to preaching — one of the pillars on which Dominican life rests, and summed up in the phrase contemplata aliis tradere: to hand on to others the fruits of contemplation.",
    instructions:
      "Choose one serious text and stay with it for months rather than sampling many: Scripture with a sound commentary, the Catechism, a treatise of St Thomas Aquinas taken in small daily portions, a Father of the Church. Begin every session with prayer to the Holy Spirit and end it with thanksgiving; if study does not begin and end in prayer it becomes mere acquisition. Read with a pen: for each article or paragraph, write down the question it answers and the answer in one sentence of your own. Follow the classical order — state the difficulty honestly and at its strongest before you answer it. Test everything you conclude against the Church's teaching rather than against your own judgement, and take genuine difficulties to a priest or a competent teacher instead of settling them alone. Return regularly to Scripture, which the Second Vatican Council calls the soul of theology. Then give the fruit away: teach a catechism class, answer the question a colleague asks, prepare the Sunday readings for your household. Study that is never handed on has stopped being Dominican.",
    background:
      "The Order of Preachers, founded by St Dominic in 1216, made study a constitutive part of its life rather than a preparation for it; St Thomas Aquinas gave the tradition its motto in holding that it is greater to hand on to others what has been contemplated than merely to contemplate.",
    tradition: "Dominican",
    durationMinutes: 30,
    frequency: "Daily",
    prayers: ["veni-creator-spiritus", "prayer-to-the-holy-spirit"],
    saints: ["saint-dominic", "saint-thomas-aquinas", "saint-catherine-of-siena"],
    authority: "VATICAN",
    citations: [DEI_VERBUM, FIDES_ET_RATIO, CCC_MEDITATION],
  }),

  practice({
    slug: "meditating-the-mysteries-of-the-rosary",
    title: "Meditating the Mysteries of the Rosary",
    kind: "vocal_prayer",
    summary:
      "Praying the Rosary as St John Paul II asks it to be prayed — not as a recitation of Aves but as a contemplation of the face of Christ in the company of his Mother, with the mystery announced, a Scripture text heard, and silence kept before the beads begin.",
    instructions:
      "For each decade, follow the order Rosarium Virginis Mariae sets out. 1. Announce the mystery aloud, and if you can, place an image of it before your eyes. 2. Proclaim a short passage of Scripture that belongs to it — the Word of God, not a commentary. 3. Keep a moment of real silence before beginning the vocal prayers; John Paul II insists this pause is what turns recitation into contemplation. 4. Pray the Our Father, ten Hail Marys and the Glory Be, letting the repetition carry the mystery rather than compete with it; the name of Jesus at the centre of the Hail Mary is the centre of gravity of the whole prayer. 5. Add, where it is customary, the Fatima prayer, and conclude the Rosary with the Salve Regina or the Litany of the Blessed Virgin Mary. Keep a set of five decades a day if you can; a single decade prayed this way is worth more than fifteen rushed. The four sets of mysteries — Joyful, Luminous, Sorrowful and Glorious — are distributed across the week; the Luminous Mysteries were proposed by St John Paul II in 2002 and are freely, not obligatorily, used.",
    background:
      "The Directory on Popular Piety treats the Rosary among the pious practices most recommended by the Magisterium, and Rosarium Virginis Mariae (2002) sets out its method, adds the Mysteries of Light, and calls it a compendium of the Gospel. The Church's tradition has long associated the Rosary with the Order of Preachers.",
    tradition: "Latin Church; associated with the Dominican family",
    durationMinutes: 20,
    frequency: "Daily",
    prayers: [
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
      "litany-of-the-blessed-virgin-mary",
      "apostles-creed",
    ],
    saints: ["saint-john-paul-ii", "saint-louis-de-montfort"],
    authority: "VATICAN",
    citations: [ROSARIUM_VIRGINIS_MARIAE, DIRECTORY_POPULAR_PIETY, USCCB_ROSARY],
  }),

  practice({
    slug: "praying-the-angelus",
    title: "Praying the Angelus",
    kind: "vocal_prayer",
    summary:
      "The threefold daily pause — at dawn, at midday and at dusk — in which the faithful recall the Annunciation and the Word made flesh, marking the hours of the working day with the Incarnation.",
    instructions:
      'Pray it three times daily: morning, noon and evening, wherever you are, and let a bell, an alarm or the sound of the church bells be the summons. The form is fixed and short: three versicles with their responses — "The Angel of the Lord declared unto Mary," "Behold the handmaid of the Lord," "And the Word was made flesh" — each followed by a Hail Mary, then the versicle "Pray for us, O holy Mother of God," and the concluding prayer, "Pour forth, we beseech thee, O Lord, thy grace into our hearts." Stop what you are doing rather than praying it while working; the point is the interruption. Where circumstances make even this difficult, the Directory on Popular Piety says that at least three Hail Marys should be said. Throughout Eastertide, from Easter Sunday to Pentecost, the Angelus is replaced by the antiphon Regina Caeli, a substitution laid down by Benedict XIV in 1742. On solemn occasions — in religious communities, at Marian shrines, at gatherings — it may be sung, with the Gospel of the Annunciation proclaimed and the bells rung.',
    background:
      "The Angelus is treated in the Directory on Popular Piety among the practices recommended by the Magisterium, which praises its simple structure, biblical character, quasi-liturgical rhythm sanctifying the times of the day, and openness to the Paschal Mystery.",
    tradition: "Latin Church",
    durationMinutes: 3,
    frequency: "Three times daily — morning, noon and evening",
    prayers: ["angelus", "regina-caeli", "hail-mary"],
    authority: "VATICAN",
    citations: [DIRECTORY_POPULAR_PIETY, MARIALIS_CULTUS, USCCB_PRAYERS_AND_DEVOTIONS],
  }),

  practice({
    slug: "sung-prayer-and-gregorian-chant",
    title: "Sung Prayer and Gregorian Chant",
    kind: "other",
    summary:
      "The practice of singing prayer rather than only saying it — in the liturgy first of all, where the Church's treasury of sacred music belongs, and then at home, where a small learned repertoire carries the faith through the seasons.",
    instructions:
      "Begin in the liturgy: sing the parts of the Mass that belong to the assembly, and learn them by heart so that the book can be put down. Then learn a small common repertoire that any Catholic can share and that will be sung wherever you go — the Pater Noster, the Salve Regina, the Adoro te devote, the Tantum ergo and O salutaris hostia for Benediction, the Veni Creator Spiritus, and the Te Deum. Learn the simple psalm tones, which let you sing Morning and Evening Prayer without accompaniment. Sing at home: a hymn at the Advent wreath, the Salve Regina at night prayer, a carol at the crib. If your parish has a schola or choir, join it, and if it does not, ask. Sing at the pace of prayer, not of performance; chant is unmeasured and follows the words. Remember the order of things: sacred music exists for the liturgy and grows in holiness the more closely it is joined to it, and Gregorian chant, other things being equal, holds pride of place in the Roman Rite.",
    background:
      "Sacrosanctum Concilium devotes its sixth chapter (nn. 112-121) to sacred music, calls the Church's musical tradition a treasure of inestimable value, and gives Gregorian chant pride of place in liturgical services of the Roman Rite while admitting other kinds of sacred music.",
    tradition: "Roman Rite",
    frequency: "At every liturgy; and in the home through the seasons",
    prayers: [
      "salve-regina",
      "adoro-te-devote",
      "tantum-ergo",
      "o-salutaris-hostia",
      "veni-creator-spiritus",
      "te-deum",
    ],
    authority: "VATICAN",
    citations: [SACROSANCTUM_CONCILIUM, DIRECTORY_POPULAR_PIETY, CCC_LIFE_OF_PRAYER],
  }),

  /* ---------------------------------------------------------------- */
  /* Eucharistic practices                                             */
  /* ---------------------------------------------------------------- */
  /* NOTE: thanksgiving-after-holy-communion and spiritual-communion are  */
  /* NOT here. Both are curated as DEVOTION entries (devotions/group-1),  */
  /* which is the canonical home for a Eucharistic devotion; carrying     */
  /* them here as well reused one slug across two content types and gave  */
  /* two content pages the same title.                                    */

  practice({
    slug: "the-eucharistic-fast",
    title: "The Eucharistic Fast",
    kind: "fasting",
    summary:
      "The abstention from food and drink required of anyone about to receive Holy Communion — a small bodily discipline by which the body itself says that this food is unlike other food.",
    instructions:
      "The law is short and exact. Canon 919 §1: one who is to receive the Most Holy Eucharist is to abstain for at least one hour before Holy Communion from any food and drink, with the sole exceptions of water and medicine. Reckon the hour to the moment of receiving Communion, not to the beginning of Mass — which in practice means that if you are eating on the way, you have almost always kept it. Water may be taken at any time, and so may any medicine. Canon 919 §3 excuses the elderly, the infirm, and those who care for them: they may receive even if they have eaten something within the preceding hour. Canon 919 §2 allows a priest celebrating two or three times on the same day to take something before the later celebrations even if less than an hour has passed. Keep the fast as a preparation and not merely as a rule: many Catholics extend it voluntarily to three hours, or from midnight, as the older discipline required, and use the time for prayer, examination and an act of contrition before Mass.",
    background:
      "The one-hour fast is the discipline of the 1983 Code of Canon Law (c. 919), which relaxed the older and longer fasts. Sacramentum Caritatis places such preparation within the wider reverence owed to the Eucharist.",
    tradition: "Latin Church",
    durationMinutes: 60,
    frequency: "Before every reception of Holy Communion",
    authority: "VATICAN",
    citations: [CIC_EUCHARIST, USCCB_EUCHARIST, SACRAMENTUM_CARITATIS],
  }),

  /* ---------------------------------------------------------------- */
  /* Penance and asceticism                                            */
  /* ---------------------------------------------------------------- */

  practice({
    slug: "friday-penance",
    title: "Friday Penance",
    kind: "penance",
    summary:
      "The keeping of every Friday of the year as a penitential day in memory of the Lord's death — by abstinence from meat, or, where the bishops' conference permits, by another act of penance freely chosen and faithfully kept.",
    instructions:
      "Canon 1250 makes every Friday of the year, and the whole season of Lent, penitential days in the universal Church. Canon 1251 requires abstinence from meat, or from some other food determined by the episcopal conference, on all Fridays unless a solemnity falls on that day, and requires both abstinence and fasting on Ash Wednesday and Good Friday. In the United States the bishops' 1966 Pastoral Statement on Penance and Abstinence keeps abstinence from meat obligatory on the Fridays of Lent, and, outside Lent, allows the faithful to substitute another act of penance for Friday abstinence while urging that the day never be left without penance of some kind. Make this practical: decide on Thursday what Friday's penance will be, so that Friday does not simply pass. Good substitutes are those that cost something and help someone — a meal skipped and its cost given away, an hour of volunteer work, abstention from alcohol or from screens, the Stations of the Cross, a visit to the sick. Keep it quietly, and join it to almsgiving and prayer, which the Church always names alongside fasting.",
    background:
      "Paul VI's apostolic constitution Paenitemini (1966) reformed the Church's penitential discipline and left to episcopal conferences the determination of how the obligation is met in their territories; the current Code embodies that reform in canons 1249-1253.",
    tradition: "Latin Church; particular law in the United States",
    frequency: "Every Friday of the year",
    authority: "USCCB",
    citations: [CIC_SACRED_TIMES, USCCB_PENANCE_AND_ABSTINENCE, PAENITEMINI],
  }),

  practice({
    slug: "abstinence-from-meat",
    title: "Abstinence from Meat",
    kind: "fasting",
    summary:
      "The Church's oldest and simplest common penance: on appointed days the faithful take no meat, so that the whole body of Christians denies itself the same thing on the same day.",
    instructions:
      "Abstinence binds on Ash Wednesday, on Good Friday, and on the Fridays of Lent; outside Lent it binds on Fridays unless the episcopal conference has permitted a substitution or a solemnity falls on that Friday. What is forbidden is meat — the flesh of land animals and of birds. Paul VI's Paenitemini states the norm plainly: the law of abstinence forbids the use of meat, but not of eggs, the products of milk, or condiments made of animal fat; fish and other cold-blooded animals are not covered. Canon 1252 binds those who have completed their fourteenth year; the law of fasting, which is distinct, binds those who have reached their majority until the beginning of their sixtieth year. Pastors and parents are charged with teaching the true meaning of penance to those whom age does not bind. In practice: plan the meal rather than improvising it, do not turn the day into an occasion for expensive seafood, and let the money or the pleasure forgone go to the poor. Those genuinely unable to observe abstinence — through illness, or as a guest with no choice of food — should substitute another penance, and a pastor may dispense or commute the obligation in individual cases.",
    background:
      "The current discipline rests on Paenitemini (1966) and canons 1249-1253 of the 1983 Code. In the United States the bishops' complementary norms govern how canons 1252 and 1253 are applied.",
    tradition: "Latin Church",
    frequency: "Ash Wednesday, Good Friday, and the Fridays of Lent; other Fridays as determined",
    authority: "VATICAN",
    citations: [PAENITEMINI, CIC_SACRED_TIMES, USCCB_FAST_AND_ABSTINENCE_CANONS],
  }),

  practice({
    slug: "monthly-confession",
    title: "Regular Confession",
    kind: "penance",
    summary:
      "The habit of going to sacramental confession at a fixed interval — commonly once a month — rather than only when grave sin makes it necessary, so that the sacrament becomes a means of growth and not only of rescue.",
    instructions:
      "Fix the day and keep it: the first Saturday, the first Friday, a set week of the month. Prepare with an examination of conscience — the U.S. bishops publish forms for children, young adults and married persons — and take five minutes over it rather than thirty seconds in the queue. In the confessional, name grave sins by kind and number, as the Church requires; name venial sins simply and specifically rather than in generalities, and say what you actually did. Listen to the counsel, accept the penance and perform it the same day if you can. Make an Act of Contrition. Then ask the confessor for one point to work on, and bring that same point back next month — this is what turns repeated confession into real growth. Keeping the same confessor, where possible, gives the sacrament the continuity of direction. The Church's law obliges the faithful to confess grave sins at least once a year (canon 989), and grave sin must be confessed before receiving Communion; the regular confession of venial sins is not commanded but is strongly recommended by the Church as a genuine means of conversion and of growth in the Spirit.",
    background:
      "Canon 989 states the annual obligation. Reconciliatio et Paenitentia and Sacramentum Caritatis both urge the frequent, devout use of the sacrament, and Misericordia et Misera treats confession as the ordinary place where the Church's mercy is met.",
    tradition: "Latin Church",
    frequency: "Monthly is the common counsel; at minimum once a year for grave sin",
    prayers: ["act-of-contrition", "confiteor"],
    saints: ["saint-john-vianney", "saint-padre-pio"],
    authority: "VATICAN",
    citations: [
      CIC_PENANCE_AND_INDULGENCES,
      USCCB_PENANCE,
      RECONCILIATIO_ET_PAENITENTIA,
      MISERICORDIA_ET_MISERA,
    ],
  }),

  practice({
    slug: "custody-of-the-eyes",
    title: "Custody of the Eyes",
    kind: "mortification",
    summary:
      "The deliberate guarding of what one looks at, undertaken for the sake of purity of heart and of an undivided attention to God — an ancient discipline that the age of screens has made newly urgent rather than obsolete.",
    instructions:
      "Decide in advance what you will not look at, because the decision cannot be made honestly in the moment. Then train the first movement: when the eye is caught, turn it away immediately, before deliberation begins, and turn it toward something good — a person's face, a crucifix, the work in front of you. Do not argue with the temptation; leave the room, close the tab, put the phone down. Extend the same custody to devices: remove the applications that occasion sin, install a filter whose password you do not hold, keep phones and screens out of the bedroom, and keep a friend or spouse informed. Say a short prayer at the moment of temptation — a Hail Mary, the Memorare, the Sub tuum praesidium — so that the will has something to do. Renew the resolution each morning and check it in the nightly examination of conscience, and go to confession promptly rather than letting a habit consolidate. Finally, pair the discipline with positive charity: custody of the eyes that turns the gaze inward on oneself has missed the point, which is to see other people as persons and God in all things.",
    background:
      "The practice takes its warrant from the Lord's own words about the adulterous look (Matthew 5:28-29). The Catechism sets such vigilance within the battle of prayer, where humble watchfulness of heart is the condition of perseverance.",
    tradition: "The common ascetical tradition",
    frequency: "Continual; renewed each morning and reviewed each night",
    prayers: ["hail-mary", "memorare", "sub-tuum-praesidium", "prayer-to-saint-michael"],
    saints: ["saint-dominic-savio", "saint-maria-goretti"],
    authority: "CATECHISM",
    citations: [CCC_HUMBLE_VIGILANCE, CCC_BATTLE_OF_PRAYER, GAUDETE_ET_EXSULTATE],
  }),

  practice({
    slug: "the-practice-of-silence",
    title: "The Practice of Silence",
    kind: "silence",
    summary:
      "The deliberate making of room for quiet in an ordinary day — not as a technique but as the condition in which the Word of God can be heard and contemplative prayer becomes possible.",
    instructions:
      "Build fixed islands of silence rather than hoping for them. Keep the first ten minutes after waking without speech and without a screen. Keep a silent stretch of the commute, or a silent walk. Keep silence after Communion, and again after Night Prayer — the monastic Great Silence runs from Compline until Morning Prayer and can be kept in a household with only a little goodwill. Give one quarter of an hour a week to sitting before the Blessed Sacrament with nothing to read. Then remove the noise you have actually chosen: background media left running, the phone that is checked at every pause, talk that fills space rather than saying anything. St Benedict's Rule treats restraint of speech as a virtue in its own right, and it is the easier half of this practice; the harder half is interior. When the silence exposes restlessness, boredom or grief, stay in it and tell God what you find there rather than reaching for distraction. The Catechism calls contemplative prayer silence, the symbol of the world to come — silence is not the absence of prayer but the room it needs.",
    background:
      "Verbum Domini treats silence as integral to hearing the Word of God; the Catechism's article on contemplative prayer describes it as a silent love in which the Father speaks his Word into us.",
    tradition: "Monastic in origin; common to the whole Church",
    durationMinutes: 20,
    frequency: "Daily",
    authority: "CATECHISM",
    citations: [CCC_CONTEMPLATIVE_PRAYER, VERBUM_DOMINI, RULE_OF_ST_BENEDICT],
  }),

  practice({
    slug: "detachment-of-heart",
    title: "Detachment of Heart",
    kind: "mortification",
    summary:
      "The steady freeing of the heart from disordered attachment to created goods, so that it can love God above them and love them rightly in him — the Carmelite discipline St John of the Cross sets out in the Ascent of Mount Carmel.",
    instructions:
      "Work on the attachment, not on the thing: creation is good, and the fault lies in the grip. Begin by asking honestly what you could not do without — a comfort, an approval, a plan, a person's good opinion — and name it. Then practise small, deliberate renunciations of things that are entirely lawful: the second helping, the last word in an argument, the better seat, the interesting piece of news you could pass on. Give away something you cling to. Accept without complaint what is taken from you without your consent, which is the harder and more fruitful half. In prayer, do not seek the consolations of God in place of the God of consolations; when sweetness goes, stay. St John of the Cross's image is exact: a bird tied by a thin thread is as unable to fly as one tied by a cord, and the small attachment must be broken like the great one. Keep all of it hidden and cheerful, undertake nothing severe without a confessor or spiritual director, and measure progress by freedom to love rather than by austerity achieved.",
    background:
      "The Ascent of Mount Carmel, Book I, treats the night of sense and the disordered appetites; the doctrine is Carmelite but the practice is the common ascetical inheritance of the Church.",
    tradition: "Carmelite (Discalced)",
    frequency: "Continual; in small daily acts",
    saints: ["saint-john-of-the-cross", "saint-teresa-of-avila", "saint-therese-of-lisieux"],
    authority: "RELIGIOUS_ORDER",
    citations: [ASCENT_OF_MOUNT_CARMEL, CCC_CONTEMPLATIVE_PRAYER, GAUDETE_ET_EXSULTATE],
  }),

  practice({
    slug: "franciscan-simplicity",
    title: "Franciscan Simplicity",
    kind: "other",
    summary:
      "Living with less on purpose — the Franciscan way of poverty, gratitude and fraternity that frees the heart for God, restores a right relation to created things, and puts the disciple within reach of the poor.",
    instructions:
      "Start with an inventory rather than an intention: go through what you own and give away what you do not need, to people who do. Then change the flow — buy less, repair rather than replace, borrow and lend, keep a plain table, and set a ceiling on spending in the categories where you know you overreach. Make gratitude explicit and vocal: St Francis's Canticle of the Creatures is a school of it, and thanking God aloud for bread, water, weather and daylight changes how they are used. Give directly and personally as well as by transfer, so that you meet the poor face to face and learn their names. Work for your bread and refuse anxious accumulation. Keep the seasons of restraint the Church gives — Fridays, Advent, Lent — as a household, not privately. Members of the Secular Franciscan Order live this under an approved Rule and in fraternity; anyone may begin without joining anything, with one concrete renunciation held to for a year.",
    background:
      "St Francis of Assisi (d. 1226) founded the Order of Friars Minor on poverty and fraternity; his Canticle of the Creatures gives Laudato Si' its name, and that encyclical develops the same conversion under the headings of sobriety, gratitude and care for the common home.",
    tradition: "Franciscan",
    frequency: "A continuing way of life; reviewed each Lent",
    prayers: ["prayer-of-saint-francis"],
    saints: ["saint-francis-of-assisi", "saint-clare-of-assisi", "saint-anthony-of-padua"],
    authority: "VATICAN",
    citations: [LAUDATO_SI, EVANGELII_GAUDIUM, CCC_GUIDES_FOR_PRAYER],
  }),

  practice({
    slug: "gaining-indulgences",
    title: "Gaining Indulgences",
    kind: "other",
    summary:
      "The devout use of the Church's grants of indulgence — the remission before God of the temporal punishment due to sins whose guilt is already forgiven — for oneself or for the souls in purgatory.",
    instructions:
      "Understand first what an indulgence is and is not. Canon 992 defines it as the remission before God of temporal punishment for sins whose guilt is already forgiven, obtained by a properly disposed member of the faithful through the ministry of the Church. It does not forgive sin; grave sin must first be forgiven in sacramental confession. To gain a plenary indulgence, perform the work to which the grant is attached and fulfil the three usual conditions — sacramental confession, Eucharistic Communion, and prayer for the intentions of the Supreme Pontiff, for which an Our Father and a Hail Mary suffice — and be free of all attachment to sin, even venial sin. Where that last disposition is lacking, or a condition is unmet, the indulgence obtained is partial. The three conditions may be fulfilled some days before or after the work itself; a single sacramental confession suffices for several plenary indulgences, while Communion and the prayer for the Pope are required for each. Only one plenary indulgence may be gained in a day, apart from the indulgence granted at the hour of death. An indulgence may be applied to oneself or to the souls in purgatory, but not to another living person. Finally, keep the practice in proportion: the Church attaches indulgences to works of prayer, penance and charity in order to encourage those works, and it is the works, done in charity, that convert the heart.",
    background:
      "Paul VI's apostolic constitution Indulgentiarum Doctrina (1967) reformed the discipline and set out its doctrinal basis in the communion of saints; canons 992-997 of the 1983 Code carry the reform into law. The particular grants are collected in the Enchiridion Indulgentiarum of the Apostolic Penitentiary.",
    tradition: "Latin Church",
    frequency: "As the individual grants provide; at most one plenary indulgence a day",
    prayers: ["our-father", "hail-mary", "eternal-rest"],
    authority: "VATICAN",
    citations: [INDULGENTIARUM_DOCTRINA, CIC_PENANCE_AND_INDULGENCES, DIRECTORY_POPULAR_PIETY],
  }),

  practice({
    slug: "memento-mori",
    title: "Memento Mori — Keeping Death Before One's Eyes",
    kind: "other",
    summary:
      "The Christian remembrance of death: not morbidity but readiness, practised so that the hour no one can predict finds a soul in the state of grace, its affairs settled and its hope in the resurrection.",
    instructions:
      "Make it daily and short. Each night, pray the words the Church puts into Night Prayer — \"Into your hands, Lord, I commend my spirit\" — and go to sleep as a rehearsal of dying. St Benedict's Rule numbers among the tools of good works the counsel to keep death daily before one's eyes; a crucifix where you will see it does the work of the old memento mori objects. Then do the practical things now, while you can: make a will; write down that you want a priest called, confession, the Anointing of the Sick and Viaticum; name who is to call; arrange a Catholic funeral and burial and tell your family what you have decided. Pray regularly for a happy death and for the grace of final perseverance. Go to confession as if it were the last, and receive the Anointing of the Sick when illness or age gives cause, without waiting for the final hours. Visit a cemetery, attend funerals, and pray for the dead by name — the Church devotes November in particular to this suffrage. Read a proven guide: the medieval Ars moriendi and St Alphonsus Liguori's Preparation for Death stand in this tradition. The remembrance is Christian only if it ends in hope: we recall death because we expect the resurrection of the body and life everlasting.",
    background:
      "Spe Salvi treats Christian hope in the face of death and judgement; the Church's rites for the dying — Penance, Anointing and Viaticum — are the sacramental form this preparation takes, and the Directory on Popular Piety treats the suffrages the faithful offer for the dead.",
    tradition: "The common ascetical tradition; monastic in origin",
    frequency: "Daily remembrance; practical arrangements reviewed periodically",
    prayers: [
      "nunc-dimittis",
      "eternal-rest",
      "de-profundis",
      "anima-christi",
      "saint-gertrude-prayer",
    ],
    saints: ["saint-joseph", "saint-alphonsus-liguori", "saint-benedict-of-nursia"],
    authority: "VATICAN",
    citations: [SPE_SALVI, RULE_OF_ST_BENEDICT, DIRECTORY_POPULAR_PIETY, USCCB_BEREAVEMENT],
  }),

  /* ---------------------------------------------------------------- */
  /* Mercy and charity                                                 */
  /* ---------------------------------------------------------------- */

  practice({
    slug: "corporal-works-of-mercy",
    title: "The Corporal Works of Mercy",
    kind: "mercy",
    summary:
      "The seven bodily services by which Christians meet Christ in the poor: to feed the hungry, give drink to the thirsty, clothe the naked, shelter the homeless, visit the sick, visit the imprisoned, and bury the dead.",
    instructions:
      "Choose one work and bind yourself to it with a time and a place, because charity that stays general stays undone. A weekly two hours at a food pantry or soup kitchen; a monthly visit through the parish to a nursing home, a hospital or a prison ministry; a standing commitment to attend the funerals of parishioners who would otherwise be buried alone; a spare room or a coat given away. Do the work in person wherever you can, and learn the name of the person you serve; the corporal works are corporal precisely because presence is part of the gift. Give from your substance and not only from your surplus. Bring the children into it, at their own level, so that they learn it as ordinary. Join the work to prayer before and after, so that it does not decay into philanthropy or into a good opinion of yourself. And receive the poor as the Lord asks to be received: whatever you did for one of these least brothers of mine, you did for me (Matthew 25:40).",
    background:
      "The list is drawn from the Lord's account of the judgement in Matthew 25 and from the burial of the dead in the book of Tobit. Misericordiae Vultus sets out both the corporal and the spiritual works and asks that they be rediscovered; Deus Caritas Est shows why the Church's charitable service can never be delegated away.",
    tradition: "The common practice of the whole Church",
    frequency: "Ongoing; at least one work taken up concretely",
    saints: [
      "saint-vincent-de-paul",
      "saint-john-of-god",
      "saint-camillus-de-lellis",
      "saint-martin-de-porres",
      "saint-damien-of-molokai",
    ],
    authority: "VATICAN",
    citations: [MISERICORDIAE_VULTUS, DEUS_CARITAS_EST, MISERICORDIA_ET_MISERA],
  }),

  practice({
    slug: "spiritual-works-of-mercy",
    title: "The Spiritual Works of Mercy",
    kind: "mercy",
    summary:
      "The seven services rendered to the soul of one's neighbour: to counsel the doubtful, instruct the ignorant, admonish sinners, comfort the afflicted, forgive offences, bear patiently those who wrong us, and pray for the living and the dead.",
    instructions:
      "Take the works that are within reach today rather than the ones that sound impressive. Counsel and instruct where you are actually competent: answer the friend's honest question about the faith instead of deflecting it, teach the catechism to the children in your house, offer to prepare the Sunday readings with someone. Comfort the afflicted by being present and saying little; sitting with the bereaved is most of it. Forgive concretely — the decision not to retell the injury is what forgiveness looks like in practice. Bear patiently the colleague or relative who wrongs you, without narrating the burden to others. Pray for the living and the dead by name: keep a written list, add to it, and pray it at a fixed hour, offering Mass and indulgenced prayers for the holy souls. Admonition is the hardest of the seven and requires standing, charity and privacy; where you lack any of the three, pray and stay silent. And remember that instructing and counselling badly does harm: what you do not know, say you do not know, and point to someone who does.",
    background:
      "Misericordiae Vultus lists the seven spiritual works alongside the corporal ones and asks Catholics to rediscover both; Catechesi Tradendae treats the duty of every believer to hand on what has been received.",
    tradition: "The common practice of the whole Church",
    frequency: "Ongoing",
    prayers: ["eternal-rest", "de-profundis", "saint-gertrude-prayer"],
    authority: "VATICAN",
    citations: [MISERICORDIAE_VULTUS, EVANGELII_GAUDIUM, CATECHESI_TRADENDAE],
  }),

  practice({
    slug: "fraternal-correction",
    title: "Fraternal Correction",
    kind: "mercy",
    summary:
      "The spiritual work of mercy by which a Christian speaks privately and charitably to another about a fault, in the manner the Lord himself prescribes — and which, done any other way, becomes detraction rather than mercy.",
    instructions:
      'The Lord\'s own procedure is the rule: "If your brother sins against you, go and tell him his fault between you and him alone" (Matthew 18:15). Before you speak, ask three questions and answer them honestly. Is it true — do you know, or have you heard? Is it yours to say — have you the relationship, the standing or the responsibility? Is now the time — is the person able to hear it, and are you free of anger? Pray for the person first, and examine your own conscience on the same point; correction offered by someone who has not looked at himself lands as contempt. Then speak privately, briefly, and about the act rather than the character. Say what you saw, not what you concluded about their soul. Leave them their dignity and their freedom, and be genuinely ready to be wrong. If a private word fails and the matter is grave, the Lord\'s next steps are to bring one or two others, and then those with responsibility (Matthew 18:16-17). Never correct in public, in writing, or in front of a third party who does not need to be there — and never let "concern" become the retelling of another\'s faults, which is detraction and is itself a sin against charity.',
    background:
      "Gaudete et Exsultate treats the sins of the tongue at length, warning that gossip and defamation destroy the communion the Beatitudes create; Fratelli Tutti places honest, charitable speech within the wider recovery of social friendship.",
    tradition: "The common practice of the whole Church",
    frequency: "As charity and responsibility require",
    prayers: ["litany-of-humility"],
    authority: "VATICAN",
    citations: [GAUDETE_ET_EXSULTATE, MISERICORDIAE_VULTUS, FRATELLI_TUTTI],
  }),

  practice({
    slug: "tithing-and-sacrificial-giving",
    title: "Tithing and Sacrificial Giving",
    kind: "almsgiving",
    summary:
      "Giving a fixed and deliberate share of one's income to the Church and to the poor, decided in advance and given first rather than last — the ordinary form almsgiving takes in a wage economy.",
    instructions:
      "Decide a percentage and give it off the top, before other spending, rather than from whatever survives the month; this single change is what makes the practice sacrificial rather than residual. Make it automatic so that it does not depend on how you feel in a given week. Then divide it deliberately: a portion to your own parish, whose upkeep is the responsibility of the faithful and whose needs are concrete; a portion to the poor directly and to the Church's missions and charities. Alongside the transfer, give personally — meet someone in need face to face, since money given at a distance never teaches the giver anything. Keep it hidden, as the Lord commands: do not let your left hand know what your right is doing (Matthew 6:3). Review the amount once a year and whenever income rises, and raise it when it can be raised. When money is genuinely short, give time and skill instead, and give them on the same fixed terms. One clarification worth holding: the tithe of a tenth is a scriptural custom that many Catholics adopt freely and find clarifying, but the Church's own precept binds the faithful to provide for the material needs of the Church according to their abilities, not to a fixed figure.",
    background:
      "Deus Caritas Est sets the Church's charitable activity alongside word and sacrament as constitutive of her being; Evangelii Gaudium presses the same claim on individual disciples, and Misericordiae Vultus places almsgiving among the works of mercy to be rediscovered.",
    tradition: "The common practice of the whole Church",
    frequency: "With every income; reviewed yearly",
    authority: "VATICAN",
    citations: [DEUS_CARITAS_EST, EVANGELII_GAUDIUM, MISERICORDIAE_VULTUS],
  }),

  /* ---------------------------------------------------------------- */
  /* Rhythms of life: Sunday, family, work                             */
  /* ---------------------------------------------------------------- */

  practice({
    slug: "keeping-sunday-holy",
    title: "Keeping Sunday Holy",
    kind: "other",
    summary:
      "Ordering the whole of Sunday — not the hour of Mass alone — around the Lord's resurrection: participation in the Eucharist, abstention from the work and business that hinder worship and rest, and the deliberate use of the day for joy, family and works of mercy.",
    instructions:
      "Plan the week so that Sunday is actually free: do the shopping, the chores and the schoolwork on Saturday. Make Mass the centre of the day rather than an errand within it — read the Sunday Scriptures beforehand, arrive early enough to pray, and go as a household. Canon 1247 states the obligation: on Sundays and other holy days the faithful are bound to participate in the Mass, and are to abstain from those works and affairs that hinder the worship owed to God, the joy proper to the Lord's day, or the suitable relaxation of mind and body. So keep the rest of the day different from the other six: a proper meal at a laid table; unhurried time with the people you live with; genuine rest; a walk; a visit to the sick or to a relative living alone; an hour with a book. Do not require needless Sunday work of others any more than of yourself. Sunday begins with First Vespers on Saturday evening, and the evening Mass of anticipation satisfies the obligation. Where illness, distance or duty makes Mass impossible, keep the day by prayer, the Liturgy of the Hours and the Scriptures of the day.",
    background:
      "St John Paul II's apostolic letter Dies Domini (1998) treats Sunday under five headings — the day of the Lord, of Christ, of the Church, of humanity, and the day of days. Canons 1246-1248 carry the obligation in law; the Catechism notes that Sundays, centred on the Eucharist, are kept holy primarily by prayer.",
    tradition: "The common practice of the whole Church",
    frequency: "Weekly",
    prayers: ["magnificat", "te-deum", "benedictus-canticle-of-zechariah"],
    authority: "VATICAN",
    citations: [DIES_DOMINI, CIC_SACRED_TIMES, CCC_LIFE_OF_PRAYER],
  }),

  practice({
    slug: "family-prayer-in-the-domestic-church",
    title: "Family Prayer in the Domestic Church",
    kind: "family",
    summary:
      "The daily prayer of a household together — the family understood as the domestic church, and the parents as the first teachers of prayer to their children by praying in front of them and not only over them.",
    instructions:
      "Fix two moments the whole household keeps, and keep them at the same time each day: a short morning prayer and a longer evening prayer. Make the form simple and unchanging, so the youngest can join and everyone knows it by heart — the Sign of the Cross, the Our Father, the Hail Mary, the Glory Be, the prayer to the Guardian Angel, and then intercessions for named people, living and dead. Say grace before and after meals aloud, including in company. Add a decade of the Rosary rather than five decades if five will not survive; length is not the virtue here. Mark the liturgical year at home, because children learn the faith through the senses: the Advent wreath, ashes on Ash Wednesday, the crucifix covered in Passiontide, blessed candles at Candlemas, the crib at Christmas, holy water at the door. Read the Sunday Gospel together before Sunday. Let the children lead parts of it and choose some of the intentions. And let them see the parents praying alone as well — the Catechism calls the Christian family the first place of education in prayer, and the lesson is carried chiefly by example.",
    background:
      "Lumen Gentium calls the family the domestic church; Familiaris Consortio devotes a substantial section to family prayer and to parents as the first educators of their children in faith. Amoris Laetitia takes up the same subject in its treatment of the spirituality of the family.",
    tradition: "The common practice of the whole Church",
    durationMinutes: 10,
    frequency: "Daily, morning and evening",
    prayers: [
      "our-father",
      "hail-mary",
      "glory-be",
      "guardian-angel-prayer",
      "grace-before-meals",
      "grace-after-meals",
      "angelus",
      "eternal-rest",
    ],
    saints: ["saint-monica", "saint-joseph", "saint-gianna-molla"],
    authority: "VATICAN",
    citations: [FAMILIARIS_CONSORTIO, CCC_GUIDES_FOR_PRAYER, AMORIS_LAETITIA, LUMEN_GENTIUM],
  }),

  practice({
    slug: "parental-blessing-of-children",
    title: "The Parental Blessing of Children",
    kind: "family",
    summary:
      "The daily blessing parents give their children — a sign of the cross traced on the forehead with a short invocation — by which the household's ordinary partings and bedtimes are placed under God's protection.",
    instructions:
      'Do it at the same moments each day so the child comes to expect it: at bedtime, at the door before school, at a departure, before an examination or an operation, on a birthday and on the anniversary of baptism. Trace the sign of the cross with the thumb on the child\'s forehead and say the same words each time, so that the child learns them and can one day say them: "May God bless you and keep you," or simply "In the name of the Father, and of the Son, and of the Holy Spirit." Holy water may be used. Add a longer blessing on the feast of the Holy Family, which the Directory on Popular Piety names as a fitting occasion for the blessing of children as provided in the ritual. The Church\'s Book of Blessings contains an order for the blessing of children which parents may use at home. Keep the distinction clear: this is a parental blessing, given in virtue of the baptismal priesthood and of the office of a parent, and it does not use the gestures or the formulas reserved to a priest or deacon. Canon 1168 provides that lay persons may administer certain sacramentals in accordance with the liturgical books.',
    background:
      "The Directory on Popular Piety recommends the blessing of children, as provided in the ritual, particularly on the feast of the Holy Family, and treats blessings within the family among the practices of Christian households. Familiaris Consortio grounds the practice in the priestly office of Christian parents.",
    tradition: "The common practice of Catholic households",
    durationMinutes: 1,
    frequency: "Daily — at bedtime and at partings",
    prayers: ["guardian-angel-prayer", "sub-tuum-praesidium"],
    saints: ["saint-joseph", "saint-monica"],
    authority: "VATICAN",
    citations: [DIRECTORY_POPULAR_PIETY, CIC_SACRAMENTALS, FAMILIARIS_CONSORTIO],
  }),

  practice({
    slug: "marriage-as-a-path-to-holiness",
    title: "Marriage as a Path to Holiness",
    kind: "family",
    summary:
      "Living the married state as the actual road to sanctity for those called to it — the spouse and the children being not obstacles to holiness but its ordinary means, and the daily asceticism of common life being the school in which charity is learned.",
    instructions:
      "Take the state itself as the rule of life. Pray together daily, however briefly, and pray for each other by name; couples who cannot yet pray aloud together can begin by saying a Hail Mary side by side. Keep the sacraments together — Mass as a household on Sunday, confession at the same interval so that neither drifts. Practise the asceticism proper to this state, which is unglamorous and constant: patience with the same person across decades, the apology made before sleep, the interruption accepted, the chore done without being asked, the grievance not brought up again. Guard the marriage deliberately — a weekly hour alone together, complete honesty about money and about temptation, and no confidant closer than the spouse. Welcome children generously and take up their education in the faith, which the Church names the first duty of Christian parents. Renew the marriage vows on the anniversary and on the feast of the Holy Family. Practise hospitality and the works of mercy as a household rather than individually. And expect the sanctification to come through the other person, not around them: that is what the sacrament is for.",
    background:
      "Lumen Gentium's chapter on the universal call to holiness names married couples among those who follow their own path to sanctity; Amoris Laetitia devotes its ninth chapter to the spirituality of marriage and the family, and Familiaris Consortio to the mission of the Christian family.",
    tradition: "The common teaching of the Church on the lay state",
    frequency: "A continuing state of life",
    prayers: ["our-father", "memorare", "litany-of-saint-joseph"],
    saints: ["saint-gianna-molla", "saint-monica", "saint-joseph", "saint-thomas-more"],
    authority: "VATICAN",
    citations: [AMORIS_LAETITIA, FAMILIARIS_CONSORTIO, LUMEN_GENTIUM, USCCB_MARRIAGE],
  }),

  practice({
    slug: "sanctifying-daily-work",
    title: "Sanctifying Daily Work",
    kind: "work",
    summary:
      "The offering and the doing of ordinary professional and domestic work as a path to holiness and a means of apostolate — the characteristic spirituality of the lay faithful, who are called to sanctify the world from within it.",
    instructions:
      "Offer the day's work in the morning by name — this task, this shift, these people — rather than in general terms; the Morning Offering exists for this. Then do the work well, because sanctifying work begins with competence: punctuality, order, finishing what has been begun, and honesty about what you have not done. Work done badly cannot be offered. Fix one small discipline inside the working day — rising at the hour set without negotiating with yourself, or a single task done first because it is the one you would avoid. Build a rule of prayer that survives a working day rather than one that only works on holiday: a fixed short period of mental prayer at the same hour, the Angelus at noon, a decade of the Rosary on the commute, a brief visit to a church when you pass one. Treat the people you work with as the first field of charity, and, when the moment is genuinely right, of apostolate. Close the day by handing the unfinished work back to God rather than carrying it home. St Josemaría Escrivá taught that ordinary work, done well and offered, is itself the way to holiness for lay people; the Second Vatican Council teaches the same when it describes the secular character proper to the lay vocation.",
    background:
      "Laborem Exercens sets out the elements of a spirituality of work, in which human labour shares in the work of the Creator and is united to the Cross of Christ. Lumen Gentium and Christifideles Laici describe the secular character of the lay vocation, and St Josemaría Escrivá (canonized 2002) made the sanctification of ordinary work the centre of the message of Opus Dei.",
    tradition: "Lay spirituality; Opus Dei",
    frequency: "Every working day",
    prayers: ["morning-offering", "angelus"],
    saints: [
      "saint-josemaria-escriva",
      "saint-joseph",
      "saint-isidore-the-farmer",
      "saint-john-paul-ii",
    ],
    authority: "VATICAN",
    citations: [LABOREM_EXERCENS, LUMEN_GENTIUM, CHRISTIFIDELES_LAICI],
  }),

  practice({
    slug: "ora-et-labora",
    title: "Ora et Labora — The Benedictine Balance",
    kind: "work",
    summary:
      "The Benedictine ordering of a whole day between the Work of God, prayerful reading and manual labour, so that no hour is empty, no work is severed from prayer, and the day has a shape given to it rather than one it falls into.",
    instructions:
      "Fix the hours of prayer first and build the work around them, not the reverse; this single inversion is what the Rule actually legislates. Keep the appointed times when the bell — or the alarm — sounds, laying down what you are doing, because the Rule says that nothing is to be preferred to the Work of God. Give a defined portion of the day to prayerful reading: St Benedict assigns fixed hours of the day to lectio divina, and treats it as work rather than as leisure. Take up manual labour deliberately, however modest — cooking, cleaning, the garden, repairs — since the Rule teaches that idleness is the enemy of the soul and that the brethren should be occupied at set times in labour and at set times in reading. Begin and end each block with a short prayer. Observe moderation in food, sleep and speech, and keep to the schedule even when you do not feel like it: stability and obedience are what make the balance hold. Benedictine oblates live an adapted form of the Rule in the world, under the guidance of a monastery; anyone may begin by writing out a horarium for a single ordinary day and keeping it for a month. Note that the motto ora et labora is a later summary and does not appear as such in the Rule, though the balance it names is exactly what the Rule arranges.",
    background:
      "St Benedict of Nursia (d. c. 547) wrote his Rule for monastic communities; its chapters on the Divine Office (8-20), on the daily manual labour and reading (48), and on the reverence due to the Work of God (43) contain the arrangement summarized in the later phrase ora et labora.",
    tradition: "Benedictine",
    frequency: "A daily rule of life",
    prayers: ["our-father", "te-deum", "benedictus-canticle-of-zechariah"],
    saints: ["saint-benedict-of-nursia", "saint-scholastica", "saint-gregory-the-great"],
    authority: "RELIGIOUS_ORDER",
    citations: [RULE_OF_ST_BENEDICT, CCC_LIFE_OF_PRAYER, LABOREM_EXERCENS],
  }),

  practice({
    slug: "the-direction-of-intention",
    title: "The Direction of Intention",
    kind: "other",
    summary:
      "The Salesian habit of offering each action to God at the moment of beginning it — a few words, repeated all day, by which ordinary occupations are consciously referred to him and the whole day becomes prayer.",
    instructions:
      'Begin with the morning exercise St Francis de Sales prescribes: on waking, adore God, thank him for the night, offer him the whole day, foresee the occasions the day will bring — the difficult meeting, the tempting hour, the person who irritates you — and resolve in advance how you will meet them, asking his grace for each. Then, through the day, before each significant action, pause for the length of a breath and direct it: "Live Jesus!", which is the Salesian watchword, or "My God, I offer you this." Do it before beginning work, before a conversation, before eating, before setting out. Afterwards, thank him briefly for what went well and ask pardon for what did not, without dwelling on either. St Francis adds what he calls spiritual retirement — short deliberate returns to God\'s presence in the middle of occupations — and the evening examination. Above all, do all of it gently: the Salesian counsel is to be patient with yourself and to correct yourself without anger, since anger at one\'s own faults is itself a form of pride.',
    background:
      'St Francis de Sales set out the morning exercise, the direction of intention, spiritual retirement and the evening examination in the Introduction to the Devout Life (1609), written for lay people living in the world. "Live Jesus!" was his and St Jane Frances de Chantal\'s watchword, and remains that of the Salesian family. Pope Francis returned to his teaching in Totum Amoris Est (2022) on the fourth centenary of his death.',
    tradition: "Salesian",
    durationMinutes: 5,
    frequency: "Throughout every day",
    prayers: ["morning-offering", "act-of-love"],
    saints: ["saint-francis-de-sales", "saint-jane-frances-de-chantal"],
    authority: "RELIGIOUS_ORDER",
    citations: [INTRODUCTION_TO_THE_DEVOUT_LIFE, BXVI_ON_FRANCIS_DE_SALES, TOTUM_AMORIS_EST],
  }),

  practice({
    slug: "thirty-three-day-preparation-for-marian-consecration",
    title: "The Thirty-Three Day Preparation for Marian Consecration",
    kind: "other",
    summary:
      "The month of prayer by which St Louis-Marie Grignion de Montfort prepares a soul to make the total consecration to Jesus Christ through the hands of Mary — twelve days of detachment from the spirit of the world, then three weeks of growing knowledge of self, of Mary, and of Jesus Christ.",
    instructions:
      "Montfort divides the preparation into four periods and assigns to each its prayers and its subject. For the first twelve days, work at emptying the spirit of the world, whose maxims are contrary to those of the Gospel. Then keep three weeks: the first given to the knowledge of oneself and to sorrow for sin; the second to the knowledge of the Blessed Virgin; the third to the knowledge of Jesus Christ, to whom the whole devotion is directed. Each day carries prayers Montfort assigns — the Veni Creator Spiritus, the Ave Maris Stella, the Litany of the Blessed Virgin Mary, the Rosary, the Magnificat — together with a daily examination and a concrete act of renunciation. At the end of the thirty-three days the act of consecration is made, ideally on a Marian feast and, if possible, after confession and Communion. Montfort asks that the consecration then be renewed: briefly each day, and in full each year on the same feast. Keep the doctrine straight throughout, since it is what the practice depends on: this is not a devotion that terminates in Mary but a way of belonging entirely to Christ, giving him everything through the hands of his Mother, whose whole office is to lead souls to her Son.",
    background:
      "St Louis-Marie Grignion de Montfort (d. 1716) set out the devotion and its preparation in his Treatise on True Devotion to the Blessed Virgin. St John Paul II, whose motto Totus tuus is drawn from this tradition, acknowledged his debt to Montfort in Rosarium Virginis Mariae, and Redemptoris Mater sets Marian entrustment within the Church's pilgrimage of faith.",
    tradition: "Montfortian",
    frequency: "Thirty-three days of preparation; the consecration renewed daily and yearly",
    prayers: [
      "veni-creator-spiritus",
      "litany-of-the-blessed-virgin-mary",
      "magnificat",
      "memorare",
      "hail-mary",
    ],
    saints: ["saint-louis-de-montfort", "saint-john-paul-ii", "saint-maximilian-kolbe"],
    authority: "VATICAN",
    citations: [TRUE_DEVOTION_TO_MARY, ROSARIUM_VIRGINIS_MARIAE, REDEMPTORIS_MATER],
  }),

  /* ---------------------------------------------------------------- */
  /* Accompaniment, discernment and witness                            */
  /* ---------------------------------------------------------------- */

  practice({
    slug: "silent-retreat",
    title: "The Silent Retreat",
    kind: "silence",
    summary:
      "Withdrawing for a fixed period — a day, a weekend, a week or longer — into exterior and interior silence at a retreat house or monastery, under a director, in order to pray at length and to see one's life from a distance.",
    instructions:
      "Book with a retreat house, monastery or diocesan centre well ahead, and choose a preached or a directed retreat according to what you need — a preached retreat gives conferences to all; a directed retreat gives you a director and a daily meeting. Arrange the practical things so they cannot pull you back: tell people you will be unreachable, and hand in the phone or lock it away rather than trusting yourself. Keep the house's horarium exactly — Mass, the Liturgy of the Hours, the appointed periods of prayer, meals in silence, rest. Take one short Scripture passage into each period of prayer rather than a book; resist the urge to read your way through the retreat. Go to confession while you are there. Walk. Sleep enough, since exhaustion is not prayer. Expect the first day to be restless and do not judge the retreat by it. On the last day, write down what you actually received, and reduce it to two or three concrete resolutions and a realistic plan of prayer for home — a retreat that changes nothing on the following Tuesday has not finished. Make one annually if your state of life allows it.",
    background:
      "The practice of periodic withdrawal for prayer is ancient and is presupposed by every school of spirituality; Gaudete et Exsultate insists that growth in holiness requires moments set apart in silence, and the Catechism describes the determination required to make time for contemplative prayer.",
    tradition: "Common to the Latin Church; forms vary by school",
    frequency: "Annually where possible",
    authority: "VATICAN",
    citations: [GAUDETE_ET_EXSULTATE, CCC_CONTEMPLATIVE_PRAYER, VERBUM_DOMINI],
  }),

  practice({
    slug: "spiritual-journaling",
    title: "Spiritual Journaling",
    kind: "other",
    summary:
      "Keeping a brief written record of one's prayer — what was prayed with, what stirred, what was resisted — so that God's action can be recognized across weeks rather than judged in a single hour, and so that it can be brought to a director.",
    instructions:
      "Write after prayer, never during it, and write for two or three minutes only. Record four things: the date, the text or subject you prayed with, the grace you asked for, and what actually happened — including nothing, when nothing is what happened. Note any movement of consolation or desolation and what preceded it. Keep it plain and factual; this is a log, not literature, and it is not a diary of the day's events. Reread the last month before each meeting with your spiritual director, and mark the two or three entries worth discussing. Once a year, read the whole and look for patterns rather than incidents: what consistently draws you toward God, what consistently pulls away, which resolutions you keep making and never keeping. Keep it private, and feel free to destroy it — it is a tool, not an archive. Written under obedience to a confessor, the practice produced St Faustina Kowalska's Diary; St Ignatius of Loyola kept such a record for his own discernment and left part of it behind.",
    background:
      "The Catechism describes the humble vigilance of heart by which the movements of the soul are noticed and discerned. St Faustina wrote her Diary at the direction of her confessor; St John Paul II canonized her in 2000 and made her account of Divine Mercy widely known.",
    tradition: "Common to several schools; Ignatian in method",
    durationMinutes: 5,
    frequency: "Daily, after prayer",
    saints: ["saint-faustina-kowalska", "saint-ignatius-of-loyola", "saint-therese-of-lisieux"],
    authority: "VATICAN",
    citations: [CCC_HUMBLE_VIGILANCE, JPII_FAUSTINA_CANONIZATION, SPIRITUAL_EXERCISES],
  }),

  practice({
    slug: "spiritual-friendship",
    title: "Spiritual Friendship",
    kind: "other",
    summary:
      "A friendship deliberately ordered to the holiness of both friends — one in which prayer, honesty and mutual accountability are part of the bond, and in which each wants the other's sanctity more than the other's approval.",
    instructions:
      "Choose deliberately rather than drifting: a spiritual friendship is not simply a friendship between two believers. Give it structure, or it will not survive ordinary life — meet at a set time, weekly or monthly; pray together aloud, however briefly, at every meeting; read the same book and talk about it; and ask each other two honest questions, one about prayer and one about sin, and answer them. Speak of your own failures before speaking of the other's. Keep confidences absolutely and without exception. Keep it chaste, and keep it open: a friendship that must be concealed from a spouse, a superior or a director is not this thing but its counterfeit — St Francis de Sales warns those living in the world at length against friendships that flatter and possess rather than convert. Let it serve the marriage, family, parish or community you already belong to and never compete with them. And accept correction from your friend when it comes: the willingness to be told the truth is what distinguishes this friendship from companionship.",
    background:
      "St Francis de Sales treats true and false friendship at length in the third part of the Introduction to the Devout Life. Gaudete et Exsultate insists that holiness is grown in community and not alone, and Fratelli Tutti recovers the wider notion of social friendship.",
    tradition: "Salesian in its classical treatment; common to the whole Church",
    frequency: "Regular meetings — weekly or monthly",
    prayers: ["litany-of-humility"],
    saints: ["saint-francis-de-sales", "saint-jane-frances-de-chantal", "saint-john-henry-newman"],
    authority: "RELIGIOUS_ORDER",
    citations: [INTRODUCTION_TO_THE_DEVOUT_LIFE, GAUDETE_ET_EXSULTATE, FRATELLI_TUTTI],
  }),

  practice({
    slug: "vocational-discernment",
    title: "Vocational Discernment",
    kind: "vocation",
    summary:
      "The ordered process by which a Catholic seeks to know the state of life to which God calls them — marriage, priesthood, consecrated life, or the single life lived for the Kingdom — using prayer, direction, real information and the judgement of the Church.",
    instructions:
      "Work through it in order, and do not skip the first steps because the last are more interesting. 1. Put the question before God daily in prayer, and ask first for the grace to want whatever he wants, since a discernment made by someone who has already decided is not a discernment. 2. Get the ordinary Christian life in order: daily prayer, Sunday Mass, regular confession, chastity according to your present state, honest work. A vocation is discerned from within a life of grace, not alongside one. 3. Find a spiritual director and meet monthly; this is not optional. 4. Gather real information rather than imagining: visit a seminary or religious house and stay there, spend time with people actually living the life, meet your diocesan vocation director. If marriage is the question, court seriously and openly rather than indefinitely. 5. Watch the movements — the Ignatian rules on consolation and desolation apply directly — and never make or reverse a decision while in desolation. 6. Test the desire against your gifts, your health, and any obligations already contracted, and against the judgement of those who know you well. 7. Take a step and let the Church confirm it or refuse it. No one discerns alone: a call to priesthood or consecrated life is finally the Church's call, and admission to seminary or novitiate is her judgement, not a private certainty.",
    background:
      "Pastores Dabo Vobis treats the discernment and formation of priestly vocations; Vita Consecrata does the same for the consecrated life. Both insist that the call is confirmed by the Church and not merely felt by the individual.",
    tradition: "Common to the whole Church; Ignatian in its rules of discernment",
    frequency: "A season of life; reviewed monthly with a director",
    prayers: ["veni-creator-spiritus", "prayer-to-the-holy-spirit", "memorare"],
    saints: ["saint-john-paul-ii", "saint-ignatius-of-loyola", "saint-john-vianney"],
    authority: "VATICAN",
    citations: [PASTORES_DABO_VOBIS, VITA_CONSECRATA, USCCB_VOCATIONS, CCC_GUIDES_FOR_PRAYER],
  }),

  practice({
    slug: "personal-witness-and-evangelization",
    title: "Personal Witness and Evangelization",
    kind: "other",
    summary:
      "The ordinary Catholic's share in the Church's mission: a life that raises the question, and a readiness to answer it plainly when it is asked — carried on among the people one already knows rather than among strangers.",
    instructions:
      "Begin with your own conversion, since the Church evangelizes only if she is first evangelized herself. Then live so that the question arises: Evangelii Nuntiandi describes the wordless witness of Christians who radiate faith, charity and hope, and who thereby provoke irresistible questions in those who watch them. Be ready to answer plainly when asked, which means knowing the basic content — the Creed, why you believe it, what the Church actually teaches on the point at issue, and, just as importantly, what you do not know and where to send someone who wants more. Speak to people you already know, one at a time, and listen far more than you argue; an argument won at a dinner table converts no one. Invite concretely rather than in principle: to Mass, to a funeral, to an hour of adoration, to a meal at your table. Accompany rather than recruit, and do not hurry another's conscience — the pace belongs to grace. Pray by name for the people you hope to bring to Christ, and keep the list where you will see it. And support the wider mission with money, with hospitality, and with the vocations that may come out of your own family.",
    background:
      "Evangelii Nuntiandi (1975) sets out the priority of witness and the necessity of explicit proclamation; Redemptoris Missio recovers the Church's mission ad gentes; Evangelii Gaudium describes every baptized person as a missionary disciple. Apostolicam Actuositatem grounds the lay apostolate in baptism and confirmation.",
    tradition: "The common vocation of the baptized",
    frequency: "Ongoing",
    prayers: ["veni-creator-spiritus", "prayer-to-the-holy-spirit", "act-of-faith"],
    saints: [
      "saint-francis-xavier",
      "saint-paul",
      "saint-katharine-drexel",
      "saint-frances-xavier-cabrini",
    ],
    authority: "VATICAN",
    citations: [
      EVANGELII_NUNTIANDI,
      REDEMPTORIS_MISSIO,
      EVANGELII_GAUDIUM,
      APOSTOLICAM_ACTUOSITATEM,
    ],
  }),

  practice({
    slug: "praying-with-the-word-of-god-daily",
    title: "Praying with the Word of God Daily",
    kind: "spiritual_reading",
    summary:
      "Taking the Scriptures of the day — the readings of the Mass — as the daily food of prayer, so that a Catholic's personal prayer is fed by the same Word the whole Church is hearing.",
    instructions:
      "Use the Church's own lectionary rather than choosing passages by mood: pray with the readings the Mass will use that day, or with the Sunday readings across the week before Sunday. Do it at a fixed hour. Read the passage twice, the second time slowly and aloud if you can. Then stay with the single verse or phrase that holds you, and repeat it. Ask the plain questions — what does this say, what does it ask of me, what do I want to say back to God about it — and then say it back to him in your own words. End with a moment of silence and one sentence you will carry through the day; write it down. On Sunday, read the coming week's Gospel with your household before Mass. Keep a Bible with the Church's approved translation and a sound commentary or the Catechism's cross-references to hand for what puzzles you, and take real difficulties to a priest rather than settling them alone. Pope Francis instituted the Sunday of the Word of God to press this practice on the whole Church; Verbum Domini asks that Scripture become the soul of every Catholic's prayer and not the preserve of scholars.",
    background:
      "Dei Verbum urges all the faithful to frequent reading of the Scriptures and reminds them that prayer should accompany the reading, so that a conversation takes place between God and the reader. Verbum Domini (2010) develops this at length, and Aperuit Illis (2019) established the Sunday of the Word of God.",
    tradition: "The common practice of the whole Church",
    durationMinutes: 20,
    frequency: "Daily",
    prayers: ["prayer-to-the-holy-spirit", "veni-creator-spiritus", "magnificat"],
    saints: ["saint-jerome", "saint-gregory-the-great"],
    authority: "VATICAN",
    citations: [DEI_VERBUM, VERBUM_DOMINI, APERUIT_ILLIS, CCC_WELLSPRINGS_OF_PRAYER],
  }),

  practice({
    slug: "ejaculatory-prayer-and-aspirations",
    title: "Ejaculatory Prayer and Aspirations",
    kind: "vocal_prayer",
    summary:
      "Very short prayers — a sentence, a name, a single cry — sent up repeatedly through the course of a day, so that prayer is not confined to the times set aside for it and the habit of God's presence is kept alive in the middle of work.",
    instructions:
      'Choose two or three short forms and keep them until they are automatic: "My Lord and my God"; "Jesus, I trust in you"; "Lord, have mercy"; "Come, Holy Spirit"; "Mary, help of Christians, pray for us"; or simply the holy Name of Jesus. Attach them to fixed triggers so they are not left to memory — every time you cross a threshold, wait at a red light, wash your hands, open a message, hear a siren, pass a church. Say them at the moment of temptation, of anger, of fear, and again in gratitude when something goes well. Keep them short: an aspiration that grows into a paragraph has stopped doing this particular work. St Francis de Sales calls such prayers the retreat of the heart and holds that a devout life in the world depends more on them than on long exercises, and the Catechism, teaching that it is always possible to pray, quotes the Fathers on fervent prayer offered while walking, buying and selling, or cooking. When the day has been too full for anything else, these are what remain, and they are enough.',
    background:
      "The Catechism, on persevering in love, teaches that it is always possible to pray and cites the ancient counsel that prayer can be offered in the midst of any occupation. The practice is common to every school of Catholic spirituality and is treated at length by St Francis de Sales.",
    tradition: "Common to the whole Church",
    durationMinutes: 1,
    frequency: "Many times a day",
    prayers: ["fatima-prayer", "divine-praises", "act-of-love", "guardian-angel-prayer"],
    saints: ["saint-francis-de-sales", "saint-therese-of-lisieux"],
    authority: "CATECHISM",
    citations: [CCC_PERSEVERING_IN_LOVE, INTRODUCTION_TO_THE_DEVOUT_LIFE, CCC_WAY_OF_PRAYER],
  }),

  practice({
    slug: "a-personal-rule-of-life",
    title: "A Personal Rule of Life",
    kind: "other",
    summary:
      "A short written plan of prayer, penance, study and charity, proportioned to one's state and duties, kept with a director's help and reviewed periodically — the ordinary means by which good intentions become an actual spiritual life.",
    instructions:
      "Write it down; a rule held only in the head is a wish. Keep it to one page and to four headings. Prayer: the fixed times and the fixed forms — morning prayer, a set period of mental prayer, the Angelus, an examination at night, Mass and confession at named intervals. Word and study: what you will read daily and for how long. Penance and asceticism: the Friday penance, one small daily mortification, the concrete disciplines you have found you need. Charity and duty: the works of mercy you have actually committed to, and the duties of your state — spouse, children, employment — named as part of the rule rather than as what the rule competes with. Then obey two principles. First, make it small enough to keep on your worst ordinary week, not your best; a rule that fails is worse than none. Second, show it to a confessor or spiritual director before you adopt it, and review it with them twice a year, tightening what has become easy and cutting what has proved impossible. When you break it, resume the same day without drama. The Catechism is blunt about the necessity: we cannot pray at all times if we do not pray at specific times, consciously willing it.",
    background:
      "The Catechism notes that the Tradition of the Church proposes to the faithful certain rhythms of prayer intended to nourish continual prayer — daily prayers, the Liturgy of the Hours, the Sunday Eucharist, the cycle of the liturgical year. A personal rule is simply the application of that principle to one particular life, and every school of spirituality provides one.",
    tradition: "Common to the whole Church; monastic in origin",
    frequency: "Kept daily; reviewed with a director twice a year",
    prayers: ["morning-offering", "angelus", "act-of-contrition"],
    authority: "CATECHISM",
    citations: [CCC_LIFE_OF_PRAYER, RULE_OF_ST_BENEDICT, GAUDETE_ET_EXSULTATE],
  }),
];

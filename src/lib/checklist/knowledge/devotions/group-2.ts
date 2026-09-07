import type { CuratedEntry } from "../index";

/**
 * Devotion group 2: Marian devotions, devotions to the Passion and to the
 * Person of Christ, devotions to the saints and the holy angels, and the
 * penitential and seasonal observances of the Christian year.
 *
 * Every entry describes a devotion the Church actually practises and that is
 * described on the pages cited under it. Nothing has been reconstructed from
 * memory: where a source is silent on a detail — a date, a promise, a bead
 * count — the detail is omitted rather than supplied, and pious stories whose
 * historical basis is disputed are left out entirely.
 *
 * As the Directory on Popular Piety and the Liturgy asks, the `background`
 * field says in each case whether what is described is an act of the Church's
 * public worship, a devotion of a religious family or confraternity, or a
 * private and domestic exercise of piety.
 *
 * Indulgences are claimed for only three entries — the Act of Dedication of the
 * Human Race to Christ the King, the observance of Divine Mercy Sunday, and the
 * November visits made for the holy souls — and in each case the grant is
 * described in words, with the granting document named. No other entry claims
 * an indulgence, and no promise is reported that its cited source does not
 * report.
 */

/* --------------------------- Holy See ---------------------------- */

const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const MARIALIS_CULTUS =
  "https://www.vatican.va/content/paul-vi/en/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus.html";
const ROSARIUM_VIRGINIS_MARIAE =
  "https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html";
const QUAS_PRIMAS =
  "https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_11121925_quas-primas.html";
const HAURIETIS_AQUAS =
  "https://www.vatican.va/content/pius-xii/en/encyclicals/documents/hf_p-xii_enc_15051956_haurietis-aquas.html";
const PAENITEMINI =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_19660217_paenitemini.html";
const INDULGENTIARUM_DOCTRINA =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_01011967_indulgentiarum-doctrina.html";
const DIVES_IN_MISERICORDIA =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_30111980_dives-in-misericordia.html";
const CANONIZATION_OF_ST_FAUSTINA =
  "https://www.vatican.va/content/john-paul-ii/en/homilies/2000/documents/hf_jp-ii_hom_20000430_faustina.html";
const DIVINE_MERCY_INDULGENCE_DECREE =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_doc_20020629_decree-ii_en.html";
const PAUL_VI_PHILIPPINES_RADIO_MESSAGE =
  "https://www.vatican.va/content/paul-vi/en/speeches/1965/documents/hf_p-vi_spe_19650502_philippines.html";
const FRANCIS_MANILA_HOMILY =
  "https://www.vatican.va/content/francesco/en/homilies/2015/documents/papa-francesco_20150118_srilanka-filippine-omelia-rizal-park.html";

/* ----------------------------- USCCB ------------------------------ */

const USCCB_ANGELUS = "https://www.usccb.org/prayers/angelus";
const USCCB_REGINA_CAELI = "https://www.usccb.org/prayers/regina-caeli";
const USCCB_BLESSING_OF_AN_ADVENT_WREATH = "https://www.usccb.org/prayers/blessing-advent-wreath";
const USCCB_PENANCE_AND_ABSTINENCE =
  "https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/lent/us-bishops-pastoral-statement-on-penance-and-abstinence";
const USCCB_FAST_AND_ABSTINENCE =
  "https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/lent/catholic-information-on-lenten-fast-and-abstinence";
const USCCB_CANONS_1252_1253 =
  "https://www.usccb.org/beliefs-and-teachings/what-we-believe/canon-law/complementary-norms/canons-1252-and-1253-observance-of-fast-and-abstinence";
const USCCB_GOOD_FRIDAY_LITURGY =
  "https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/triduum/roman-missal-and-the-good-friday-liturgy";

/* ------------------------------ EWTN ------------------------------ */

const EWTN_LITTLE_OFFICE_OF_OUR_LADY =
  "https://www.ewtn.com/catholicism/library/little-office-of-our-lady-11815";
const EWTN_ROSARY_CONFRATERNITY =
  "https://www.ewtn.com/catholicism/library/rosary-confraternity-11833";
const EWTN_ON_THE_CONFRATERNITY_OF_THE_ROSARY =
  "https://www.ewtn.com/catholicism/library/on-the-confraternity-of-the-holy-rosary-3408";
const EWTN_PAPAL_CONSECRATIONS_IMMACULATE_HEART =
  "https://www.ewtn.com/catholicism/library/papal-consecrations-to-the-immaculate-heart-7140";
const EWTN_ACT_OF_CONSECRATION_IMMACULATE_HEART =
  "https://www.ewtn.com/catholicism/devotions/solemn-act-of-consecration-to-the-immaculate-heart-of-mary-12729";
const EWTN_LITANY_OF_THE_PRECIOUS_BLOOD =
  "https://www.ewtn.com/catholicism/library/litany-of-the-most-precious-blood-of-our-lord-jesus-christ-11888";
const EWTN_THE_HOLY_NAME_OF_JESUS_CHRIST =
  "https://www.ewtn.com/catholicism/library/the-holy-name-of-jesus-christ-13712";
const EWTN_LITANY_OF_THE_HOLY_NAME =
  "https://www.ewtn.com/catholicism/devotions/litany-to-the-most-holy-name-of-jesus-268";
const EWTN_DIVINE_MERCY_SUNDAY =
  "https://www.ewtn.com/catholicism/library/divine-mercy-sunday-4367";
const EWTN_ADORATION_OF_THE_CROSS =
  "https://www.ewtn.com/catholicism/library/adoration-of-the-cross-12558";
const EWTN_ST_MICHAEL_PRAYER_AT_MASS =
  "https://www.ewtn.com/catholicism/library/st-michael-prayer-at-mass-4913";
const EWTN_NOVENA_TO_ST_JUDE =
  "https://www.ewtn.com/catholicism/devotions/novena-to-st-jude--desperate-situations-and-hopeless-cases-305";
const EWTN_ST_RITA_OF_CASCIA = "https://www.ewtn.com/catholicism/saints/rita-of-cascia-749";
const EWTN_ST_PEREGRINE =
  "https://www.ewtn.com/catholicism/library/cancer-saint-st-peregrine-osm-5742";
const EWTN_NOVENA_TO_THE_HOLY_FAMILY =
  "https://www.ewtn.com/catholicism/devotions/novena-to-the-holy-family-308";

/* -------------------------- Catholic Culture ---------------------- */

const CC_MAY_MONTH_OF_MARY =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/05_1.cfm";
const CC_MAY_DEVOTION_BVM =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=758";
const CC_FAMILY_MAY_CROWNING =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1078";
const CC_LITTLE_OFFICE_OF_OUR_LADY =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=9072";
const CC_AUGUST_IMMACULATE_HEART =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/08_1.cfm";
const CC_OCTOBER_MONTH_OF_THE_ROSARY =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/10_1.cfm";
const CC_JUNE_OVERVIEW =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/06_1.cfm";
const CC_JULY_PRECIOUS_BLOOD =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/07_1.cfm";
const CC_JULY_DEVOTION_PRECIOUS_BLOOD =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=760";
const CC_JANUARY_HOLY_NAME =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/01_1.cfm";
const CC_FIVE_WOUNDS_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=33590";
const CC_LITANY_OF_THE_SACRED_WOUNDS =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1120";
const CC_DIVINE_MERCY_INDULGENCE =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1052";
const CC_ACT_OF_DEDICATION_TO_CHRIST_THE_KING =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=920";
const CC_CHILD_JESUS_PROTECTOR_OF_THE_PHILIPPINES =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=10801";
const CC_PRAYER_TO_ST_MICHAEL =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=869";
const CC_ST_MICHAEL_GUARDIAN_OF_THE_CHURCH =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=1217";
const CC_LEONINE_PRAYERS_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=34560";
const CC_ANGELE_DEI =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=871";
const CC_GUARDIAN_ANGELS_MEMORIAL =
  "https://www.catholicculture.org/culture/liturgicalyear/calendar/day.cfm?date=2025-10-02";
const CC_ST_ANTHONYS_BREAD = "https://www.catholicculture.org/commentary/st-anthonys-bread/";
const CC_BLESSING_OF_BREAD_ST_ANTHONY =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1379";
const CC_SIMON_AND_JUDE =
  "https://www.catholicculture.org/culture/liturgicalyear/calendar/day.cfm?date=2025-10-28";
const CC_ST_RITA_ACTIVITY =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1123";
const CC_NOVENA_TO_ST_PEREGRINE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1306";
const CC_PRAYER_TO_ST_PEREGRINE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1307";
const CC_FEBRUARY_DEVOTION_HOLY_FAMILY =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=754";
const CC_JESSE_TREE_OVERVIEW =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1372";
const CC_JESSE_TREE_INSTRUCTIONS =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=545";
const CC_JESSE_TREE_PRAYER_SERVICE =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=559";
const CC_LAS_POSADAS_AND_LOS_PASTORES =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=557";
const CC_LAS_POSADAS_II =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=962";
const CC_NOVEMBER_MONTH_OF_THE_HOLY_SOULS =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/months/11_1.cfm";
const CC_PRAYING_FOR_THE_DEAD_ACTIVITY =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1178";
const CC_PRAYING_FOR_THE_DEAD_LIBRARY =
  "https://www.catholicculture.org/culture/library/view.cfm?id=3888";
const CC_ENCHIRIDION_WORKS_AND_PRAYERS =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=6623";
const CC_EMBER_DAYS_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=33306";
const CC_EMBER_DAY_PRAYERS =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1369";
const CC_CONTEMPORARY_OBSERVATION_OF_EMBER_DAYS =
  "https://www.catholicculture.org/commentary/contemporary-observation-ember-days/";

/* -------------------------- Indulgence notes ---------------------- */

const CHRIST_THE_KING_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant on acts of consecration and devotion: a plenary indulgence, on the usual conditions, for the public recitation of the Act of Dedication of the Human Race to Jesus Christ King (Iesu dulcissime, Redemptor) on the Solemnity of Our Lord Jesus Christ, King of the Universe; a partial indulgence for its recitation at other times. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

const DIVINE_MERCY_INDULGENCE = {
  claimed: true,
  citation:
    "Apostolic Penitentiary, Decree on indulgences attached to devotions in honour of Divine Mercy (29 June 2002), approved by Pope John Paul II: a plenary indulgence, on the usual conditions of sacramental confession, Eucharistic Communion and prayer for the intentions of the Supreme Pontiff, and in a spirit wholly detached from affection for sin, for the faithful who on the Second Sunday of Easter take part in prayers and devotions in honour of Divine Mercy in any church or chapel, or who before the Blessed Sacrament exposed or reserved recite the Our Father and the Creed with a devout prayer to the merciful Lord Jesus.",
};

const HOLY_SOULS_NOVEMBER_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grants for the faithful departed: a plenary indulgence, applicable only to the souls in purgatory, for devoutly visiting a cemetery and praying, even mentally, for the dead on each day from 1 to 8 November, and for devoutly visiting a church or oratory on the Commemoration of All the Faithful Departed and there praying the Our Father and the Creed; a partial indulgence for a cemetery visit on other days of the year. The usual conditions apply, and a plenary indulgence may be gained only once a day. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

/* ------------------------------------------------------------------ */
/* Citation sets                                                       */
/* ------------------------------------------------------------------ */

const ANGELUS_CITATIONS = [USCCB_ANGELUS, DIRECTORY_POPULAR_PIETY, MARIALIS_CULTUS];
const REGINA_CAELI_CITATIONS = [USCCB_REGINA_CAELI, USCCB_ANGELUS, DIRECTORY_POPULAR_PIETY];
const MAY_CROWNING_CITATIONS = [
  CC_MAY_MONTH_OF_MARY,
  CC_FAMILY_MAY_CROWNING,
  CC_MAY_DEVOTION_BVM,
  DIRECTORY_POPULAR_PIETY,
];
const SATURDAY_DEVOTION_CITATIONS = [
  MARIALIS_CULTUS,
  DIRECTORY_POPULAR_PIETY,
  CC_MAY_MONTH_OF_MARY,
];
const LITTLE_OFFICE_CITATIONS = [
  EWTN_LITTLE_OFFICE_OF_OUR_LADY,
  CC_LITTLE_OFFICE_OF_OUR_LADY,
  DIRECTORY_POPULAR_PIETY,
];
const IMMACULATE_HEART_CONSECRATION_CITATIONS = [
  EWTN_PAPAL_CONSECRATIONS_IMMACULATE_HEART,
  EWTN_ACT_OF_CONSECRATION_IMMACULATE_HEART,
  CC_AUGUST_IMMACULATE_HEART,
  DIRECTORY_POPULAR_PIETY,
];
const ROSARY_CONFRATERNITY_CITATIONS = [
  EWTN_ROSARY_CONFRATERNITY,
  EWTN_ON_THE_CONFRATERNITY_OF_THE_ROSARY,
  ROSARIUM_VIRGINIS_MARIAE,
];
const MONTH_OF_THE_ROSARY_CITATIONS = [
  CC_OCTOBER_MONTH_OF_THE_ROSARY,
  ROSARIUM_VIRGINIS_MARIAE,
  DIRECTORY_POPULAR_PIETY,
];

const FIVE_WOUNDS_CITATIONS = [CC_FIVE_WOUNDS_DICTIONARY, CC_LITANY_OF_THE_SACRED_WOUNDS];
const PRECIOUS_BLOOD_CITATIONS = [
  CC_JULY_PRECIOUS_BLOOD,
  CC_JULY_DEVOTION_PRECIOUS_BLOOD,
  EWTN_LITANY_OF_THE_PRECIOUS_BLOOD,
];
const HOLY_NAME_CITATIONS = [
  EWTN_THE_HOLY_NAME_OF_JESUS_CHRIST,
  CC_JANUARY_HOLY_NAME,
  EWTN_LITANY_OF_THE_HOLY_NAME,
];
const DIVINE_MERCY_SUNDAY_CITATIONS = [
  DIVINE_MERCY_INDULGENCE_DECREE,
  CANONIZATION_OF_ST_FAUSTINA,
  CC_DIVINE_MERCY_INDULGENCE,
  EWTN_DIVINE_MERCY_SUNDAY,
  DIVES_IN_MISERICORDIA,
];
const VENERATION_OF_THE_CROSS_CITATIONS = [
  USCCB_GOOD_FRIDAY_LITURGY,
  EWTN_ADORATION_OF_THE_CROSS,
  DIRECTORY_POPULAR_PIETY,
];
const SANTO_NINO_CITATIONS = [
  CC_CHILD_JESUS_PROTECTOR_OF_THE_PHILIPPINES,
  PAUL_VI_PHILIPPINES_RADIO_MESSAGE,
  FRANCIS_MANILA_HOMILY,
];
const CHRIST_THE_KING_CITATIONS = [
  CC_ACT_OF_DEDICATION_TO_CHRIST_THE_KING,
  QUAS_PRIMAS,
  INDULGENTIARUM_DOCTRINA,
];
const MONTH_OF_THE_SACRED_HEART_CITATIONS = [
  CC_JUNE_OVERVIEW,
  HAURIETIS_AQUAS,
  DIRECTORY_POPULAR_PIETY,
];

const ST_MICHAEL_CITATIONS = [
  EWTN_ST_MICHAEL_PRAYER_AT_MASS,
  CC_PRAYER_TO_ST_MICHAEL,
  CC_LEONINE_PRAYERS_DICTIONARY,
  CC_ST_MICHAEL_GUARDIAN_OF_THE_CHURCH,
];
const GUARDIAN_ANGELS_CITATIONS = [
  CC_ANGELE_DEI,
  CC_GUARDIAN_ANGELS_MEMORIAL,
  DIRECTORY_POPULAR_PIETY,
];
const ST_ANTHONYS_BREAD_CITATIONS = [CC_ST_ANTHONYS_BREAD, CC_BLESSING_OF_BREAD_ST_ANTHONY];
const ST_JUDE_CITATIONS = [EWTN_NOVENA_TO_ST_JUDE, CC_SIMON_AND_JUDE];
const ST_RITA_CITATIONS = [EWTN_ST_RITA_OF_CASCIA, CC_ST_RITA_ACTIVITY];
const ST_PEREGRINE_CITATIONS = [
  EWTN_ST_PEREGRINE,
  CC_NOVENA_TO_ST_PEREGRINE,
  CC_PRAYER_TO_ST_PEREGRINE,
];
const HOLY_FAMILY_CITATIONS = [
  CC_FEBRUARY_DEVOTION_HOLY_FAMILY,
  EWTN_NOVENA_TO_THE_HOLY_FAMILY,
  DIRECTORY_POPULAR_PIETY,
];

const FRIDAY_PENANCE_CITATIONS = [
  USCCB_PENANCE_AND_ABSTINENCE,
  USCCB_CANONS_1252_1253,
  PAENITEMINI,
];
const LENTEN_PENANCE_CITATIONS = [USCCB_FAST_AND_ABSTINENCE, USCCB_CANONS_1252_1253, PAENITEMINI];
const ADVENT_WREATH_CITATIONS = [USCCB_BLESSING_OF_AN_ADVENT_WREATH, DIRECTORY_POPULAR_PIETY];
const JESSE_TREE_CITATIONS = [
  CC_JESSE_TREE_OVERVIEW,
  CC_JESSE_TREE_INSTRUCTIONS,
  CC_JESSE_TREE_PRAYER_SERVICE,
];
const LAS_POSADAS_CITATIONS = [CC_LAS_POSADAS_AND_LOS_PASTORES, CC_LAS_POSADAS_II];
const HOLY_SOULS_CITATIONS = [
  CC_PRAYING_FOR_THE_DEAD_ACTIVITY,
  CC_PRAYING_FOR_THE_DEAD_LIBRARY,
  CC_NOVEMBER_MONTH_OF_THE_HOLY_SOULS,
  CC_ENCHIRIDION_WORKS_AND_PRAYERS,
  INDULGENTIARUM_DOCTRINA,
];
const EMBER_DAYS_CITATIONS = [
  CC_EMBER_DAYS_DICTIONARY,
  CC_EMBER_DAY_PRAYERS,
  CC_CONTEMPORARY_OBSERVATION_OF_EMBER_DAYS,
];

export const devotionGroupTwo: CuratedEntry[] = [
  /* ----------------------------- Marian ----------------------------- */
  {
    contentType: "DEVOTION",
    slug: "the-angelus",
    authorityLevel: "USCCB",
    citations: ANGELUS_CITATIONS,
    payload: {
      slug: "the-angelus",
      title: "The Angelus",
      summary:
        "Three times a day the Angelus stops the day's work to recall the Annunciation: the angel's greeting, Mary's consent, and the Word made flesh who dwells among us.",
      background:
        "A private devotion of very old standing in the Latin Church, taken up in the home, the workplace and the parish rather than in the liturgy itself, and traditionally announced by the ringing of a bell at morning, midday and evening. The Directory on Popular Piety and the Liturgy commends it as a simple and biblical exercise of piety that sanctifies the hours of the day, and the Popes recite it publicly with the faithful at midday.",
      devotionType: "marian",
      subtype: "daily prayer",
      practiceInstructions:
        "Pray it at about six in the morning, at noon, and at about six in the evening. Take the three versicles in turn — the angel of the Lord declared unto Mary; behold the handmaid of the Lord; and the Word was made flesh — answering each with its response and praying a Hail Mary after each. Then say the versicle 'Pray for us, O holy Mother of God' with its response, and close with the collect asking that we who have known the incarnation of Christ by the message of an angel may be brought by his Passion and Cross to the glory of his resurrection. It takes about two minutes; where a bell is rung, let the bell rather than the clock call you to it.",
      durationMinutes: 3,
      relatedPrayers: ["angelus", "hail-mary", "glory-be"],
      relatedSaints: [],
      citations: ANGELUS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "regina-caeli-in-eastertide",
    authorityLevel: "USCCB",
    citations: REGINA_CAELI_CITATIONS,
    payload: {
      slug: "regina-caeli-in-eastertide",
      title: "The Regina Caeli in Eastertide",
      summary:
        "Through the fifty days of Easter the Church sets aside the Angelus and greets Our Lady with the Regina Caeli, asking the Mother who stood by the Cross to rejoice because her Son is risen as he said.",
      background:
        "A private devotion that follows the rhythm of the liturgical year: from Easter Sunday until Pentecost the Regina Caeli takes the place of the Angelus at morning, noon and evening. The antiphon itself belongs to the Church's public prayer, where it serves as the Marian antiphon of Compline during Eastertide; the devotional use of it through the day grew from that liturgical use.",
      devotionType: "marian",
      subtype: "daily prayer",
      practiceInstructions:
        "From Easter Sunday through Pentecost, pray the Regina Caeli in place of the Angelus at the same three hours. Say or sing the four acclamations — Queen of heaven, rejoice; for he whom you were worthy to bear has risen as he said; pray for us to God; rejoice and be glad, O Virgin Mary, for the Lord has truly risen — each answered with alleluia, and close with the prayer asking God, who gave joy to the world through the resurrection of his Son, that through Mary his Mother we may lay hold of the joys of eternal life. It is customary to stand rather than kneel, as the whole of Eastertide is prayed standing.",
      durationMinutes: 2,
      relatedPrayers: ["regina-caeli", "angelus", "salve-regina"],
      relatedSaints: [],
      citations: REGINA_CAELI_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "may-crowning-and-the-month-of-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: MAY_CROWNING_CITATIONS,
    payload: {
      slug: "may-crowning-and-the-month-of-mary",
      title: "May Crowning and the Month of Mary",
      summary:
        "May is kept as Our Lady's month, and its most familiar act is the crowning of her image with flowers by a parish or a family, a small ceremony that lets the whole household honour the Mother of God together.",
      background:
        "A popular devotion, not a rite of the liturgy: the custom of dedicating May to the Blessed Virgin took shape at the end of the Middle Ages, spread through the Jesuit colleges of Rome, and has been repeatedly recommended by the Popes. Because May falls inside the Easter season, the Directory on Popular Piety and the Liturgy asks that May devotions be harmonised with the paschal liturgy and never allowed to overshadow it.",
      devotionType: "marian",
      subtype: "seasonal observance",
      practiceInstructions:
        "Set a statue or image of Our Lady in a place of honour, in the church or on a table at home, with flowers and a candle. Make a wreath of fresh flowers to fit the image and let a child carry it forward and place it on Mary's head while the others bring flowers. Sing a Marian hymn, pray the Rosary or the Litany of Loreto, read a short passage of Scripture, and end with a prayer entrusting the family to her care. Through the rest of May keep a daily Marian prayer together — a decade of the Rosary, the Angelus or Regina Caeli, or the Memorare — remembering that during Eastertide the risen Christ, not the devotion itself, remains the centre.",
      durationMinutes: 20,
      relatedPrayers: [
        "hail-mary",
        "salve-regina",
        "memorare",
        "regina-caeli",
        "litany-of-the-blessed-virgin-mary",
      ],
      relatedSaints: [],
      citations: MAY_CROWNING_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "saturday-devotion-to-our-lady",
    authorityLevel: "VATICAN",
    citations: SATURDAY_DEVOTION_CITATIONS,
    payload: {
      slug: "saturday-devotion-to-our-lady",
      title: "Saturday Devotion to Our Lady",
      summary:
        "Saturday is the Blessed Virgin's day, kept in memory of the day her Son lay in the tomb and she alone held the faith of the Church intact while she waited for the resurrection.",
      background:
        "Here devotion and liturgy meet. The memorial of the Blessed Virgin Mary on Saturday is an option of the Roman Missal and Liturgy of the Hours, and Paul VI in Marialis Cultus traces it to the Carolingian period and commends it as an ancient and discreet remembrance. Around that liturgical observance a devotional custom has grown of giving Saturday to Mary in some particular way. It should not be confused with the Five First Saturdays, which is a distinct devotion of reparation with its own conditions.",
      devotionType: "marian",
      subtype: "weekly observance",
      practiceInstructions:
        "On Saturdays that are free of an obligatory memorial, feast or solemnity, ask your parish about the optional memorial of the Blessed Virgin Mary at Mass, or pray the Office of the Blessed Virgin from the Liturgy of the Hours. Where that is not possible, mark the day simply: pray the Rosary, the Salve Regina or the Sub tuum praesidium, renew your entrustment to Our Lady, and read the Gospel of Holy Saturday's silence. Keeping one small Marian practice every Saturday is worth more than an elaborate one kept once.",
      relatedPrayers: [
        "hail-mary",
        "salve-regina",
        "sub-tuum-praesidium",
        "memorare",
        "litany-of-the-blessed-virgin-mary",
      ],
      relatedSaints: [],
      citations: SATURDAY_DEVOTION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "little-office-of-the-blessed-virgin-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: LITTLE_OFFICE_CITATIONS,
    payload: {
      slug: "little-office-of-the-blessed-virgin-mary",
      title: "The Little Office of the Blessed Virgin Mary",
      summary:
        "A short, fixed office of psalms, hymns and antiphons in honour of Our Lady, built on the pattern of the Divine Office and made for those who want to pray the hours without the complexity of the full breviary.",
      background:
        "A devotional office rather than the Church's official public prayer. The first mention of it comes from the eleventh century, from the Camaldolese abbey of Fonte Avellana, and it was later taken up by monastic communities, by third orders and by lay confraternities, who bound themselves to recite it daily. The Liturgy of the Hours remains the public prayer of the Church; the Little Office is a devotion that imitates its shape, and the Directory on Popular Piety and the Liturgy commends such offices while asking that they lead the faithful towards the liturgy itself.",
      devotionType: "marian",
      subtype: "office",
      practiceInstructions:
        "Obtain an approved edition — the psalms, antiphons and hymns are fixed and short, and most editions print the whole office in one small volume. Pray the hours through the day as your state of life allows: Matins and Lauds in the morning, the little hours at their times, Vespers in the evening and Compline before sleep. If the whole office is too much, begin with Lauds and Vespers alone and add the others as the habit settles. Beginners should not treat it as a substitute for the Liturgy of the Hours, but as a devotion that trains the ear for it.",
      relatedPrayers: ["salve-regina", "magnificat", "nunc-dimittis", "sub-tuum-praesidium"],
      relatedSaints: [],
      citations: LITTLE_OFFICE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "consecration-to-the-immaculate-heart-of-mary",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: IMMACULATE_HEART_CONSECRATION_CITATIONS,
    payload: {
      slug: "consecration-to-the-immaculate-heart-of-mary",
      title: "Consecration to the Immaculate Heart of Mary",
      summary:
        "An act by which a person, a family or the whole world is entrusted to the Heart of the Mother of God, so that she may keep what is given her and hand it over to her Son.",
      background:
        "A devotional act, made both by Popes and by individual faithful. Pius XII consecrated the Church and the world to the Immaculate Heart in a radio message to Portugal on 31 October 1942 and repeated the act at Rome on 8 December of that year; John Paul II made his act of entrustment on 25 March 1984 in union with the bishops of the world. Personal consecration to Mary is not worship offered to her — worship belongs to God alone — but the handing over of oneself to her intercession and care, so that she may lead the one consecrated more surely to Christ.",
      devotionType: "marian",
      subtype: "act of consecration",
      practiceInstructions:
        "Prepare by going to confession and, where possible, by receiving Holy Communion on the day of the act. Choose a Marian feast — the Immaculate Conception on 8 December, the Immaculate Heart on the Saturday after the Solemnity of the Sacred Heart, or the Assumption on 15 August. Kneel before an image of Our Lady and read the act of consecration aloud, slowly and deliberately, naming what you are entrusting to her: your body and soul, your family, your work. Renew the act each year on the same day, and keep it alive between times by a daily Marian prayer.",
      relatedPrayers: [
        "hail-mary",
        "memorare",
        "sub-tuum-praesidium",
        "fatima-prayer",
        "act-of-consecration-to-mary-de-montfort",
      ],
      relatedSaints: [],
      citations: IMMACULATE_HEART_CONSECRATION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "confraternity-of-the-most-holy-rosary",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: ROSARY_CONFRATERNITY_CITATIONS,
    payload: {
      slug: "confraternity-of-the-most-holy-rosary",
      title: "The Confraternity of the Most Holy Rosary",
      summary:
        "A worldwide association under the care of the Dominican Order whose members bind themselves to pray the Rosary regularly and share in one another's prayers and good works.",
      background:
        "A confraternity of the Order of Preachers, not a private devotion invented at will: members are enrolled by name in a register kept by the Order, and the confraternity has long been encouraged by the Popes as a school of Marian prayer. The traditional undertaking is to pray the full traditional cycle of the mysteries in the course of each week; it is an undertaking of love, and, as the Order has always taught, it does not bind under sin.",
      devotionType: "marian",
      subtype: "confraternity",
      practiceInstructions:
        "Ask a Dominican house or a parish affiliated with the Order to enrol you; enrolment is free and is recorded in the confraternity register. Then keep the undertaking: pray the mysteries of the Rosary through the week — one set of five each day covers it easily — meditating on each mystery rather than only counting the beads. Members are encouraged to pray for the other members, living and dead, and for the intentions of the whole confraternity, and to keep the feast of Our Lady of the Rosary on 7 October.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "salve-regina", "apostles-creed"],
      relatedSaints: ["saint-dominic"],
      citations: ROSARY_CONFRATERNITY_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "month-of-the-holy-rosary",
    authorityLevel: "VATICAN",
    citations: MONTH_OF_THE_ROSARY_CITATIONS,
    payload: {
      slug: "month-of-the-holy-rosary",
      title: "October, Month of the Holy Rosary",
      summary:
        "October is given over to the Rosary, gathered around the feast of Our Lady of the Rosary on the seventh of the month, when parishes and families take up the beads together for the whole of the month.",
      background:
        "A popular devotion long recommended by the Popes, who have repeatedly urged the daily Rosary during October. John Paul II devoted the apostolic letter Rosarium Virginis Mariae to it in 2002, proposing the Mysteries of Light and insisting that the Rosary is a contemplation of the face of Christ in the company of his Mother. The Directory on Popular Piety and the Liturgy asks that October devotions be arranged so that they lead to the liturgy rather than compete with it.",
      devotionType: "marian",
      subtype: "seasonal observance",
      practiceInstructions:
        "Pray five decades every day through October, alone or with the household, keeping the customary distribution of the mysteries: the Joyful on Monday and Saturday, the Sorrowful on Tuesday and Friday, the Glorious on Wednesday and Sunday, and the Luminous on Thursday. Announce each mystery aloud, pause long enough to picture the scene, and only then begin the Our Father and the ten Hail Marys. Keep the feast of Our Lady of the Rosary on 7 October at Mass if you can, and let the month end with a renewed intention to keep the Rosary going through the year.",
      durationMinutes: 20,
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "salve-regina", "fatima-prayer"],
      relatedSaints: [],
      citations: MONTH_OF_THE_ROSARY_CITATIONS,
    },
  },

  /* ---------------------- Passion and Christ ------------------------ */
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-five-wounds",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: FIVE_WOUNDS_CITATIONS,
    payload: {
      slug: "devotion-to-the-five-wounds",
      title: "Devotion to the Five Wounds of Christ",
      summary:
        "A devotion to the Passion that dwells on the five wounds of the risen Christ — in his hands, his feet and his pierced side — as the marks by which the disciples knew him and by which we are healed.",
      background:
        "A private devotion to the Passion, dear to many of the saints, and in some countries attached to a feast of the Five Wounds kept on the fourth Friday of Lent. Among its best-known forms is the litany of the sacred wounds associated with St Clare of Assisi, approved by the Holy See for private use and enriched by Leo XIII in 1885 with an indulgence of three hundred days, once a day — a grant made under the older system of days, which Paul VI's reform of 1967 replaced with the present partial and plenary indulgences.",
      devotionType: "passion",
      subtype: "passion devotion",
      practiceInstructions:
        "Kneel before a crucifix, ideally on a Friday or during Lent. Take the wounds one at a time — the right hand, the left hand, the right foot, the left foot, the side — and at each one read the Gospel verse that names it, ask for one grace, and rest there in silence for a moment before moving on. Many pray five Our Fathers, five Hail Marys and a Glory Be with the wounds, or use the litany of the sacred wounds where an approved text is at hand. Close with the prayer before a crucifix.",
      durationMinutes: 15,
      relatedPrayers: [
        "prayer-before-a-crucifix",
        "anima-christi",
        "our-father",
        "hail-mary",
        "glory-be",
      ],
      relatedSaints: ["saint-clare-of-assisi", "saint-francis-of-assisi"],
      citations: FIVE_WOUNDS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-precious-blood",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: PRECIOUS_BLOOD_CITATIONS,
    payload: {
      slug: "devotion-to-the-precious-blood",
      title: "Devotion to the Most Precious Blood",
      summary:
        "July is kept as the month of the Precious Blood, honouring the price paid for our redemption and poured out still in the chalice at every Mass.",
      background:
        "A popular devotion as old as Christian reflection on the Passion, given a liturgical shape when Pius IX, in exile at Gaeta in 1849, extended the feast of the Most Precious Blood to the whole Church. It was carried through the nineteenth century above all by St Gaspar del Bufalo and the Missionaries of the Precious Blood he founded. The separate feast was removed in the reform of the calendar, its content taken up into the Solemnity of the Most Holy Body and Blood of Christ, and the devotion continues through the month of July. The Litany of the Most Precious Blood was drawn up by the Sacred Congregation of Rites and promulgated by John XXIII on 24 February 1960.",
      devotionType: "passion",
      subtype: "monthly observance",
      practiceInstructions:
        "Through July, pray the Litany of the Most Precious Blood once a day from an approved text, or, if that is too long, make the seven offerings of the Blood of Christ for the Church, for sinners, for the dying, for the holy souls, for your family, for your enemies and for yourself. Offer the Precious Blood at the elevation of the chalice at Mass. Meditation on the Agony in the Garden and on the piercing of the side of Christ belongs naturally to this month, as does a decade of the Sorrowful Mysteries each day.",
      relatedPrayers: ["anima-christi", "prayer-before-a-crucifix", "divine-praises"],
      relatedSaints: [],
      citations: PRECIOUS_BLOOD_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-holy-name-of-jesus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: HOLY_NAME_CITATIONS,
    payload: {
      slug: "devotion-to-the-holy-name-of-jesus",
      title: "Devotion to the Holy Name of Jesus",
      summary:
        "Reverence for the name at which every knee should bow — honouring it, invoking it in temptation, and making reparation for the blasphemy and casual profanity that surround us.",
      background:
        "Both a liturgical observance and a devotional one. The feast of the Holy Name was instituted by Innocent XIII in 1721, removed from the calendar in the reform of 1969, and restored by John Paul II; it is now kept as an optional memorial on 3 January, and January is honoured as the month of the Holy Name. The devotion was carried for centuries by the Holy Name Society, first organised in 1274 and given the status of a confraternity in 1564, whose purpose is reverence for the name of Jesus, reparation for blasphemy, and the sanctification of its members. A Litany of the Holy Name was approved by Pius IX in 1862 and commended to the whole Church by Leo XIII; it is one of the few litanies approved for public as well as private use.",
      devotionType: "christological",
      subtype: "reparation",
      practiceInstructions:
        "Bow the head whenever the name of Jesus is spoken, at Mass and outside it — the gesture is a small act of faith and costs nothing. When you hear the name taken in vain, answer it silently with 'Blessed be the name of Jesus' rather than with an argument. Pray the Litany of the Holy Name from an approved text through January, or on the memorial of the Holy Name on 3 January. Use the name itself as a prayer in temptation, weariness or fear: repeat it slowly with each breath, asking nothing else.",
      relatedPrayers: ["divine-praises", "anima-christi", "our-father"],
      relatedSaints: ["saint-bernardine-of-siena", "saint-paul"],
      citations: HOLY_NAME_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "divine-mercy-sunday-observance",
    authorityLevel: "VATICAN",
    citations: DIVINE_MERCY_SUNDAY_CITATIONS,
    payload: {
      slug: "divine-mercy-sunday-observance",
      title: "Divine Mercy Sunday",
      summary:
        "The Second Sunday of Easter is kept as Divine Mercy Sunday, the day the Church sets aside to receive the mercy that flowed from the pierced side of the risen Christ.",
      background:
        "Here liturgy and devotion are joined. John Paul II established the Second Sunday of Easter as Divine Mercy Sunday for the universal Church at the canonisation of St Faustina Kowalska on 30 April 2000; the day is the octave day of Easter and its Gospel is the appearance of the risen Lord to the apostles with Thomas. The devotional practices connected with it — the image of the Merciful Jesus, the chaplet, the hour of great mercy — come from the spiritual writings of St Faustina, and the Apostolic Penitentiary attached an indulgence to the devout observance of the day by a decree of 29 June 2002.",
      devotionType: "christological",
      subtype: "feast observance",
      practiceInstructions:
        "Go to sacramental confession in the days before or after the Sunday and receive Holy Communion on the day itself, and pray for the intentions of the Holy Father — the ordinary conditions for a plenary indulgence, which also require that the heart be wholly detached from affection for sin. Take part in the prayers and devotions held in honour of Divine Mercy in a church or chapel; where none are held, pray the Our Father and the Creed before the Blessed Sacrament exposed or reserved, adding a devout invocation of the merciful Lord Jesus such as 'Merciful Jesus, I trust in you.' Many keep the Chaplet of Divine Mercy through the nine days from Good Friday as a preparation, and pray at three in the afternoon, the hour of the Lord's death.",
      relatedPrayers: ["our-father", "apostles-creed", "divine-mercy-chaplet-prayers"],
      relatedSaints: ["saint-faustina-kowalska", "saint-john-paul-ii"],
      indulgences: DIVINE_MERCY_INDULGENCE,
      citations: DIVINE_MERCY_SUNDAY_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "veneration-of-the-cross-on-good-friday",
    authorityLevel: "LITURGICAL_BOOK",
    citations: VENERATION_OF_THE_CROSS_CITATIONS,
    payload: {
      slug: "veneration-of-the-cross-on-good-friday",
      title: "Veneration of the Cross on Good Friday",
      summary:
        "On the one day of the year when no Mass is offered, the Church shows the wood of the Cross to the assembly and everyone present comes forward, one by one, to honour it.",
      background:
        "This is not a private devotion but an act of the Church's public worship: the second part of the Celebration of the Passion of the Lord on Good Friday, standing between the Liturgy of the Word and Holy Communion in the Roman Missal. The Cross is shown in three stages with the acclamation 'Behold the wood of the Cross, on which hung the Salvation of the world', answered by 'Come, let us adore'; the Reproaches and other chants accompany the procession of the faithful. The Missal directs that a single Cross be used for the veneration, so that the sign is not divided.",
      devotionType: "liturgical",
      subtype: "Holy Week",
      practiceInstructions:
        "Come to the Celebration of the Passion in your parish on Good Friday afternoon, and plan to stay for the whole of it. When the Cross has been unveiled and shown, join the procession and make the act of veneration your parish uses — a genuflection, a kiss, a bow or a touch — without hurrying, and let the gesture be the prayer. If the assembly is very large the priest may hold up the Cross for a common veneration instead; make the act with the same deliberateness from where you stand. Keep the fast and abstinence of the day, and let the silence after the liturgy stand rather than filling it.",
      relatedPrayers: ["prayer-before-a-crucifix", "anima-christi"],
      relatedSaints: ["saint-helena"],
      citations: VENERATION_OF_THE_CROSS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-santo-nino",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: SANTO_NINO_CITATIONS,
    payload: {
      slug: "devotion-to-the-santo-nino",
      title: "Devotion to the Santo Niño, the Holy Child Jesus",
      summary:
        "The devotion to the Child Jesus that came to the Philippines with the Gospel itself, and that still gathers whole cities around the image of the Holy Child each January.",
      background:
        "A popular devotion of the Filipino people, bound up with the beginning of Christianity in the islands: the image of the Holy Child accompanied the first preaching of the Gospel there, and on 1 January 1571 the village kingdom of Sugbu was renamed Villa del Santo Niño, placing the first city of the Philippines under the Child Jesus' patronage. Paul VI recalled that history in his radio message for the fourth centenary of the evangelisation of the Philippines, and Pope Francis preached on the Santo Niño at Rizal Park in Manila in 2015. The devotion is celebrated in the Philippines and among Filipinos everywhere with the feast of the Santo Niño in January.",
      devotionType: "christological",
      subtype: "popular devotion",
      practiceInstructions:
        "Keep an image of the Holy Child in a place of honour in the home, with a candle and flowers, and pray before it as a family — morning and evening prayers said in front of it are enough. Make the novena to the Santo Niño in the nine days before the feast in January, and take part in the parish Mass and procession where one is held. The devotion is meant to school the household in the childhood of Christ: read the infancy narratives of Luke and Matthew together during the novena, and ask for the simplicity and obedience of the Child rather than only for favours.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be"],
      relatedSaints: ["saint-lorenzo-ruiz", "saint-joseph"],
      citations: SANTO_NINO_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "act-of-dedication-of-the-human-race-to-christ-the-king",
    authorityLevel: "VATICAN",
    citations: CHRIST_THE_KING_CITATIONS,
    payload: {
      slug: "act-of-dedication-of-the-human-race-to-christ-the-king",
      title: "Act of Dedication of the Human Race to Christ the King",
      summary:
        "On the last Sunday of the liturgical year the Church offers the whole human race to Christ the King in the prayer that begins 'Iesu dulcissime, Redemptor' — Most sweet Jesus, Redeemer of the human race.",
      background:
        "A devotional act attached to a liturgical solemnity. Pius XI instituted the feast of Christ the King in the encyclical Quas Primas in 1925 to answer the exclusion of Christ from public life, and directed that the act of dedication of the human race be renewed on that day each year. The act is prayed publicly in parishes on the Solemnity of Our Lord Jesus Christ, King of the Universe, and privately at other times.",
      devotionType: "christological",
      subtype: "act of consecration",
      practiceInstructions:
        "On the Solemnity of Christ the King, pray the act publicly — in most parishes it follows the homily or comes after Mass, often before the Blessed Sacrament exposed. Read it aloud with the assembly rather than silently: it names the whole human race, those who have never known Christ and those who have left him, and asks that all be gathered into his Kingdom. To gain the plenary indulgence attached to its public recitation on that day, go to sacramental confession, receive Holy Communion and pray for the intentions of the Holy Father, with the heart detached from affection for sin.",
      relatedPrayers: ["divine-praises", "litany-of-the-sacred-heart-of-jesus", "te-deum"],
      relatedSaints: [],
      indulgences: CHRIST_THE_KING_INDULGENCE,
      citations: CHRIST_THE_KING_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "month-of-the-sacred-heart",
    authorityLevel: "VATICAN",
    citations: MONTH_OF_THE_SACRED_HEART_CITATIONS,
    payload: {
      slug: "month-of-the-sacred-heart",
      title: "June, Month of the Sacred Heart",
      summary:
        "June is given to the Heart of Jesus, the month in which the Solemnity of the Sacred Heart falls and in which the Church makes reparation for the love that is not returned.",
      background:
        "A popular devotion gathered around a liturgical solemnity kept on the Friday after the second Sunday after Pentecost. Pius XII gave the devotion its fullest magisterial exposition in the encyclical Haurietis Aquas of 1956, teaching that what is honoured is the physical Heart of Christ as the sign of the whole love — human and divine — with which he loved us. The Directory on Popular Piety and the Liturgy asks that the devotions of the month be kept in harmony with the liturgy of the season, in which the Sacred Heart, Corpus Christi and the Immaculate Heart follow closely on one another.",
      devotionType: "christological",
      subtype: "monthly observance",
      practiceInstructions:
        "Through June, pray the Litany of the Sacred Heart each day, alone or with the family, and begin each morning with the Morning Offering, which places the day's prayers, works, joys and sufferings in the Heart of Jesus. Keep the Solemnity of the Sacred Heart at Mass. If your household has an image of the Sacred Heart, put it in a place of honour with a light before it for the month. Add one concrete act of reparation — a visit to the Blessed Sacrament, an hour given to someone who is alone — rather than only more words.",
      relatedPrayers: [
        "litany-of-the-sacred-heart-of-jesus",
        "morning-offering",
        "anima-christi",
        "act-of-love",
      ],
      relatedSaints: ["saint-margaret-mary-alacoque", "saint-john-vianney"],
      citations: MONTH_OF_THE_SACRED_HEART_CITATIONS,
    },
  },

  /* ------------------------ Saints and angels ----------------------- */
  {
    contentType: "DEVOTION",
    slug: "devotion-to-saint-michael-the-archangel",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ST_MICHAEL_CITATIONS,
    payload: {
      slug: "devotion-to-saint-michael-the-archangel",
      title: "Devotion to Saint Michael the Archangel",
      summary:
        "The Church invokes St Michael as the prince of the heavenly host and defender of the People of God, above all in the prayer of Leo XIII asking his protection in the daily battle against evil.",
      background:
        "A private devotion resting on Scripture — Michael appears in Daniel, in the Letter of Jude and in the Book of Revelation — and honoured in the liturgy at the feast of Saints Michael, Gabriel and Raphael on 29 September. Leo XIII composed the familiar prayer and prescribed it in 1886 among the Leonine prayers said after Low Mass; those prayers were abolished in 1964, and the prayer to St Michael is now said by custom after Mass in many parishes, or privately, at the invitation of pastors rather than by law.",
      devotionType: "angelic",
      subtype: "protection",
      practiceInstructions:
        "Pray the prayer to St Michael daily — after Mass where the parish keeps that custom, or at the end of your own morning or night prayers. Say it deliberately: it asks God to rebuke the evil one, and it is God, not the archangel, who does the rebuking. Keep the feast of the Archangels on 29 September, and turn to St Michael particularly in temptation, in danger, and at the hour of death, for which the Church has long invoked him.",
      durationMinutes: 2,
      relatedPrayers: ["prayer-to-saint-michael", "salve-regina", "hail-mary"],
      relatedSaints: [],
      citations: ST_MICHAEL_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-guardian-angels",
    authorityLevel: "VATICAN",
    citations: GUARDIAN_ANGELS_CITATIONS,
    payload: {
      slug: "devotion-to-the-guardian-angels",
      title: "Devotion to the Guardian Angels",
      summary:
        "The Church teaches that each person is entrusted to an angel who watches over him and helps him towards salvation; the devotion is simply the habit of living gratefully in that company.",
      background:
        "A private devotion resting on the Church's constant faith, honoured in the liturgy by the memorial of the Holy Guardian Angels on 2 October. Its most common form is the short prayer Angele Dei, 'Angel of God, my guardian dear', said by families at morning and evening prayers and often joined to the Angelus. The Directory on Popular Piety and the Liturgy commends devotion to the angels while warning against idle curiosity about them — inventing names for them, or treating them as figures to be consulted — since their whole ministry is to serve God and lead us to him.",
      devotionType: "angelic",
      subtype: "daily prayer",
      practiceInstructions:
        "Pray the Angel of God prayer morning and evening, and teach it to children as one of the first prayers they learn by heart. Ask your guardian angel for help before a difficult conversation, a journey, or a decision, and thank him at the end of the day when you examine your conscience. Keep the memorial of the Holy Guardian Angels on 2 October. Keep the devotion sober: honour the angel, but address your worship to God alone.",
      durationMinutes: 2,
      relatedPrayers: ["guardian-angel-prayer", "angelus", "morning-offering"],
      relatedSaints: [],
      citations: GUARDIAN_ANGELS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "saint-anthonys-bread",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ST_ANTHONYS_BREAD_CITATIONS,
    payload: {
      slug: "saint-anthonys-bread",
      title: "Saint Anthony's Bread",
      summary:
        "A custom of giving alms for the poor — the price of bread — in thanksgiving for a favour asked through the intercession of St Anthony of Padua, so that gratitude turns immediately into charity.",
      background:
        "A private devotion that grew from the saint's own care for the poor at Padua. The name in its modern form goes back to Louise Bouffier, a shopkeeper at Toulon in 1890, who promised bread for the poor if St Anthony would help her open a lock that would not turn; the alms boxes marked 'St Anthony's Bread' in parish churches descend from that promise. The blessing of bread in honour of St Anthony is provided in the Church's book of blessings and is commonly given on his feast, 13 June.",
      devotionType: "saintly",
      subtype: "almsgiving",
      practiceInstructions:
        "When you ask St Anthony's intercession, promise something definite for the poor — the price of a loaf, a week's groceries, an offering to the parish food pantry — and give it whether or not you receive what you asked for. Many parishes keep an alms box for St Anthony's Bread; where yours does not, give directly to those who feed the hungry. On his feast, 13 June, bring bread to be blessed if your parish offers the blessing, and share it at the family table. Some keep the older custom of praying to St Anthony on thirteen consecutive Tuesdays leading up to the feast.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be"],
      relatedSaints: ["saint-anthony-of-padua"],
      citations: ST_ANTHONYS_BREAD_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-saint-jude",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ST_JUDE_CITATIONS,
    payload: {
      slug: "devotion-to-saint-jude",
      title: "Devotion to Saint Jude",
      summary:
        "St Jude Thaddeus, one of the Twelve, is invoked by the faithful in desperate situations and hopeless cases, when every human remedy has been tried and nothing is left but prayer.",
      background:
        "A private devotion to an apostle whose feast the Church keeps with St Simon on 28 October. His reputation as the patron of causes that seem lost is a matter of Christian custom rather than of doctrine, and it grew steadily as the faithful found their prayers through him answered; the novena to St Jude spread widely in the twentieth century through shrines dedicated to him. The Church does not promise that any devotion will obtain a particular outcome: what is asked for is God's help, sought through the intercession of a friend of God.",
      devotionType: "saintly",
      subtype: "intercession",
      practiceInstructions:
        "Bring the situation itself into the prayer rather than leaving it vague. Pray the novena to St Jude — nine consecutive days, using an approved text, each day with an Our Father, Hail Mary and Glory Be — and if you can, go to confession and receive Holy Communion during those days, since the sacraments, not the novena, are where God's help chiefly comes. Ask for what you need plainly, and add the petition that God's will be done in the matter. Keep his feast on 28 October, and when the prayer is answered, say so to someone.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "memorare"],
      relatedSaints: ["saint-jude-thaddeus", "saints-philip-and-james"],
      citations: ST_JUDE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-saint-rita-of-cascia",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ST_RITA_CITATIONS,
    payload: {
      slug: "devotion-to-saint-rita-of-cascia",
      title: "Devotion to Saint Rita of Cascia",
      summary:
        "St Rita — wife, mother, widow and Augustinian nun — is turned to by those in painful marriages, in bereavement, and in situations that look impossible, and her devotion is marked everywhere by roses.",
      background:
        "A private devotion to a saint of Cascia in Umbria who bore a difficult marriage, lost her husband and sons to violence and vendetta, and was received at last into the Augustinian monastery of her town, where she received a wound from the crown of thorns. The roses that mark her devotion come from the account of her final illness, when she asked for a rose from the garden at Roccaporena and one was found in bloom out of season; roses are blessed in her honour on her feast, 22 May.",
      devotionType: "saintly",
      subtype: "intercession",
      practiceInstructions:
        "Keep her feast on 22 May, and where roses are blessed in her honour, bring one and afterwards give it to someone carrying the kind of burden she carried. Pray to her in a particular difficulty — a marriage under strain, a family divided by an old wrong, an illness that will not lift — and ask, as she did, for the grace to forgive before asking for the situation to change. A novena of nine days before her feast, with an Our Father, Hail Mary and Glory Be each day and one act of forgiveness or reconciliation attempted, is the plainest form of the devotion.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "prayer-of-saint-francis"],
      relatedSaints: ["saint-rita-of-cascia", "saint-augustine-of-hippo"],
      citations: ST_RITA_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-saint-peregrine-for-the-sick",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: ST_PEREGRINE_CITATIONS,
    payload: {
      slug: "devotion-to-saint-peregrine-for-the-sick",
      title: "Devotion to Saint Peregrine for the Sick",
      summary:
        "St Peregrine Laziosi, a Servite friar cured of a cancer of the foot on the eve of its amputation, is invoked by those who carry cancer and other grave illness, and by those who care for them.",
      background:
        "A devotion of the Order of the Servants of Mary, to which St Peregrine belonged, and which keeps his memory and his shrines. He endured his illness in union with Christ crucified and was healed, living some twenty further years and dying at a great age. The devotion is not a promise of cure: it asks the intercession of a saint who knew the fear and the pain from the inside, and it is regularly joined in parishes to the Anointing of the Sick, which is the sacrament the Church gives the seriously ill.",
      devotionType: "saintly",
      subtype: "healing",
      practiceInstructions:
        "Pray the novena to St Peregrine — nine days, using an approved text — for yourself or for someone who is ill, naming the person and the illness aloud. Where a parish or Servite church holds a St Peregrine Mass with a blessing of the sick, bring the person there; and if the illness is serious, ask the priest for the Anointing of the Sick, which is not a last rite reserved for the dying but the Church's sacrament for the gravely ill. Keep the prayer honest: ask for healing, and ask for the endurance the saint himself was given if healing does not come.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "memorare", "anima-christi"],
      relatedSaints: [],
      citations: ST_PEREGRINE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "devotion-to-the-holy-family",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: HOLY_FAMILY_CITATIONS,
    payload: {
      slug: "devotion-to-the-holy-family",
      title: "Devotion to the Holy Family of Nazareth",
      summary:
        "The household of Jesus, Mary and Joseph is set before Christian families as the model of domestic life, and the devotion consists mainly in learning to pray and live as they did.",
      background:
        "A popular devotion attached to the feast of the Holy Family, kept on the Sunday within the octave of Christmas, with February traditionally honoured as the month of the Holy Family because the Presentation in the Temple falls on the second of the month. The Directory on Popular Piety and the Liturgy encourages devotions that strengthen the family as the domestic church — common prayer, the blessing of the home, the Christian celebration of its feasts — and this devotion is chiefly practised in the home rather than in church.",
      devotionType: "saintly",
      subtype: "family devotion",
      practiceInstructions:
        "Pray together as a household every day, even briefly: grace at meals, a decade of the Rosary in the evening, night prayers with the children. Put an image of the Holy Family where the family gathers. On the feast of the Holy Family, or on a family anniversary, make an act of consecration of the household to Jesus, Mary and Joseph, and ask the priest to bless your home. The novena to the Holy Family in the days before the feast, or through February, gives the devotion a shape; but the substance of it is the ordinary work, patience and forgiveness of Nazareth.",
      relatedPrayers: [
        "grace-before-meals",
        "grace-after-meals",
        "hail-mary",
        "litany-of-saint-joseph",
        "prayer-to-saint-joseph",
      ],
      relatedSaints: ["saint-joseph", "saint-anne"],
      citations: HOLY_FAMILY_CITATIONS,
    },
  },

  /* -------------------- Penitential and seasonal -------------------- */
  {
    contentType: "DEVOTION",
    slug: "friday-penance-and-abstinence",
    authorityLevel: "USCCB",
    citations: FRIDAY_PENANCE_CITATIONS,
    payload: {
      slug: "friday-penance-and-abstinence",
      title: "Friday Penance and Abstinence",
      summary:
        "Every Friday of the year is a day of penance in the Church, kept in memory of the day the Lord died, most often by abstaining from meat or by another deliberate act of self-denial.",
      background:
        "This is Church law before it is a devotion. Paul VI restored and set out the discipline of penance for the whole Church in the apostolic constitution Paenitemini in 1966, and the Code of Canon Law makes all Fridays of the year, and the season of Lent, days of penance. In the United States the bishops' Pastoral Statement on Penance and Abstinence, also of 1966, keeps abstinence from meat obligatory on the Fridays of Lent while allowing another form of penance to be substituted on the Fridays outside Lent — a permission that presumes some penance is in fact done, not that Friday becomes an ordinary day.",
      devotionType: "general",
      subtype: "penance",
      practiceInstructions:
        "Decide in advance what your Friday penance will be, so that the day does not pass unmarked. Abstinence from meat is the traditional form and remains obligatory on the Fridays of Lent for those aged fourteen and older; outside Lent, in the United States, you may keep it or substitute another penance — a fast from something you would otherwise enjoy, a work of mercy, extra time in prayer or the Stations of the Cross. Do not treat a costly seafood dinner as abstinence in any meaningful sense. Ash Wednesday and Good Friday remain days of both fast and abstinence.",
      relatedPrayers: [
        "act-of-contrition",
        "confiteor",
        "de-profundis",
        "prayer-before-a-crucifix",
      ],
      relatedSaints: [],
      citations: FRIDAY_PENANCE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "lenten-fasting-and-almsgiving",
    authorityLevel: "USCCB",
    citations: LENTEN_PENANCE_CITATIONS,
    payload: {
      slug: "lenten-fasting-and-almsgiving",
      title: "Lenten Fasting and Almsgiving",
      summary:
        "Lent is kept by the three works the Lord names in the Gospel of Ash Wednesday — prayer, fasting and almsgiving — bound together so that what is denied to the body is given to the poor.",
      background:
        "Church discipline and popular practice together. Paenitemini and the Code of Canon Law make the whole of Lent a penitential season; Ash Wednesday and Good Friday are days of both fasting and abstinence, and the Fridays of Lent are days of abstinence from meat. The rules bind those of a certain age — abstinence from fourteen, fasting from the completion of the eighteenth year until the beginning of the sixtieth — but the season is asked of everyone, and the customary Lenten sacrifices taken up voluntarily belong to popular piety rather than to law.",
      devotionType: "general",
      subtype: "penance",
      practiceInstructions:
        "On Ash Wednesday and Good Friday keep the fast: one full meal, with two smaller meals that together do not equal a full one, and nothing between meals; abstain from meat on those days and on the Fridays of Lent. Choose one thing to give up for the whole season and one thing to take up, and let the two be connected — set aside the money not spent on what you gave up and give it away before Easter. Add a daily practice you can actually keep: ten minutes of Scripture, the Stations of the Cross on Fridays, or the Seven Penitential Psalms. Go to confession during the season. Those excused from fasting by age, illness, pregnancy or hard labour should keep the season by prayer and charity instead.",
      relatedPrayers: [
        "act-of-contrition",
        "confiteor",
        "de-profundis",
        "prayer-of-saint-francis",
        "our-father",
      ],
      relatedSaints: [],
      citations: LENTEN_PENANCE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "advent-wreath",
    authorityLevel: "USCCB",
    citations: ADVENT_WREATH_CITATIONS,
    payload: {
      slug: "advent-wreath",
      title: "The Advent Wreath",
      summary:
        "A circle of evergreen holding four candles, lit one by one through the four weeks of Advent, so that the growing light on the family table measures the approach of Christmas.",
      background:
        "A devotion of the domestic church that has also found a place in parish churches. The wreath is blessed on the First Sunday of Advent or on the evening before; the United States bishops provide the blessing for use in the home, where it is fitting that a parent or another member of the family give it. Three candles are violet and one rose, the rose candle being lit on the Third Sunday, Gaudete Sunday. The Directory on Popular Piety and the Liturgy commends such Advent customs as helping families enter the season, provided they serve the liturgy of Advent rather than anticipate Christmas.",
      devotionType: "general",
      subtype: "Advent",
      practiceInstructions:
        "Make or buy a wreath of evergreen with four candles — three violet and one rose. On the First Sunday of Advent, or the evening before, gather the household, make the Sign of the Cross, read a short passage from Isaiah, and pray the blessing over the wreath; then light the first candle. Each evening afterwards, light the candles for the week at the family meal, with a Scripture verse and a short prayer, adding one candle each Sunday and the rose candle on the Third Sunday. Keep the wreath unlit and undecorated for Christmas itself: at Christmas the crib, not the wreath, takes the centre.",
      durationMinutes: 10,
      relatedPrayers: [
        "grace-before-meals",
        "our-father",
        "hail-mary",
        "benedictus-canticle-of-zechariah",
      ],
      relatedSaints: [],
      citations: ADVENT_WREATH_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "jesse-tree",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: JESSE_TREE_CITATIONS,
    payload: {
      slug: "jesse-tree",
      title: "The Jesse Tree",
      summary:
        "An Advent tree hung with one symbol each day, tracing the ancestry of Christ from creation through the patriarchs and prophets to the shoot that springs from the stump of Jesse.",
      background:
        "A domestic Advent custom of recent date — it took its present form in the twentieth century — drawing on the medieval art of the Jesse tree and the mystery plays' Tree of Life, and taking its name from Isaiah's prophecy that a shoot shall sprout from the stump of Jesse. It is a teaching devotion above all, meant to set the coming of Christ inside the whole history of salvation, and it belongs to the home rather than to the liturgy.",
      devotionType: "general",
      subtype: "Advent",
      practiceInstructions:
        "Use a small evergreen, a bare branch set in a pot, or a felt or paper hanging. Prepare one symbol for each day of Advent, drawn from the genealogy of Christ and from the key figures of salvation history — creation, Noah's ark, Abraham, Jacob's ladder, Moses, David's harp, Isaiah's tongs, and so on to Mary and Joseph. Each evening gather the household, hang the day's symbol, read the Scripture passage it stands for, say what it has to do with Christ, and close with a short prayer or an Advent hymn. Keep it brief enough that children can attend to it all the way to Christmas.",
      durationMinutes: 10,
      relatedPrayers: [
        "our-father",
        "magnificat",
        "benedictus-canticle-of-zechariah",
        "o-antiphons",
      ],
      relatedSaints: [],
      citations: JESSE_TREE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "las-posadas",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: LAS_POSADAS_CITATIONS,
    payload: {
      slug: "las-posadas",
      title: "Las Posadas",
      summary:
        "A Christmas novena acted out over nine nights, in which a procession carrying images of Mary and Joseph goes from house to house asking for lodging and is turned away until the last night.",
      background:
        "A popular devotion of Mexican origin, kept in Mexico and throughout Latin America and among Latino Catholics elsewhere. It is a Christmas novena in dramatic form, beginning on 16 December: nine homes or families of the neighbourhood are chosen in advance to be the posadas, the inns. Like the crib and the Christmas play, it belongs to popular piety and prepares the household for the liturgy of the Nativity rather than replacing it.",
      devotionType: "general",
      subtype: "Christmas novena",
      practiceInstructions:
        "Arrange nine households in advance, one for each night from 16 to 24 December. Each evening the pilgrims form a procession with candles, carrying images of Mary and Joseph, and sing the traditional dialogue at the door of that night's house asking for lodging. On the first eight nights the household sings back that there is no room; the pilgrims are then let in to pass through the house singing, and the evening ends with prayer, a decade of the Rosary and refreshments. On the ninth night, Christmas Eve, the procession is admitted for good, to a room where the crib has been prepared, and the Child is laid in the manger before all go to the Mass of Christmas.",
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "magnificat"],
      relatedSaints: ["saint-joseph"],
      citations: LAS_POSADAS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "november-visits-for-the-holy-souls",
    authorityLevel: "VATICAN",
    citations: HOLY_SOULS_CITATIONS,
    payload: {
      slug: "november-visits-for-the-holy-souls",
      title: "November Visits for the Holy Souls",
      summary:
        "In the first days of November the faithful go to the cemeteries and to their parish churches to pray for the dead, and the Church attaches to those visits an indulgence that can be given only to the souls in purgatory.",
      background:
        "A devotional practice bound to the liturgy of All Saints and of the Commemoration of All the Faithful Departed on 2 November, and to November as the month of the holy souls. What is done is very simple — a visit, a prayer for the dead — but the Church's grant is precise: the plenary indulgence gained in these days may be applied only to the departed, never to oneself. Praying for the dead is a work of mercy and rests on the Church's faith in the communion of saints, not on any claim to know the state of a particular soul.",
      devotionType: "general",
      subtype: "prayer for the dead",
      practiceInstructions:
        "On each day from 1 to 8 November, visit a cemetery and pray for the dead, if only in your own mind, at the graves; on the Commemoration of All the Faithful Departed, visit a church or oratory and there pray the Our Father and the Creed. For the plenary indulgence, which is applicable only to the souls in purgatory, add the usual conditions: sacramental confession, Holy Communion on each day the indulgence is sought, and prayer for the intentions of the Holy Father, with the heart detached from all affection for sin. A plenary indulgence may be gained only once a day. Bring the names of your own dead with you and say them aloud, and have Masses offered for them, which remains the greatest help the Church can give them.",
      relatedPrayers: [
        "eternal-rest",
        "de-profundis",
        "our-father",
        "apostles-creed",
        "nicene-creed",
      ],
      relatedSaints: [],
      indulgences: HOLY_SOULS_NOVEMBER_INDULGENCE,
      citations: HOLY_SOULS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "ember-days",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: EMBER_DAYS_CITATIONS,
    payload: {
      slug: "ember-days",
      title: "The Ember Days",
      summary:
        "Four sets of three days spread through the year — Wednesday, Friday and Saturday — given to fasting, prayer and thanksgiving for the fruits of the earth and for those about to be ordained.",
      background:
        "An ancient observance of the Roman Church, kept four times a year to sanctify the seasons, to give thanks for the harvest and human labour, and to pray for the clergy to be ordained at those times; in the older calendar they fell after St Lucy in December, in the first week of Lent, after Pentecost, and after the Exaltation of the Holy Cross in September. The 1969 reform of the calendar left the regulation of Ember and Rogation Days to the conferences of bishops, and the 1983 Code no longer imposes their fasting rules; in the United States they are not officially observed, though many Catholics and communities keep them privately as a rhythm of penance and thanksgiving.",
      devotionType: "general",
      subtype: "penance",
      practiceInstructions:
        "Keep the three days — Wednesday, Friday and Saturday — of each Embertide as days of moderation and prayer: a simpler table, abstinence from meat, and time given to prayer rather than only food withheld. Take up the traditional intentions explicitly: on the Wednesday, thanksgiving for the harvest and for honest work; on the Friday, penance for your own sins and those of the Church; on the Saturday, prayer for those to be ordained and for vocations to the priesthood and religious life. Since the observance is now voluntary in most places, agree on what you will do beforehand, and check your diocese's own practice before treating the days as obligatory.",
      relatedPrayers: [
        "act-of-contrition",
        "veni-creator-spiritus",
        "te-deum",
        "grace-before-meals",
        "prayer-for-vocations",
      ],
      relatedSaints: [],
      citations: EMBER_DAYS_CITATIONS,
    },
  },
];

import type { CuratedEntry } from "../index";

/**
 * Devotion group 1: chaplets, scapulars and sacramentals, and Eucharistic
 * devotions.
 *
 * Every entry below is a devotion the Church actually practises and that is
 * described on the cited pages. Where a chaplet's bead structure is given, it
 * is the structure printed in the cited text and nothing has been reconstructed
 * from memory; where a source is silent on a detail, the detail is omitted
 * rather than supplied. `background` says in each case whether the devotion is
 * a private devotion, a devotion of a religious family, or an act of the
 * Church's public worship, as the Directory on Popular Piety and the Liturgy
 * asks.
 *
 * Indulgences are attached only to the four grants of the Enchiridion
 * Indulgentiarum that are not in dispute — Eucharistic adoration, the solemn
 * Eucharistic procession, the devout use of a blessed article of devotion, and
 * the prayer "En ego, o bone et dulcissime Iesu" after Communion — and the
 * grant is described in words rather than by a paragraph number. No other entry
 * claims an indulgence, and no promise is reported here that its cited source
 * does not report.
 */

// Holy See
const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const ECCLESIA_DE_EUCHARISTIA =
  "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_20030417_eccl-de-euch.html";
const MYSTERIUM_FIDEI =
  "https://www.vatican.va/content/paul-vi/en/encyclicals/documents/hf_p-vi_enc_03091965_mysterium.html";
const SACRAMENTUM_CARITATIS =
  "https://www.vatican.va/content/benedict-xvi/en/apost_exhortations/documents/hf_ben-xvi_exh_20070222_sacramentum-caritatis.html";
const REDEMPTIONIS_SACRAMENTUM =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20040423_redemptionis-sacramentum_en.html";
const INDULGENTIARUM_DOCTRINA =
  "https://www.vatican.va/content/paul-vi/en/apost_constitutions/documents/hf_p-vi_apc_01011967_indulgentiarum-doctrina.html";
const RELICS_INSTRUCTION =
  "https://www.vatican.va/roman_curia/congregations/csaints/documents/rc_con_csaints_doc_20171208_istruzione-reliquie_en.html";
const BENEDICT_XVI_ON_ALPHONSUS =
  "https://www.vatican.va/content/benedict-xvi/en/audiences/2011/documents/hf_ben-xvi_aud_20110330.html";

// USCCB
const USCCB_EUCHARISTIC_DEVOTION =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/eucharistic-devotion";
const USCCB_PERPETUAL_EXPOSITION =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/adoration/perpetual-exposition-of-the-blessed-sacrament";
const USCCB_DEVOTIONS_AND_ADORATION =
  "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/adoration/devotions-and-eucharistic-adoration";
const USCCB_ANIMA_CHRISTI = "https://www.usccb.org/prayers/anima-christi";
const USCCB_PRAYER_TO_CHRIST_CRUCIFIED =
  "https://www.usccb.org/prayers/prayer-our-lord-jesus-christ-crucified";

// EWTN
const EWTN_USE_OF_BEADS = "https://www.ewtn.com/catholicism/library/use-of-beads-at-prayers-10710";
const EWTN_SEVEN_DOLORS =
  "https://www.ewtn.com/catholicism/library/seven-dolors-of-the-blessed-virgin-mary-5437";
const EWTN_SEVEN_SORROWS_CHAPLET =
  "https://www.ewtn.com/catholicism/seasons-and-feast-days/what-is-the-chaplet-of-the-seven-sorrows-of-mary-21938";
const EWTN_HOW_TO_PRAY_SEVEN_SORROWS =
  "https://www.ewtn.com/catholicism/seasons-and-feast-days/how-do-you-pray-the-seven-sorrows-rosary-21939";
const EWTN_DEVOTION_TO_ST_JOSEPH =
  "https://www.ewtn.com/catholicism/devotions/devotion-to-st-joseph-346";
const EWTN_FRANCISCAN_CROWN =
  "https://www.ewtn.com/catholicism/library/franciscan-crown-rosary-11842";
const EWTN_WHAT_IS_FRANCISCAN_CROWN =
  "https://www.ewtn.com/catholicism/seasons-and-feast-days/what-is-the-franciscan-crown-rosary-21581";
const EWTN_TWENTY_FOUR_GLORY_BES =
  "https://www.ewtn.com/catholicism/devotions/novena-of-the-twentyfour-glory-bes-to-st-teresa-the-little-flower-293";
const EWTN_LITTLE_CROWN =
  "https://www.ewtn.com/catholicism/library/little-crown-of-the-infant-jesus-of-prague-11846";
const EWTN_INFANT_OF_PRAGUE_HISTORY =
  "https://www.ewtn.com/catholicism/library/history-of-the-infant-jesus-of-prague-1329";
const EWTN_SCAPULAR_DEVOTION = "https://www.ewtn.com/catholicism/library/scapular-devotion-5806";
const EWTN_DOES_A_SCAPULAR_HAVE_TO_BE_CLOTH =
  "https://www.ewtn.com/catholicism/seasons-and-feast-days/does-a-brown-scapular-have-to-be-cloth-21929";
const EWTN_JUBILEE_MEDAL_OF_ST_BENEDICT =
  "https://www.ewtn.com/catholicism/library/jubilee-medal-of-st-benedict-5415";
const EWTN_BLESSING_OF_WATER =
  "https://www.ewtn.com/catholicism/library/blessing-of-water-outside-mass-4887";
const EWTN_SACRAMENTALS =
  "https://www.ewtn.com/catholicism/library/talks-on-the-sacramentals-11209";
const EWTN_SIGN_OF_THE_CROSS = "https://www.ewtn.com/catholicism/library/sign-of-the-cross-1151";
const EWTN_SIGNIFICANCE_OF_THE_SIGN_OF_THE_CROSS =
  "https://www.ewtn.com/catholicism/library/significance-of-the-sign-of-the-cross-4999";
const EWTN_WHY_VENERATE_RELICS =
  "https://www.ewtn.com/catholicism/library/why-do-we-venerate-relics-1137";
const EWTN_ACT_OF_SPIRITUAL_COMMUNION =
  "https://www.ewtn.com/catholicism/library/act-of-spiritual-communion-11891";
const EWTN_ALPHONSUS_AND_THE_EUCHARIST =
  "https://www.ewtn.com/catholicism/library/life-of-st-alphonsus-and-the-holy-eucharist-5175";
const EWTN_PRAYER_WHILE_VISITING =
  "https://www.ewtn.com/catholicism/devotions/prayer-while-visiting-the-most-blessed-sacrament-374";
const EWTN_WHAT_IS_PERPETUAL_ADORATION =
  "https://www.ewtn.com/catholicism/library/what-is-perpetual-adoration-12619";
const EWTN_PERPETUAL_ADORATION_ANCIENT =
  "https://www.ewtn.com/catholicism/library/perpetual-adoration-an-ancient-devotion-in-modern-times-931";
const EWTN_HISTORY_OF_ADORATION =
  "https://www.ewtn.com/catholicism/library/history-of-eucharistic-adoration-development-of-doctrine-in-the-catholic-church-4086";
const EWTN_BENEDICTION =
  "https://www.ewtn.com/catholicism/library/benediction-of-the-blessed-sacrament-957";
const EWTN_BENEDICTION_SAUNDERS =
  "https://www.ewtn.com/catholicism/teachings/fr-saunders-benediction-of-the-blessed-sacrament-112";
const EWTN_THANKSGIVING_AFTER_MASS =
  "https://www.ewtn.com/catholicism/library/thanksgiving-after-mass-11896";
const EWTN_THANKSGIVING_PRAYER =
  "https://www.ewtn.com/catholicism/devotions/thanksgiving-prayer-after-mass-12766";
const EWTN_EUCHARISTIC_ADORATION =
  "https://www.ewtn.com/catholicism/teachings/eucharistic-adoration-100";

// Catholic Culture
const CC_CHAPLET_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=32437";
const CC_CHAPLET_INDEX =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/index.cfm?action=list&filter=prayercategories&id=13";
const CC_CHAPLET_SEVEN_SORROWS =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1253";
const CC_CHAPLET_OF_ST_JOSEPH =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1007";
const CC_CHAPLET_OF_THE_HOLY_SPIRIT =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=101";
const CC_CHAPLET_OF_ST_ANTHONY =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1236";
const CC_CHAPLET_OF_THE_BLESSED_SACRAMENT =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1193";
const CC_KINDS_OF_SCAPULARS =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=1312";
const CC_SCAPULAR_MEDAL = "https://www.catholicculture.org/culture/library/view.cfm?recnum=5197";
const CC_SCAPULAR_MEDAL_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=36311";
const CC_SCAPULAR_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=36310";
const CC_MEDAL_OF_ST_BENEDICT =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1132";
const CC_BLESSING_OF_THE_MEDAL_OF_ST_BENEDICT =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1081";
const CC_HOLY_WATER_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=33979";
const CC_HOLY_WATER_ACTIVITY =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=767";
const CC_THREE_SACRAMENTALS =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=11641";
const CC_BLESSED_PALMS_IN_THE_HOME =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=1035";
const CC_HISTORY_OF_PALM_SUNDAY =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=105";
const CC_BLESSING_OF_CANDLES =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1395";
const CC_CANDLEMAS_CEREMONY =
  "https://www.catholicculture.org/culture/liturgicalyear/activities/view.cfm?id=527";
const CC_BLESSING_OF_THROATS =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=733";
const CC_ST_BLAISE_BLESSING_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=36231";
const CC_AGNUS_DEI_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=31713";
const CC_RELIC_DICTIONARY =
  "https://www.catholicculture.org/culture/library/dictionary/index.cfm?id=36023";
const CC_CORPUS_CHRISTI_PROCESSIONS =
  "https://www.catholicculture.org/culture/liturgicalyear/overviews/feasts/corpus_christi/corpus_christi_processions.cfm";
const CC_EUCHARISTIC_PROCESSION =
  "https://www.catholicculture.org/culture/liturgicalyear/prayers/view.cfm?id=1198";
const CC_PERPETUAL_ADORATION_STATUTES =
  "https://www.catholicculture.org/culture/library/view.cfm?recnum=3028";

const ADORATION_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant on Eucharistic adoration: a plenary indulgence for adoring the Blessed Sacrament for at least half an hour, and a partial indulgence for a shorter visit, on the usual conditions. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

const PROCESSION_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant on Eucharistic adoration and procession: a plenary indulgence, on the usual conditions, for devoutly taking part in a solemn Eucharistic procession of particular importance, such as the procession of Corpus Christi. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

const BLESSED_OBJECT_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant on the use of articles of devotion: a partial indulgence for the devout use of a crucifix, rosary, scapular or medal properly blessed by a priest. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

/* ------------------------------------------------------------------ */
/* Chaplets                                                            */
/* ------------------------------------------------------------------ */

const CHAPLET_SEVEN_SORROWS_CITATIONS = [
  CC_CHAPLET_SEVEN_SORROWS,
  EWTN_SEVEN_SORROWS_CHAPLET,
  EWTN_HOW_TO_PRAY_SEVEN_SORROWS,
  EWTN_SEVEN_DOLORS,
];

const CHAPLET_ST_JOSEPH_CITATIONS = [
  CC_CHAPLET_OF_ST_JOSEPH,
  EWTN_DEVOTION_TO_ST_JOSEPH,
  EWTN_USE_OF_BEADS,
];

const CHAPLET_HOLY_SPIRIT_CITATIONS = [CC_CHAPLET_OF_THE_HOLY_SPIRIT, CC_CHAPLET_INDEX];

const FRANCISCAN_CROWN_CITATIONS = [
  EWTN_FRANCISCAN_CROWN,
  EWTN_WHAT_IS_FRANCISCAN_CROWN,
  DIRECTORY_POPULAR_PIETY,
];

const CHAPLET_ST_ANTHONY_CITATIONS = [CC_CHAPLET_OF_ST_ANTHONY, CC_CHAPLET_DICTIONARY];

const CHAPLET_ST_THERESE_CITATIONS = [EWTN_TWENTY_FOUR_GLORY_BES, CC_CHAPLET_DICTIONARY];

const LITTLE_CROWN_CITATIONS = [
  EWTN_LITTLE_CROWN,
  EWTN_INFANT_OF_PRAGUE_HISTORY,
  EWTN_USE_OF_BEADS,
];

/* ------------------------------------------------------------------ */
/* Scapulars and sacramentals                                          */
/* ------------------------------------------------------------------ */

const GREEN_SCAPULAR_CITATIONS = [
  CC_KINDS_OF_SCAPULARS,
  EWTN_SCAPULAR_DEVOTION,
  INDULGENTIARUM_DOCTRINA,
];

const RED_SCAPULAR_CITATIONS = [
  CC_KINDS_OF_SCAPULARS,
  EWTN_SCAPULAR_DEVOTION,
  INDULGENTIARUM_DOCTRINA,
];

const SCAPULAR_MEDAL_CITATIONS = [
  CC_SCAPULAR_MEDAL,
  CC_SCAPULAR_MEDAL_DICTIONARY,
  EWTN_DOES_A_SCAPULAR_HAVE_TO_BE_CLOTH,
  CC_KINDS_OF_SCAPULARS,
  INDULGENTIARUM_DOCTRINA,
];

const BLACK_SCAPULAR_CITATIONS = [
  CC_KINDS_OF_SCAPULARS,
  CC_SCAPULAR_DICTIONARY,
  EWTN_SEVEN_DOLORS,
  INDULGENTIARUM_DOCTRINA,
];

const BLUE_SCAPULAR_CITATIONS = [
  CC_KINDS_OF_SCAPULARS,
  CC_SCAPULAR_DICTIONARY,
  EWTN_SCAPULAR_DEVOTION,
  INDULGENTIARUM_DOCTRINA,
];

const WHITE_SCAPULAR_CITATIONS = [
  CC_KINDS_OF_SCAPULARS,
  CC_SCAPULAR_DICTIONARY,
  EWTN_SCAPULAR_DEVOTION,
  INDULGENTIARUM_DOCTRINA,
];

const BENEDICT_MEDAL_CITATIONS = [
  CC_MEDAL_OF_ST_BENEDICT,
  CC_BLESSING_OF_THE_MEDAL_OF_ST_BENEDICT,
  EWTN_JUBILEE_MEDAL_OF_ST_BENEDICT,
  INDULGENTIARUM_DOCTRINA,
];

const HOLY_WATER_CITATIONS = [
  CC_HOLY_WATER_DICTIONARY,
  CC_HOLY_WATER_ACTIVITY,
  EWTN_BLESSING_OF_WATER,
  CC_THREE_SACRAMENTALS,
];

const BLESSED_PALMS_CITATIONS = [
  CC_BLESSED_PALMS_IN_THE_HOME,
  CC_HISTORY_OF_PALM_SUNDAY,
  DIRECTORY_POPULAR_PIETY,
];

const BLESSED_CANDLES_CITATIONS = [
  CC_BLESSING_OF_CANDLES,
  CC_CANDLEMAS_CEREMONY,
  DIRECTORY_POPULAR_PIETY,
];

const ST_BLAISE_CITATIONS = [CC_BLESSING_OF_THROATS, CC_ST_BLAISE_BLESSING_DICTIONARY];

const SIGN_OF_THE_CROSS_CITATIONS = [
  EWTN_SIGN_OF_THE_CROSS,
  EWTN_SIGNIFICANCE_OF_THE_SIGN_OF_THE_CROSS,
  INDULGENTIARUM_DOCTRINA,
];

const AGNUS_DEI_CITATIONS = [CC_AGNUS_DEI_DICTIONARY, EWTN_SACRAMENTALS];

const RELICS_CITATIONS = [RELICS_INSTRUCTION, EWTN_WHY_VENERATE_RELICS, CC_RELIC_DICTIONARY];

/* ------------------------------------------------------------------ */
/* Eucharistic devotions                                               */
/* ------------------------------------------------------------------ */

const SPIRITUAL_COMMUNION_CITATIONS = [
  ECCLESIA_DE_EUCHARISTIA,
  EWTN_ACT_OF_SPIRITUAL_COMMUNION,
  BENEDICT_XVI_ON_ALPHONSUS,
];

const VISITS_CITATIONS = [
  EWTN_ALPHONSUS_AND_THE_EUCHARIST,
  EWTN_PRAYER_WHILE_VISITING,
  BENEDICT_XVI_ON_ALPHONSUS,
  INDULGENTIARUM_DOCTRINA,
];

const PERPETUAL_ADORATION_CITATIONS = [
  USCCB_PERPETUAL_EXPOSITION,
  USCCB_DEVOTIONS_AND_ADORATION,
  EWTN_WHAT_IS_PERPETUAL_ADORATION,
  SACRAMENTUM_CARITATIS,
  INDULGENTIARUM_DOCTRINA,
];

const NOCTURNAL_ADORATION_CITATIONS = [
  EWTN_HISTORY_OF_ADORATION,
  EWTN_PERPETUAL_ADORATION_ANCIENT,
  EWTN_EUCHARISTIC_ADORATION,
  CC_PERPETUAL_ADORATION_STATUTES,
  INDULGENTIARUM_DOCTRINA,
];

const CORPUS_CHRISTI_PROCESSION_CITATIONS = [
  DIRECTORY_POPULAR_PIETY,
  CC_CORPUS_CHRISTI_PROCESSIONS,
  CC_EUCHARISTIC_PROCESSION,
  MYSTERIUM_FIDEI,
  INDULGENTIARUM_DOCTRINA,
];

const BENEDICTION_CITATIONS = [
  EWTN_BENEDICTION,
  EWTN_BENEDICTION_SAUNDERS,
  REDEMPTIONIS_SACRAMENTUM,
];

const THANKSGIVING_CITATIONS = [
  EWTN_THANKSGIVING_AFTER_MASS,
  EWTN_THANKSGIVING_PRAYER,
  USCCB_ANIMA_CHRISTI,
  USCCB_PRAYER_TO_CHRIST_CRUCIFIED,
  INDULGENTIARUM_DOCTRINA,
];

const CHAPLET_BLESSED_SACRAMENT_CITATIONS = [
  CC_CHAPLET_OF_THE_BLESSED_SACRAMENT,
  USCCB_EUCHARISTIC_DEVOTION,
  CC_CHAPLET_DICTIONARY,
];

export const devotionGroupOne: CuratedEntry[] = [
  /* ---------------------------- Chaplets ---------------------------- */
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-the-seven-sorrows",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: CHAPLET_SEVEN_SORROWS_CITATIONS,
    payload: {
      slug: "chaplet-of-the-seven-sorrows",
      title: "Chaplet of the Seven Sorrows of Mary",
      summary:
        "Also called the Servite Rosary, this chaplet leads the one praying through the seven sorrows of the Blessed Virgin, from Simeon's prophecy to the burial of her Son, so that compassion for the Mother becomes a way into the Passion of Christ.",
      background:
        "A private devotion of the Order of the Servants of Mary (the Servites), founded at Florence in 1233, whose members took the Sorrows of Our Lady as the heart of their spirituality. The chaplet is strung as seven groups of seven beads with medals of the seven sorrows. It is distinct from the liturgical memorial of Our Lady of Sorrows on 15 September, which is an act of the Church's public worship; the chaplet is a devotional exercise that prepares for and flows from that liturgy.",
      devotionType: "marian",
      subtype: "chaplet",
      practiceInstructions:
        "Begin with an act of contrition. Then take the seven sorrows in order: (1) the prophecy of Simeon; (2) the flight into Egypt; (3) the loss of the Child Jesus in the Temple; (4) Mary meets Jesus carrying the Cross; (5) Mary stands at the foot of the Cross; (6) Mary receives the body of Jesus taken down from the Cross; (7) Jesus is laid in the tomb. For each sorrow read the Gospel scene or recall it quietly, then pray one Our Father and seven Hail Marys. After the seventh sorrow pray three Hail Marys in honour of the tears of the Blessed Virgin, and close with a prayer for the intentions of the Holy Father.",
      durationMinutes: 20,
      relatedPrayers: [
        "our-father",
        "hail-mary",
        "stabat-mater",
        "seven-sorrows-of-mary-prayer",
        "litany-of-our-lady-of-sorrows",
      ],
      relatedSaints: [],
      citations: CHAPLET_SEVEN_SORROWS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-saint-joseph",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CHAPLET_ST_JOSEPH_CITATIONS,
    payload: {
      slug: "chaplet-of-saint-joseph",
      title: "Chaplet of Saint Joseph",
      summary:
        "A bead devotion that honours the guardian of the Redeemer by joining the mysteries of the Rosary to a simple, constantly repeated praise of the Holy Family: 'Praised and blessed be Jesus, Mary, and Joseph.'",
      background:
        "A private devotion, one of many that grew up as devotion to St. Joseph spread in the Latin Church and that gathered strength after Blessed Pius IX declared him patron of the universal Church in 1870. The chaplet is strung as fifteen groups of four beads, one white and three purple: the white bead recalls St. Joseph's purity, the purple beads his piety. It has no place in the liturgy; it is a domestic and personal prayer.",
      devotionType: "saintly",
      subtype: "chaplet",
      practiceInstructions:
        "Begin with the Sign of the Cross. Move through the fifteen groups of beads in turn. On each white bead call to mind one of the fifteen mysteries of the Rosary as St. Joseph would have known or awaited it. On each of the three purple beads that follow, pray: 'Praised and blessed be Jesus, Mary, and Joseph.' At the end pray: 'V. Pray for us, O holy St. Joseph. R. That we may be made worthy of the promises of Christ,' and close with a prayer asking St. Joseph's intercession for a holy life and a happy death.",
      durationMinutes: 15,
      relatedPrayers: [
        "our-father",
        "hail-mary",
        "glory-be",
        "litany-of-saint-joseph",
        "memorare-to-saint-joseph",
      ],
      relatedSaints: ["saint-joseph"],
      citations: CHAPLET_ST_JOSEPH_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-the-holy-spirit",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CHAPLET_HOLY_SPIRIT_CITATIONS,
    payload: {
      slug: "chaplet-of-the-holy-spirit",
      title: "Chaplet of the Holy Spirit",
      summary:
        "Five mysteries that trace the work of the Holy Spirit from the conception of Christ to his indwelling in the souls of the just, each closed with seven Glory Bes for the seven gifts.",
      background:
        "A private devotion, commonly prayed in the days before Pentecost and through the Easter season, though it may be used at any time. It is not a liturgical office; the Church's own public prayer to the Spirit is found in the Mass and the Liturgy of the Hours, and this chaplet is a personal echo of it.",
      devotionType: "general",
      subtype: "chaplet",
      practiceInstructions:
        "Begin with the Sign of the Cross and an act of contrition. Then pray the five mysteries in order, reading the Scripture named with each: (1) Jesus is conceived by the Holy Spirit of the Virgin Mary; (2) the Spirit of the Lord rests upon Jesus at his baptism; (3) Jesus is led by the Spirit into the desert; (4) the Holy Spirit in the Church at Pentecost; (5) the Holy Spirit dwelling in the souls of the just. For each of the first four mysteries pray one Our Father, one Hail Mary, and seven Glory Bes. Close the fifth mystery with the Creed, one Our Father, one Hail Mary, and seven Glory Bes.",
      durationMinutes: 15,
      relatedPrayers: [
        "our-father",
        "hail-mary",
        "glory-be",
        "apostles-creed",
        "veni-creator-spiritus",
        "prayer-for-the-seven-gifts",
        "litany-of-the-holy-spirit",
      ],
      relatedSaints: [],
      citations: CHAPLET_HOLY_SPIRIT_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "franciscan-crown-rosary",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: FRANCISCAN_CROWN_CITATIONS,
    payload: {
      slug: "franciscan-crown-rosary",
      title: "The Franciscan Crown (Rosary of the Seven Joys of Mary)",
      summary:
        "A seven-decade rosary of the Franciscan family that crowns Our Lady with the seven joys of her life, from the Annunciation to her Assumption, as a garland of flowers was once laid on her image.",
      background:
        "A devotion proper to the Franciscan Order, traced to the year 1422 and to a young friar who had been accustomed, before entering religion, to place a crown of fresh flowers on a statue of Our Lady. It is a private devotion of a religious family, freely taken up by the laity, and is not part of the Church's liturgy.",
      devotionType: "marian",
      subtype: "rosary",
      practiceInstructions:
        "Pray seven decades, each of one Our Father and ten Hail Marys, meditating in turn on the seven joys of Mary: (1) the Annunciation; (2) the Visitation; (3) the birth of Christ; (4) the adoration of the Magi; (5) the finding of Jesus in the Temple; (6) the Resurrection of the Lord; (7) the Assumption of the Blessed Virgin into heaven. After the seventh decade add two Hail Marys, bringing the total to seventy-two in memory of the years Mary is traditionally said to have lived on earth, and close with an Our Father and a Hail Mary for the intentions of the Holy Father.",
      durationMinutes: 25,
      relatedPrayers: ["our-father", "hail-mary", "glory-be", "salve-regina", "magnificat"],
      relatedSaints: ["saint-francis-of-assisi"],
      citations: FRANCISCAN_CROWN_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-saint-anthony",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CHAPLET_ST_ANTHONY_CITATIONS,
    payload: {
      slug: "chaplet-of-saint-anthony",
      title: "Chaplet of Saint Anthony of Padua",
      summary:
        "Thirteen small decades in honour of St. Anthony of Padua, whose feast falls on 13 June and whose intercession the poor and the bereft have sought for eight centuries.",
      background:
        "A private devotion connected with the Tuesday devotions to St. Anthony and with the alms called St. Anthony's Bread. The number thirteen recalls the day of his death and feast, 13 June 1231. Like every chaplet, it is a devotional exercise, not a liturgical rite; the Church's public honour of St. Anthony is the Mass and Office of his memorial.",
      devotionType: "saintly",
      subtype: "chaplet",
      practiceInstructions:
        "Pray thirteen small decades of three beads each. On the first bead of each decade pray the Our Father, on the second the Hail Mary, and on the third the Glory Be, offering each decade for a particular need or for the poor whom St. Anthony loved. After the thirteenth decade recite the responsory Si quaeris miracula, then the versicle 'Pray for us, blessed Anthony, that we may be made worthy of the promises of Christ,' and a closing prayer.",
      durationMinutes: 15,
      relatedPrayers: [
        "our-father",
        "hail-mary",
        "glory-be",
        "si-quaeris-miracula",
        "unfailing-prayer-to-saint-anthony",
      ],
      relatedSaints: ["saint-anthony-of-padua"],
      citations: CHAPLET_ST_ANTHONY_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-saint-therese",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CHAPLET_ST_THERESE_CITATIONS,
    payload: {
      slug: "chaplet-of-saint-therese",
      title: "Chaplet of Saint Thérèse (The Twenty-Four Glory Bes)",
      summary:
        "Twenty-four Glory Bes, one for each year of St. Thérèse of Lisieux's short life, offered in thanksgiving to the Blessed Trinity for the graces given her and asking her intercession in a present need.",
      background:
        "A private devotion begun by a Jesuit priest, Father Putigan, who started the novena of the twenty-four Glory Bes on 3 December 1925. It is usually prayed as a novena of nine days, but the twenty-four Glory Bes may also be prayed on a single day as a chaplet. Nothing about it belongs to the liturgy; the Church honours St. Thérèse publicly in the Mass and Office of her memorial on 1 October.",
      devotionType: "saintly",
      subtype: "chaplet",
      practiceInstructions:
        "Pray the Glory Be twenty-four times, thanking the Blessed Trinity for the favours and graces given to St. Thérèse during the twenty-four years of her life on earth. After each Glory Be add the invocation 'Saint Thérèse of the Child Jesus, pray for us.' Name your intention at the beginning and entrust it to her intercession at the end. Prayed on nine successive days, the same twenty-four Glory Bes form the well-known novena.",
      durationMinutes: 10,
      relatedPrayers: [
        "glory-be",
        "litany-of-saint-therese",
        "prayer-to-saint-therese",
        "morning-prayer-of-saint-therese",
      ],
      relatedSaints: ["saint-therese-of-lisieux"],
      citations: CHAPLET_ST_THERESE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "little-crown-of-the-infant-jesus",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: LITTLE_CROWN_CITATIONS,
    payload: {
      slug: "little-crown-of-the-infant-jesus",
      title: "Little Crown of the Infant Jesus",
      summary:
        "A chaplet of fifteen beads honouring the hidden childhood of the Word made flesh: three Our Fathers for the Holy Family and twelve Hail Marys for the twelve years of the Holy Childhood.",
      background:
        "A private devotion received by Venerable Margaret of the Blessed Sacrament, a Carmelite of the Carmel of Beaune who died in 1648, and closely bound up with devotion to the Infant Jesus of Prague. It is prayed in homes and shrines; it has no liturgical standing, and the Church's own celebration of the Lord's infancy is the Christmas season.",
      devotionType: "christological",
      subtype: "chaplet",
      practiceInstructions:
        "Take the chaplet of fifteen beads. On the first three beads pray one Our Father each, in honour of Jesus, Mary, and Joseph. On the remaining twelve beads pray a Hail Mary each, in honour of the twelve years of the childhood of Christ, letting the hidden years at Nazareth be the subject of your meditation. Close with a prayer to the Infant Jesus for the grace of simplicity and trust.",
      durationMinutes: 10,
      relatedPrayers: [
        "our-father",
        "hail-mary",
        "glory-be",
        "litany-of-the-infant-jesus",
        "sign-of-the-cross",
      ],
      relatedSaints: [],
      citations: LITTLE_CROWN_CITATIONS,
    },
  },

  /* ------------------- Scapulars and sacramentals ------------------- */
  {
    contentType: "DEVOTION",
    slug: "green-scapular",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: GREEN_SCAPULAR_CITATIONS,
    payload: {
      slug: "green-scapular",
      title: "The Green Scapular",
      summary:
        "A single piece of green cloth bearing the Immaculate Heart of Mary, worn or quietly given to another, with a short daily prayer for conversion and for a good death.",
      background:
        "A private devotion associated with Sister Justine Bisqueyburu, a Daughter of Charity, in 1840 — the same community to which St. Catherine Labouré, who received the Miraculous Medal ten years earlier, belonged. Blessed Pius IX approved the devotion in 1863 and again in 1870. Unlike a true scapular of a religious order, it is not two joined squares of cloth and carries no enrolment: it is simply blessed and used.",
      devotionType: "marian",
      subtype: "scapular",
      practiceInstructions:
        "Have the green scapular blessed by a priest — no enrolment or investiture is required. Wear it, or carry it in your clothing, or place it quietly in the room or among the belongings of the person for whom you are praying. Each day pray the words that appear on it: 'Immaculate Heart of Mary, pray for us now and at the hour of our death.' If the person for whom it is intended does not pray, the one who gave it says the prayer daily on their behalf.",
      practiceText: "Immaculate Heart of Mary, pray for us now and at the hour of our death.",
      relatedPrayers: [
        "hail-mary",
        "memorare",
        "sub-tuum-praesidium",
        "act-of-consecration-to-the-immaculate-heart",
      ],
      relatedSaints: ["saint-catherine-laboure"],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: GREEN_SCAPULAR_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "red-scapular-of-the-passion",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: RED_SCAPULAR_CITATIONS,
    payload: {
      slug: "red-scapular-of-the-passion",
      title: "The Red Scapular of the Passion",
      summary:
        "A scapular of red wool showing the crucified Lord with the instruments of his Passion on one side and the Hearts of Jesus and Mary on the other, worn as a daily reminder of the price of redemption.",
      background:
        "A private devotion associated with a Daughter of Charity of St. Vincent de Paul in 1846 and formally approved by Blessed Pius IX on 25 June 1847, who entrusted its blessing and imposition to the priests of the Congregation of the Mission. The sources that transmit the devotion report a promise of a great increase of faith, hope, and charity to those who wear it and honour it each Friday; nothing beyond that is claimed for it.",
      devotionType: "passion",
      subtype: "scapular",
      practiceInstructions:
        "Ask a priest with the proper faculty to bless and impose the red scapular. Wear it over the shoulders so that one square rests on the breast and the other on the back. Each Friday, the day of the Lord's death, kiss it devoutly and spend a few moments meditating on the Passion — the scourging, the crowning with thorns, the nails, the lance — asking for an increase of faith, hope, and charity.",
      relatedPrayers: [
        "prayer-before-a-crucifix",
        "anima-christi",
        "litany-of-the-passion",
        "stabat-mater",
        "salutation-to-the-hearts-of-jesus-and-mary",
      ],
      relatedSaints: ["saint-vincent-de-paul"],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: RED_SCAPULAR_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "scapular-medal",
    authorityLevel: "VATICAN",
    citations: SCAPULAR_MEDAL_CITATIONS,
    payload: {
      slug: "scapular-medal",
      title: "The Scapular Medal",
      summary:
        "A blessed medal bearing the Sacred Heart on one side and the Blessed Virgin on the other, which Pope St. Pius X permitted the enrolled faithful to wear in place of a cloth scapular.",
      background:
        "In 1910 Pope St. Pius X allowed those who had been validly enrolled in a scapular confraternity to substitute a single medal for the cloth scapular or scapulars. The concession touches only the wearing: enrolment must still be made in the cloth scapular itself, by a priest with the faculty to do so, and the medal must afterwards be blessed. It is a permission of the Holy See governing a private devotion, not a liturgical rite.",
      devotionType: "marian",
      subtype: "sacramental",
      practiceInstructions:
        "First be enrolled in the scapular itself by a priest who has the faculty, receiving the cloth scapular in the usual way. Afterwards a medal bearing the image of the Sacred Heart of Jesus on one side and the Blessed Virgin Mary on the other may be blessed and worn in its place — a separate blessing is required for each scapular the medal replaces. Wear it constantly and keep the obligations of the scapular you were enrolled in, above all the daily prayer attached to it.",
      relatedPrayers: ["hail-mary", "flos-carmeli", "sub-tuum-praesidium", "memorare"],
      relatedSaints: ["saint-pope-pius-x"],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: SCAPULAR_MEDAL_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "black-scapular-of-the-seven-sorrows",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: BLACK_SCAPULAR_CITATIONS,
    payload: {
      slug: "black-scapular-of-the-seven-sorrows",
      title: "The Black Scapular of the Seven Sorrows of Mary",
      summary:
        "The small black scapular of the Servite family, worn as a sign of companionship with the Mother of Sorrows and of a promise to keep her sorrows in mind.",
      background:
        "After Pope Alexander IV formally established the Servite Order in 1255, lay men and women formed a confraternity in honour of the seven sorrows of Mary and wore a black scapular, usually bearing an image of Our Lady of Sorrows, as the sign of their membership. It is one of the five best-known small scapulars approved by the Church. Wearing it is a private devotion and an act of membership in a confraternity; it is not part of the Church's liturgy, and it carries no promise beyond what its cited sources report.",
      devotionType: "marian",
      subtype: "scapular",
      practiceInstructions:
        "Be enrolled by a priest who has the faculty to invest in this scapular, and afterwards wear it constantly over the shoulders, under your clothing. Keep the sorrows of Mary in mind through the day — Simeon's prophecy, the flight into Egypt, the loss of the Child in the Temple, the meeting on the way to Calvary, the Crucifixion, the taking down from the Cross, and the burial — pausing at each with a Hail Mary, and stand with her beside the suffering of the people around you.",
      relatedPrayers: [
        "stabat-mater",
        "seven-sorrows-of-mary-prayer",
        "litany-of-our-lady-of-sorrows",
        "hail-mary",
      ],
      relatedSaints: [],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: BLACK_SCAPULAR_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blue-scapular-of-the-immaculate-conception",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: BLUE_SCAPULAR_CITATIONS,
    payload: {
      slug: "blue-scapular-of-the-immaculate-conception",
      title: "The Blue Scapular of the Immaculate Conception",
      summary:
        "A small light-blue scapular bearing the Immaculate Conception on one side and the name of Mary on the other, worn in honour of Our Lady conceived without sin.",
      background:
        "The devotion comes from the Theatine tradition and from Venerable Ursula Benincasa, who in 1581 received a vision of the scapular's design and asked that the graces she had been shown be extended to the faithful who would wear a small light-blue scapular bearing on one side the image of the Immaculate Conception and on the other the name 'Mary.' In 1671 Pope Clement X granted permission to bless the scapular and to invest people with it. It is one of the five best-known small scapulars, a private devotion rather than a liturgical act, and nothing is promised here that the cited sources do not report.",
      devotionType: "marian",
      subtype: "scapular",
      practiceInstructions:
        "Be enrolled by a priest with the faculty to invest in this scapular, and then wear it constantly over the shoulders beneath your clothing. Let it hold you to the purity it signifies: renew each day a short act of consecration to Our Lady conceived without sin, pray a Hail Mary in honour of her Immaculate Conception, and ask her help in whatever most needs cleansing in your life.",
      relatedPrayers: [
        "prayer-in-honor-of-the-immaculate-conception",
        "prayer-to-our-lady-immaculate",
        "hail-mary",
        "sub-tuum-praesidium",
      ],
      relatedSaints: [],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: BLUE_SCAPULAR_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "white-scapular-of-the-most-holy-trinity",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: WHITE_SCAPULAR_CITATIONS,
    payload: {
      slug: "white-scapular-of-the-most-holy-trinity",
      title: "The White Scapular of the Most Holy Trinity",
      summary:
        "The white scapular of the Trinitarian family, marked with a blue and red cross, worn in honour of the Blessed Trinity and of the work of ransoming captives.",
      background:
        "When Pope Innocent III approved the Order of the Most Holy Trinity on 28 January 1198, an angel is recorded as having appeared to him wearing a white garment marked with a cross formed of a blue horizontal bar and a red vertical bar; that cross became the badge of the Trinitarians and the model of the small scapular worn by the lay confraternity attached to them. It is one of the five best-known small scapulars. Wearing it is a private devotion, and its meaning is bound to the Trinitarian charism of freeing those held captive.",
      devotionType: "general",
      subtype: "scapular",
      practiceInstructions:
        "Be enrolled by a priest who has the faculty to invest in this scapular, and afterwards wear it constantly over the shoulders, under your clothing. Honour the Blessed Trinity each day in the words the scapular's cross recalls — Glory be to the Father, and to the Son, and to the Holy Spirit — and take up some share, by prayer, almsgiving or work, in the Trinitarian care for the imprisoned, the trafficked and the persecuted.",
      relatedPrayers: [
        "glory-be",
        "sign-of-the-cross",
        "nicene-creed",
        "prayer-of-thanksgiving-to-the-trinity",
      ],
      relatedSaints: [],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: WHITE_SCAPULAR_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "medal-of-saint-benedict",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: BENEDICT_MEDAL_CITATIONS,
    payload: {
      slug: "medal-of-saint-benedict",
      title: "The Medal of Saint Benedict",
      summary:
        "A blessed medal covered with the initials of Latin prayers against the devil, worn or placed in homes as a sign of the Cross's victory and of St. Benedict's protection.",
      background:
        "A sacramental of the Benedictine tradition. The form most used today is the Jubilee medal struck at Montecassino in 1880 for the fourteenth centenary of St. Benedict's birth. On the face St. Benedict holds the cross and the Rule; around it runs 'Eius in obitu nostro praesentia muniamur' — May we be strengthened by his presence in the hour of our death. On the reverse a cross bears the letters C S S M L / N D S M D for 'Crux sacra sit mihi lux, non draco sit mihi dux' (May the holy Cross be my light, may the dragon never be my guide), with C S P B in the angles for 'Crux Sancti Patris Benedicti', PAX above, and around the rim V R S N S M V — S M Q L I V B for 'Vade retro Satana, nunquam suade mihi vana; sunt mala quae libas, ipse venena bibas.' Wearing the medal is a private devotion; it works no magic and asks for faith and prayer.",
      devotionType: "saintly",
      subtype: "sacramental",
      practiceInstructions:
        "Ask a priest to bless the medal with the formula given for it in the Roman Ritual. Then wear it, or keep it in the home, in a car, or in the foundations of a building, as a plea for protection. Use it with an act of faith rather than as a charm: make the Sign of the Cross, renounce the devil and his works, and pray in the words the medal abbreviates — 'May the holy Cross be my light; may the dragon never be my guide' — and ask St. Benedict's intercession for a holy death.",
      relatedPrayers: [
        "prayer-of-saint-benedict-of-nursia",
        "prayer-to-saint-michael",
        "sign-of-the-cross",
        "prayer-for-help-against-spiritual-enemies",
      ],
      relatedSaints: ["saint-benedict-of-nursia"],
      indulgences: BLESSED_OBJECT_INDULGENCE,
      citations: BENEDICT_MEDAL_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "holy-water",
    authorityLevel: "LITURGICAL_BOOK",
    citations: HOLY_WATER_CITATIONS,
    payload: {
      slug: "holy-water",
      title: "The Use of Holy Water",
      summary:
        "Water blessed by the Church and used to sign oneself, one's family, and one's home, so that every day begins again from the font where we were baptised.",
      background:
        "Holy water is a sacramental: a sacred sign instituted by the Church that prepares us to receive the fruit of the sacraments and sanctifies the circumstances of life. Its blessing belongs to the Church's public worship — the Rite of Blessing of Water outside Mass, and the rite of sprinkling that may replace the penitential act at Sunday Mass — while its use at the church door and in the home is a private devotion that flows from that liturgy. It forgives no sin of itself; it disposes us to repentance and recalls the grace of Baptism.",
      devotionType: "general",
      subtype: "sacramental",
      practiceInstructions:
        "Take blessed water from the font on entering and leaving the church, and make the Sign of the Cross with it deliberately, recalling your Baptism. Keep a small font at home. Bless yourself and your children with it in the morning and at night; sprinkle the rooms of the house, the sick, and those setting out on a journey, saying: 'In the name of the Father, and of the Son, and of the Holy Spirit.' Water that has been blessed is not to be poured down a drain: return what is left to the earth.",
      relatedPrayers: ["sign-of-the-cross", "psalm-50", "blessing-of-a-bedroom"],
      relatedSaints: [],
      citations: HOLY_WATER_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blessed-palms",
    authorityLevel: "LITURGICAL_BOOK",
    citations: BLESSED_PALMS_CITATIONS,
    payload: {
      slug: "blessed-palms",
      title: "Blessed Palms",
      summary:
        "The branches blessed and carried on Palm Sunday, taken home and kept through the year as a household confession that Christ is King and that his throne is the Cross.",
      background:
        "The blessing and procession of branches belongs to the liturgy of Palm Sunday of the Passion of the Lord, which opens Holy Week and unites the royal welcome of Jerusalem with the proclamation of the Passion. What the faithful do afterwards with the branches — keeping them at home or at work — is a popular devotion that the Directory on Popular Piety commends, provided it is understood as a witness of faith in Christ and not as a protective charm.",
      devotionType: "liturgical",
      subtype: "sacramental",
      practiceInstructions:
        "Take part in the procession or solemn entrance at the beginning of the Palm Sunday liturgy, carrying the branch you have received. Bring it home and place it behind a crucifix, a holy image, or over the door, where it will be seen through the year. Because the branches are blessed they are sacramentals: when they are replaced the following year, burn them or bury them rather than throwing them away. In many parishes the old palms are collected and burned to make the ashes for Ash Wednesday.",
      relatedPrayers: ["sign-of-the-cross", "vexilla-regis", "gloria-in-excelsis", "sanctus"],
      relatedSaints: [],
      citations: BLESSED_PALMS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blessed-candles",
    authorityLevel: "LITURGICAL_BOOK",
    citations: BLESSED_CANDLES_CITATIONS,
    payload: {
      slug: "blessed-candles",
      title: "Blessed Candles (Candlemas)",
      summary:
        "Candles blessed on 2 February, the Presentation of the Lord, carried in procession to meet Christ the light of the nations, and afterwards lit in the home in sickness, in storm, and at the bedside of the dying.",
      background:
        "The blessing of candles, their distribution, the procession, and the Mass that follows make up the liturgy of the Feast of the Presentation of the Lord, celebrated forty days after Christmas and popularly called Candlemas. The candles are blessed in the Church's public worship; their later use in the home is a devotional custom, and the light they give is a sign of Christ, 'a light for revelation to the Gentiles' in Simeon's song.",
      devotionType: "liturgical",
      subtype: "sacramental",
      practiceInstructions:
        "Bring candles to the parish church on 2 February for the blessing, and carry a lighted candle in the procession as Simeon's canticle is sung. Take the blessed candles home. Light them at family prayer, before a sacred image, in time of storm or serious illness, and beside the bed of one who is dying, praying the Nunc Dimittis with the sick person. Keep them for sacred use only.",
      relatedPrayers: ["nunc-dimittis", "sign-of-the-cross", "sub-tuum-praesidium", "de-profundis"],
      relatedSaints: [],
      citations: BLESSED_CANDLES_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blessing-of-throats-on-saint-blaise-day",
    authorityLevel: "LITURGICAL_BOOK",
    citations: ST_BLAISE_CITATIONS,
    payload: {
      slug: "blessing-of-throats-on-saint-blaise-day",
      title: "The Blessing of Throats on the Feast of Saint Blaise",
      summary:
        "On 3 February the faithful come forward to have two crossed candles held to the throat while the minister asks, through the intercession of St. Blaise, deliverance from every ailment of the throat and from every other illness.",
      background:
        "St. Blaise was bishop of Sebaste in Armenia in the fourth century; his cult spread through the medieval Church because he was said to have saved a boy who was choking on a fishbone. The blessing is a liturgical rite of the Church, given in the Book of Blessings and ordinarily celebrated within Mass or a celebration of the word of God on his optional memorial, 3 February. It is not a private devotion, and it is not a guarantee of health: it is the Church praying for the sick through a martyr's intercession.",
      devotionType: "liturgical",
      subtype: "blessing",
      practiceInstructions:
        "Go to a parish celebrating the blessing on 3 February and come forward after the homily or after Communion. The minister — a priest, deacon, or a lay minister using the rite provided for lay ministers — touches the throat with two candles blessed the previous day at the Presentation of the Lord and joined in the form of a cross, saying: 'Through the intercession of Saint Blaise, bishop and martyr, may God deliver you from every disease of the throat and from every other illness: In the name of the Father, and of the Son, and of the Holy Spirit.' Where the numbers are large, the blessing may be given to all at once with hands extended over the people.",
      practiceText:
        "Through the intercession of Saint Blaise, bishop and martyr, may God deliver you from every disease of the throat and from every other illness: In the name of the Father, and of the Son, and of the Holy Spirit.",
      relatedPrayers: ["sign-of-the-cross", "prayer-for-the-sick", "prayer-for-healing"],
      relatedSaints: ["saint-blaise"],
      citations: ST_BLAISE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "sign-of-the-cross-daily-devotion",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: SIGN_OF_THE_CROSS_CITATIONS,
    payload: {
      slug: "sign-of-the-cross-daily-devotion",
      title: "The Sign of the Cross as a Daily Devotion",
      summary:
        "The oldest Christian gesture: a confession of the Trinity traced on the body, marking the day's beginnings and endings, its meals, its dangers, and its work with the Cross that saved us.",
      background:
        "Tertullian, writing about the year 200, already describes Christians tracing the sign at every going out and coming in, at table, at the lighting of the lamps, in all the ordinary actions of life; St. Basil counts it among the practices handed down from the apostles. It is both liturgical — every Mass, sacrament, and blessing begins and ends with it — and the simplest of private devotions, the prayer a Christian makes with the body when there are no words.",
      devotionType: "general",
      subtype: "gesture",
      practiceInstructions:
        "With the right hand touch the forehead, then the breast, then the left shoulder and the right, saying: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.' Make it slowly and deliberately rather than in haste. Use it on rising and on going to bed, before and after meals and prayer, on entering a church with holy water, when passing a church or a cemetery, at the beginning of work or a journey, and in the moment of temptation or fear. Parents may trace a small cross on the forehead of a child as a blessing.",
      practiceText: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
      relatedPrayers: ["sign-of-the-cross", "our-father", "glory-be", "prayer-on-rising"],
      relatedSaints: [],
      indulgences: {
        claimed: true,
        citation:
          "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), which lists the Sign of the Cross, made with the customary words, among the prayers enriched with a partial indulgence. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
      },
      citations: SIGN_OF_THE_CROSS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "agnus-dei-sacramental",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: AGNUS_DEI_CITATIONS,
    payload: {
      slug: "agnus-dei-sacramental",
      title: "The Agnus Dei",
      summary:
        "A small disc of wax stamped with the Lamb of God, blessed by the Roman Pontiff himself and kept by the faithful as a sign of Christ the Lamb who takes away the sin of the world.",
      background:
        "An ancient Roman sacramental whose blessing is reserved to the Pope: the discs were blessed in the first year of a pontificate and every seventh year thereafter, on the Wednesday of Easter week, and solemnly distributed a few days later. The wax recalls the body of Christ, the lamb the Victim of Calvary, the banner his victory over sin and death. The custom has not been continued in recent pontificates, so surviving examples are rare and are treasured rather than newly obtained. Like every sacramental it asks for faith: it is a reminder and a plea, never a talisman.",
      devotionType: "christological",
      subtype: "sacramental",
      practiceInstructions:
        "If an Agnus Dei has come to you, treat it with the reverence due a papal sacramental: keep it in a clean and worthy place in the home or wear it in a case, never sell it, and do not let it be handled as a curiosity. Use it as it was meant to be used — as an occasion for an act of faith in Christ the Lamb of God. Looking at it, pray the words of the liturgy: 'Lamb of God, you take away the sins of the world, have mercy on us,' and ask protection in sickness, in storm, and in the hour of death.",
      practiceText: "Lamb of God, you take away the sins of the world, have mercy on us.",
      relatedPrayers: ["divine-praises", "anima-christi", "ave-verum-corpus", "sign-of-the-cross"],
      relatedSaints: [],
      citations: AGNUS_DEI_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "veneration-of-relics",
    authorityLevel: "VATICAN",
    citations: RELICS_CITATIONS,
    payload: {
      slug: "veneration-of-relics",
      title: "The Veneration of Relics",
      summary:
        "Honour given to the bodies of the saints and to what has touched them, because those bodies were temples of the Holy Spirit and are destined for the resurrection.",
      background:
        "The practice is as old as the tombs of the martyrs and was defended by the Council of Trent in its twenty-fifth session, which taught that the bodies of the martyrs and of others now living with Christ are to be venerated by the faithful. It is expressed liturgically in the ancient custom of placing relics of martyrs beneath a fixed altar. Relics are commonly classed as first class (the body of a saint), second class (something the saint used or wore), and third class (an object touched to the first or second). The Congregation for the Causes of Saints regulates their authentication and conservation in its 2017 Instruction, and canon law absolutely forbids selling them or transferring them without the permission of the Holy See. The honour given is veneration of the saint and worship of God who is wonderful in his saints — never adoration of the object.",
      devotionType: "saintly",
      subtype: "veneration",
      practiceInstructions:
        "Venerate a relic as the Church does: approach quietly, kneel or bow, and kiss or touch the reliquary. Then pray — not to the relic but to God, asking through the intercession of the saint whose relic it is, and read something of that saint's life or writings so that the veneration leads to imitation. Never buy or sell a relic; if one comes into your hands, entrust it to a parish or a religious house where it can be kept and honoured properly, with its authentication intact.",
      relatedPrayers: ["litany-of-the-saints", "te-deum", "eternal-rest", "glory-be"],
      relatedSaints: [],
      citations: RELICS_CITATIONS,
    },
  },

  /* --------------------- Eucharistic devotions ---------------------- */
  {
    contentType: "DEVOTION",
    slug: "spiritual-communion",
    authorityLevel: "VATICAN",
    citations: SPIRITUAL_COMMUNION_CITATIONS,
    payload: {
      slug: "spiritual-communion",
      title: "Spiritual Communion",
      summary:
        "An ardent desire to receive Jesus in the Blessed Sacrament, made when sacramental Communion is not possible, so that the Lord may come at least spiritually into the heart that longs for him.",
      background:
        "The practice rests on the Church's ancient teaching that the Eucharist may be received sacramentally and spiritually, and that the desire for the sacrament already draws down its fruit in a soul in the state of grace. St. Alphonsus Liguori made it a cornerstone of his Eucharistic teaching and composed the act most widely used. Pope St. John Paul II commended it in the encyclical Ecclesia de Eucharistia, urging the faithful to cultivate a constant desire for the sacrament. It is a private devotion and never a substitute for sacramental Communion, which remains the norm for those who are able to receive; anyone conscious of grave sin must first be reconciled in confession before receiving sacramentally.",
      devotionType: "eucharistic",
      subtype: "act of desire",
      practiceInstructions:
        "Recollect yourself for a moment wherever you are. Make an act of faith in the real presence of Christ in the Blessed Sacrament, an act of contrition for your sins, and then an act of desire — asking Jesus to come into your heart since you cannot at this moment receive him sacramentally. Remain a little while in silence as if you had just received Communion, thanking him and offering him the day. St. Alphonsus's act may be used: 'My Jesus, I believe that Thou art present in the Most Holy Sacrament. I love Thee above all things, and I desire to receive Thee into my soul. Since I cannot at this moment receive Thee sacramentally, come at least spiritually into my heart. I embrace Thee as if Thou wert already there and unite myself wholly to Thee. Never permit me to be separated from Thee.'",
      durationMinutes: 5,
      relatedPrayers: [
        "act-of-spiritual-communion",
        "anima-christi",
        "act-of-faith",
        "act-of-love",
        "adoro-te-devote",
      ],
      relatedSaints: ["saint-alphonsus-liguori"],
      citations: SPIRITUAL_COMMUNION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "visits-to-the-blessed-sacrament",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: VISITS_CITATIONS,
    payload: {
      slug: "visits-to-the-blessed-sacrament",
      title: "Visits to the Blessed Sacrament",
      summary:
        "The short, frequent, unhurried visit to Christ reserved in the tabernacle — friendship kept up by calling on a friend, as St. Alphonsus Liguori described it.",
      background:
        "A private devotion given its classic form by St. Alphonsus Liguori in his little book of visits to the Most Blessed Sacrament and to the Blessed Virgin Mary, published in 1745, which provides a short visit for each day of the month. For St. Alphonsus, after the reception of the sacraments no devotion stands higher. Pope Benedict XVI recalled his Eucharistic teaching in a general audience of 30 March 2011. The visit is made to the Blessed Sacrament reserved in the tabernacle and does not require exposition.",
      devotionType: "eucharistic",
      subtype: "visit",
      practiceInstructions:
        "Enter the church quietly and genuflect toward the tabernacle. Kneel or sit near it and begin with an act of faith in the real presence and an act of adoration. Then speak simply to the Lord: thank him, ask pardon, lay your needs and the needs of others before him, and spend part of the time in silence letting him look at you. A short reading — a psalm, a Gospel passage, or one of St. Alphonsus's visits — helps. Before leaving, ask a blessing and genuflect again. Even a few minutes on the way to or from work is enough; what matters is that the visit is frequent.",
      durationMinutes: 15,
      relatedPrayers: [
        "prayer-while-visiting-the-blessed-sacrament",
        "adoro-te-devote",
        "anima-christi",
        "divine-praises",
        "act-of-spiritual-communion",
      ],
      relatedSaints: ["saint-alphonsus-liguori"],
      indulgences: ADORATION_INDULGENCE,
      citations: VISITS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "perpetual-adoration",
    authorityLevel: "USCCB",
    citations: PERPETUAL_ADORATION_CITATIONS,
    payload: {
      slug: "perpetual-adoration",
      title: "Perpetual Eucharistic Adoration",
      summary:
        "An unbroken watch before the Blessed Sacrament exposed, kept around the clock by a community or a parish so that the Lord is never left alone.",
      background:
        "Adoration before the exposed Sacrament grew out of the medieval feast of Corpus Christi and flowered in the sixteenth century as an act of reparation. Perpetual exposition today is properly the practice of religious communities that have it as part of their common life and of lay associations that have received official recognition. Where a parish undertakes it, the permission of the diocesan bishop is required; he regulates when it is permitted and on what conditions. It is not a private devotion improvised by individuals but a stable commitment of a community, ordered to the Mass from which it flows and to which it leads.",
      devotionType: "eucharistic",
      subtype: "adoration",
      practiceInstructions:
        "Perpetual adoration is organised, not improvised: obtain the permission of the local Ordinary, and set it, if in a parish, in a chapel distinct from the body of the church so that it does not interfere with the parish's liturgical life. Fill every hour of the day and night with committed adorers so that the Blessed Sacrament is never left unattended; where enough people cannot be found for some hours, reserve the Sacrament and expose it only at the hours when adorers are present. Take an hour, and keep it faithfully: begin with adoration, then thanksgiving, reparation, and intercession, using Scripture, the rosary, or silence. Exposition may never take place during the Easter Triduum.",
      durationMinutes: 60,
      relatedPrayers: [
        "o-salutaris-hostia",
        "tantum-ergo",
        "adoro-te-devote",
        "divine-praises",
        "anima-christi",
        "act-of-spiritual-communion",
      ],
      relatedSaints: [],
      indulgences: ADORATION_INDULGENCE,
      citations: PERPETUAL_ADORATION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "nocturnal-adoration",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: NOCTURNAL_ADORATION_CITATIONS,
    payload: {
      slug: "nocturnal-adoration",
      title: "Nocturnal Adoration",
      summary:
        "Adoration of the Blessed Sacrament kept through the night, in company with the Lord who asked his friends to watch one hour with him in Gethsemane.",
      background:
        "Organised night adoration on an international scale began in Rome in 1810 with the Pious Union of the Adorers of the Most Blessed Sacrament and spread through Europe and the Americas during the nineteenth century. The World Federation of Nocturnal Adoration Societies was decreed an international association of the faithful of pontifical right on 6 December 2003. Nocturnal adoration is the ordered devotion of an association or a parish rather than a private exercise, and where the Sacrament is exposed the norms of the diocesan bishop govern it.",
      devotionType: "eucharistic",
      subtype: "adoration",
      practiceInstructions:
        "Join or form a group that divides the night into hours, so that adorers relieve one another and the Lord is never left alone. Take an hour and keep it. A traditional shape for the hour: begin with an act of adoration and the O Salutaris; read the account of the agony in the garden and stay in silence with it; make reparation for the sins of the night just passed; intercede for the dying, for priests, and for those who will not pray; end with the Divine Praises. Where the Blessed Sacrament is exposed, follow the diocesan norms and ensure adorers are always present.",
      durationMinutes: 60,
      relatedPrayers: [
        "o-salutaris-hostia",
        "tantum-ergo",
        "divine-praises",
        "anima-christi",
        "te-lucis-ante-terminum",
        "eternal-rest",
      ],
      relatedSaints: [],
      indulgences: ADORATION_INDULGENCE,
      citations: NOCTURNAL_ADORATION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "corpus-christi-procession",
    authorityLevel: "VATICAN",
    citations: CORPUS_CHRISTI_PROCESSION_CITATIONS,
    payload: {
      slug: "corpus-christi-procession",
      title: "The Corpus Christi Procession",
      summary:
        "The Blessed Sacrament carried publicly through the streets on the Solemnity of the Body and Blood of Christ, so that the town itself becomes a place of adoration.",
      background:
        "Pope Urban IV extended the feast of Corpus Christi to the whole Church in 1264, and the procession grew up around it in the following century. The Directory on Popular Piety and the Liturgy treats it as the model of Eucharistic processions: it is a public act of worship, an extension of the Mass just celebrated, and a witness of faith to the town, not a display. The Blessed Sacrament is carried in a monstrance by a priest or deacon under a canopy; the procession ordinarily concludes with Benediction.",
      devotionType: "eucharistic",
      subtype: "procession",
      practiceInstructions:
        "The procession normally sets out from the Mass of the solemnity, the Sacrament having been consecrated at that Mass. Walk in order behind the cross, with candles, singing Eucharistic hymns — Pange Lingua, Lauda Sion, Adoro Te Devote — and praying between the hymns; the singing and prayer should express the faith of the whole community, not merely accompany a spectacle. Where the route allows, stop at altars prepared along the way for a Gospel reading, a prayer, and Benediction. At the end return to the church and conclude with the Tantum Ergo, the versicle and prayer, Benediction with the monstrance, and the Divine Praises. Take part with reverence and, if you cannot walk it, kneel as the Sacrament passes.",
      durationMinutes: 60,
      relatedPrayers: [
        "pange-lingua",
        "tantum-ergo",
        "o-salutaris-hostia",
        "adoro-te-devote",
        "divine-praises",
        "verbum-supernum-prodiens",
      ],
      relatedSaints: ["saint-thomas-aquinas"],
      indulgences: PROCESSION_INDULGENCE,
      citations: CORPUS_CHRISTI_PROCESSION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "benediction-of-the-blessed-sacrament",
    authorityLevel: "LITURGICAL_BOOK",
    citations: BENEDICTION_CITATIONS,
    payload: {
      slug: "benediction-of-the-blessed-sacrament",
      title: "Benediction of the Blessed Sacrament",
      summary:
        "The rite that crowns exposition: after hymns, incense, and prayer, the priest or deacon blesses the people in silence with the Host raised in the monstrance.",
      background:
        "Benediction arose in the centuries after the institution of the feast of Corpus Christi in 1264, when the Eucharist began to be carried in vessels like the monstrance we use today. It is a liturgical rite of the Church, not a private devotion, and is governed by the Church's liturgical books; the blessing is given by a priest or deacon, and exposition and Benediction are always ordered to the Mass, never set in competition with it. Adoration and Benediction may not take place at the same time as Mass in the same part of the church.",
      devotionType: "eucharistic",
      subtype: "liturgical rite",
      practiceInstructions:
        "The Blessed Sacrament is exposed in the monstrance and incensed while O Salutaris Hostia is sung. A period of adoration follows, with Scripture, silence, hymns, or prayers. Toward the end the Tantum Ergo is sung and the Sacrament is incensed again; the minister then sings or says the versicle 'You have given them bread from heaven' with its response and the prayer. Vested in humeral veil, the priest or deacon takes the monstrance and makes the sign of the cross over the people in silence — no words accompany the blessing. The Divine Praises are then said, and the Sacrament is reposed in the tabernacle as a hymn is sung. Kneel for the exposition, the Tantum Ergo, and the blessing.",
      durationMinutes: 20,
      relatedPrayers: ["o-salutaris-hostia", "tantum-ergo", "divine-praises", "adoro-te-devote"],
      relatedSaints: ["saint-thomas-aquinas"],
      citations: BENEDICTION_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "thanksgiving-after-holy-communion",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: THANKSGIVING_CITATIONS,
    payload: {
      slug: "thanksgiving-after-holy-communion",
      title: "Thanksgiving after Holy Communion",
      summary:
        "The quarter of an hour after Communion, kept in silence and prayer, when the Lord who has just been received is welcomed as a guest rather than dismissed.",
      background:
        "A private devotion of great antiquity, made within and after the Mass: the Roman Missal itself provides for a period of sacred silence after Communion, and the traditional prayer books gather the prayers of St. Thomas Aquinas, the Anima Christi, and the prayer before a crucifix for this moment. It is the personal side of what the Church does corporately in the prayer after Communion; nothing in it may be allowed to displace attention to the liturgy still being celebrated.",
      devotionType: "eucharistic",
      subtype: "thanksgiving",
      practiceInstructions:
        "After returning to your place, kneel or sit and keep silence — do not reach for a book at once. Make an act of faith in the presence of Christ within you, then adore, thank, ask pardon, and petition. Stay for ten or fifteen minutes after Mass if you can. The classic prayers for this moment are the Anima Christi, the prayer of St. Thomas Aquinas after Communion, and the prayer before a crucifix, 'En ego, o bone et dulcissime Iesu' — 'Behold, O good and most sweet Jesus.' End by offering the day and the work ahead to the Lord you have received.",
      durationMinutes: 15,
      relatedPrayers: [
        "anima-christi",
        "prayer-of-saint-thomas-after-communion",
        "prayer-before-a-crucifix",
        "adoro-te-devote",
        "thanksgiving-prayer",
      ],
      relatedSaints: ["saint-thomas-aquinas"],
      indulgences: {
        claimed: true,
        citation:
          "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant attached to the prayer 'En ego, o bone et dulcissime Iesu' (the Prayer before a Crucifix): a plenary indulgence when it is recited after Communion before an image of Christ crucified on a Friday of Lent, and a partial indulgence at other times. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
      },
      citations: THANKSGIVING_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "chaplet-of-the-blessed-sacrament",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: CHAPLET_BLESSED_SACRAMENT_CITATIONS,
    payload: {
      slug: "chaplet-of-the-blessed-sacrament",
      title: "Chaplet of the Blessed Sacrament",
      summary:
        "Thirty-three beads for the thirty-three years of the Lord's life on earth, each carrying a single cry of faith to Jesus present on the altar.",
      background:
        "A short private devotion approved by Pope St. Pius X on 30 May 1911. It is made up of a medal of the Blessed Sacrament and thirty-three beads recalling the years of Christ's earthly life. It is well suited to a visit to the tabernacle or to a period of adoration, and it is a devotional exercise rather than any part of the Church's liturgy.",
      devotionType: "eucharistic",
      subtype: "chaplet",
      practiceInstructions:
        "Begin at the medal with an act of spiritual communion: 'As I cannot now receive Thee, my Jesus, in Holy Communion, come spiritually into my heart.' Then on each of the thirty-three beads pray: 'Jesus in the Blessed Sacrament on the altar, have mercy on us.' Pray it slowly before the tabernacle or the exposed Sacrament, letting each bead stand for a year of the Lord's hidden and public life given for us.",
      practiceText: "Jesus in the Blessed Sacrament on the altar, have mercy on us.",
      durationMinutes: 10,
      relatedPrayers: [
        "act-of-spiritual-communion",
        "anima-christi",
        "adoro-te-devote",
        "divine-praises",
      ],
      relatedSaints: ["saint-pope-pius-x"],
      citations: CHAPLET_BLESSED_SACRAMENT_CITATIONS,
    },
  },
];

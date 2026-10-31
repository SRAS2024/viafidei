import type { CuratedEntry } from "../index";

/**
 * Devotion group 3: the pious exercises of the Church's year that the Directory
 * on Popular Piety and the Liturgy commends by name (the Via Matris, the Via
 * Lucis, the Christmas crib, the visit to the altar of repose, the Easter
 * encounter of the risen Christ with his Mother, the blessing of Easter food),
 * together with devotions of the universal Church and of particular peoples
 * that the earlier groups do not yet cover.
 *
 * The rules of groups 1 and 2 apply unchanged. Every entry describes a devotion
 * the Church actually practises and that is described on the pages cited under
 * it; summaries, backgrounds and instructions are editorial text written from
 * those pages. No prayer text is reproduced: where a practice is built on
 * Scripture, the passages are named, and the few words quoted from the Bible
 * are given in the Douay-Rheims version. Pious stories whose historical basis
 * is uncertain are reported as tradition, and where sources disagree on a date
 * the date is left out.
 *
 * `background` says in each case whether the practice is part of the liturgy,
 * attached to it, or a private and popular exercise of piety, as the Directory
 * asks. Only one indulgence is claimed — the Enchiridion's grant for adoration
 * of the Blessed Sacrament, which covers the Holy Thursday watch — and it is
 * described in words with its source named; where a devotion once carried
 * indulgences that are not claimed today, the entry says `claimed: false`.
 */

/* --------------------------- Holy See ---------------------------- */

const DIRECTORY_POPULAR_PIETY =
  "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html";
const ADMIRABILE_SIGNUM =
  "https://www.vatican.va/content/francesco/en/apost_letters/documents/papa-francesco-lettera-ap_20191201_admirabile-signum.html";
const ENCHIRIDION_INDULGENTIARUM =
  "https://www.vatican.va/roman_curia/tribunals/apost_penit/documents/rc_trib_appen_doc_20020826_enchiridion-indulgentiarum_lt.html";
const PWPN_STATUTES =
  "https://www.vatican.va/content/francesco/en/motu_proprio/documents/20240701-statuto-rete-mondiale-preghiera.html";
const FRANCIS_AT_THE_SHRINE_OF_THE_LORD_OF_MIRACLES =
  "https://www.vatican.va/content/francesco/en/homilies/2018/documents/papa-francesco_20180121_omelia-peru-lima-preghiera.html";

/* ----------------------- Other Catholic sources ------------------ */

const ALETEIA_VIA_MATRIS =
  "https://aleteia.org/2018/03/23/a-marian-alternative-to-the-stations-of-the-cross";
const LITURGICAL_ARTS_VIA_MATRIS =
  "https://www.liturgicalartsjournal.com/2019/12/saving-catholic-artistic-heritage-via.html";
const CATHOLIC_COMPANY_VIA_LUCIS =
  "https://www.catholiccompany.com/magazine/praying-the-via-lucis-way-of-light-during-the-easter-season/";
const FATIMA_VIA_LUCIS = "https://www.fatima.pt/en/news/way-of-light-inaugurated-in-fatima";
const CATHOLICS_AND_CULTURES_VISITA_IGLESIA =
  "https://www.catholicsandcultures.org/philippines-catholics-vow-visit-seven-churches-during-holy-week";
const ALETEIA_SALUBONG =
  "https://aleteia.org/2017/04/15/salubong-an-easter-morning-mother-and-child-reunion";
const ARKANSAS_CATHOLIC_EASTER_FOOD =
  "https://arkansas-catholic.org/2015/03/26/holy-saturday-food-blessing-a-tradition-from-poland/";
const CORK_AND_ROSS_EASTER_FOOD =
  "https://corkandross.org/news/blessing-of-food-marks-start-of-easter-for-polish-people-in-our-diocese";
const MESIA_THREE_HOURS_ARCHIVE =
  "https://archive.org/details/devotion-of-the-three-hours-by-father-alonso-mesia";
const WIKIPEDIA_THREE_HOURS = "https://en.wikipedia.org/wiki/Three_Hours%27_Agony";
const CATHOLIC_COMPANY_GREGORIAN_MASSES =
  "https://www.catholiccompany.com/getfed/what-are-gregorian-masses/";
const ALETEIA_GREGORIAN_MASSES =
  "https://aleteia.org/2018/11/07/what-are-gregorian-masses-for-the-dead";
const EWTN_GREGORIAN_MASSES = "https://www.ewtn.com/catholicism/library/gregorian-masses-4473";
const WIKIPEDIA_GREGORIAN_MASSES = "https://en.wikipedia.org/wiki/Gregorian_Masses";
const OP_ANGELIC_WARFARE = "https://www.op.org/angelic-warfare-confraternity/";
const ANGELIC_WARFARE_HISTORY = "https://angelicwarfareconfraternity.org/history/";
const POPES_PRAYER_USA_ABOUT = "https://popesprayerusa.net/about/";
const ANDINA_LORD_OF_MIRACLES =
  "https://andina.pe/ingles/noticia-perus-lord-of-miracles-everything-you-need-to-know-about-limas-deepest-devotion-1048798.aspx";
const EWTN_BLACK_NAZARENE_HISTORY = "https://ewtnnews.com/world/history-black-nazarene-philippines";
const EWTN_BLACK_NAZARENE_PROCESSION =
  "https://ewtnnews.com/world/black-nazarene-procession-attracts-millions-in-the-philippines";
const OPUS_DEI_SEVEN_SUNDAYS = "https://opusdei.org/en/article/seven-sundays-of-saint-joseph";
const ALETEIA_SEVEN_SUNDAYS =
  "https://aleteia.org/2018/01/28/what-is-the-powerful-seven-sundays-devotion-to-st-joseph";
const CATHOLIC_ANSWERS_BLESSING_OF_ANIMALS =
  "https://catholic.com/magazine/online-edition/why-the-church-blesses-animals";
const ALETEIA_ANIMALS_BLESSED_AT_THE_VATICAN =
  "https://aleteia.org/2023/01/17/despite-a-rainy-morning-animals-blessed-at-vatican";
const NCREGISTER_ST_JOSEPH_TABLES =
  "https://www.ncregister.com/features/st-joseph-day-tables-feast-day";
const EWTN_ST_JOSEPH_ALTARS =
  "https://www.ewtnnews.com/world/us/how-the-big-easy-celebrates-st-joseph";
const VARSITARIAN_SIMBANG_GABI =
  "https://varsitarian.net/whats-the-difference-simbang-gabi-misa-de-aguinaldo-misa-de-gallo/";
const US_CATHOLIC_SIMBANG_GABI =
  "https://uscatholic.org/articles/202012/the-christmas-tradition-of-simbang-gabi/";

/* -------------------------- Indulgence notes ---------------------- */

const HOLY_THURSDAY_ADORATION_INDULGENCE = {
  claimed: true,
  citation:
    "Enchiridion Indulgentiarum, 4th ed. (Apostolic Penitentiary, 1999), grant 7 on Eucharistic adoration: a plenary indulgence, on the usual conditions, for visiting the Blessed Sacrament to adore it for at least half an hour, and for devoutly reciting the verses of the Tantum ergo during the solemn reposition of the Blessed Sacrament after the Mass of the Lord's Supper on Holy Thursday; a partial indulgence for a shorter visit made in adoration. The governing norms are those of Paul VI, Indulgentiarum Doctrina (1967).",
};

const NO_INDULGENCE_CLAIMED = { claimed: false };

/* ------------------------------------------------------------------ */
/* Citation sets                                                       */
/* ------------------------------------------------------------------ */

const VIA_MATRIS_CITATIONS = [
  DIRECTORY_POPULAR_PIETY,
  ALETEIA_VIA_MATRIS,
  LITURGICAL_ARTS_VIA_MATRIS,
];
const VIA_LUCIS_CITATIONS = [DIRECTORY_POPULAR_PIETY, CATHOLIC_COMPANY_VIA_LUCIS, FATIMA_VIA_LUCIS];
const CHRISTMAS_CRIB_CITATIONS = [ADMIRABILE_SIGNUM, DIRECTORY_POPULAR_PIETY];
const VISITA_IGLESIA_CITATIONS = [
  DIRECTORY_POPULAR_PIETY,
  CATHOLICS_AND_CULTURES_VISITA_IGLESIA,
  ENCHIRIDION_INDULGENTIARUM,
];
const EASTER_ENCOUNTER_CITATIONS = [DIRECTORY_POPULAR_PIETY, ALETEIA_SALUBONG];
const EASTER_FOOD_CITATIONS = [
  DIRECTORY_POPULAR_PIETY,
  ARKANSAS_CATHOLIC_EASTER_FOOD,
  CORK_AND_ROSS_EASTER_FOOD,
];
const THREE_HOURS_CITATIONS = [MESIA_THREE_HOURS_ARCHIVE, WIKIPEDIA_THREE_HOURS];
const GREGORIAN_MASSES_CITATIONS = [
  CATHOLIC_COMPANY_GREGORIAN_MASSES,
  ALETEIA_GREGORIAN_MASSES,
  EWTN_GREGORIAN_MASSES,
  WIKIPEDIA_GREGORIAN_MASSES,
];
const ANGELIC_WARFARE_CITATIONS = [OP_ANGELIC_WARFARE, ANGELIC_WARFARE_HISTORY];
const PRAYER_NETWORK_CITATIONS = [PWPN_STATUTES, POPES_PRAYER_USA_ABOUT];
const LORD_OF_MIRACLES_CITATIONS = [
  FRANCIS_AT_THE_SHRINE_OF_THE_LORD_OF_MIRACLES,
  ANDINA_LORD_OF_MIRACLES,
];
const BLACK_NAZARENE_CITATIONS = [EWTN_BLACK_NAZARENE_HISTORY, EWTN_BLACK_NAZARENE_PROCESSION];
const SEVEN_SUNDAYS_CITATIONS = [OPUS_DEI_SEVEN_SUNDAYS, ALETEIA_SEVEN_SUNDAYS];
const BLESSING_OF_ANIMALS_CITATIONS = [
  CATHOLIC_ANSWERS_BLESSING_OF_ANIMALS,
  ALETEIA_ANIMALS_BLESSED_AT_THE_VATICAN,
];
const ST_JOSEPHS_TABLE_CITATIONS = [NCREGISTER_ST_JOSEPH_TABLES, EWTN_ST_JOSEPH_ALTARS];
const SIMBANG_GABI_CITATIONS = [VARSITARIAN_SIMBANG_GABI, US_CATHOLIC_SIMBANG_GABI];

export const devotionGroupThree: CuratedEntry[] = [
  /* --------------- Pious exercises of the Church's year -------------- */
  {
    contentType: "DEVOTION",
    slug: "via-matris",
    authorityLevel: "VATICAN",
    citations: VIA_MATRIS_CITATIONS,
    payload: {
      slug: "via-matris",
      title: "The Via Matris (Way of the Sorrowful Mother)",
      summary:
        "Modelled on the Stations of the Cross, the Via Matris walks with the Blessed Virgin through her seven sorrows, from Simeon's prophecy to the burial of her Son, as a journey of faith and sorrow on which she goes ahead of the Church.",
      background:
        "A pious exercise, not a liturgical rite. The Directory on Popular Piety and the Liturgy explains that it developed on the model of the Via Crucis and was approved by the Apostolic See; it existed in embryonic form from the sixteenth century and took its present shape in the nineteenth, with seven stations corresponding to the seven sorrows of Mary. The Servants of Mary, whose spirituality centres on Our Lady of Sorrows, have long promoted it; at their Basilica of Our Lady of Sorrows in Chicago it was prayed publicly from 1937, every Friday for many years, before a cycle of seven paintings of the sorrows. The Directory notes that it harmonises with the themes of Lent, that it always leads back to Christ the suffering servant and to the Church, which walks the road on which Mary has gone before, and that its highest expression is the Pietà.",
      devotionType: "marian",
      subtype: "stations",
      practiceInstructions:
        "Move from station to station in a church or garden where the sorrows are depicted, or keep the stations in meditation at home. They follow the seven sorrows: (1) the prophecy of Simeon (Luke 2:34-35); (2) the flight into Egypt (Matthew 2:13-15); (3) the loss of the Child Jesus in the Temple (Luke 2:41-50); (4) Mary meets Jesus on the way to Calvary; (5) Mary stands at the foot of the Cross (John 19:25-30); (6) Mary receives the body of her Son taken down from the Cross; (7) Jesus is laid in the tomb. At each station read the Gospel passage, keep a short silence, and pray — a Hail Mary, a verse of the Stabat Mater, or a prayer in your own words — asking to share Mary's faith beside her Son. It is especially fitting in Lent and on the memorial of Our Lady of Sorrows, 15 September.",
      durationMinutes: 30,
      relatedPrayers: [
        "stabat-mater",
        "seven-sorrows-of-mary-prayer",
        "litany-of-our-lady-of-sorrows",
        "hail-mary",
      ],
      relatedSaints: [],
      citations: VIA_MATRIS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "via-lucis",
    authorityLevel: "VATICAN",
    citations: VIA_LUCIS_CITATIONS,
    payload: {
      slug: "via-lucis",
      title: "The Via Lucis (Way of Light)",
      summary:
        "A companion to the Way of the Cross for the Easter season, the Via Lucis follows the risen Christ in fourteen stations from the Resurrection to Pentecost, so that those who have walked with him to Calvary may also walk with him into the light.",
      background:
        "A recent pious exercise, not a liturgical rite. It was proposed in 1988 by Fr. Sabino Palumbieri, a Salesian teaching at the Salesian university in Rome, and the Directory on Popular Piety and the Liturgy (2001) commends it: following the model of the Via Crucis, the faithful meditate on the appearances of Jesus from his Resurrection to his Ascension and recall their Baptism, by which they passed from the darkness of sin into the light of grace — an excellent pedagogy of the faith, per crucem ad lucem. The list of stations varies a little from one booklet to another. Many churches now have Via Lucis images; at the Sanctuary of Fátima a set of fourteen paintings given by the Italian movement Testimoni del Risorto was blessed in 2008, the bishop calling the two ways two faces of the same coin.",
      devotionType: "christological",
      subtype: "Eastertide",
      practiceInstructions:
        "Pray it on the Sundays of Easter or on any day between Easter and Pentecost, in a church with Via Lucis images or simply with a Bible. A widely used sequence of fourteen stations runs: the Resurrection; the finding of the empty tomb; the risen Lord and Mary Magdalene; the road to Emmaus; the breaking of the bread; the appearance to the disciples; the gift of peace and of the power to forgive sins; the strengthening of Thomas's faith; the appearance by the Sea of Tiberias; the forgiveness of Peter and the charge to feed the sheep; the commissioning on the mountain; the Ascension; the waiting in prayer with Mary; and the descent of the Holy Spirit at Pentecost. At each station proclaim the Gospel passage, keep silence, add a short prayer and an acclamation of praise to the risen Christ, and close the whole exercise with the Our Father; the Regina Caeli makes a fitting ending.",
      durationMinutes: 45,
      relatedPrayers: ["regina-caeli", "our-father", "veni-creator-spiritus"],
      relatedSaints: [],
      citations: VIA_LUCIS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "christmas-crib",
    authorityLevel: "VATICAN",
    citations: CHRISTMAS_CRIB_CITATIONS,
    payload: {
      slug: "christmas-crib",
      title: "The Christmas Crib (Nativity Scene)",
      summary:
        "Setting up a crib at Christmas — in the church, the home, the school or the town square — makes the mystery of the Incarnation visible: the Word made flesh lying in a manger, with Mary and Joseph, the shepherds, the poor and, at the Epiphany, the Magi.",
      background:
        "A custom of popular and domestic piety. Representations of the Nativity are found in churches from antiquity, but the building of cribs, especially in the home, spread from the thirteenth century under the influence of Saint Francis of Assisi, who at Greccio at Christmas 1223, with the help of a local man named John, had the scene of Bethlehem prepared with a manger, an ox and a donkey, and Mass celebrated over the manger. The Directory on Popular Piety and the Liturgy commends the family crib as an occasion for prayer and for reading the Gospel accounts of the Lord's birth, with children playing a large part. Pope Francis's apostolic letter Admirabile Signum, signed at Greccio on 1 December 2019, encourages the custom in homes, workplaces, schools, hospitals, prisons and public squares, and explains the meaning of its figures — the night sky, the shepherds, the poor who have every right to draw near, the Holy Family and the Magi.",
      devotionType: "christological",
      subtype: "Christmas",
      practiceInstructions:
        "Make the crib a place of family prayer. On Christmas Eve, when the crib is completed in the home, gather before it to read Saint Luke's account of the birth of Christ (Luke 2:1-20), sing Christmas carols, and offer prayers of petition and praise, especially the prayers of the children, as the Directory on Popular Piety suggests. Through the Christmas season come back to the crib for a short moment of prayer or to read the Gospel accounts of the Lord's birth, and at the Epiphany read the coming of the Magi (Matthew 2:1-12).",
      relatedPrayers: ["gloria-in-excelsis", "hail-mary", "our-father"],
      relatedSaints: ["saint-francis-of-assisi", "saint-joseph"],
      citations: CHRISTMAS_CRIB_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "visita-iglesia-altar-of-repose",
    authorityLevel: "VATICAN",
    citations: VISITA_IGLESIA_CITATIONS,
    payload: {
      slug: "visita-iglesia-altar-of-repose",
      title: "Visita Iglesia: Visiting the Altars of Repose on Holy Thursday",
      summary:
        "On the night of Holy Thursday, after the Mass of the Lord's Supper, the faithful keep watch with Christ before the Blessed Sacrament at the altar of repose; in the Philippines and elsewhere the custom has grown of visiting seven churches in turn, the Visita Iglesia.",
      background:
        "A practice of popular piety attached to the liturgy of Holy Thursday. The Directory on Popular Piety and the Liturgy commends silent and prolonged adoration at the altar of repose while asking that its meaning be explained: the Eucharist is reserved there for the Communion of Good Friday and for Viaticum, so the place should not be called or decorated as a sepulchre, the Sacrament remains in a closed tabernacle rather than in a monstrance, and after midnight, when the day of the Lord's Passion has begun, the adoration is to end without solemnity. The visit to seven churches is commonly traced to the pilgrimage to the churches of Rome promoted by Saint Philip Neri in the sixteenth century; in the Philippines it is a widely kept Holy Week vow, and the bishops there ask that it never become a substitute for the liturgy itself.",
      devotionType: "eucharistic",
      subtype: "Holy Week",
      practiceInstructions:
        "Take part first in the evening Mass of the Lord's Supper and the procession of the Blessed Sacrament to the altar of repose. Then, before the churches close at midnight, visit the altar of repose in your own church and, if you wish, in others — traditionally seven. In each, kneel before the tabernacle and keep watch with Christ in his agony, answering his question to the sleeping disciples, 'Could you not watch one hour with me?' (Matthew 26:40): pray in silence, read the Gospel of the Last Supper or of Gethsemane, pray the Rosary or divide the Stations of the Cross among the churches, and make an act of spiritual communion. Go quietly, as to a place of prayer rather than a sightseeing tour, and give an alms to the poor at each church, as many Filipino families do.",
      relatedPrayers: [
        "tantum-ergo",
        "pange-lingua",
        "adoro-te-devote",
        "prayer-while-visiting-the-blessed-sacrament",
        "act-of-spiritual-communion",
      ],
      relatedSaints: ["saint-philip-neri"],
      indulgences: HOLY_THURSDAY_ADORATION_INDULGENCE,
      citations: VISITA_IGLESIA_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "easter-encounter-salubong",
    authorityLevel: "VATICAN",
    citations: EASTER_ENCOUNTER_CITATIONS,
    payload: {
      slug: "easter-encounter-salubong",
      title: "The Easter Encounter of the Risen Christ and His Mother (Salubong)",
      summary:
        "Before dawn on Easter Sunday two processions, one carrying an image of the risen Christ and the other an image of his Mother veiled in mourning, set out from different directions and meet before the church, where the veil is lifted and the Easter joy breaks out.",
      background:
        "A pious exercise of popular piety, kept in the Philippines as the Salubong — the word means welcome — and in similar forms elsewhere, including some towns of Italy. The Directory on Popular Piety and the Liturgy describes it as a representation of the Church's affirmation that God filled the Virgin with joy in the resurrection of her Son: the meeting shows Mary as the first and full participant in the mystery of Easter. It asks that the exercise never acquire greater importance than the Easter liturgy itself and that liturgical and devotional forms not be mixed. The Gospels do not record a meeting of the risen Lord with his Mother; the custom expresses the conviction of Christian piety that she who stood by the Cross was the first to share the joy of the Resurrection.",
      devotionType: "marian",
      subtype: "Easter procession",
      practiceInstructions:
        "Where a parish keeps the custom, join one of the two processions before dawn on Easter Sunday — traditionally the men and boys with the image of the risen Christ, the women and girls with the image of Mary veiled in black. At the meeting place before the church a child dressed as an angel lifts the veil from Mary's image while the Alleluia is sung, and the two processions enter the church together for the Mass of Easter morning. In the home the same joy can be marked by greeting Mary at her image with the Regina Caeli on Easter morning.",
      relatedPrayers: ["regina-caeli"],
      relatedSaints: [],
      citations: EASTER_ENCOUNTER_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blessing-of-easter-food",
    authorityLevel: "VATICAN",
    citations: EASTER_FOOD_CITATIONS,
    payload: {
      slug: "blessing-of-easter-food",
      title: "The Blessing of Easter Food (Święconka)",
      summary:
        "On Holy Saturday families bring baskets holding a sampling of their Easter breakfast — breads and cakes, eggs, meats, salt and other foods — to the church to be blessed, so that the first meal of Easter begins with a blessing as the fast gives way to the feast.",
      background:
        "A blessing belonging to popular piety, kept above all by Polish and other Central and Eastern European Catholics and carried by them wherever they have settled. The Directory on Popular Piety and the Liturgy mentions among the pious exercises of Easter the traditional blessing of eggs, a symbol of life, and the blessing of the family table, which it wants encouraged every day and especially on Easter Sunday. In the Polish custom, Święconka, the basket is lined with white linen and trimmed with greenery; the blessing covers its three groups of food — breads and pastries, meats and sausages, and eggs — and the food is then set aside until Easter morning, when the family shares the blessed egg and eats the breakfast together after Mass.",
      devotionType: "liturgical",
      subtype: "blessing",
      practiceInstructions:
        "Ask your parish when the blessing of Easter food is given on Holy Saturday; it is usually offered at set times through the day. Prepare a basket lined with a white cloth and fill it with a little of the Easter breakfast: bread or a sweet Easter cake, decorated eggs, sausage or ham, salt and, if you wish, horseradish, butter shaped as a lamb and a candle. Bring it to church for the blessing and keep it covered at home until Easter morning, since Holy Saturday remains a day of quiet waiting at the Lord's tomb. Begin the Easter breakfast by sharing the blessed egg with Easter wishes among everyone at table, and say grace before the meal.",
      relatedPrayers: ["grace-before-meals"],
      relatedSaints: [],
      citations: EASTER_FOOD_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "three-hours-agony-tre-ore",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: THREE_HOURS_CITATIONS,
    payload: {
      slug: "three-hours-agony-tre-ore",
      title: "The Three Hours' Agony (Tre Ore)",
      summary:
        "From noon until three in the afternoon on Good Friday — the hours Christ hung on the Cross — the faithful keep watch with him, meditating in turn on the seven last words he spoke from the Cross, with prayers, hymns and silence.",
      background:
        "A pious exercise, not part of the liturgy of Good Friday. It was begun in Lima by the Peruvian Jesuit Alonso Mesía (1665–1732), probably in the years after the earthquakes that struck the city from 1687; first kept privately in his own church, it was taken up by the parishes and religious houses of Lima and spread through Peru, Chile and Quito to Panama and Mexico, and then to Rome, where it was held at the church of the Gesù. Pope Pius VI granted an indulgence to those who took part there, and Pope Pius VII attached a plenary indulgence to the devotion in 1815; those grants belong to its history and are not claimed here. The original method gave each of the seven words a meditation with prayers and a hymn; later practice often turned it into a series of short sermons, and the devotion has been widely adopted beyond the Catholic Church. Since the Church's own Celebration of the Lord's Passion takes place in the afternoon, the Three Hours are best kept so that they lead into it rather than replace it.",
      devotionType: "passion",
      subtype: "Holy Week",
      practiceInstructions:
        "On Good Friday, from noon until three, keep the three hours in a church where the devotion is held, or at home before a crucifix. Take the seven last words in order: 'Father, forgive them, for they know not what they do' (Luke 23:34); 'This day thou shalt be with me in paradise' (Luke 23:43); 'Woman, behold thy son ... Behold thy mother' (John 19:26-27); 'My God, my God, why hast thou forsaken me?' (Matthew 27:46); 'I thirst' (John 19:28); 'It is consummated' (John 19:30); 'Father, into thy hands I commend my spirit' (Luke 23:46). For each, read the passage, listen to or read a short meditation, keep a period of silence, and pray — a verse of the Stabat Mater or of a Passion hymn, an Our Father, or an act of contrition. End at three o'clock, the hour of Christ's death, and go on to the Celebration of the Lord's Passion.",
      durationMinutes: 180,
      relatedPrayers: [
        "stabat-mater",
        "vexilla-regis",
        "litany-of-the-passion",
        "prayer-before-a-crucifix",
        "act-of-contrition",
      ],
      relatedSaints: [],
      indulgences: NO_INDULGENCE_CLAIMED,
      citations: THREE_HOURS_CITATIONS,
    },
  },

  /* ------------------ Devotions of the universal Church ----------------- */
  {
    contentType: "DEVOTION",
    slug: "gregorian-masses",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: GREGORIAN_MASSES_CITATIONS,
    payload: {
      slug: "gregorian-masses",
      title: "Gregorian Masses for the Dead",
      summary:
        "Gregorian Masses are a series of thirty Masses offered on thirty consecutive days for the soul of one person who has died, a practice named after Pope Saint Gregory the Great.",
      background:
        "The practice goes back to an account in the Dialogues of Saint Gregory the Great: Justus, a monk of Gregory's monastery of Saint Andrew in Rome, broke his vow of poverty by keeping some gold coins and died repentant; Gregory had Mass offered for him on thirty successive days, and at the end of them Justus appeared to his brother Copiosus to say that he had been set free. The custom spread through the monasteries of the Middle Ages and was later regulated by the Holy See, which in 1888 called the confidence of the faithful in the special efficacy of Gregorian Masses pious and reasonable. It rests on the Church's teaching that the Eucharistic sacrifice is offered for the faithful departed; it is not a guarantee of any particular result, which remains in the hands of God.",
      devotionType: "general",
      subtype: "prayer for the dead",
      practiceInstructions:
        "Gregorian Masses can be requested only for the dead, and only for one person at a time. Because the thirty Masses are offered on consecutive days, a parish priest can rarely accept the request (since 1967 a series interrupted by an unforeseen impediment or for a reasonable cause, such as a funeral or wedding Mass, is completed as soon as possible rather than begun again); it is usually made to a monastery, seminary, religious community or mission society that offers them, with the customary offering. While the Masses are being offered, the family can join them by praying daily for the one who has died — the Eternal Rest or the De Profundis — and by going to Mass when they can.",
      relatedPrayers: ["eternal-rest", "de-profundis", "prayer-for-the-faithful-departed"],
      relatedSaints: ["saint-gregory-the-great"],
      citations: GREGORIAN_MASSES_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "angelic-warfare-confraternity",
    authorityLevel: "RELIGIOUS_ORDER",
    citations: ANGELIC_WARFARE_CITATIONS,
    payload: {
      slug: "angelic-warfare-confraternity",
      title: "The Angelic Warfare Confraternity (Cord of Saint Thomas Aquinas)",
      summary:
        "A confraternity entrusted to the Dominican Order in which men and women help one another by prayer to live chastely according to their state in life, under the patronage of Saint Thomas Aquinas and the Blessed Virgin Mary, wearing a blessed cord or medal of Saint Thomas.",
      background:
        "An association of the faithful, not a liturgical rite. It springs from the tradition that the young Thomas Aquinas, held prisoner by his family to keep him from the Dominicans, drove away a temptation against chastity and was then girded by angels, in a vision, with a cord. The devotion spread among students and the young, and in the seventeenth century the Dominican Franciscus Deurweerders organised it as a confraternity at the University of Louvain; it was approved for the universal Church by Pope Benedict XIII in 1727. Today it is an international association of the faithful in the care of the Order of Preachers, and it counts Saint Aloysius Gonzaga among its saints. The cord is a sign of grace sought in prayer, not a charm.",
      devotionType: "saintly",
      subtype: "confraternity",
      practiceInstructions:
        "Ask a Dominican priest, or another priest authorised to enrol members, to receive you; after the short rite of reception your name is sent to the confraternity's director for its register. Wear the blessed cord or the medal of Saint Thomas, or both, as continuously as is reasonably possible. Each day pray fifteen Hail Marys for chastity, for yourself and for all the members, together with the two traditional prayers to Saint Thomas for purity. Join the practice to the sacraments, especially frequent confession and Communion, and to the ordinary means of guarding purity of heart.",
      relatedPrayers: ["hail-mary", "prayer-for-purity"],
      relatedSaints: ["saint-thomas-aquinas", "saint-aloysius-gonzaga"],
      citations: ANGELIC_WARFARE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "popes-worldwide-prayer-network",
    authorityLevel: "VATICAN",
    citations: PRAYER_NETWORK_CITATIONS,
    payload: {
      slug: "popes-worldwide-prayer-network",
      title: "The Pope's Worldwide Prayer Network and the Daily Offering",
      summary:
        "Through the Pope's Worldwide Prayer Network, formerly the Apostleship of Prayer, Catholics offer each day to God in union with the Heart of Jesus and pray for the intention that the Pope proposes to the whole Church each month.",
      background:
        "A pontifical work of the Holy See entrusted to the Society of Jesus, not a liturgical rite. It began on 3 December 1844 at Vals-près-le-Puy in France, when the Jesuit Fr. François-Xavier Gautrelet urged young Jesuits longing for the missions to be missionaries already by prayer and by the offering of their daily lives. Pope Pius IX recognised the Apostleship of Prayer in 1849, and from 1890 Pope Leo XIII entrusted it with his monthly prayer intentions; its youth branch, founded in 1915 as the Eucharistic Crusade, is now the Eucharistic Youth Movement. Pope Francis renewed the work as the Pope's Worldwide Prayer Network, made it a Vatican foundation in 2020 and approved its definitive statutes on 1 July 2024, which describe its spirituality as that of the Heart of Jesus and its mission as prayer and service in the face of the challenges to humanity and to the mission of the Church that the Pope presents each month.",
      devotionType: "christological",
      subtype: "apostleship of prayer",
      practiceInstructions:
        "Begin each day with a morning offering, giving God your prayers, works, joys and sufferings in union with the Heart of Jesus offered in the Eucharist, for the intentions of the Holy Father. Learn the Pope's prayer intention for the month, which the Network publishes, and pray for it every day; let the day's ordinary work be your apostolate. Renew the offering briefly during the day. Those who wish can join a local group of the Network or, for children and young people, the Eucharistic Youth Movement.",
      relatedPrayers: ["morning-offering", "prayer-for-the-pope"],
      relatedSaints: [],
      citations: PRAYER_NETWORK_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "seven-sundays-of-saint-joseph",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: SEVEN_SUNDAYS_CITATIONS,
    payload: {
      slug: "seven-sundays-of-saint-joseph",
      title: "The Seven Sundays of Saint Joseph",
      summary:
        "In preparation for the solemnity of Saint Joseph on 19 March, the seven Sundays before it are each given to one of his seven sorrows and seven joys, as the Gospels of Jesus' infancy tell them.",
      background:
        "A private devotion. Its origins are uncertain — one pious story tells of two Franciscans saved from shipwreck by a stranger who named himself Joseph and asked them to honour his sorrows and joys — but it spread widely in the nineteenth century: Pope Gregory XVI encouraged the custom and attached many indulgences to it, and Blessed Pius IX asked the faithful to invoke Saint Joseph for the afflictions of the universal Church. No indulgence is claimed for it here. The devotion is a way of entering the Gospels of Christ's childhood through the eyes of the man who guarded it.",
      devotionType: "saintly",
      subtype: "seasonal observance",
      practiceInstructions:
        "Count back seven Sundays from 19 March; the first falls in late January or early February. Each Sunday take one pair of sorrow and joy: (1) Joseph's doubt and the angel's message (Matthew 1:19-20); (2) the poverty of Christ's birth and the birth of the Saviour (Luke 2:7, 10-11); (3) the circumcision and the Holy Name of Jesus (Luke 2:21; Matthew 1:25); (4) Simeon's prophecy and the redemption it announces (Luke 2:34, 38); (5) the flight into Egypt and the fall of Egypt's idols (Matthew 2:14; Isaiah 19:1); (6) the return from Egypt and the hidden life at Nazareth (Matthew 2:22; Luke 2:39); (7) the loss of the Child Jesus and his finding in the Temple (Luke 2:45-46). Read the passages slowly, consider what Joseph felt, pray for a particular intention, and close with a prayer to Saint Joseph or his litany.",
      relatedPrayers: [
        "prayer-to-saint-joseph",
        "litany-of-saint-joseph",
        "memorare-to-saint-joseph",
      ],
      relatedSaints: ["saint-joseph"],
      indulgences: NO_INDULGENCE_CLAIMED,
      citations: SEVEN_SUNDAYS_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "blessing-of-animals",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: BLESSING_OF_ANIMALS_CITATIONS,
    payload: {
      slug: "blessing-of-animals",
      title: "The Blessing of Animals",
      summary:
        "Catholics bring their pets, livestock and working animals to be blessed, thanking the Creator for the creatures that share and serve human life — traditionally on the feast of Saint Anthony the Abbot, 17 January, and, especially in the United States, on or near the feast of Saint Francis of Assisi, 4 October.",
      background:
        "A blessing, one of the sacramentals, provided for in the Church's Book of Blessings. Its introduction notes that by the providence of the Creator animals have a place in human life — helping people in their work and supplying food and clothing — and that the custom of invoking God's blessing on them may be continued, for example on a saint's feast. The rite may take a longer or shorter form, with readings and intercessions or with the prayer of blessing alone, and the animals may be sprinkled with holy water. In Rome the blessing has been given on Saint Anthony's day since the Middle Ages and is still held at the Vatican each 17 January, since Anthony, the father of monasticism, is honoured as the protector of animals; the October blessings on the feast of Saint Francis are a later custom, widespread in America.",
      devotionType: "liturgical",
      subtype: "blessing",
      practiceInstructions:
        "Watch for a parish blessing of animals on or near 17 January or 4 October, often held outdoors. Bring pets on a lead or in a carrier, and farm or working animals where space allows. The minister reads a short passage of Scripture on God's care for his creatures, leads intercessions, and blesses the animals with holy water. At home the family can mark the day by thanking God for its animals, praying the canticle of the three young men in Daniel 3 — 'O all ye beasts and cattle, bless the Lord' — and resolving to care for creation as a gift entrusted to us.",
      relatedPrayers: ["canticle-of-daniel-benedicite"],
      relatedSaints: ["saint-anthony-the-abbot", "saint-francis-of-assisi"],
      citations: BLESSING_OF_ANIMALS_CITATIONS,
    },
  },

  /* ------------------- Devotions of particular peoples ------------------ */
  {
    contentType: "DEVOTION",
    slug: "lord-of-miracles-of-lima",
    authorityLevel: "VATICAN",
    citations: LORD_OF_MIRACLES_CITATIONS,
    payload: {
      slug: "lord-of-miracles-of-lima",
      title: "The Lord of Miracles of Lima (Señor de los Milagros)",
      summary:
        "Lima's greatest devotion is to an image of Christ crucified painted on an adobe wall in the seventeenth century, venerated in the Sanctuary of Las Nazarenas and carried each October through the streets of the city by brotherhoods robed in purple.",
      background:
        "A popular devotion, and the deepest of Lima's devotions, venerated by millions. The image of the crucified Christ was painted in the mid-seventeenth century by an enslaved man brought from Angola, on an adobe wall that was revered after it withstood the earthquakes that devastated Lima; the original stands over the main altar of the Sanctuary of Las Nazarenas, the church of the Discalced Carmelite Nazarene nuns, and a seventeenth-century copy is carried in the processions. October is kept in Lima as the month of the Lord of Miracles, with Masses almost every hour in the sanctuary and processions on several days. The Brotherhood of bearers and incense-bearers, founded in 1878 and recognised by the Church in 1955, organises the processions under a steward appointed by the Archbishop of Lima. Pope Francis prayed with contemplative nuns at the Shrine of the Lord of Miracles on 21 January 2018 and spoke of it as a shrine visited so often by Peruvians to ask the Lord for his closeness and mercy.",
      devotionType: "christological",
      subtype: "popular devotion",
      practiceInstructions:
        "In October join the processions of the Lord of Miracles in Lima, walking with the image in prayer and, if you belong to a brotherhood, in its purple habit. Visit the Sanctuary of Las Nazarenas to pray before the image and take part in one of the Masses celebrated there through the month. Wherever you are, the devotion can be kept by praying before a crucifix for those who suffer, especially the victims of earthquakes and disasters, and by joining a novena or vigil in honour of the Lord of Miracles where one is held.",
      relatedPrayers: ["prayer-before-a-crucifix", "litany-of-the-passion"],
      relatedSaints: [],
      citations: LORD_OF_MIRACLES_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "black-nazarene-of-quiapo",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: BLACK_NAZARENE_CITATIONS,
    payload: {
      slug: "black-nazarene-of-quiapo",
      title: "Devotion to the Black Nazarene of Quiapo",
      summary:
        "The life-size dark image of Christ kneeling on one knee beneath a great wooden Cross, enshrined in Quiapo Church in Manila, draws millions of Filipino Catholics, above all on 9 January, when barefoot devotees accompany it through the city in the procession called the Traslación.",
      background:
        "A popular devotion to Christ in his Passion. The image is believed to have come from Mexico with the Augustinian Recollect missionaries who reached Manila in 1606; first enshrined in the church of Saint John the Baptist near Luneta, it was later transferred to the church of Quiapo, which has the same patron, and the Traslación re-enacts that transfer while recalling Christ's road to Calvary. The image has survived fires, earthquakes, floods and the bombing of the Second World War, and Quiapo Church, a minor basilica of the Archdiocese of Manila, receives devotees every day for Mass and confession. Devotees press forward to touch the image or throw cloths to be touched to it and returned — a culture of touch, in the words of one of its rectors. As with every sacred image, its meaning lies in the one it represents: Christ who carried the Cross for us.",
      devotionType: "passion",
      subtype: "procession",
      practiceInstructions:
        "Visit Quiapo Church to pray before the image, take part in Mass and go to confession. On the feast, 9 January, attend Mass before the procession and join the Traslación if you are able, walking in prayer and following the organisers' directions for safety; those who cannot walk can keep the day at home in prayer. Wherever you are, keep the devotion by meditating on Christ carrying his Cross — the second Station of the Cross — and by bearing your own crosses patiently and helping others to carry theirs.",
      relatedPrayers: ["prayer-before-a-crucifix", "litany-of-the-passion"],
      relatedSaints: [],
      citations: BLACK_NAZARENE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "saint-josephs-table",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: ST_JOSEPHS_TABLE_CITATIONS,
    payload: {
      slug: "saint-josephs-table",
      title: "Saint Joseph's Table (Saint Joseph's Altar)",
      summary:
        "On 19 March, the solemnity of Saint Joseph, families and parishes of Sicilian tradition build a tiered table laden with breads, pastries and meatless dishes in his honour, have it blessed by a priest, and share its food with all comers and with the poor.",
      background:
        "A custom of popular piety from Sicily, where tradition holds that the people, faced with famine during a drought in the Middle Ages, prayed to Saint Joseph and, when the rain came, gave thanks by preparing tables of food from which no one was turned away. Sicilian immigrants brought the custom to New Orleans in the nineteenth century, and from there it has spread across the United States. The table usually has three tiers in honour of the Holy Trinity, with a statue or picture of Saint Joseph at the top; breads are shaped as his staff, his carpenter's tools or the Sacred Heart, breadcrumbs recall the sawdust of his workshop, and fava beans are set out as the first crop said to have grown after the drought. Because the feast falls in Lent, the dishes are meatless. A priest blesses the table, and the food or the money it raises goes to those in need.",
      devotionType: "saintly",
      subtype: "feast custom",
      practiceInstructions:
        "Plan the table with your family or parish in the days before 19 March, praying to Saint Joseph for the intentions of the household as you work. Set up three tiers covered with white cloths, with a statue or picture of Saint Joseph at the top, and lilies, candles, breads, pastries, meatless dishes and fava beans. Ask a priest to bless the table and open it to guests on the feast, inviting the poor in particular, and give what remains to a charity. Children can re-enact the Holy Family's search for shelter — the custom called Tupa Tupa, or Knock Knock — knocking at the door until they are welcomed to the feast.",
      relatedPrayers: ["prayer-to-saint-joseph", "litany-of-saint-joseph", "grace-before-meals"],
      relatedSaints: ["saint-joseph"],
      citations: ST_JOSEPHS_TABLE_CITATIONS,
    },
  },
  {
    contentType: "DEVOTION",
    slug: "simbang-gabi",
    authorityLevel: "TRUSTED_PUBLISHER",
    citations: SIMBANG_GABI_CITATIONS,
    payload: {
      slug: "simbang-gabi",
      title: "Simbang Gabi (Misa de Aguinaldo)",
      summary:
        "Filipino Catholics prepare for Christmas with nine Masses celebrated at dawn from 16 to 24 December — or, in many places, on the evenings of 15 to 23 December — keeping a novena of the Eucharist in expectation of the Saviour's birth.",
      background:
        "A devotion bound up with the liturgy. The dawn Masses are properly called Misas de Aguinaldo, votive Masses offered in response to the devotion of the faithful and particularly in honour of the Blessed Virgin Mary, while the name Misa de Gallo strictly belongs to the Spanish midnight Mass of Christmas Eve; Simbang Gabi is the popular name for the whole series. The custom took root in the colonial period, when farmers and fishermen heard Mass before the day's work began. At the request of the First Plenary Council of the Philippines in 1953 the Holy See granted an indult allowing the Masses to continue, extended in 1961. Filipino communities abroad have carried the tradition with them, usually holding the Masses in the evening and often with neighbouring parishes taking turns, with parol star lanterns and food shared after Mass.",
      devotionType: "liturgical",
      subtype: "Christmas novena",
      practiceInstructions:
        "Attend all nine Masses if you can, at dawn from 16 to 24 December or at the anticipated evening Masses from 15 to 23 December, and let the early rising be a small offering of watchfulness. Prepare each day by recalling the Gospel accounts of the Annunciation and of the waiting of Mary and Joseph for the birth of Jesus. Hang a parol, the star lantern, at home as a sign of Christ the light of the world, and after Mass share the traditional breakfast with family and parishioners. Complete the novena with the Mass of Christmas.",
      relatedPrayers: ["magnificat", "angelus", "hail-mary"],
      relatedSaints: [],
      citations: SIMBANG_GABI_CITATIONS,
    },
  },
];

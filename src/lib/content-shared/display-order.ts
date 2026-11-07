/**
 * The order the public lists show their content in. Pure, so a page and a test
 * read the same answer. Nothing on a page describes these orders: a reader just
 * finds the familiar names first.
 *
 * Slugs are the production ones. A published row whose slug is not listed (a
 * future publish) is never lost: it sorts after the listed rows by the rule each
 * list states, so these lists can only ever fall behind, not break.
 */

import { parseYear } from "./saints";

/** Anything with a slug and a title; the comparators need nothing more. */
export interface OrderableEntry {
  slug: string;
  title: string;
}

/** Position of each slug in a ranked list. */
function rankOf(slugs: readonly string[]): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  slugs.forEach((slug, index) => {
    if (!ranks.has(slug)) ranks.set(slug, index);
  });
  return ranks;
}

/** A title as it files in a list: without its article, ignoring case and accents. */
function titleKey(title: string): string {
  return title
    .replace(/^(?:a|an|the)\s+/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function compareTitles(a: OrderableEntry, b: OrderableEntry): number {
  return titleKey(a.title).localeCompare(titleKey(b.title), "en") || a.slug.localeCompare(b.slug);
}

/** A ranked list's comparator: the listed slugs in their order, the rest by title. */
function byRankThenTitle<T extends OrderableEntry>(
  entries: readonly T[],
  ranks: ReadonlyMap<string, number>,
): T[] {
  return [...entries].sort((a, b) => {
    const ra = ranks.get(a.slug) ?? Number.POSITIVE_INFINITY;
    const rb = ranks.get(b.slug) ?? Number.POSITIVE_INFINITY;
    return ra !== rb ? ra - rb : compareTitles(a, b);
  });
}

/* -------------------------------------------------------------------------
 * Prayers
 * ---------------------------------------------------------------------- */

/**
 * Every Catholic learns the first five in this order, the owner's own. The rest
 * run from what a child learns at home, through what is prayed in common at
 * Mass, in the Rosary and at Benediction, to the prayers a devout reader knows.
 */
const PRAYER_ORDER: readonly string[] = [
  "our-father",
  "glory-be",
  "hail-mary",
  "jesus-prayer",
  "fatima-prayer",

  // Known to nearly every Catholic.
  "sign-of-the-cross",
  "apostles-creed",
  "salve-regina",
  "memorare",
  "angelus",
  "act-of-contrition",
  "prayer-to-saint-michael",
  "prayer-of-saint-francis",
  "guardian-angel-prayer",
  "nicene-creed",
  "grace-before-meals",
  "regina-caeli",
  "anima-christi",
  "divine-praises",
  "eternal-rest",
  "morning-offering",
  "come-holy-spirit",
  "prayer-to-the-holy-spirit",

  // The Rosary and the Chaplet of Divine Mercy.
  "rosary-opening-prayers",
  "joyful-mysteries",
  "sorrowful-mysteries",
  "glorious-mysteries",
  "luminous-mysteries",
  "rosary-closing-prayer",
  "divine-mercy-chaplet-prayers",

  // Heard at Mass and in common prayer.
  "confiteor",
  "grace-after-meals",
  "gloria-in-excelsis",
  "sanctus",
  "te-deum",
  "magnificat",
  "benedictus-canticle-of-zechariah",
  "nunc-dimittis",

  // The famous litanies.
  "litany-of-the-blessed-virgin-mary",
  "litany-of-the-saints",
  "litany-of-humility",
  "litany-of-the-sacred-heart-of-jesus",
  "litany-of-the-holy-name-of-jesus",
  "litany-of-saint-joseph",
  "litany-of-the-precious-blood",

  // The acts, and the great short prayers of the saints.
  "act-of-faith",
  "act-of-hope",
  "act-of-love",
  "act-of-spiritual-communion",
  "sub-tuum-praesidium",
  "suscipe-of-saint-ignatius",
  "prayer-to-saint-joseph-leo-xiii",
  "prayer-to-saint-jude",
  "lorica-of-saint-patrick",
  "nada-te-turbe",
  "prayer-of-saint-augustine",
  "unfailing-prayer-to-saint-anthony",
  "prayer-to-saint-anthony-of-padua-o-wonderful-saint-anthony",
  "si-quaeris-miracula",
  "act-of-contrition-traditional",
  "acts-of-faith-hope-and-charity-i-most-firmly-believe",

  // Benediction and the Blessed Sacrament.
  "tantum-ergo",
  "pange-lingua",
  "o-salutaris-hostia",
  "adoro-te-devote",
  "ave-verum-corpus",
  "prayer-before-a-crucifix",
  "o-sacrament-most-holy-o-sacrament-divine",
  "veni-creator-spiritus",
  "veni-sancte-spiritus",

  // The Psalms and the Office of the Dead that everyone meets.
  "psalm-22",
  "psalm-50",
  "de-profundis",
  "psalm-90",
  "stabat-mater",
  "dies-irae",
  "in-paradisum",
  "commendation-of-the-dying",

  // Our Lady.
  "ave-maris-stella",
  "alma-redemptoris-mater",
  "ave-regina-caelorum",
  "prayer-to-immaculate-mary",
  "tota-pulchra-es-maria",
  "act-of-consecration-to-mary",
  "act-of-consecration-to-mary-de-montfort",
  "act-of-consecration-to-the-immaculate-heart",
  "prayer-to-our-lady-of-guadalupe",
  "prayer-to-our-lady-of-perpetual-help",
  "prayer-to-our-lady-of-lourdes-traditional",
  "prayer-to-our-lady-of-mount-carmel-raccolta",
  "flos-carmeli",
  "don-bosco-prayer-to-mary",
  "o-domina-mea-my-queen-my-mother",
  "august-queen-of-heaven-prayer-to-the-queen-of-angels",
  "childrens-prayer-to-mary",
  "o-mary-bless-this-house",
  "seven-sorrows-of-mary-prayer",
  "rosary-of-the-seven-dolours-servite-chaplet",
  "prayer-to-the-queen-of-the-most-holy-rosary-leo-xiii",
  "prayer-in-honor-of-the-immaculate-conception",

  // The Sacred Heart and the Holy Face.
  "act-of-consecration-to-the-sacred-heart",
  "consecration-to-christ-the-king",
  "consecration-of-the-family-to-the-sacred-heart",
  "short-consecration-to-the-sacred-heart",
  "act-of-reparation-to-the-sacred-heart-o-jesus-only-son-of-the-living-god",
  "daily-act-of-oblation-to-the-sacred-heart",
  "golden-arrow",
  "prayer-to-the-holy-face",
  "chaplet-of-the-sacred-heart-prayers",

  // The saints most often called on.
  "memorare-to-saint-joseph",
  "prayer-to-saint-joseph",
  "consecration-to-saint-joseph",
  "thirty-days-prayer-to-saint-joseph",
  "prayer-to-saint-joseph-for-a-happy-death",
  "prayer-to-saint-therese",
  "morning-prayer-of-saint-therese",
  "prayer-to-saint-peregrine",
  "prayer-to-saint-dymphna",
  "prayer-to-saint-rita-in-suffering",
  "prayer-to-saint-patrick",
  "prayer-to-saint-gabriel",
  "prayers-to-saint-raphael",
  "prayer-to-saint-anne",
  "prayer-to-saint-mary-magdalene",
  "prayer-to-saint-cecilia",
  "prayer-to-saint-lucy-for-light",
  "prayer-to-saint-francis-xavier",
  "prayer-to-saints-peter-and-paul",
  "prayer-to-saint-nicholas-of-bari",
  "prayer-to-saint-vincent-de-paul-patron-of-charitable-works",
  "prayer-to-saint-thomas-aquinas-patron-of-schools",
  "prayer-to-saint-michael-leo-xiii-long-form",
  "chaplet-of-saint-michael-prayers",
  "fatima-angel-prayer",
  "fatima-pardon-prayer",

  // Before and after the sacraments.
  "prayer-before-mass",
  "prayer-before-confession",
  "thanksgiving-after-confession",
  "prayer-of-saint-thomas-before-communion",
  "prayer-of-saint-thomas-after-communion",
  "prayer-of-saint-thomas-aquinas-before-study",
  "prayer-after-mass-obsecro-te-dulcissime-domine-jesu-christe",
  "o-great-high-priest-prayer-before-communion-ascribed-to-saint-ambrose",
  "stations-of-the-cross-raccolta-prayers",

  // The prayers people look for when something has happened.
  "thanksgiving-prayer",
  "prayer-for-the-sick",
  "prayer-for-healing",
  "prayer-for-the-faithful-departed",
  "prayer-for-a-happy-death",
  "prayer-for-peace-da-pacem",
  "prayer-for-vocations",
  "prayer-for-priests",
  "prayer-for-the-pope",
  "prayer-for-travelers",
  "prayer-for-a-good-spouse",
  "prayer-for-expectant-mothers",
  "prayer-for-motherhood",
  "prayer-of-parents-for-their-children",
  "a-childs-prayer-for-parents",
  "prayer-for-deceased-parents",
  "prayer-for-a-dead-friend",
  "prayer-for-doctors-and-nurses",
  "prayer-in-suffering",
  "daily-prayer-in-sickness",
  "prayer-for-purity",
  "prayer-for-the-gift-of-humility",
  "prayer-for-the-gift-of-patience",
  "prayer-for-our-enemies",
  "prayer-before-work",
  "prayer-on-rising",
  "prayer-of-abandonment",
  "prayer-for-the-seven-gifts",
  "prayer-for-choosing-a-state-of-life",
  "prayer-of-saint-alphonsus-before-retiring-to-rest",

  // Loved by those who know them.
  "o-jesus-living-in-mary",
  "act-of-love-of-saint-john-vianney",
  "canticle-of-the-sun",
  "blessing-of-brother-leo",
  "priestly-blessing-of-aaron",
  "beatitudes",
  "universal-prayer-of-pope-clement-xi",
  "prayer-of-saint-ephrem",
  "trisagion",
  "chaplet-of-the-holy-spirit-prayers",
  "chaplet-of-the-precious-blood-prayers",
  "crown-of-twelve-stars",
  "chaplet-of-the-immaculate-conception",
  "chaplet-of-the-immaculate-heart-of-mary",
  "fifteen-prayers-on-the-passion-ascribed-to-saint-bridget",
  "athanasian-creed",
  "ignatius-eternal-lord-of-all-things",
  "petitions-of-saint-augustine",
  "prayer-of-saint-benedict-of-nursia",
  "prayers-of-saint-clare-to-the-five-wounds",
  "prayer-of-saint-bonaventure",
  "praises-of-god-saint-francis",
  "we-adore-thee-lord-jesus-christ-saint-francis",
  "absorbeat-prayer-of-saint-francis",
  "fac-nos-innocuam-invocation-of-saint-joseph",
  "invocation-of-saint-thomas-aquinas-before-study",
  "seven-sorrows-and-seven-joys-of-saint-joseph",
  "priestly-prayer-of-jesus-john-17",

  // Hymns the faithful sing.
  "adeste-fideles",
  "veni-veni-emmanuel",
  "lead-kindly-light",
  "firmly-i-believe-and-truly",
  "praise-to-the-holiest-in-the-height",
  "glory-be-to-jesus-hymn",
  "ubi-caritas-et-amor",
  "vexilla-regis",
  "victimae-paschali-laudes",
  "gloria-laus-et-honor",
  "lauda-sion",
  "exultet-easter-proclamation",
  "o-antiphons",
  "rorate-caeli",
  "attende-domine",
  "conditor-alme-siderum",
  "iam-lucis-orto-sidere",
  "te-lucis-ante-terminum",
  "stabat-mater-speciosa",
  "jesu-dulcis-memoria",
  "ad-regias-agni-dapes",

  // The rest of the litanies.
  "litany-of-the-holy-spirit",
  "litany-of-the-holy-angels",
  "litany-of-our-lady-of-sorrows",
  "litany-of-the-infant-jesus",
  "litany-for-a-happy-death-merciful-jesus-have-mercy-on-me",
  "litany-of-the-passion",
  "litany-of-the-love-of-god",
  "litany-for-priests",
  "litany-of-saint-jude",
  "litany-of-saint-therese",
  "litany-of-saint-francis",
  "litany-of-our-lady-of-fatima",
  "litany-of-our-lady-of-lourdes",
  "litany-of-our-lady-of-good-counsel",
  "litany-of-saint-john-the-baptist",
  "litany-of-saint-teresa-of-avila",
  "litany-of-saint-kateri-tekakwitha",

  // The Psalms and canticles most prayed outside the Office.
  "psalm-26",
  "psalm-120",
  "psalm-99",
  "psalm-138",
  "psalm-41",
  "psalm-83",
  "psalm-94",
  "psalm-8",
  "psalm-33",
  "psalm-62",
  "psalm-102",
  "psalm-117",
  "psalm-150",
  "psalm-18",
  "canticle-of-daniel-benedicite",
  "philippians-2-hymn",
  "colossians-1-hymn",
  "canticle-of-hannah",
];

const PRAYER_RANK = rankOf(PRAYER_ORDER);

/**
 * Pages the web crawl filed as prayers that are not one prayer: an article, a
 * collection, a donation page. They stay findable and go last.
 */
const PRAYER_PAGES_NOT_PRAYERS: ReadonlySet<string> = new Set([
  "a-guide-for-confession",
  "el-rosario-santo",
  "prayer-of-the-day-for-tuesday-july-7",
  "prayer-videos",
  "saint-prayers-our-catholic-faith",
  "send-deacon-keith-your-prayer-requests",
  "the-holy-rosary",
  "the-memorare-prayers-vatican-news",
  "traditional-catholic-prayers-33-prayers-with-their-history",
]);

/**
 * Prayers from the burial rite and the Raccolta known by their Latin opening,
 * which read as hymns to anyone but a priest or a choir, whatever type they carry.
 */
const LATIN_PRAYER_TEXTS: ReadonlySet<string> = new Set([
  "absolve-quaesumus-domine-animam-famuli-tui",
  "ad-mensam-dulcissimi-convivii-prayer-before-communion",
  "ave-augustissima",
  "beati-mortui-meditation-on-death",
  "blessing-before-a-journey",
  "credo-quod-redemptor-meus-vivit",
  "crucem-tuam-adoramus",
  "deus-cui-proprium-est-for-the-soul-departed",
  "deus-cujus-miseratione-blessing-of-the-grave",
  "deus-indulgentiarum-domine-anniversary-of-burial",
  "ecce-crucem-domini",
  "fac-quaesumus-domine-hanc-cum-famula-tua",
  "libera-me-domine-de-morte-aeterna",
  "lucis-creator-optime",
  "maria-mater-gratiae",
  "ne-recorderis-peccata-mea",
  "non-intres-in-judicium-burial-prayer",
  "nunc-sancte-nobis-spiritus",
  "o-excellentissima",
  "o-gloriosa-virginum",
  "omnipotence-of-the-father-prayer",
  "peccantem-me-quotidie",
  "pressi-malorum-pondere-responsory-of-saint-paul",
  "priests-intention-before-mass-ego-volo-celebrare-missam",
  "quaesumus-domine-third-seventh-thirtieth-day",
  "quem-terra-pontus-sidera",
  "qui-lazarum-resuscitasti",
  "rector-potens-verax-deus",
  "rerum-deus-tenax-vigor",
  "si-vis-patronum-responsory-of-saint-peter",
  "splendor-paternae-gloriae",
  "subvenite-sancti-dei",
  "virginum-custos-prayer-to-saint-joseph-for-purity",
]);

/** Where an unlisted prayer falls: the familiar first, the obscure Latin text last. */
const PrayerTier = {
  Familiar: 0,
  OneAuthorSeries: 1,
  Scripture: 2,
  Collect: 3,
  LatinText: 4,
  NotAPrayer: 5,
} as const;

/** The stored type of a prayer, from a list row or from a full payload. */
function prayerTypeOf(prayer: { subtype?: unknown; payload?: unknown }): string {
  if (typeof prayer.subtype === "string" && prayer.subtype) return prayer.subtype;
  const payload = prayer.payload;
  if (payload && typeof payload === "object") {
    const type = (payload as { prayerType?: unknown }).prayerType;
    if (typeof type === "string") return type;
  }
  return "";
}

/** A Scripture reference closing a title: "(Judith 9)", "(4 Kings [2 Kings] 19:14-19)". */
const CLOSING_SCRIPTURE = /\((?:[1-4] )?[A-Z][a-z]+(?: \[[^\]]+\])? \d+(?:[:,][^)]*)?\)\s*$/;

/** The long runs of prayers from one author's book, which would bury everything else. */
const ONE_AUTHOR_SERIES =
  /^(?:newman|gertrude|mechtilde|augustine|anselm|saint-bridget|saint-gertrude)-/;

function prayerTier(prayer: OrderableEntry & { subtype?: unknown; payload?: unknown }): number {
  if (PRAYER_PAGES_NOT_PRAYERS.has(prayer.slug)) return PrayerTier.NotAPrayer;
  const type = prayerTypeOf(prayer);
  if (type === "hymn" || LATIN_PRAYER_TEXTS.has(prayer.slug)) return PrayerTier.LatinText;
  if (/Tenebrae Responsory/i.test(prayer.title)) return PrayerTier.LatinText;
  if (/^collects?-of-/.test(prayer.slug)) return PrayerTier.Collect;
  if (type === "psalm" || type === "canticle") return PrayerTier.Scripture;
  if (/^(?:psalm|canticle)-/.test(prayer.slug) || CLOSING_SCRIPTURE.test(prayer.title)) {
    return PrayerTier.Scripture;
  }
  if (ONE_AUTHOR_SERIES.test(prayer.slug)) return PrayerTier.OneAuthorSeries;
  return PrayerTier.Familiar;
}

/**
 * Prayers from the most to the least widely known. The same order runs through
 * /litanies, whose rows are prayers: the famous litanies lead there too.
 */
export function sortPrayersForDisplay<
  T extends OrderableEntry & { subtype?: unknown; payload?: unknown },
>(prayers: readonly T[]): T[] {
  return [...prayers].sort((a, b) => {
    const ra = PRAYER_RANK.get(a.slug);
    const rb = PRAYER_RANK.get(b.slug);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return prayerTier(a) - prayerTier(b) || compareTitles(a, b);
  });
}

/* -------------------------------------------------------------------------
 * Popes
 * ---------------------------------------------------------------------- */

/**
 * The line of Roman Pontiffs from Saint Peter, with the year each reign began.
 *
 * The order is the Annuario Pontificio's. It is written out because a record's
 * own dates cannot give it: in sixteen years more than one reign began (John Paul
 * I and II in 1978, Innocent V, Adrian V and John XXI in 1276), and the stored
 * years are rounded or disputed (Honorius II 1125 for December 1124, Leo VIII 964
 * for 963, Benedict IX 1045 for the first of his three reigns, 1032). A record
 * edited later cannot move a listed pope; the list here decides.
 */
const POPE_SUCCESSION: ReadonlyArray<readonly [slug: string, startYear: number]> = [
  ["pope-saint-peter", 30],
  ["pope-saint-linus", 67],
  ["pope-saint-anacletus", 79],
  ["pope-saint-clement-i", 88],
  ["pope-saint-evaristus", 99],
  ["pope-alexander-i", 107],
  ["pope-sixtus-i", 115],
  ["pope-saint-telesphorus", 125],
  ["pope-hyginus", 138],
  ["pope-saint-pius-i", 140],
  ["pope-anicetus", 150],
  ["pope-saint-soter", 166],
  ["pope-eleuterus", 175],
  ["pope-saint-victor-i", 189],
  ["pope-zephyrinus", 199],
  ["pope-saint-callixtus-i", 217],
  ["pope-urban-i", 222],
  ["pope-saint-pontian", 230],
  ["pope-anterus", 235],
  ["pope-saint-fabian", 236],
  ["pope-saint-cornelius", 251],
  ["pope-lucius-i", 253],
  ["pope-saint-stephen-i", 254],
  ["pope-saint-sixtus-ii", 257],
  ["pope-saint-dionysius", 259],
  ["pope-felix-i", 269],
  ["pope-eutychian", 275],
  ["pope-caius", 283],
  ["pope-saint-marcellinus", 296],
  ["pope-marcellus-i", 308],
  ["pope-eusebius", 309],
  ["pope-saint-miltiades", 311],
  ["pope-saint-sylvester-i", 314],
  ["pope-mark", 336],
  ["pope-saint-julius-i", 337],
  ["pope-liberius", 352],
  ["pope-saint-damasus-i", 366],
  ["pope-saint-siricius", 384],
  ["pope-anastasius-i", 399],
  ["pope-saint-innocent-i", 401],
  ["pope-zosimus", 417],
  ["pope-boniface-i", 418],
  ["pope-saint-celestine-i", 422],
  ["pope-sixtus-iii", 432],
  ["pope-saint-leo-the-great", 440],
  ["pope-saint-hilarius", 461],
  ["pope-simplicius", 468],
  ["pope-felix-iii", 483],
  ["pope-saint-gelasius-i", 492],
  ["pope-anastasius-ii", 496],
  ["pope-symmachus", 498],
  ["pope-saint-hormisdas", 514],
  ["pope-john-i", 523],
  ["pope-felix-iv", 526],
  ["pope-boniface-ii", 530],
  ["pope-john-ii", 533],
  ["pope-agapetus-i", 535],
  ["pope-silverius", 536],
  ["pope-vigilius", 537],
  ["pope-pelagius-i", 556],
  ["pope-john-iii", 561],
  ["pope-benedict-i", 575],
  ["pope-pelagius-ii", 579],
  ["pope-saint-gregory-the-great", 590],
  ["pope-sabinian", 604],
  ["pope-boniface-iii", 607],
  ["pope-boniface-iv", 608],
  ["pope-adeodatus-i", 615],
  ["pope-boniface-v", 619],
  ["pope-honorius-i", 625],
  ["pope-severinus", 640],
  ["pope-john-iv", 640],
  ["pope-theodore-i", 642],
  ["pope-martin-i", 649],
  ["pope-eugene-i", 654],
  ["pope-vitalian", 657],
  ["pope-adeodatus-ii", 672],
  ["pope-donus", 676],
  ["pope-agatho", 678],
  ["pope-leo-ii", 682],
  ["pope-benedict-ii", 684],
  ["pope-john-v", 685],
  ["pope-conon", 686],
  ["pope-sergius-i", 687],
  ["pope-john-vi", 701],
  ["pope-john-vii", 705],
  ["pope-sisinnius", 708],
  ["pope-constantine", 708],
  ["pope-saint-gregory-ii", 715],
  ["pope-gregory-iii", 731],
  ["pope-saint-zachary", 741],
  ["pope-stephen-ii", 752],
  ["pope-paul-i", 757],
  ["pope-stephen-iii", 768],
  ["pope-adrian-i", 772],
  ["pope-saint-leo-iii", 795],
  ["pope-stephen-iv", 816],
  ["pope-paschal-i", 817],
  ["pope-eugene-ii", 824],
  ["pope-valentine", 827],
  ["pope-gregory-iv", 827],
  ["pope-sergius-ii", 844],
  ["pope-saint-leo-iv", 847],
  ["pope-benedict-iii", 855],
  ["pope-saint-nicholas-i", 858],
  ["pope-adrian-ii", 867],
  ["pope-john-viii", 872],
  ["pope-marinus-i", 882],
  ["pope-adrian-iii", 884],
  ["pope-stephen-v", 885],
  ["pope-formosus", 891],
  ["pope-boniface-vi", 896],
  ["pope-stephen-vi", 896],
  ["pope-romanus", 897],
  ["pope-theodore-ii", 897],
  ["pope-john-ix", 898],
  ["pope-benedict-iv", 900],
  ["pope-leo-v", 903],
  ["pope-sergius-iii", 904],
  ["pope-anastasius-iii", 911],
  ["pope-lando", 913],
  ["pope-john-x", 914],
  ["pope-leo-vi", 928],
  ["pope-stephen-vii", 928],
  ["pope-john-xi", 931],
  ["pope-leo-vii", 936],
  ["pope-stephen-viii", 939],
  ["pope-marinus-ii", 942],
  ["pope-agapetus-ii", 946],
  ["pope-john-xii", 955],
  ["pope-leo-viii", 963],
  ["pope-benedict-v", 964],
  ["pope-john-xiii", 965],
  ["pope-benedict-vi", 973],
  ["pope-benedict-vii", 974],
  ["pope-john-xiv", 983],
  ["pope-john-xv", 985],
  ["pope-gregory-v", 996],
  ["pope-sylvester-ii", 999],
  ["pope-john-xvii", 1003],
  ["pope-john-xviii", 1003],
  ["pope-sergius-iv", 1009],
  ["pope-benedict-viii", 1012],
  ["pope-john-xix", 1024],
  ["pope-benedict-ix", 1032],
  ["pope-sylvester-iii", 1045],
  ["pope-gregory-vi", 1045],
  ["pope-clement-ii", 1046],
  ["pope-damasus-ii", 1048],
  ["pope-saint-leo-ix", 1049],
  ["pope-victor-ii", 1055],
  ["pope-stephen-ix", 1057],
  ["pope-nicholas-ii", 1059],
  ["pope-alexander-ii", 1061],
  ["pope-saint-gregory-vii", 1073],
  ["pope-victor-iii", 1086],
  ["pope-blessed-urban-ii", 1088],
  ["pope-paschal-ii", 1099],
  ["pope-gelasius-ii", 1118],
  ["pope-callixtus-ii", 1119],
  ["pope-honorius-ii", 1124],
  ["pope-innocent-ii", 1130],
  ["pope-celestine-ii", 1143],
  ["pope-lucius-ii", 1144],
  ["pope-eugene-iii", 1145],
  ["pope-anastasius-iv", 1153],
  ["pope-adrian-iv", 1154],
  ["pope-alexander-iii", 1159],
  ["pope-lucius-iii", 1181],
  ["pope-urban-iii", 1185],
  ["pope-gregory-viii", 1187],
  ["pope-clement-iii", 1187],
  ["pope-celestine-iii", 1191],
  ["pope-innocent-iii", 1198],
  ["pope-honorius-iii", 1216],
  ["pope-gregory-ix", 1227],
  ["pope-celestine-iv", 1241],
  ["pope-innocent-iv", 1243],
  ["pope-alexander-iv", 1254],
  ["pope-urban-iv", 1261],
  ["pope-clement-iv", 1265],
  ["pope-gregory-x", 1271],
  ["pope-innocent-v", 1276],
  ["pope-adrian-v", 1276],
  ["pope-john-xxi", 1276],
  ["pope-nicholas-iii", 1277],
  ["pope-martin-iv", 1281],
  ["pope-honorius-iv", 1285],
  ["pope-nicholas-iv", 1288],
  ["pope-saint-celestine-v", 1294],
  ["pope-boniface-viii", 1294],
  ["pope-benedict-xi", 1303],
  ["pope-clement-v", 1305],
  ["pope-john-xxii", 1316],
  ["pope-benedict-xii", 1334],
  ["pope-clement-vi", 1342],
  ["pope-innocent-vi", 1352],
  ["pope-urban-v", 1362],
  ["pope-gregory-xi", 1370],
  ["pope-urban-vi", 1378],
  ["pope-boniface-ix", 1389],
  ["pope-innocent-vii", 1404],
  ["pope-gregory-xii", 1406],
  ["pope-martin-v", 1417],
  ["pope-eugene-iv", 1431],
  ["pope-nicholas-v", 1447],
  ["pope-callixtus-iii", 1455],
  ["pope-pius-ii", 1458],
  ["pope-paul-ii", 1464],
  ["pope-sixtus-iv", 1471],
  ["pope-innocent-viii", 1484],
  ["pope-alexander-vi", 1492],
  ["pope-pius-iii", 1503],
  ["pope-julius-ii", 1503],
  ["pope-leo-x", 1513],
  ["pope-adrian-vi", 1522],
  ["pope-clement-vii", 1523],
  ["pope-paul-iii", 1534],
  ["pope-julius-iii", 1550],
  ["pope-marcellus-ii", 1555],
  ["pope-paul-iv", 1555],
  ["pope-pius-iv", 1559],
  ["pope-saint-pius-v", 1566],
  ["pope-gregory-xiii", 1572],
  ["pope-sixtus-v", 1585],
  ["pope-urban-vii", 1590],
  ["pope-gregory-xiv", 1590],
  ["pope-innocent-ix", 1591],
  ["pope-clement-viii", 1592],
  ["pope-leo-xi", 1605],
  ["pope-paul-v", 1605],
  ["pope-gregory-xv", 1621],
  ["pope-urban-viii", 1623],
  ["pope-innocent-x", 1644],
  ["pope-alexander-vii", 1655],
  ["pope-clement-ix", 1667],
  ["pope-clement-x", 1670],
  ["pope-blessed-innocent-xi", 1676],
  ["pope-alexander-viii", 1689],
  ["pope-innocent-xii", 1691],
  ["pope-clement-xi", 1700],
  ["pope-innocent-xiii", 1721],
  ["pope-benedict-xiii", 1724],
  ["pope-clement-xii", 1730],
  ["pope-benedict-xiv", 1740],
  ["pope-clement-xiii", 1758],
  ["pope-clement-xiv", 1769],
  ["pope-pius-vi", 1775],
  ["pope-pius-vii", 1800],
  ["pope-leo-xii", 1823],
  ["pope-pius-viii", 1829],
  ["pope-gregory-xvi", 1831],
  ["pope-pius-ix", 1846],
  ["pope-leo-xiii", 1878],
  ["pope-saint-pius-x", 1903],
  ["pope-benedict-xv", 1914],
  ["pope-pius-xi", 1922],
  ["pope-venerable-pius-xii", 1939],
  ["pope-saint-john-xxiii", 1958],
  ["pope-saint-paul-vi", 1963],
  ["pope-john-paul-i", 1978],
  ["pope-saint-john-paul-ii", 1978],
  ["pope-benedict-xvi", 2005],
  ["pope-francis", 2013],
  ["pope-leo-xiv", 2025],
];

const POPE_PLACE: ReadonlyMap<string, { index: number; year: number }> = new Map(
  POPE_SUCCESSION.map(([slug, year], index) => [slug, { index, year }]),
);

/** A place in the line by the pope's name alone: "pius-xii", "john-paul-ii". */
const POPE_NAME_PLACE: ReadonlyMap<string, number> = new Map(
  POPE_SUCCESSION.map(([slug], index) => [
    slug.replace(/^pope-(?:(?:saint|blessed|venerable)-)?/, ""),
    index,
  ]),
);

/**
 * Whether a named pope was reigning in a year, by the line above: from the year his
 * reign began to the year the next one's did. A pope is found however a text styles
 * him ("Pope Pius XI", "Pope Saint Pius V", "Pope John-Paul II"), and a name the line
 * does not hold, such as a Coptic pope's, did not reign.
 */
export function popeReignedIn(name: string, year: number): boolean {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/^pope\s+/, "")
    .replace(/^(?:saint|st\.?|blessed|bl\.?|venerable)\s+/, "")
    .replace(/[^a-z]+/g, "-");
  const index = POPE_NAME_PLACE.get(key);
  if (index == null) return false;
  const begins = POPE_SUCCESSION[index]![1];
  const ends = POPE_SUCCESSION[index + 1]?.[1] ?? Number.POSITIVE_INFINITY;
  return year >= begins && year <= ends;
}

const MONTH_NUMBER: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * When a reign began, to the day where the record says so, read from whatever
 * form it was stored in ("2025-05-08", "May 8, 2025", "8 May 2025", "c. 125",
 * "1045"). `dayOfYear` is 0 when the record gives only a year, so a bare year
 * files first within its year; the first number in the string is never trusted
 * on its own, since it may be a day.
 */
export function popeReignStart(payload: unknown): { year: number; dayOfYear: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { papacyStart?: unknown }).papacyStart;
  const year = parseYear(raw);
  if (year == null || typeof raw !== "string") return null;
  const iso = /(?:^|\D)\d{1,4}-(\d{2})-(\d{2})(?!\d)/.exec(raw);
  if (iso) return { year, dayOfYear: Number(iso[1]) * 100 + Number(iso[2]) };
  const dayFirst = /\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+\d/i.exec(raw);
  if (dayFirst) {
    const month = MONTH_NUMBER[dayFirst[2]!.toLowerCase()];
    if (month) return { year, dayOfYear: month * 100 + Number(dayFirst[1]) };
  }
  const monthFirst = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+\d/i.exec(raw);
  if (monthFirst) {
    const month = MONTH_NUMBER[monthFirst[1]!.toLowerCase()];
    if (month) return { year, dayOfYear: month * 100 + Number(monthFirst[2]) };
  }
  return { year, dayOfYear: 0 };
}

/**
 * Popes in reverse chronological order: the current pope first, down to Saint
 * Peter. A pope the line above does not name yet, the next one, files by the
 * date on his own record; one with no readable date goes last rather than first.
 */
export function sortPopesForDisplay<T extends OrderableEntry & { payload?: unknown }>(
  popes: readonly T[],
): T[] {
  const keyed = popes.map((pope) => {
    const place = POPE_PLACE.get(pope.slug);
    const start = popeReignStart(pope.payload);
    return {
      pope,
      year: place?.year ?? start?.year ?? null,
      // A pope of the line files before an unlisted one who began the same year:
      // the unlisted one, being new to the site, is taken to be the later.
      index: place?.index ?? POPE_SUCCESSION.length,
      day: start?.dayOfYear ?? 0,
    };
  });
  keyed.sort((a, b) => {
    if (a.year == null || b.year == null) {
      if (a.year == null && b.year == null) return compareTitles(a.pope, b.pope);
      return a.year == null ? 1 : -1;
    }
    return (
      b.year - a.year ||
      b.index - a.index ||
      (a.index === POPE_SUCCESSION.length ? b.day - a.day : 0) ||
      compareTitles(a.pope, b.pope)
    );
  });
  return keyed.map((entry) => entry.pope);
}

/* -------------------------------------------------------------------------
 * Our Lady
 * ---------------------------------------------------------------------- */

/** Marian apparitions and revelations, from the most to the least widely known. */
const APPARITION_ORDER: readonly string[] = [
  "apparition-our-lady-of-guadalupe",
  "apparition-our-lady-of-lourdes",
  "apparition-our-lady-of-fatima",
  "apparition-our-lady-queen-of-peace-medjugorje",
  "apparition-miraculous-medal-rue-du-bac",
  "apparition-our-lady-of-knock",
  "apparition-our-lady-of-la-salette",
  "apparition-our-lady-of-mount-carmel-simon-stock",
  "apparition-our-lady-of-akita",
  "apparition-our-lady-of-walsingham",
  "apparition-our-lady-of-kibeho",
  "apparition-divine-mercy-saint-faustina",
  "apparition-sacred-heart-paray-le-monial",
  "apparition-our-lady-of-good-help",
  "apparition-our-lady-of-the-snows-rome",
  "apparition-our-lady-of-the-pillar-zaragoza",
  "apparition-our-lady-of-banneux",
  "apparition-our-lady-of-beauraing",
  "apparition-our-lady-of-la-vang",
  "apparition-our-lady-of-good-health-vailankanni",
  "apparition-our-lady-of-las-lajas",
  "apparition-our-lady-of-the-rosary-of-san-nicolas",
  "apparition-our-lady-of-pontmain",
  "apparition-our-lady-of-good-success-quito",
  "apparition-our-lady-of-mercy-peter-nolasco",
  "apparition-our-lady-of-the-miracle-santandrea-delle-fratte",
  "apparition-our-lady-of-laus",
  "apparition-our-lady-of-siluva",
  "apparition-our-lady-of-coromoto",
  "apparition-our-lady-of-manaoag",
  "apparition-our-lady-of-zeitoun",
  "apparition-our-lady-of-betania",
  "apparition-our-lady-of-cuapa",
  "apparition-maria-rosa-mystica-montichiari-fontanelle",
  "apparition-our-lady-of-gietrzwald",
  "apparition-our-lady-of-mercy-pellevoisin",
  "apparition-our-lady-of-ocotlan",
  "apparition-our-lady-of-prayer-ile-bouchard",
  "apparition-our-lady-of-monte-berico",
  "apparition-our-lady-of-caravaggio",
  "apparition-holy-face-tours-marie-de-saint-pierre",
  "apparition-saint-michael-monte-gargano",
  "apparition-our-lady-of-sorrows-castelpetroso",
  "apparition-our-lady-of-the-guard-monte-figogna",
  "apparition-our-lady-of-lichen",
  "apparition-our-lady-help-of-christians-filippsdorf",
  "apparition-our-lady-of-sorrows-chandavila",
  "apparition-mount-zvir-litmanova",
  "apparition-our-lady-of-the-rock-placanica",
  "apparition-our-lady-of-grace-cimbres",
  "apparition-our-lady-of-all-help-querrien",
  "apparition-saint-joseph-cotignac",
];

const APPARITION_RANK = rankOf(APPARITION_ORDER);

/** Marian apparitions from the most to the least widely known. */
export function sortApparitionsForDisplay<T extends OrderableEntry>(
  apparitions: readonly T[],
): T[] {
  return byRankThenTitle(apparitions, APPARITION_RANK);
}

/**
 * Marian titles: her four dogmas and her universal titles first, then the images
 * and shrines that whole countries and the whole Church know her by, then the
 * local ones.
 */
const MARIAN_TITLE_ORDER: readonly string[] = [
  "immaculate-conception",
  "queen-of-heaven",
  "mother-of-god",
  "assumption-of-mary",
  "perpetual-virginity",
  "immaculate-heart-of-mary",
  "our-lady-of-guadalupe",
  "our-lady-of-lourdes",
  "our-lady-of-fatima",
  "our-lady-of-the-rosary",
  "our-lady-of-sorrows",
  "our-lady-of-mount-carmel",
  "our-lady-of-perpetual-help",
  "our-lady-of-the-miraculous-medal",
  "mother-of-the-church",
  "our-lady-help-of-christians",
  "our-lady-star-of-the-sea",
  "our-lady-queen-of-peace",
  "our-lady-of-good-counsel",
  "our-lady-of-mercy",
  "our-lady-undoer-of-knots",
  "our-lady-seat-of-wisdom",
  "our-lady-refuge-of-sinners",
  "our-lady-of-knock",
  "our-lady-of-la-salette",
  "our-lady-of-czestochowa",
  "our-lady-of-loreto",
  "our-lady-of-walsingham",
  "our-lady-of-the-snows",
  "our-lady-of-victory",
  "our-lady-of-the-angels",
  "our-lady-of-the-pillar",
  "queen-of-apostles",
  "gate-of-heaven",
  "morning-star",
  "mystical-rose",
  "mediatrix-of-all-graces",
  "our-lady-of-divine-providence",
  "our-lady-of-charity",
  "our-lady-of-aparecida",
  "our-lady-of-pompeii",
  "our-lady-of-prompt-succor",
  "our-lady-of-good-help",
  "our-lady-of-la-vang",
  "our-lady-of-kibeho",
  "our-lady-of-vailankanni",
  "our-lady-of-lujan",
  "our-lady-of-altagracia",
  "our-lady-of-montserrat",
  "our-lady-of-covadonga",
  "our-lady-of-coromoto",
  "our-lady-of-copacabana",
  "our-lady-of-penafrancia",
  "our-lady-of-manaoag",
  "our-lady-of-suyapa",
  "our-lady-of-sheshan",
  "our-lady-of-africa",
  "our-lady-of-einsiedeln",
  "our-lady-of-ta-pinu",
  "our-lady-of-the-atonement",
  "our-lady-of-the-turning-eyes",
];

const MARIAN_TITLE_RANK = rankOf(MARIAN_TITLE_ORDER);

/** Marian titles from the most to the least widely known. */
export function sortMarianTitlesForDisplay<T extends OrderableEntry>(titles: readonly T[]): T[] {
  return byRankThenTitle(titles, MARIAN_TITLE_RANK);
}

/** Exposed for the tests that hold these lists to the published slugs. */
export const DISPLAY_ORDER_LISTS = {
  prayers: PRAYER_ORDER,
  popes: POPE_SUCCESSION.map(([slug]) => slug) as readonly string[],
  apparitions: APPARITION_ORDER,
  marianTitles: MARIAN_TITLE_ORDER,
} as const;

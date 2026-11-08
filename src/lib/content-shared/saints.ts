/**
 * Saint ordering and labelling (spec — "Saints chronological ordering" and
 * "Saint Titles").
 *
 * The owner set the order of the saint list himself: Mary, Joseph, Peter, Paul,
 * James and John, the rest of the Apostles, John the Baptist, Mary Magdalene,
 * Augustine, Ignatius of Antioch, Thomas Aquinas and Mother Teresa, then the most
 * popular saints, then everyone else in the order they lived, and finally the
 * saints of the Old Testament. Only a strict, permitted set of title labels may
 * appear beneath a saint's name; everything else (Martyr, Virgin, Bishop, …)
 * shows no label.
 */

import type { Translator } from "@/lib/i18n/translator";

/**
 * The head of the saint list, by slug, most prominent first. Everyone named here
 * leads the list in this order; every other saint follows by year.
 */
export const SAINT_DISPLAY_ORDER: readonly string[] = [
  "saint-blessed-virgin-mary",
  "saint-joseph",

  // Peter, Paul, James and John.
  "saint-peter",
  "saint-paul",
  "saint-james-the-greater",
  "saint-john-the-apostle",

  // The rest of the Apostles.
  "saint-andrew-the-apostle",
  "saint-philip-the-apostle",
  "saint-bartholomew",
  "saint-matthew",
  "saint-thomas-the-apostle",
  "saint-james-the-less",
  "saint-jude-thaddeus",
  "saint-simon-the-zealot",
  "saint-matthias",

  "saint-john-the-baptist",
  "saint-mary-magdalene",

  "saint-augustine-of-hippo",
  "saint-ignatius-of-antioch",
  "saint-thomas-aquinas",
  "saint-mother-teresa-of-calcutta",

  // The most popular saints, the best known first.
  "saint-francis-of-assisi",
  "saint-anthony-of-padua",
  "saint-therese-of-lisieux",
  "saint-padre-pio",
  "saint-michael",
  "saint-gabriel-the-archangel",
  "saint-raphael-the-archangel",
  "saint-teresa-of-avila",
  "saint-john-paul-ii",
  "saint-patrick",
  "saint-nicholas",
  "saint-benedict-of-nursia",
  "saint-ignatius-of-loyola",
  "saint-catherine-of-siena",
  "saint-monica",
  "saint-rita-of-cascia",
  "saint-peregrine-laziosi",
  "saint-clare-of-assisi",
  "saint-joan-of-arc",
  "saint-bernadette-soubirous",
  "saint-faustina-kowalska",
  "saint-maximilian-kolbe",
  "saint-anne",
  "saint-joachim",
  "saint-elizabeth-mother-of-john-the-baptist",
  "saint-zechariah-father-of-john-the-baptist",
  "saint-george",
  "saint-christopher",
  "saint-valentine",
  "saint-cecilia",
  "saint-lucy",
  "saint-agnes",
  "saint-stephen",
  "saint-dominic",
  "saint-francis-xavier",
  "saint-francis-de-sales",
  "saint-john-bosco",
  "saint-vincent-de-paul",
  "saint-jerome",
  "saint-ambrose",
  "saint-gregory-the-great",
  "saint-luke-the-evangelist",
  "saint-mark-the-evangelist",
  "saint-barnabas",
  "saint-timothy",
  "saint-titus",
  "saint-elizabeth-ann-seton",
  "saint-kateri-tekakwitha",
  "saint-juan-diego",
  "saint-martin-de-porres",
  "saint-rose-of-lima",
  "saint-john-vianney",
  "saint-dymphna",
  "saint-john-of-the-cross",
  "saint-josephine-bakhita",
  "saint-maria-goretti",
  "saint-gianna-molla",
  "saint-teresa-benedicta-of-the-cross",
  "saint-carlo-acutis",
  "saint-sebastian",
  "saint-lawrence",
  "saint-blaise",
  "saint-agatha",
  "saint-martha",
  "saint-lazarus-of-bethany",
  "saint-mary-of-bethany",
  "saint-dismas",
  "saint-thomas-more",
  "saint-margaret-clitherow",
  "saint-thomas-becket",
  "saint-john-henry-newman",
  "saint-bernard-of-clairvaux",
  "saint-hildegard-of-bingen",
  "saint-philip-neri",
  "saint-aloysius-gonzaga",
  "saint-charles-borromeo",
  "saint-gerard-majella",
  "saint-raymond-nonnatus",
  "saint-isidore-the-farmer",
  "saint-helena",
  "saint-elizabeth-of-hungary",
  "saint-john-chrysostom",
  "saint-athanasius",
  "saint-basil-the-great",
  "saint-gregory-nazianzen",
  "saint-alphonsus-liguori",
  "saint-bonaventure",
  "saint-albertus-magnus",
  "saint-anselm",
  "saint-leo-the-great",
  "saint-clement-of-rome",
  "saint-polycarp",
  "saint-justin-martyr",
  "saint-irenaeus-of-lyon",
  "saint-perpetua-and-felicity",
  "saint-cyprian-of-carthage",
  "saint-boniface",
  "saint-bede-the-venerable",
  "saint-cuthbert-of-lindisfarne",
  "saint-martin-of-tours",
  "saint-wenceslaus",
  "saint-andrew-kim-taegon",
  "saint-paul-miki",
  "saint-charles-lwanga",
  "saint-lorenzo-ruiz",
  "saint-pedro-calungsod",
  "saint-junipero-serra",
  "saint-damien-of-molokai",
  "saint-marianne-cope",
  "saint-katharine-drexel",
  "saint-frances-xavier-cabrini",
  "saint-john-neumann",
  "saint-andre-bessette",
  "saint-rose-philippine-duchesne",
  "saint-oscar-romero",
  "saint-pope-john-xxiii",
  "saint-pope-paul-vi",
  "saint-pope-pius-x",
  "saint-josemaria-escriva",
  "saint-margaret-mary-alacoque",
  "saint-catherine-laboure",
  "saint-louis-de-montfort",
  "saint-john-of-god",
  "saint-camillus-de-lellis",
  "saint-peter-claver",
  "saint-bridget-of-sweden",
  "saint-brigid-of-ireland",
  "saint-columba",
  "saint-scholastica",
  "saint-anthony-the-abbot",
  "saint-augustine-of-canterbury",
  "saint-genevieve",
  "saint-louis-ix",
  "saint-margaret-of-scotland",
  "saint-edward-the-confessor",
  "saint-roch",
  "saint-giles",
  "saint-vitus",
  "saint-barbara",
  "saint-catherine-of-alexandria",
  "saint-margaret-of-antioch",
  "saint-ursula",
  "saint-philomena",
  "saint-expeditus",
  "saint-tarcisius",
  "saint-dominic-savio",
  "saint-jose-sanchez-del-rio",
  "saint-jacinta-and-francisco-marto",
  "saint-miguel-pro",
  "saint-pier-giorgio-frassati",
  "saint-gemma-galgani",
  "saint-zita",
  "saint-casimir",
  "saint-stanislaus",
  "saint-stanislaus-kostka",
  "saint-john-berchmans",
  "saint-gabriel-of-our-lady-of-sorrows",
  "saint-john-baptist-de-la-salle",
  "saint-angela-merici",
  "saint-jane-frances-de-chantal",
  "saint-louise-de-marillac",
  "saint-paul-of-the-cross",
  "saint-anthony-mary-claret",
  "saint-peter-canisius",
  "saint-robert-bellarmine",
  "saint-peter-damian",
  "saint-isidore-of-seville",
  "saint-cyril-of-alexandria",
  "saint-saints-cyril-and-methodius",
  "saints-cosmas-and-damian",
  "saint-ephrem-the-syrian",
  "saint-john-of-damascus",
  "saint-hilary-of-poitiers",
  "saint-lawrence-of-brindisi",
  "saint-cornelius",
  "saint-fabian",
  "saint-bernardine-of-siena",
  "saint-vincent-ferrer",
  "saint-john-of-capistrano",
  "saint-frances-of-rome",
  "saint-hedwig",
  "saint-elizabeth-of-portugal",
  "saint-nicholas-of-tolentino",
  "saint-joseph-of-cupertino",
  "saint-romuald",
  "saint-norbert",
  "saint-bruno",
  "saint-dorothy",
  "saint-apollonia",
  "saint-eligius",
  "saint-homobonus",
  "saint-leonard-of-noblac",
  "saint-pancras",
  "saint-ferdinand-iii",
  "saint-henry-ii",
  "saint-stephen-of-hungary",
  "saint-olaf-ii-of-norway",
  "saint-oliver-plunkett",
  "saint-john-fisher",
  "saint-edmund-campion",
  "saint-john-ogilvie",
  "saint-isaac-jogues",
  "saint-jean-de-brebeuf",
  "saint-north-american-martyrs",
  "saint-marguerite-d-youville",
  "saint-marguerite-bourgeoys",
  "saint-mary-mackillop",
  "saint-teresa-of-the-andes",
  "saint-alberto-hurtado",
  "saint-elizabeth-of-the-trinity",
  "saint-louis-martin-and-azelie-marie-guerin",
  "saint-charles-de-foucauld",
  "saint-titus-brandsma",
  "saint-john-of-avila",
  "saint-simon-stock",
  "saint-nicodemus",
  "saint-joseph-of-arimathea",
  "saint-longinus",
  "saint-salome",
  "saint-mary-of-clopas",
  "saint-philemon",
  "saint-onesimus",
  "saint-lydia-of-thyatira",
  "saint-phoebe",
  "saint-dorcas",
  "saint-rosalia",
  "saint-notburga",
  "saint-walpurga",
  "saint-aidan-of-lindisfarne",
  "saint-alban",
  "saint-david",
  "saint-dunstan",
  "saint-chad-of-mercia",
  "saint-oswald-of-northumbria",
  "saint-josaphat",
  "saint-charbel-makhlouf",
  "saint-rafqa-pietra-choboq-ar-rayes",
  "saint-maron",
  "saint-alphonsa",
  "saint-kuriakose-elias-chavara",
  "saint-fiacre",
  "saint-hyacinth-of-poland",
  "saint-john-cantius",
  "saint-benedict-the-moor",
  "saint-paschal-baylon",
  "saint-felix-of-cantalice",
  "saint-benedict-joseph-labre",
  "saint-peter-julian-eymard",
  "saint-catherine-of-genoa",
  "saint-catherine-of-bologna",
  "saint-catherine-of-ricci",
  "saint-jean-eudes",
  "saint-gaspar-del-bufalo",
  "saint-maria-mazzarello",
  "saint-madeleine-sophie-barat",
  "saint-julie-billiart",
  "saint-clemens-maria-hofbauer",
  "saint-john-of-nepomuk",
  "saint-adalbert-of-prague",
  "saint-ludmila-of-bohemia",
  "saint-cunigunde-of-luxembourg",
  "saint-pius-v",
  "saint-gregory-vii",
  "saint-sylvester-i",
  "saint-mechtilde",
  "saint-gertrude-the-great",
  "saint-angela-of-foligno",
  "saint-veronica-giuliani",
  "saint-mary-of-egypt",
  "saint-paula-of-rome",
];

/**
 * Saints of the Old Testament, who close the list in the order the Scriptures
 * place them. A record with a date before Christ joins them by itself; these are
 * the ones with no date (the prophets) or a date that lost its era (Eleazar
 * stored as 167, not 167 BC). The records called only "Abraham", "Moses", "David"
 * and "Sarah" are other people, and are not on this list: an abbot of Farshut, a
 * fourth-century desert bishop, the bishop of Wales and Sara-la-Kâli.
 */
export const OLD_TESTAMENT_SAINTS: readonly string[] = [
  "saint-abraham-the-patriarch",
  "saint-moses-the-lawgiver",
  "saint-david-the-king",
  "saint-elijah",
  "saint-elisha",
  "saint-isaiah-the-prophet",
  "saint-jeremiah-the-prophet",
  "saint-ezekiel-the-prophet",
  "saint-daniel-the-prophet",
  "saint-joel",
  "saint-amos",
  "saint-obadiah",
  "saint-jonah",
  "saint-habakkuk",
  "saint-eleazar",
  "saint-woman-with-seven-sons",
];

/** A saint whose only date is earlier than this lived before the Resurrection. */
export const OLD_TESTAMENT_BEFORE_YEAR = 30;

/**
 * The same person published twice, usually once from the curated knowledge base
 * and once from Wikidata: duplicate → the record the list shows. The curated
 * record wins because a reader sees it at its best, with a clean name, the
 * patronages the Church gives the saint and the Roman feast (Jude's Wikidata
 * record keeps the Eastern June 19). A hidden record's own page stays reachable,
 * and it takes its canonical's place in the list if that record is ever withdrawn.
 */
export const SAINT_DUPLICATE_OF: Readonly<Record<string, string>> = {
  "saint-john-the-evangelist": "saint-john-the-apostle",
  "saint-jude-the-apostle": "saint-jude-thaddeus",
  "saint-mother-teresa": "saint-mother-teresa-of-calcutta",
  "saint-st-james-the-elder": "saint-james-the-greater",
  // Philip and James the Less now have a card each.
  "saints-philip-and-james": "saint-philip-the-apostle",
  // In the Latin tradition, James son of Alphaeus is the James "brother of the Lord".
  "saint-james-the-just": "saint-james-the-less",
  "saint-santa-faustina-kowalska": "saint-faustina-kowalska",
  "st-francis-xavier-saints-angels-catholic-online": "saint-francis-xavier",
  "saint-jean-marie-vianney": "saint-john-vianney",
  "saint-juan-diego-cuauhtlatoatzin": "saint-juan-diego",
  "saint-agnes-of-rome": "saint-agnes",
  "saint-gregory-i": "saint-gregory-the-great",
  "saint-leo-i": "saint-leo-the-great",
  "saint-clement-q42887": "saint-clement-of-rome",
  "saint-gianna-beretta-molla": "saint-gianna-molla",
  "saint-edith-stein": "saint-teresa-benedicta-of-the-cross",
  "saint-anselm-of-canterbury": "saint-anselm",
  "saint-alphonsus-maria-de-liguori": "saint-alphonsus-liguori",
  "saint-bede": "saint-bede-the-venerable",
  "saint-cyprian": "saint-cyprian-of-carthage",
  "saint-father-damien": "saint-damien-of-molokai",
  "saint-karoli-lwanga": "saint-charles-lwanga",
  "saint-isidore-the-laborer": "saint-isidore-the-farmer",
  "saint-anthony-the-great": "saint-anthony-the-abbot",
  "saint-margaret-the-virgin": "saint-margaret-of-antioch",
  "saint-wenceslaus-i-duke-of-bohemia": "saint-wenceslaus",
  "saint-louis-ix-of-france": "saint-louis-ix",
  "saint-stephen-i-of-hungary": "saint-stephen-of-hungary",
  "saint-henry-ii-holy-roman-emperor": "saint-henry-ii",
  "saint-ferdinand-iii-of-castille": "saint-ferdinand-iii",
  "saint-elizabeth-of-aragon": "saint-elizabeth-of-portugal",
  "saint-brigid-of-kildare": "saint-brigid-of-ireland",
  "saint-dorothea-of-caesarea": "saint-dorothy",
  "saint-stanislaus-of-szczepanow": "saint-stanislaus",
  "saint-norbert-of-xanten": "saint-norbert",
  "saint-bruno-of-cologne": "saint-bruno",
  "saint-pancras-of-rome": "saint-pancras",
  "saint-bernardino-of-siena": "saint-bernardine-of-siena",
  "saint-louise-marillac": "saint-louise-de-marillac",
  "saint-josaphat-kuntsevych": "saint-josaphat",
  "saint-hedwig-of-silesia": "saint-hedwig",
  "saint-jean-baptiste-de-la-salle": "saint-john-baptist-de-la-salle",
  "saint-charbel-makhluf": "saint-charbel-makhlouf",
  "saint-gerolamo-emiliani": "saint-jerome-emiliani",
  "saint-turibius-of-mongrovejo": "saint-turibius-of-mogrovejo",
  "saint-raymond-of-penyafort": "saint-raymond-of-penafort",
  "saint-anthony-maria-zaccaria": "saint-anthony-mary-zaccaria",
  // Wikidata's label for Pope John XXIII came through as "John".
  "saint-john": "saint-pope-john-xxiii",
  "saint-canadian-martyrs": "saint-north-american-martyrs",
  "saint-jacinta-marto": "saint-jacinta-and-francisco-marto",
  "saint-louis-martin": "saint-louis-martin-and-azelie-marie-guerin",
  "saint-emmanuel-ruiz": "saint-manuel-ruiz-and-his-10-companions",
  "saint-victoria": "saint-victoria-of-cordoba",
  "saint-peter-lieou": "saint-peter-liu",
  "saint-theodoric-balat": "saint-teodoryk-balat",
  // Not the New Testament Archippus: its record describes an Athenian comic poet.
  "saint-archippus-q276575": "saint-archippus",
  // The Good Thief, published again under his description.
  "saint-penitent-thief": "saint-dismas",
};

/** Slug → place in the head of the list. A hidden duplicate holds its canonical's place. */
export const SAINT_DISPLAY_RANK: ReadonlyMap<string, number> = (() => {
  const ranks = new Map<string, number>(SAINT_DISPLAY_ORDER.map((slug, index) => [slug, index]));
  for (const [duplicate, canonical] of Object.entries(SAINT_DUPLICATE_OF)) {
    const rank = ranks.get(canonical);
    if (rank != null) ranks.set(duplicate, rank);
  }
  return ranks;
})();

/**
 * Sort rank for the saints who lead the list (lower = earlier), or null for the
 * saints who sort purely by year. The Admin Worker can override it per saint
 * with an explicit `orderRank`.
 */
export function saintOrderRank(payload: Record<string, unknown>): number | null {
  if (typeof payload.orderRank === "number" && Number.isFinite(payload.orderRank)) {
    return payload.orderRank;
  }
  const slug = typeof payload.slug === "string" ? payload.slug.toLowerCase() : "";
  return SAINT_DISPLAY_RANK.get(slug) ?? null;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A month's name, whole or abbreviated, in a date someone wrote out. */
const MONTH_WORD =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
/** The day in "27 August" or "the 3rd of May". */
const DAY_BEFORE_MONTH = new RegExp(
  `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?=${MONTH_WORD}\\b)`,
  "gi",
);
/** The day in "August 27" or "August 27, 542": what follows a month and can only be a day. */
const DAY_AFTER_MONTH = new RegExp(
  `\\b(${MONTH_WORD})\\s+(?:[12]?\\d|3[01])(?:st|nd|rd|th)?(?=\\s*,|\\s+\\d|\\s*$)`,
  "gi",
);

/**
 * Extracts a signed year from a free-form date string. Handles plain years,
 * full dates, circa, BC/AD/CE markers, "Nth century" (mapped to its
 * midpoint), and year ranges (the first year wins). Returns null when no
 * year can be read.
 *
 * A day is never a year. A digit run beside an era marker or alone in the
 * string used to win however it came there, so "542-08-27 AD" (Caesarius of
 * Arles, died 542) read as the year 27, "5 March 33" as the year 5 and "27
 * August", which names no year at all, as 27.
 */
export function parseYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  // Drop periods so "A.D."/"B.C." collapse to AD/BC, then collapse spaces.
  const collapsed = value
    .replace(/&nbsp;/gi, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return null;
  // A parenthesis qualifies the date: the age in "96 (aged 102)" is not a year.
  // It is only read when it holds the only number there is.
  const unbracketed = collapsed.replace(/\([^)]*\)/g, " ").trim();
  const norm = /\d/.test(unbracketed) ? unbracketed : collapsed;

  const isBC = /\b(bc|bce)\b/i.test(norm);
  const sign = isBC ? -1 : 1;

  // An ISO date, which the structured sources write with or without an era
  // ("542-08-27 AD"). Its year comes first, whatever its length.
  const iso = norm.match(/(?:^|\D)(\d{1,4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?!\d)/);
  if (iso) return sign * Number(iso[1]);

  // A year range — the earliest (first) year wins, e.g. "100–44 BC" → -100.
  // For BC ranges the era marker sits beside the *later* year, so the
  // era-adjacent rule below would pick the wrong end; handle ranges first.
  // Guarded to BC so numeric dates like "10-01-1897" still fall to the
  // 4-digit-year rule below.
  if (isBC) {
    const range = norm.match(/(\d{1,4})\s*[–—-]\s*\d{1,4}/);
    if (range) return -Number(range[1]);
  }

  // "4th century", "3rd century BC", "6th-century", "5th c." → midpoint of that century.
  const century = norm.match(/(\d{1,2})\s*(?:st|nd|rd|th)[\s-]*(?:century|cent\b|c\b)/i);
  if (century) return sign * ((Number(century[1]) - 1) * 100 + 50);

  // Whatever is left of a written-out date once its day is gone: "5 March 33"
  // is the year 33, and "27 August" has no year to read.
  const dayless = norm.replace(DAY_BEFORE_MONTH, " ").replace(DAY_AFTER_MONTH, "$1 ");

  // A year sitting right next to an era marker: "AD 33", "33 AD", "100 BC".
  const afterMarker = dayless.match(/\bad\s+(\d{1,4})/i);
  if (afterMarker) return sign * Number(afterMarker[1]);
  const beforeMarker = dayless.match(/(\d{1,4})\s*(?:ad|bce?|ce)\b/i);
  if (beforeMarker) return sign * Number(beforeMarker[1]);

  // Otherwise prefer a 4- then 3- then 1–2-digit run.
  const y4 = dayless.match(/\d{4}/);
  if (y4) return sign * Number(y4[0]);
  const y3 = dayless.match(/\d{3}/);
  if (y3) return sign * Number(y3[0]);
  const any = dayless.match(/\d{1,2}/);
  if (any) return sign * Number(any[0]);
  return null;
}

/**
 * Chronological sort key for a saint: the death year, else the birth year. A
 * canonization says nothing of when the saint lived (an early martyr canonized in the
 * sixteenth century would stand among its saints), so a saint with neither date joins
 * the undated ones after the dated.
 */
export function saintSortYear(payload: Record<string, unknown>): number | null {
  return parseYear(payload.deathDate) ?? parseYear(payload.birthDate) ?? null;
}

/**
 * Where a saint stands against the Old Testament's close of a list: 0 for a saint of the
 * Church, then the named Old Testament figures in their order, then any other dated
 * before Christ. Mirrors the saint list's own grouping in orderSqlFor("saints").
 */
function oldTestamentPlace(slug: string | undefined, year: number | null): number {
  const named = slug ? OLD_TESTAMENT_SAINTS.indexOf(slug) : -1;
  if (named >= 0) return 1 + named;
  return year != null && year < OLD_TESTAMENT_BEFORE_YEAR ? 1 + OLD_TESTAMENT_SAINTS.length : 0;
}

/**
 * Comparator that orders saints. Those at the head of the saint list lead in the
 * owner's order; everyone else follows from earliest to latest, with undatable
 * saints after them and the Old Testament last, ties broken by title.
 */
export function compareSaintsChronologically(
  a: { title: string; slug?: string; payload: Record<string, unknown> },
  b: { title: string; slug?: string; payload: Record<string, unknown> },
): number {
  // A published row knows its slug; not every payload repeats it.
  const ra = saintOrderRank(a.slug ? { ...a.payload, slug: a.slug } : a.payload);
  const rb = saintOrderRank(b.slug ? { ...b.payload, slug: b.slug } : b.payload);
  if (ra != null && rb != null && ra !== rb) return ra - rb;
  if (ra != null && rb == null) return -1; // the head of the list leads
  if (ra == null && rb != null) return 1;

  const ya = saintSortYear(a.payload);
  const yb = saintSortYear(b.payload);
  // The Old Testament closes a list, as it closes the saint list, named ones first:
  // a year before Christ would otherwise put Elijah ahead of every saint of the Church.
  const oa = oldTestamentPlace(a.slug, ya);
  const ob = oldTestamentPlace(b.slug, yb);
  if (oa !== ob) return oa - ob;
  if (ya == null && yb == null) return a.title.localeCompare(b.title);
  if (ya == null) return 1;
  if (yb == null) return -1;
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
}

/** The Twelve, Matthias, Paul and Barnabas: those Scripture calls Apostles. */
const APOSTLES: ReadonlySet<string> = new Set([
  "saint-peter",
  "saint-paul",
  "saint-james-the-greater",
  "saint-john-the-apostle",
  "saint-andrew-the-apostle",
  "saint-philip-the-apostle",
  "saint-bartholomew",
  "saint-matthew",
  "saint-thomas-the-apostle",
  "saint-james-the-less",
  "saint-jude-thaddeus",
  "saint-simon-the-zealot",
  "saint-matthias",
  "saint-barnabas",
]);

/** The saint is an Apostle, under this record or the one it repeats. */
function isApostle(slug: string): boolean {
  return APOSTLES.has(slug) || APOSTLES.has(SAINT_DUPLICATE_OF[slug] ?? "");
}

/**
 * The single title label permitted beneath a saint's name, or undefined when
 * none applies (spec — "Saint Titles"). A worker-provided `titleLabel` is
 * authoritative (e.g. "Mother of God", "Foster Father of Jesus", "Apostle of
 * Jesus and Disciple of Peter"); otherwise only Apostle, Doctor of the
 * Church, and a dated papal title are derived. Martyr, Virgin, Bishop, and
 * the like deliberately show no label.
 */
export function saintTitleLabel(
  payload: Record<string, unknown>,
  slug?: string,
): string | undefined {
  if (typeof payload.titleLabel === "string" && payload.titleLabel.trim()) {
    return payload.titleLabel.trim();
  }
  const type = typeof payload.saintType === "string" ? payload.saintType : "";
  if (type === "apostle") {
    // The stored type also marks missionaries called the apostle of a people, and
    // Phoebe, Junia and Apollos; the label is true only of the Apostles themselves.
    const own = slug ?? (typeof payload.slug === "string" ? payload.slug : "");
    return isApostle(own) ? "Apostle and Disciple of Jesus" : undefined;
  }
  if (type === "doctor_of_the_church") return "Doctor of the Church";
  if (type === "pope") {
    const start = parseYear(payload.papacyStart);
    const end = parseYear(payload.papacyEnd);
    // Only the dated form is a permitted label; otherwise defer to titleLabel.
    if (start != null && end != null) return `Pope from ${start} to ${end}`;
  }
  return undefined;
}

/** Formats a stored "MM-DD" feast day as e.g. "July 25"; passes other text through. */
export function formatFeastDay(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.trim().match(/^(\d{2})-(\d{2})$/);
  if (!m) return value.trim() || undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value.trim();
  return `${MONTHS[month - 1]} ${day}`;
}

/** Catalog eyebrow for a saint: "Doctor of the Church · Feast July 25". */
export function saintEyebrow(payload: Record<string, unknown>): string | undefined {
  const label = saintTitleLabel(payload);
  const feast = formatFeastDay(payload.feastDay);
  const parts = [label, feast ? `Feast ${feast}` : undefined].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : undefined;
}

/** What a saint's catalogue card shows beneath the name. */
export interface SaintCardDetails {
  /** Patronages in stored order, phrased to follow "Patron of" (may be empty). */
  patronages: string[];
  /** "June 29", or the stored prose of a movable feast; null when none is recorded. */
  feast: string | null;
}

/**
 * The saint fields the patronage and feast lines are read from — a full
 * payload, or the narrow JSON projection the /saints list queries.
 */
export interface SaintFactSource {
  patronages?: unknown;
  patronage?: unknown;
  feastDay?: unknown;
  feastMonth?: unknown;
  feastDayOfMonth?: unknown;
}

/**
 * The patronage and feast a saint's card and page show. Patronages in stored
 * order (the legacy single `patronage` string when there is no list); the feast
 * from the indexed month/day, or the stored text for a movable feast ("The
 * Tuesday after Pentecost"), which passes through as written.
 */
export function saintCardDetails(source: SaintFactSource): SaintCardDetails {
  const list = Array.isArray(source.patronages)
    ? source.patronages
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const legacy = typeof source.patronage === "string" ? source.patronage.trim() : "";
  const patronages = list.length > 0 ? list : legacy ? [legacy] : [];

  const month = typeof source.feastMonth === "number" ? source.feastMonth : null;
  const day = typeof source.feastDayOfMonth === "number" ? source.feastDayOfMonth : null;
  const feast =
    month != null && day != null
      ? formatFeastDay(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
      : formatFeastDay(source.feastDay);
  return { patronages, feast: feast ?? null };
}

const MONTH_NAME = new RegExp(`\\b(?:${MONTHS.join("|")})\\b`, "i");

/** Words that hedge a recorded date wherever they stand ("probably 13 January 731"). */
const HEDGE =
  /\b(?:probably|possibly|perhaps|purportedly|presumably|reportedly|allegedly|likely|around|about|approximately|approx|estimated)\b/i;

/**
 * The widest spread of years one date may name and still read as "c." its
 * first year ("302 or 303", "c. 98–117"). A wider one ("1745–1862" for the
 * Vietnamese Martyrs, "c. 1715–1765", "774 or 714") is a group's dates or a
 * guess, and printing its first year would state a fact the record does not.
 */
const MAX_SPREAD_YEARS = 20;

/**
 * The years a date names, in order: an ISO date by its year, every other run
 * of digits — in a date that names a month, only runs too long to be a day —
 * and an abbreviated second year read from the first ("1293–4" → 1294,
 * "1885–87" → 1887, "643/47" → 647).
 */
function yearsNamed(s: string): number[] {
  const monthNamed = MONTH_NAME.test(s);
  const years: number[] = [];
  let prevRun = "";
  for (const m of s.matchAll(/(\d{1,4})-\d{2}-\d{2}\b|\d{1,4}/g)) {
    const iso = m[1] != null;
    const run = iso ? m[1]! : m[0];
    if (!iso && monthNamed && run.length < 3) continue;
    let year = Number(run);
    const prev = years[years.length - 1];
    if (!iso && prev != null && run.length < prevRun.length && year < prev) {
      const base = 10 ** run.length;
      year = prev - (prev % base) + year;
      if (year < prev) year += base;
    }
    years.push(year);
    prevRun = run;
  }
  return years;
}

/**
 * One end of a saint's life as a reader expects it: a year, "c. 1715" when the
 * record is approximate, hedged or gives a short span ("302 or 303", "c.
 * 700/703", "1589-1590", "173?", "probably 731", "1225 (purportedly)"), "820s"
 * and "4th century" kept as written, "100 BC", "after 673" ("shortly after
 * 465"), "before 819" ("prior to 819"). Only what the record states: a day and
 * month are dropped, never guessed. Null when the record gives no single
 * date: no year, a disputed one ("disputed: 209, 251 or 304"), candidates
 * spread wider than MAX_SPREAD_YEARS however many there are, or two people's
 * dates ("550 (Severinus); 543 (Victorinus)", "869-02-14 and 885-04-06").
 */
function lifeYear(raw: unknown): { label: string; year: number | null } | null {
  if (typeof raw !== "string") return null;
  let s = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || /\bdisputed\b/i.test(s)) return null;

  let circa = false;
  // A parenthetical about the age ("(aged 59)") or the tradition
  // ("(traditional)") says nothing about the date; one that hedges
  // ("(purportedly)", "(?)", "(circa)") or offers another year ("(973 by some
  // sources)") makes it approximate.
  for (const [, inner = ""] of s.matchAll(/\(([^)]*)\)/g)) {
    if (/\bage[ds]?\b|\byears old\b/i.test(inner)) continue;
    if (HEDGE.test(inner) || /\?|\bcirca\b|\d{3}/i.test(inner)) circa = true;
  }
  s = s
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*[a-z]+=[a-z]+\s+/i, "") // stray wiki markup: "lk=no 360"
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.includes(";")) return null;
  // Two people's dates: "Francisco: 1908-06-11 Jacinta: 1910-03-05".
  if ((s.match(/\p{L}+:\s*\d/gu) ?? []).length >= 2) return null;
  // "After 517 and before 519" is a range; any other "and" joins two dates.
  s = s.replace(/^after\s+(.+?)\s+and\s+before\s+/i, "between $1 and ");
  const between = /^between\s+/i.exec(s);
  if (between) s = s.slice(between[0].length);
  else if (/\band\b/i.test(s)) return null;

  const bc = /\b(?:BCE?|B\.C\.(?:E\.)?)(?=\s|$)/i.test(s);
  let prefix = "";
  const qualifier = s.match(/^(shortly after|after|before|prior to)\s+/i);
  if (qualifier) {
    prefix = /^(?:before|prior)/i.test(qualifier[1]!) ? "before " : "after ";
    s = s.slice(qualifier[0].length);
  }
  const approx = s.match(/^(?:c\.|ca\.?|circa|about|around|approximately|approx\.?|~)\s*/i);
  if (approx) {
    circa = true;
    s = s.slice(approx[0].length);
  } else if (/^c\s*\d/i.test(s)) {
    circa = true;
    s = s.replace(/^c\s*/i, "");
  }
  // "100 AD. ca.": the hedge written after the year.
  const trailing = /\s*\b(?:c|ca|circa)\.?\s*$/i.exec(s);
  if (trailing) {
    circa = true;
    s = s.slice(0, trailing.index).trim();
  }
  // "173?", "649 or 650", "700/703", "unknown, 660", "~1204": the record itself is unsure.
  if (/\?|~|\bor\b|\/|\bunknown\b/i.test(s) || HEDGE.test(s)) circa = true;

  const century = s.match(/\b(\d{1,2})(st|nd|rd|th)\s+century\b/i);
  if (century) {
    return { label: `${prefix}${century[1]}${century[2]} century${bc ? " BC" : ""}`, year: null };
  }
  // "820s": a decade, already approximate, kept as written.
  const decade = s.match(/\b(\d{1,3}0)s\b/);
  if (decade) {
    const year = Number(decade[1]);
    return { label: `${prefix}${decade[1]}s${bc ? " BC" : ""}`, year: bc ? -year : year };
  }

  const years = yearsNamed(s);
  if (new Set(years).size > 1) {
    if (Math.max(...years) - Math.min(...years) > MAX_SPREAD_YEARS) return null;
    circa = true; // "1589-1590", "302 or 303": a span — its first year, approximately.
  }
  // "10 April 1028", "April 16, 1127": the first year too long to be a day;
  // "5 March 33": no such run, so the year is the last number.
  let year = years[0];
  if (year == null) {
    const runs = [...s.matchAll(/\d{1,4}/g)].map((m) => Number(m[0]));
    year = runs[runs.length - 1];
  }
  if (!year) return null;
  const label = `${prefix}${circa ? "c. " : ""}${year}${bc ? " BC" : ""}`;
  return { label, year: bc ? -year : year };
}

/**
 * The dates a saint lived, for the line under the name: "1910 – 1946",
 * "c. 1715 – 1794", "Died 304", "Born 1962". Null when the record has neither
 * date, or when its dates contradict each other (a birth after the death) —
 * a wrong-looking fact is worse than a missing line.
 */
export function saintLifeDates(payload: Record<string, unknown>): string | null {
  const born = lifeYear(payload.birthDate);
  const died = lifeYear(payload.deathDate);
  if (born && died) {
    if (born.year != null && died.year != null && born.year > died.year) return null;
    return `${born.label} – ${died.label}`;
  }
  if (died) return `Died ${died.label}`;
  if (born) return `Born ${born.label}`;
  return null;
}

/**
 * The closing sentence the structured ingest wrote under every biography it
 * composed from Wikidata facts for a saint with no English article: "A fuller
 * biography is recorded in the Polish-language Wikipedia article and on
 * Wikidata." (462 published saints). It points the reader to sources, and a
 * reader's page shows none (the owner's rule), so the saint page leaves it off.
 * Only that exact closing sentence goes; the stored text keeps it.
 */
const COMPOSED_SOURCE_POINTER =
  /\s*A fuller biography is recorded in the \S+-language Wikipedia article and on Wikidata\.\s*$/;

/**
 * A reference left behind by an encyclopedia article: the "[6:86]" of "the
 * Quran,[6:86][38:48] Elisha is venerated". A reader's page shows no sources. It sits
 * hard against the text before it and is a short number or a chapter and verse, which
 * tells it from an editor's own bracket: the year in "born in [1582], he" is a word.
 */
const LEFTOVER_REFERENCE = /(?<=\S)\[\s*(?:\d{1,3}|\d+:\d+)\s*\]/g;

/**
 * The punctuation left where a bracket was stripped from a stored article:
 * "Plechelm,, is honoured", "Goedele or Goule;. Her name", "Gemma Galgani, , also
 * known as", "John Nepomucene , was". Only marks and the spaces around them go. A
 * mark must be followed by a space or the end, so "..." and "1,000" are left alone,
 * and a full stop with another beside it is an ellipsis: "He said . . . and left."
 */
function collapseStrayPunctuation(text: string): string {
  return text
    .replace(LEFTOVER_REFERENCE, "")
    .replace(/[,;](?:[ \t]*,)+(?=\s|$)/g, ",")
    .replace(/[,;][ \t]*\.(?=\s|$)(?![ \t]*\.)/g, ".")
    .replace(/(?<=[^\s.])[ \t]+([,;.])(?=\s|$)(?![ \t]*\.)/g, "$1");
}

/**
 * A saint's biography as its page shows it: the stored text, minus a source pointer
 * and the stray punctuation of its source. Every word is left as it is stored.
 */
export function saintBiographyForDisplay(biography: string): string {
  return collapseStrayPunctuation(biography.replace(COMPOSED_SOURCE_POINTER, ""));
}

/** "Saint", "Blessed", "Venerable" or "Servant of God", from `canonizationStatus`. */
const STATUS_LABELS: Record<string, string> = {
  canonized: "Saint",
  beatified: "Blessed",
  venerable: "Venerable",
  servant_of_god: "Servant of God",
};

/** How a name already says the stage of the cause: "St. Agnes", "Bl. Carlo". */
const STATUS_IN_NAME: Record<string, RegExp> = {
  Saint: /\b(?:saints?|st|sts|ste|san|santa|santo|sankt|sainte)\b\.?/i,
  Blessed: /\b(?:blessed|bl)\b\.?/i,
  Venerable: /\b(?:venerable|ven)\b\.?/i,
  "Servant of God": /\bservants? of god\b/i,
};

/**
 * The eyebrow over a saint's name on the saint's own page: the one permitted
 * title label (Apostle, Doctor of the Church, a dated papacy, a curated
 * `titleLabel`), else the stage of the cause ("Blessed", "Venerable") when the
 * name does not already say it — so a beatus is never introduced as a saint,
 * and "Saint" is never printed over "Saint Godeberta". Undefined when there is
 * nothing to add. The feast day is no longer folded in: it has its own line
 * under the name.
 */
export function saintDetailEyebrow(
  payload: Record<string, unknown>,
  name = "",
  slug?: string,
): string | undefined {
  const label = saintTitleLabel(payload, slug);
  if (label) return label;
  const status =
    typeof payload.canonizationStatus === "string"
      ? payload.canonizationStatus.trim().toLowerCase()
      : "";
  const stage = STATUS_LABELS[status];
  if (!stage || STATUS_IN_NAME[stage]!.test(name)) return undefined;
  return stage;
}

/**
 * An entry that is one of the saint's titles, not something the saint is patron of:
 * "Guardian of the Catholic Church" (Saint Michael), "Apostle of the Frisians". After
 * "Patron of" it reads as nonsense, so it is left out. "Protectress of trees" says how
 * the saint is called on and stays (see patronageIsAgainst).
 */
const TITLE_ENTRY = /^(?:the\s+)?(?:guardian|apostle|prince|queen|king|mother|father)\s+of\b/i;

/**
 * A saint's patronages, one phrase each, whatever words the source wrapped them in. The
 * label already says "Patron of", so a stored "Patron saint of" or "Patroness of" does
 * not repeat it, on any entry, nor does the name of the saint ("Epipodius is the patron
 * saint of bachelors"). A stored run of several ("Convulsions; epilepsy") is split at its
 * semicolons. A title, a note that none is recorded and the heading "Patronage list" are
 * not patronages, and a place named twice (Willibrord's "Netherlands", then
 * "Archdiocese of Utrecht, Netherlands" split at its comma) is named once.
 */
export function saintPatronageList(patronages: readonly string[]): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const entry of patronages.flatMap((p) => p.split(";"))) {
    const phrase = entry
      .trim()
      .replace(/^\p{Lu}[\p{L}' -]* is (?=(?:the |a )?patron|invoked)/u, "")
      .replace(/^(?:(?:the|a) )?patron(?:ess)?(?: saint)? of /i, "")
      .replace(/^patron (?=against\b)/i, "")
      .replace(/^saint of /i, "")
      .replace(/\s*\(see [^)]*\)/gi, "")
      .replace(/\.$/, "")
      .trim();
    if (!phrase || TITLE_ENTRY.test(phrase) || /\bnot recorded\b|^patronage list$/i.test(phrase)) {
      continue;
    }
    const key = phrase.toLowerCase().replace(/^the\s+/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
}

/**
 * A saint's patronage as one phrase to follow its label. A place written with its
 * country ("Adjuntas, Puerto Rico") keeps its comma, so a list holding one is divided by
 * semicolons, or it would read as more places than it names. A line never breaks
 * between "St." and the name.
 */
export function saintPatronage(patronages: readonly string[]): string | null {
  const list = saintPatronageList(patronages);
  if (list.length === 0) return null;
  return list
    .join(list.some((phrase) => phrase.includes(",")) ? "; " : ", ")
    .replace(/^(The|Against|Invoked)\b/, (word) => word.toLowerCase())
    .replace(/\bSt\. /g, "St.\u00a0");
}

/**
 * A phrase that cannot follow "Patron of", because it says for itself how the saint
 * is called on: "against rabies" follows "Patron" alone, and "invoked against
 * drought", "co-patron of Messina" and "protectress of trees" need no word before them.
 */
export function patronageIsAgainst(phrase: string): boolean {
  return /^(?:against|invoked|prayed to|co-patron(?:ess)?|protect(?:or|ress))\b/i.test(phrase);
}

/** The card's line for a patronage phrase. */
function patronageLine(phrase: string, t: Translator): string {
  if (!patronageIsAgainst(phrase)) return t("saints.card.patronOf", { patronages: phrase });
  return /^against\b/i.test(phrase)
    ? `Patron ${phrase}`
    : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** "September 18" with a no-break space, so a line never ends on the month. */
export function keepDateTogether(date: string): string {
  return date.replace(/^(\p{L}+) (\d{1,2})$/u, "$1\u00a0$2");
}

/**
 * The lines a saint's catalogue card shows beneath the name, in order: the
 * patronage ("Patron of the papacy, fishermen, Rome"), then the feast day
 * ("Feast day: June 29"). A line is left out when that fact is not recorded.
 */
export function saintCardDetailLines(
  details: SaintCardDetails | undefined,
  t: Translator,
): string[] {
  if (!details) return [];
  const lines: string[] = [];
  const patronage = saintPatronage(details.patronages);
  if (patronage) lines.push(patronageLine(patronage, t));
  // A date keeps its month and day on one line, however narrow the card.
  if (details.feast) lines.push(`${t("saints.feastDay")}: ${keepDateTogether(details.feast)}`);
  return lines;
}

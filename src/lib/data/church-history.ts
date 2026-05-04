import type { Locale } from "../i18n/locales";
import { prisma } from "../db/client";

/**
 * Church history timeline data.
 *
 * The timeline is rendered chronologically and grouped into named periods.
 * Live data is read from the database (LiturgyEntry rows of kind
 * COUNCIL_TIMELINE, plus any rows whose slug is prefixed `church-history-`)
 * so admins and the ingestion pipeline can extend or revise events without
 * redeploying the app.
 *
 * The FALLBACK_EVENTS set below is a starter spine — used only when the
 * database has not yet been populated for a given slug. Each entry is
 * intentionally compact; richer narrative belongs in the published
 * LiturgyEntry body and surfaces automatically via the loader.
 *
 * Each event optionally includes `context`, `issues`, `significance`, and a
 * `body`. The detail/expanded view shows whichever fields are populated.
 */

export type ChurchHistoryPeriod =
  | "apostolic"
  | "persecution"
  | "legalization"
  | "fathers"
  | "councils-early"
  | "medieval"
  | "schism"
  | "reformation"
  | "trent"
  | "modern"
  | "vatican-i"
  | "vatican-ii"
  | "post-conciliar";

export const PERIOD_ORDER: ChurchHistoryPeriod[] = [
  "apostolic",
  "persecution",
  "legalization",
  "fathers",
  "councils-early",
  "medieval",
  "schism",
  "reformation",
  "trent",
  "modern",
  "vatican-i",
  "vatican-ii",
  "post-conciliar",
];

export const PERIOD_LABELS: Record<ChurchHistoryPeriod, string> = {
  apostolic: "The Apostolic Age (c. 30–100)",
  persecution: "Early Church Persecution (c. 64–313)",
  legalization: "Legalization of Christianity (313–380)",
  fathers: "The Church Fathers (c. 100–800)",
  "councils-early": "Major Early Councils (325–787)",
  medieval: "The Medieval Church (c. 500–1500)",
  schism: "The Great Schism (1054)",
  reformation: "The Reformation (1517–)",
  trent: "The Council of Trent (1545–1563)",
  modern: "Modern Church History (1700–)",
  "vatican-i": "Vatican I (1869–1870)",
  "vatican-ii": "Vatican II (1962–1965)",
  "post-conciliar": "Post-Conciliar Church (1965–2025)",
};

export type TimelineEvent = {
  slug: string;
  title: string;
  date: string;
  /** Numerical year used for chronological sorting. */
  sortYear: number;
  period: ChurchHistoryPeriod;
  location?: string;
  context?: string;
  issues?: string;
  significance?: string;
  body?: string;
  /** True when this event is one of the twenty-one ecumenical councils. */
  council?: boolean;
};

const FALLBACK_EVENTS: TimelineEvent[] = [
  // ── Apostolic age ──
  {
    slug: "church-history-christ-public-ministry",
    title: "Christ's public ministry",
    date: "c. 27–30",
    sortYear: 27,
    period: "apostolic",
    location: "Galilee and Judaea",
    context:
      "Jesus of Nazareth begins his public preaching after his baptism by John the Baptist. He gathers twelve apostles, proclaims the Kingdom of God, performs miracles, and culminates his ministry at the Last Supper, Crucifixion, and Resurrection.",
    significance:
      "The historical foundation of the Church. The Eucharist is instituted at the Last Supper and the apostolic mission begins after the Resurrection.",
  },
  {
    slug: "church-history-pentecost",
    title: "Pentecost",
    date: "c. 33",
    sortYear: 33,
    period: "apostolic",
    location: "Jerusalem",
    context:
      "The Holy Spirit descends on Mary and the apostles in the upper room. Peter preaches to the crowds in Jerusalem and roughly three thousand are baptised.",
    significance:
      "Traditionally regarded as the birthday of the Church — the day she is sent to all nations.",
  },
  {
    slug: "church-history-council-of-jerusalem",
    title: "Council of Jerusalem",
    date: "c. 49–50",
    sortYear: 50,
    period: "apostolic",
    location: "Jerusalem",
    context:
      "The apostles and elders, led by Peter and James, gather to address whether Gentile converts must observe the Mosaic Law (Acts 15).",
    issues: "Gentile inclusion; the necessity of circumcision; dietary law.",
    significance:
      "First conciliar precedent: the Church may bind and loose, and the gospel is universal in scope.",
  },
  {
    slug: "church-history-martyrdoms-peter-paul",
    title: "Martyrdoms of Saints Peter and Paul",
    date: "c. 64–67",
    sortYear: 64,
    period: "persecution",
    location: "Rome",
    context:
      "Peter is crucified upside-down on the Vatican Hill under Nero; Paul is beheaded along the Ostian Way.",
    significance:
      "Rome becomes the apostolic see par excellence; their tombs anchor the Roman Church through every later upheaval.",
  },

  // ── Persecution ──
  {
    slug: "church-history-fall-of-jerusalem",
    title: "Destruction of the Second Temple",
    date: "70",
    sortYear: 70,
    period: "persecution",
    location: "Jerusalem",
    context:
      "Roman forces under Titus destroy the Temple, ending Temple sacrifice and accelerating the separation of Christianity from Second-Temple Judaism.",
  },
  {
    slug: "church-history-domitian-persecution",
    title: "Persecution under Domitian",
    date: "c. 81–96",
    sortYear: 81,
    period: "persecution",
    location: "Roman Empire",
    context: "John the Apostle is exiled to Patmos. The Book of Revelation is written.",
  },
  {
    slug: "church-history-decian-persecution",
    title: "Decian persecution",
    date: "249–251",
    sortYear: 249,
    period: "persecution",
    location: "Roman Empire",
    context:
      "The first empire-wide persecution. Christians who lapsed are later reconciled through public penance — the seed of the sacrament of Reconciliation.",
  },
  {
    slug: "church-history-diocletian-persecution",
    title: "The Great (Diocletianic) Persecution",
    date: "303–311",
    sortYear: 303,
    period: "persecution",
    location: "Roman Empire",
    context: "The bloodiest persecution: Scriptures burned, churches destroyed, bishops executed.",
    significance:
      "The witness of the martyrs becomes proverbial: 'the blood of martyrs is the seed of the Church' (Tertullian).",
  },

  // ── Legalization & Fathers ──
  {
    slug: "church-history-edict-of-milan",
    title: "Edict of Milan",
    date: "313",
    sortYear: 313,
    period: "legalization",
    location: "Mediolanum (Milan)",
    context:
      "Constantine and Licinius issue the edict legalising Christianity throughout the Roman Empire and restoring confiscated property.",
    significance:
      "Ends three centuries of intermittent persecution and inaugurates the era of public Christian worship.",
  },
  {
    slug: "council-of-nicaea-i",
    title: "First Council of Nicaea",
    date: "325",
    sortYear: 325,
    period: "councils-early",
    location: "Nicaea (Bithynia)",
    context:
      "Convoked by Constantine to address the teaching of the priest Arius, who held that the Son was a creature subordinate to the Father.",
    issues:
      "Arianism; the divinity of Christ; the date of Easter; the canonical structure of the great sees.",
    significance:
      "Promulgated the Nicene Creed defining Christ as 'consubstantial with the Father' (homoousios). The first ecumenical council.",
    council: true,
  },
  {
    slug: "church-history-edict-of-thessalonica",
    title: "Edict of Thessalonica",
    date: "380",
    sortYear: 380,
    period: "legalization",
    location: "Thessalonica",
    context: "Theodosius I declares Nicene Christianity the state religion of the Roman Empire.",
  },
  {
    slug: "council-of-constantinople-i",
    title: "First Council of Constantinople",
    date: "381",
    sortYear: 381,
    period: "councils-early",
    location: "Constantinople",
    context:
      "Convoked by Theodosius to address Macedonianism, which denied the divinity of the Holy Spirit.",
    issues: "Divinity of the Holy Spirit; expansion of the Creed.",
    significance: "Completed the Creed (Nicene-Constantinopolitan) recited at every Sunday Mass.",
    council: true,
  },
  {
    slug: "church-history-vulgate",
    title: "St Jerome's Vulgate",
    date: "382–405",
    sortYear: 382,
    period: "fathers",
    location: "Bethlehem",
    context:
      "Commissioned by Pope Damasus I, Jerome translates Scripture into Latin from the Hebrew and Greek originals.",
    significance:
      "The Vulgate becomes the West's biblical text for over a thousand years; declared authoritative by Trent.",
  },
  {
    slug: "council-of-ephesus",
    title: "Council of Ephesus",
    date: "431",
    sortYear: 431,
    period: "councils-early",
    location: "Ephesus",
    context:
      "Convoked to address Nestorianism, which separated the divine and human natures in Christ such that Mary could only be called 'mother of Christ'.",
    issues: "Christology; Marian title.",
    significance:
      "Defined Mary as Theotokos — God-bearer / Mother of God — vindicating the unity of Christ's person.",
    council: true,
  },
  {
    slug: "council-of-chalcedon",
    title: "Council of Chalcedon",
    date: "451",
    sortYear: 451,
    period: "councils-early",
    location: "Chalcedon",
    context: "Convoked to address Monophysitism (Christ has only one nature, the divine).",
    issues: "Christology — the union of natures.",
    significance:
      "Defined the Chalcedonian formula: Christ is one Person in two natures, divine and human, 'without confusion, change, division, or separation'.",
    council: true,
  },
  {
    slug: "church-history-augustine-confessions",
    title: "St Augustine writes Confessions and City of God",
    date: "397–426",
    sortYear: 397,
    period: "fathers",
    location: "Hippo Regius (North Africa)",
    significance:
      "Augustine's writings become the West's deepest theological influence on grace, original sin, the Trinity, and the relationship of Church and state.",
  },

  // ── Medieval ──
  {
    slug: "church-history-fall-of-rome",
    title: "Sack of Rome and the end of the Western Empire",
    date: "410 / 476",
    sortYear: 410,
    period: "medieval",
    location: "Rome",
    context:
      "Alaric's Visigoths sack Rome; Romulus Augustulus is deposed in 476. The papacy assumes increasing civic responsibility.",
  },
  {
    slug: "church-history-pope-gregory-the-great",
    title: "Pope St Gregory the Great",
    date: "590–604",
    sortYear: 590,
    period: "medieval",
    location: "Rome",
    significance:
      "Reformed the Roman liturgy (Gregorian chant takes its name from him), sent missionaries to England, and shaped the medieval papacy.",
  },
  {
    slug: "church-history-charlemagne-coronation",
    title: "Coronation of Charlemagne",
    date: "800",
    sortYear: 800,
    period: "medieval",
    location: "Rome (St Peter's)",
    context:
      "Pope Leo III crowns Charlemagne 'Emperor of the Romans' on Christmas Day, founding the medieval relationship of Church and Empire.",
  },
  {
    slug: "church-history-cluniac-reform",
    title: "Cluniac monastic reform",
    date: "910–1130",
    sortYear: 910,
    period: "medieval",
    significance:
      "Renewed Western monasticism through liturgical fervour and direct dependence on the papacy.",
  },
  {
    slug: "church-history-east-west-schism",
    title: "The Great (East–West) Schism",
    date: "1054",
    sortYear: 1054,
    period: "schism",
    location: "Constantinople and Rome",
    context:
      "Mutual excommunications between Cardinal Humbert (papal legate) and Patriarch Michael Cerularius formalise the rift over the filioque, papal primacy, leavened bread, and clerical discipline.",
    significance:
      "Begins the formal separation of the Catholic and Eastern Orthodox communions; the excommunications were lifted by Paul VI and Athenagoras I in 1965.",
  },
  {
    slug: "church-history-investiture-controversy",
    title: "Investiture Controversy and Gregorian reform",
    date: "1075–1122",
    sortYear: 1075,
    period: "medieval",
    significance:
      "Pope Gregory VII (Hildebrand) asserts the spiritual independence of the Church from secular rulers; ends with the Concordat of Worms.",
  },
  {
    slug: "church-history-st-francis-st-dominic",
    title: "Founding of the Friars (Dominican and Franciscan)",
    date: "1209 / 1216",
    sortYear: 1209,
    period: "medieval",
    significance:
      "St Francis of Assisi and St Dominic establish mendicant orders that revitalise preaching, theology (Aquinas), and care for the poor.",
  },
  {
    slug: "council-of-lateran-iv",
    title: "Fourth Lateran Council",
    date: "1215",
    sortYear: 1215,
    period: "medieval",
    location: "Rome (Lateran)",
    context: "Called by Innocent III, the most influential medieval council.",
    issues:
      "Defined transubstantiation; required annual confession and Easter communion; addressed the Albigensian and Waldensian movements.",
    significance: "Shaped Catholic sacramental life for the next three centuries.",
    council: true,
  },
  {
    slug: "church-history-thomas-aquinas-summa",
    title: "St Thomas Aquinas writes the Summa Theologiae",
    date: "1265–1274",
    sortYear: 1265,
    period: "medieval",
    significance:
      "The synthesis of faith and reason that becomes the standard reference of Catholic theology, declared by Leo XIII the perennial Doctor.",
  },
  {
    slug: "church-history-avignon-papacy",
    title: "Avignon Papacy and Western Schism",
    date: "1309–1417",
    sortYear: 1309,
    period: "medieval",
    location: "Avignon and Rome",
    context:
      "Seven popes reside in Avignon; later, two and then three rival claimants divide allegiance.",
    significance:
      "Ended by the Council of Constance (1414–1418) which restored a single Roman pope (Martin V).",
  },

  // ── Reformation & Trent ──
  {
    slug: "church-history-luther-95-theses",
    title: "Martin Luther's 95 Theses",
    date: "31 October 1517",
    sortYear: 1517,
    period: "reformation",
    location: "Wittenberg",
    context:
      "Luther posts theses against indulgence preaching. Within a decade his protest fractures Western Christendom.",
    significance:
      "Triggers the Protestant Reformation; spurs both reform and dogmatic clarification within the Catholic Church.",
  },
  {
    slug: "council-of-trent",
    title: "Council of Trent",
    date: "1545–1563",
    sortYear: 1545,
    period: "trent",
    location: "Trent (Tyrol)",
    context:
      "The Catholic Counter-Reformation council convoked by Paul III and concluded under Pius IV.",
    issues:
      "Justification; Scripture and Tradition; the seven sacraments; the canon of Scripture; clerical reform; seminary formation; the Mass and Eucharist.",
    significance:
      "Shaped Catholic life until Vatican II. The Roman Catechism, Roman Missal (1570), and Roman Breviary all flow from Trent.",
    council: true,
  },
  {
    slug: "church-history-jesuit-foundation",
    title: "Foundation of the Society of Jesus",
    date: "1540",
    sortYear: 1540,
    period: "reformation",
    significance:
      "St Ignatius of Loyola founds the Jesuits, who become the leading missionary, educational, and spiritual force of the Counter-Reformation.",
  },
  {
    slug: "church-history-mission-to-the-new-world",
    title: "Evangelization of the Americas and Asia",
    date: "1492–1700s",
    sortYear: 1492,
    period: "reformation",
    significance:
      "Franciscans, Dominicans, Jesuits, and others bring the faith to the Americas, India, China, and Japan; Our Lady of Guadalupe (1531) leads to the conversion of millions in Mexico.",
  },

  // ── Modern ──
  {
    slug: "church-history-french-revolution",
    title: "French Revolution and Civil Constitution of the Clergy",
    date: "1789–1801",
    sortYear: 1789,
    period: "modern",
    location: "France",
    context:
      "The Revolution attempts to nationalise the French Church; thousands of clergy are martyred or exiled.",
    significance:
      "Reset by the 1801 Concordat between Pius VII and Napoleon; the modern Church and modern state begin a long renegotiation.",
  },
  {
    slug: "church-history-immaculate-conception-defined",
    title: "Definition of the Immaculate Conception",
    date: "1854",
    sortYear: 1854,
    period: "modern",
    significance:
      "Pius IX's bull Ineffabilis Deus solemnly defines Mary's preservation from original sin from the first instant of her conception.",
  },
  {
    slug: "council-of-vatican-i",
    title: "First Vatican Council",
    date: "1869–1870",
    sortYear: 1869,
    period: "vatican-i",
    location: "Rome",
    context: "Convoked by Pius IX. Suspended due to the Italian seizure of Rome.",
    issues:
      "Papal infallibility; the relationship between faith and reason; the primacy of the Roman Pontiff.",
    significance:
      "Dogmatic constitution Pastor Aeternus defines papal infallibility and the universal jurisdiction of the Pope (Dei Filius on faith and reason).",
    council: true,
  },
  {
    slug: "church-history-rerum-novarum",
    title: "Rerum Novarum",
    date: "1891",
    sortYear: 1891,
    period: "modern",
    significance:
      "Leo XIII's encyclical inaugurates modern Catholic Social Teaching, addressing the rights of workers, just wages, and property.",
  },
  {
    slug: "church-history-fatima",
    title: "Apparitions of Our Lady of Fátima",
    date: "1917",
    sortYear: 1917,
    period: "modern",
    location: "Cova da Iria, Portugal",
    significance:
      "Mary appears to three shepherd children, calling for prayer of the Rosary, penance, and the consecration of Russia. Approved by the local bishop in 1930.",
  },
  {
    slug: "church-history-assumption-defined",
    title: "Definition of the Assumption",
    date: "1950",
    sortYear: 1950,
    period: "modern",
    significance:
      "Pius XII's bull Munificentissimus Deus solemnly defines the Assumption of the Blessed Virgin Mary, body and soul, into heavenly glory.",
  },
  {
    slug: "council-of-vatican-ii",
    title: "Second Vatican Council",
    date: "1962–1965",
    sortYear: 1962,
    period: "vatican-ii",
    location: "Rome",
    context:
      "Convoked by St John XXIII and concluded by St Paul VI to engage the Church with the modern world.",
    issues:
      "Liturgical reform; ecclesiology; Scripture; ecumenism; religious freedom; the lay apostolate; the relationship between the Church and the world; Eastern Catholic Churches; the role of bishops.",
    significance:
      "Sixteen documents — including the four constitutions Lumen Gentium, Dei Verbum, Sacrosanctum Concilium, and Gaudium et Spes — shape every dimension of Catholic life since.",
    council: true,
  },

  // ── Post-Conciliar ──
  {
    slug: "church-history-novus-ordo",
    title: "Novus Ordo Missae promulgated",
    date: "1969",
    sortYear: 1969,
    period: "post-conciliar",
    significance:
      "Paul VI promulgates the reformed Roman Missal in obedience to Sacrosanctum Concilium.",
  },
  {
    slug: "church-history-john-paul-ii-pontificate",
    title: "Pontificate of St John Paul II",
    date: "1978–2005",
    sortYear: 1978,
    period: "post-conciliar",
    significance:
      "Twenty-six-year pontificate marked by the Catechism of the Catholic Church (1992), Theology of the Body, World Youth Day, and a global apostolic ministry that crossed every continent.",
  },
  {
    slug: "church-history-catechism-1992",
    title: "Catechism of the Catholic Church",
    date: "1992",
    sortYear: 1992,
    period: "post-conciliar",
    significance:
      "John Paul II promulgates the universal Catechism prepared at the request of the 1985 Synod, presenting the faith of the Church 'in the light of the Second Vatican Council'.",
  },
  {
    slug: "church-history-summorum-pontificum",
    title: "Summorum Pontificum and Traditionis Custodes",
    date: "2007 / 2021",
    sortYear: 2007,
    period: "post-conciliar",
    significance:
      "Benedict XVI's motu proprio broadens use of the 1962 Roman Missal; Francis's 2021 motu proprio Traditionis Custodes restricts its celebration and reaffirms the reformed Mass as the unique expression of the Roman Rite.",
  },
  {
    slug: "church-history-francis-pontificate",
    title: "Pontificate of Francis",
    date: "2013–",
    sortYear: 2013,
    period: "post-conciliar",
    significance:
      "First pope from the Americas. Encyclicals include Lumen Fidei, Laudato Si' (2015) on the environment, Fratelli Tutti (2020) on fraternity, and Dilexit Nos (2024) on the Sacred Heart.",
  },
  {
    slug: "church-history-jubilee-2025",
    title: "Jubilee Year of Hope",
    date: "2024–2025",
    sortYear: 2024,
    period: "post-conciliar",
    location: "Rome",
    significance:
      "The ordinary Jubilee Year proclaimed by Pope Francis under the theme Spes Non Confundit ('Hope does not disappoint'), opening on 24 December 2024 and closing on 6 January 2026.",
  },
  {
    slug: "church-history-synod-on-synodality",
    title: "Synod on Synodality",
    date: "2021–2024",
    sortYear: 2021,
    period: "post-conciliar",
    location: "Worldwide → Rome",
    significance:
      "A three-year synodal process culminating in the October 2024 final document approved by Pope Francis on the theme 'For a Synodal Church: Communion, Participation, Mission'.",
  },
];

const FALLBACK_BY_SLUG = new Map(FALLBACK_EVENTS.map((e) => [e.slug, e]));

/**
 * Load the live timeline from the database, fall back to the in-app spine
 * for any slug that hasn't been ingested yet, and return events sorted
 * chronologically (by sortYear, with date as a tiebreaker).
 *
 * Database rows are expected to be LiturgyEntry rows whose slug is one of:
 *   - the slug of a known timeline event (overrides the fallback)
 *   - a new slug starting with `church-history-` or matching `council-*`
 *
 * The body of the LiturgyEntry can be the canonical narrative; the
 * structured fields (context, issues, significance) come from the fallback
 * for now. A later schema migration could extend LiturgyEntry with these
 * fields once enough timeline rows exist.
 */
export async function loadTimeline(locale: Locale): Promise<TimelineEvent[]> {
  const dbRows = await prisma.liturgyEntry.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { kind: "COUNCIL_TIMELINE" },
        { slug: { startsWith: "church-history-" } },
        { slug: { startsWith: "council-" } },
      ],
    },
    include: { translations: { where: { locale } } },
    orderBy: { title: "asc" },
  });

  const merged = new Map<string, TimelineEvent>(FALLBACK_BY_SLUG);

  for (const row of dbRows) {
    const tr = row.translations[0];
    const fallback = FALLBACK_BY_SLUG.get(row.slug);
    if (fallback) {
      merged.set(row.slug, {
        ...fallback,
        title: tr?.title ?? row.title ?? fallback.title,
        body: tr?.body ?? row.body ?? fallback.body,
      });
    } else {
      // Promote a brand-new ingested timeline entry to the modern bucket
      // until it can be re-categorised by an admin. Using `post-conciliar`
      // as a safe default since most newly-ingested events are recent.
      merged.set(row.slug, {
        slug: row.slug,
        title: tr?.title ?? row.title ?? row.slug,
        date: tr?.summary ?? row.summary ?? "Date unknown",
        sortYear: 9999,
        period: "post-conciliar",
        body: tr?.body ?? row.body ?? "",
      });
    }
  }

  return [...merged.values()].sort((a, b) => {
    const av = a.sortYear ?? 9999;
    const bv = b.sortYear ?? 9999;
    if (av !== bv) return av - bv;
    return a.date.localeCompare(b.date);
  });
}

export function groupByPeriod(events: TimelineEvent[]): Map<ChurchHistoryPeriod, TimelineEvent[]> {
  const groups = new Map<ChurchHistoryPeriod, TimelineEvent[]>();
  for (const period of PERIOD_ORDER) groups.set(period, []);
  for (const e of events) {
    groups.get(e.period)?.push(e);
  }
  return groups;
}

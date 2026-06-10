/**
 * Authority source registry.
 *
 * Lists every Catholic source the worker is allowed to read from, with its
 * authority level. The worker NEVER fetches from a source not listed here.
 * Sources are seeded into the AuthoritySource table during setup; admins can
 * pause individual sources via the admin UI.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

export interface AuthoritySourceSeed {
  name: string;
  host: string;
  baseUrl: string;
  authorityLevel: SourceAuthorityLevel;
  description: string;
  contentTypes: ChecklistContentType[];
}

const ALL_TYPES: ChecklistContentType[] = [
  "PRAYER",
  "DEVOTION",
  "SAINT",
  "MARIAN_TITLE",
  "APPARITION",
  "NOVENA",
  "SACRAMENT",
  "GUIDE",
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "SPIRITUAL_PRACTICE",
];

// Content-type groupings reused across the global registry below.
const CONFERENCE_TYPES: ChecklistContentType[] = [
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "PRAYER",
  "SAINT",
  "DEVOTION",
];
const ORDER_TYPES: ChecklistContentType[] = ["SAINT", "DEVOTION", "PRAYER", "SPIRITUAL_PRACTICE"];
const ACADEMIC_TYPES: ChecklistContentType[] = ["CHURCH_DOCUMENT", "SAINT", "SPIRITUAL_PRACTICE"];
const REFERENCE_TYPES: ChecklistContentType[] = [
  "PRAYER",
  "DEVOTION",
  "SAINT",
  "MARIAN_TITLE",
  "NOVENA",
  "GUIDE",
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "SPIRITUAL_PRACTICE",
];

/** Compact constructor for a registry entry (baseUrl defaults to https://host). */
function src(
  name: string,
  host: string,
  authorityLevel: SourceAuthorityLevel,
  contentTypes: ChecklistContentType[],
  description: string,
): AuthoritySourceSeed {
  return { name, host, baseUrl: `https://${host}`, authorityLevel, description, contentTypes };
}

export const AUTHORITY_SOURCES: AuthoritySourceSeed[] = [
  {
    name: "The Holy See (Vatican)",
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    authorityLevel: "VATICAN",
    description:
      "The official website of the Holy See. Primary authority for papal documents, Roman Curia communications, and the Catechism.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Catechism of the Catholic Church (Vatican archive)",
    host: "vatican.va/archive",
    baseUrl: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM",
    authorityLevel: "CATECHISM",
    description: "Official English text of the Catechism, hosted on Vatican.va.",
    contentTypes: [
      "PRAYER",
      "DEVOTION",
      "SACRAMENT",
      "GUIDE",
      "CHURCH_DOCUMENT",
      "LITURGICAL",
      "SPIRITUAL_PRACTICE",
    ],
  },
  {
    name: "United States Conference of Catholic Bishops",
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    authorityLevel: "USCCB",
    description:
      "USCCB pastoral letters, liturgical calendar, and approved Catholic prayers in English.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Roman Missal (Liturgical book)",
    host: "icel.org",
    baseUrl: "https://www.icel.org",
    authorityLevel: "LITURGICAL_BOOK",
    description:
      "International Commission on English in the Liturgy — approved English texts for the Roman Missal.",
    contentTypes: ["PRAYER", "LITURGICAL", "SACRAMENT"],
  },
  {
    name: "EWTN",
    host: "ewtn.com",
    baseUrl: "https://www.ewtn.com",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "EWTN Global Catholic Network — trusted Catholic publisher with editorial review.",
    contentTypes: ALL_TYPES,
  },
  {
    name: "Catholic Answers",
    host: "catholic.com",
    baseUrl: "https://www.catholic.com",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "Catholic Answers — apologetics and Catholic teaching.",
    contentTypes: ["PRAYER", "DEVOTION", "SAINT", "SACRAMENT", "GUIDE", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Catholic.org",
    host: "catholic.org",
    baseUrl: "https://www.catholic.org",
    authorityLevel: "TRUSTED_PUBLISHER",
    description: "Catholic Online — prayers and saint biographies.",
    contentTypes: ["PRAYER", "SAINT", "NOVENA", "DEVOTION"],
  },
  {
    name: "New Advent (Catholic Encyclopedia)",
    host: "newadvent.org",
    baseUrl: "https://www.newadvent.org",
    authorityLevel: "TRUSTED_PUBLISHER",
    description:
      "New Advent — Catholic Encyclopedia and source texts (St. Thomas, Fathers of the Church).",
    contentTypes: ["SAINT", "CHURCH_DOCUMENT", "LITURGICAL", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Vatican News",
    host: "vaticannews.va",
    baseUrl: "https://www.vaticannews.va",
    authorityLevel: "VATICAN",
    description: "Official Vatican news service.",
    contentTypes: ["CHURCH_DOCUMENT", "SAINT", "LITURGICAL"],
  },
  {
    name: "Press Office of the Holy See",
    host: "press.vatican.va",
    baseUrl: "https://press.vatican.va",
    authorityLevel: "VATICAN",
    description: "Official Vatican press office releases.",
    contentTypes: ["CHURCH_DOCUMENT"],
  },
  {
    name: "Dicastery for the Causes of Saints",
    host: "causasanctorum.va",
    baseUrl: "https://www.causasanctorum.va",
    authorityLevel: "VATICAN",
    description:
      "Vatican dicastery responsible for canonization causes; primary source for saint and blessed status.",
    contentTypes: ["SAINT", "APPARITION"],
  },
  {
    name: "Apostleship of Prayer / Pope's Worldwide Prayer Network",
    host: "popesprayer.va",
    baseUrl: "https://www.popesprayer.va",
    authorityLevel: "VATICAN",
    description: "Holy Father's monthly prayer intentions.",
    contentTypes: ["PRAYER", "DEVOTION"],
  },
  {
    name: "Discalced Carmelites (OCD)",
    host: "carmelite.org",
    baseUrl: "https://carmelite.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Discalced Carmelite Order resources (St. Teresa, St. John of the Cross).",
    contentTypes: ["SAINT", "DEVOTION", "SPIRITUAL_PRACTICE", "PRAYER"],
  },
  {
    name: "Dominican Order",
    host: "op.org",
    baseUrl: "https://www.op.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Order of Preachers (Dominicans).",
    contentTypes: ["SAINT", "DEVOTION", "PRAYER", "SPIRITUAL_PRACTICE"],
  },
  {
    name: "Franciscan Friars",
    host: "ofm.org",
    baseUrl: "https://www.ofm.org",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Order of Friars Minor (Franciscans).",
    contentTypes: ["SAINT", "DEVOTION", "PRAYER"],
  },
  {
    name: "Society of Jesus (Jesuits)",
    host: "jesuits.global",
    baseUrl: "https://www.jesuits.global",
    authorityLevel: "RELIGIOUS_ORDER",
    description: "Society of Jesus — Ignatian spirituality.",
    contentTypes: ["SAINT", "SPIRITUAL_PRACTICE", "PRAYER"],
  },

  // ── Roman Curia dicasteries & Holy See bodies (all *.va is also approved by
  //    pattern below; these are named for discovery targeting). ───────────────
  src(
    "Dicastery for the Laity, Family and Life",
    "laityfamilylife.va",
    "VATICAN",
    ["PRAYER", "DEVOTION", "CHURCH_DOCUMENT"],
    "Vatican dicastery for the lay faithful, the family, and the protection of life.",
  ),
  src(
    "Dicastery for Promoting Integral Human Development",
    "humandevelopment.va",
    "VATICAN",
    ["CHURCH_DOCUMENT"],
    "Vatican dicastery for justice, peace, charity, and integral human development.",
  ),
  src(
    "General Secretariat of the Synod",
    "synod.va",
    "VATICAN",
    ["CHURCH_DOCUMENT"],
    "Official site of the Synod of Bishops.",
  ),
  src(
    "Vatican Apostolic Library",
    "vatlib.it",
    "VATICAN",
    ["CHURCH_DOCUMENT", "LITURGICAL"],
    "The Vatican Apostolic Library — manuscripts and source texts of the Holy See.",
  ),

  // ── Episcopal (bishops') conferences. Authority is modelled at the USCCB tier
  //    — the existing enum value that denotes a national/continental bishops'
  //    conference (peer to the USCCB), one rung below the Holy See. ────────────
  src(
    "Bishops' Conference of England and Wales",
    "cbcew.org.uk",
    "USCCB",
    CONFERENCE_TYPES,
    "Catholic Bishops' Conference of England and Wales.",
  ),
  src(
    "Bishops' Conference of Scotland",
    "bcos.org.uk",
    "USCCB",
    CONFERENCE_TYPES,
    "Bishops' Conference of Scotland.",
  ),
  src(
    "Irish Catholic Bishops' Conference",
    "catholicbishops.ie",
    "USCCB",
    CONFERENCE_TYPES,
    "Irish Catholic Bishops' Conference.",
  ),
  src(
    "Canadian Conference of Catholic Bishops",
    "cccb.ca",
    "USCCB",
    CONFERENCE_TYPES,
    "Canadian Conference of Catholic Bishops (CCCB).",
  ),
  src(
    "Australian Catholic Bishops Conference",
    "catholic.org.au",
    "USCCB",
    CONFERENCE_TYPES,
    "Australian Catholic Bishops Conference (ACBC).",
  ),
  src(
    "New Zealand Catholic Bishops Conference",
    "catholic.org.nz",
    "USCCB",
    CONFERENCE_TYPES,
    "New Zealand Catholic Bishops Conference.",
  ),
  src(
    "Catholic Bishops' Conference of India",
    "cbci.in",
    "USCCB",
    CONFERENCE_TYPES,
    "Catholic Bishops' Conference of India (CBCI).",
  ),
  src(
    "Catholic Bishops' Conference of the Philippines",
    "cbcponline.net",
    "USCCB",
    CONFERENCE_TYPES,
    "Catholic Bishops' Conference of the Philippines (CBCP).",
  ),
  src(
    "Conferenza Episcopale Italiana",
    "chiesacattolica.it",
    "USCCB",
    CONFERENCE_TYPES,
    "Italian Episcopal Conference (CEI).",
  ),
  src(
    "Conférence des évêques de France",
    "eglise.catholique.fr",
    "USCCB",
    CONFERENCE_TYPES,
    "Bishops' Conference of France.",
  ),
  src(
    "Deutsche Bischofskonferenz",
    "dbk.de",
    "USCCB",
    CONFERENCE_TYPES,
    "German Bishops' Conference (DBK).",
  ),
  src(
    "Conferencia Episcopal Española",
    "conferenciaepiscopal.es",
    "USCCB",
    CONFERENCE_TYPES,
    "Spanish Episcopal Conference.",
  ),
  src(
    "Conferência Episcopal Portuguesa",
    "conferenciaepiscopal.pt",
    "USCCB",
    CONFERENCE_TYPES,
    "Portuguese Episcopal Conference.",
  ),
  src(
    "Konferencja Episkopatu Polski",
    "episkopat.pl",
    "USCCB",
    CONFERENCE_TYPES,
    "Polish Bishops' Conference.",
  ),
  src(
    "Conferência Nacional dos Bispos do Brasil",
    "cnbb.org.br",
    "USCCB",
    CONFERENCE_TYPES,
    "National Conference of Bishops of Brazil (CNBB).",
  ),
  src(
    "Conferencia del Episcopado Mexicano",
    "cem.org.mx",
    "USCCB",
    CONFERENCE_TYPES,
    "Mexican Episcopal Conference (CEM).",
  ),
  src(
    "Österreichische Bischofskonferenz",
    "bischofskonferenz.at",
    "USCCB",
    CONFERENCE_TYPES,
    "Austrian Bishops' Conference.",
  ),
  src(
    "Rooms-Katholieke Kerk Nederland",
    "rkkerk.nl",
    "USCCB",
    CONFERENCE_TYPES,
    "Bishops' Conference of the Netherlands.",
  ),
  src(
    "CELAM — Latin American Episcopal Council",
    "celam.org",
    "USCCB",
    CONFERENCE_TYPES,
    "Consejo Episcopal Latinoamericano (Latin America & the Caribbean).",
  ),
  src(
    "CCEE — Council of European Bishops' Conferences",
    "ccee.eu",
    "USCCB",
    CONFERENCE_TYPES,
    "Council of the Bishops' Conferences of Europe.",
  ),
  src(
    "COMECE",
    "comece.eu",
    "USCCB",
    CONFERENCE_TYPES,
    "Commission of the Bishops' Conferences of the European Union.",
  ),
  src(
    "SECAM",
    "secam.org",
    "USCCB",
    CONFERENCE_TYPES,
    "Symposium of Episcopal Conferences of Africa and Madagascar.",
  ),
  src(
    "FABC — Federation of Asian Bishops' Conferences",
    "fabc.org",
    "USCCB",
    CONFERENCE_TYPES,
    "Federation of Asian Bishops' Conferences.",
  ),

  // ── Eastern Catholic Churches (sui iuris particular churches in full communion
  //    with Rome — modelled at the conference/particular-church tier). ─────────
  src(
    "Ukrainian Greek Catholic Church",
    "ugcc.ua",
    "USCCB",
    CONFERENCE_TYPES,
    "Ukrainian Greek Catholic Church — the largest of the Eastern Catholic Churches.",
  ),
  src(
    "Syro-Malabar Catholic Church",
    "syromalabarchurch.in",
    "USCCB",
    CONFERENCE_TYPES,
    "Syro-Malabar Major Archiepiscopal Church (India).",
  ),
  src(
    "Melkite Greek Catholic Church",
    "melkite.org",
    "USCCB",
    CONFERENCE_TYPES,
    "Melkite Greek Catholic Church.",
  ),

  // ── Major (arch)dioceses (representative of the diocesan tier; the global
  //    long tail is recognised by the diocesan pattern in classifyHostAuthority).
  src(
    "Archdiocese of New York",
    "archny.org",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Archdiocese of New York.",
  ),
  src(
    "Diocese of Westminster",
    "rcdow.org.uk",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Diocese of Westminster (London).",
  ),
  src(
    "Archdiocese of Chicago",
    "archchicago.org",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Archdiocese of Chicago.",
  ),
  src(
    "Archdiocese of Los Angeles",
    "lacatholics.org",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Archdiocese of Los Angeles.",
  ),
  src(
    "Archdiocese of Boston",
    "bostoncatholic.org",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Archdiocese of Boston.",
  ),
  src(
    "Archdiocese of Sydney",
    "sydneycatholic.org",
    "DIOCESAN",
    CONFERENCE_TYPES,
    "Roman Catholic Archdiocese of Sydney.",
  ),

  // ── Religious orders & congregations. ──────────────────────────────────────
  src(
    "Order of Saint Benedict",
    "osb.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Benedictine monasticism — the Rule of St. Benedict and Benedictine saints.",
  ),
  src(
    "Cistercians of the Strict Observance (Trappists)",
    "ocso.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Order of Cistercians of the Strict Observance (Trappists).",
  ),
  src(
    "Capuchin Franciscans",
    "ofmcap.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Order of Friars Minor Capuchin.",
  ),
  src(
    "Salesians of Don Bosco",
    "sdb.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Salesians of Don Bosco — youth ministry and St. John Bosco.",
  ),
  src(
    "Missionary Oblates of Mary Immaculate",
    "omiworld.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Missionary Oblates of Mary Immaculate (OMI).",
  ),
  src(
    "Marians of the Immaculate Conception",
    "marian.org",
    "RELIGIOUS_ORDER",
    ORDER_TYPES,
    "Marian Fathers — custodians of the Divine Mercy message of St. Faustina.",
  ),

  // ── Catholic universities & pontifical institutes (academic tier). ─────────
  src(
    "University of Notre Dame",
    "nd.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "University of Notre Dame — Catholic research university (Indiana).",
  ),
  src(
    "The Catholic University of America",
    "catholic.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "The Catholic University of America — the national university of the Church in the US.",
  ),
  src(
    "Georgetown University",
    "georgetown.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Georgetown University — Jesuit university (Washington, DC).",
  ),
  src(
    "Boston College",
    "bc.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Boston College — Jesuit university.",
  ),
  src(
    "Fordham University",
    "fordham.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Fordham University — Jesuit university (New York).",
  ),
  src(
    "Villanova University",
    "villanova.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Villanova University — Augustinian Catholic university.",
  ),
  src(
    "Franciscan University of Steubenville",
    "franciscan.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Franciscan University of Steubenville.",
  ),
  src(
    "Ave Maria University",
    "avemaria.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Ave Maria University — Catholic university (Florida).",
  ),
  src(
    "Pontifical Gregorian University",
    "unigre.it",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Pontifical Gregorian University, Rome.",
  ),
  src(
    "Pontifical University of the Holy Cross",
    "pusc.it",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Pontifical University of the Holy Cross, Rome.",
  ),
  src(
    "Pontifical Urban University",
    "urbaniana.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Pontifical Urbaniana University, Rome.",
  ),
  src(
    "KU Leuven",
    "kuleuven.be",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Katholieke Universiteit Leuven — Catholic university (Belgium).",
  ),
  src(
    "University of Navarra",
    "unav.edu",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Universidad de Navarra — Catholic university (Spain).",
  ),
  src(
    "Università Cattolica del Sacro Cuore",
    "unicatt.it",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Catholic University of the Sacred Heart (Milan).",
  ),
  src(
    "Australian Catholic University",
    "acu.edu.au",
    "ACADEMIC",
    ACADEMIC_TYPES,
    "Australian Catholic University.",
  ),

  // ── Reputable Catholic reference works, databases & news. ──────────────────
  src(
    "Catholic Culture",
    "catholicculture.org",
    "TRUSTED_PUBLISHER",
    REFERENCE_TYPES,
    "Catholic Culture — reviewed library of Church documents, liturgical year, and prayers.",
  ),
  src(
    "Catholic News Agency",
    "catholicnewsagency.com",
    "TRUSTED_PUBLISHER",
    ["CHURCH_DOCUMENT", "SAINT"],
    "Catholic News Agency (CNA).",
  ),
  src(
    "National Catholic Register",
    "ncregister.com",
    "TRUSTED_PUBLISHER",
    ["CHURCH_DOCUMENT", "SAINT"],
    "National Catholic Register — EWTN news service.",
  ),
  src(
    "Aleteia",
    "aleteia.org",
    "TRUSTED_PUBLISHER",
    REFERENCE_TYPES,
    "Aleteia — Catholic spirituality, saints, and prayers.",
  ),
  src(
    "Papal Encyclicals Online",
    "papalencyclicals.net",
    "TRUSTED_PUBLISHER",
    ["CHURCH_DOCUMENT"],
    "Archive of papal encyclicals and conciliar documents.",
  ),
  src(
    "CatholicSaints.Info",
    "catholicsaints.info",
    "TRUSTED_PUBLISHER",
    ["SAINT", "DEVOTION", "PRAYER"],
    "Reference database of saints, feast days, and patronages.",
  ),
  src(
    "Universalis",
    "universalis.com",
    "TRUSTED_PUBLISHER",
    ["LITURGICAL", "PRAYER"],
    "Universalis — the Liturgy of the Hours and the liturgical calendar.",
  ),
  src(
    "Franciscan Media (Saint of the Day)",
    "franciscanmedia.org",
    "TRUSTED_PUBLISHER",
    ["SAINT", "DEVOTION", "PRAYER"],
    "Franciscan Media — Saint of the Day and Franciscan resources.",
  ),
  src(
    "Douay-Rheims Bible Online",
    "drbo.org",
    "TRUSTED_PUBLISHER",
    ["LITURGICAL", "PRAYER"],
    "The Douay-Rheims Bible — public-domain Catholic Scripture text.",
  ),
  src(
    "DivineOffice.org",
    "divineoffice.org",
    "TRUSTED_PUBLISHER",
    ["LITURGICAL", "PRAYER"],
    "The Liturgy of the Hours in English.",
  ),
  src(
    "Knights of Columbus",
    "kofc.org",
    "TRUSTED_PUBLISHER",
    ["DEVOTION", "PRAYER", "CHURCH_DOCUMENT"],
    "Knights of Columbus — Catholic fraternal resources and devotions.",
  ),
];

/**
 * Local-verification-only source hosts. When `ADMIN_WORKER_DEV_SOURCE_HOSTS`
 * is set AND `NODE_ENV !== "production"`, the listed hosts are treated as
 * approved COMMUNITY-level sources so a developer can point the worker at a
 * LOCAL MIRROR of approved Catholic content and watch the full autonomous
 * chain (fetch → read → blocks → classify → extract → build → strict QA →
 * quality → publish → verify) run end-to-end offline.
 *
 * Safety: this NEVER fires in production (guarded by NODE_ENV) and lowers
 * NO standard — content from a dev host must still pass strict QA, quality
 * scoring, and the per-type content contract before it can publish, exactly
 * like any other source. It only widens the fetch allow-list for local runs.
 */
function devSourceHosts(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  const raw = process.env.ADMIN_WORKER_DEV_SOURCE_HOSTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function authorityLevelForHost(host: string): SourceAuthorityLevel | null {
  const normalized = host.toLowerCase();
  const match = AUTHORITY_SOURCES.find(
    (s) => normalized === s.host || normalized.endsWith(`.${s.host}`),
  );
  if (match) return match.authorityLevel;
  // The `.va` top-level domain is reserved exclusively for the Holy See /
  // Vatican City State, so EVERY *.va host is an approved Vatican source. This
  // lets the worker follow links to any Roman Curia dicastery domain it has not
  // been told about explicitly.
  if (normalized === "va" || normalized.endsWith(".va")) return "VATICAN";
  // Local-verification hook (non-production only).
  if (devSourceHosts().some((h) => normalized === h || normalized.endsWith(`.${h}`))) {
    return "COMMUNITY";
  }
  return null;
}

export function isApprovedAuthorityHost(host: string): boolean {
  return authorityLevelForHost(host) !== null;
}

export function findAuthoritySource(host: string): AuthoritySourceSeed | null {
  const normalized = host.toLowerCase();
  return (
    AUTHORITY_SOURCES.find((s) => normalized === s.host || normalized.endsWith(`.${s.host}`)) ??
    null
  );
}

/**
 * Best-effort authority CLASSIFICATION for ANY host — including lesser-known
 * Catholic sources the worker discovers but which are not in the explicit
 * registry. This does NOT widen the fetch allow-list (that stays
 * `isApprovedAuthorityHost`); it lets the cross-source verifier weigh a source's
 * claims by its likely Catholic authority so the worker can still judge the
 * quality of a lesser-known source. The explicit registry (and the Holy See
 * `.va` TLD) win; otherwise the level is inferred from well-established patterns
 * — diocesan/archdiocesan domains across languages, religious orders, Catholic
 * universities — defaulting to COMMUNITY.
 */
export function classifyHostAuthority(host: string): SourceAuthorityLevel {
  const explicit = authorityLevelForHost(host);
  if (explicit) return explicit;
  const h = host.toLowerCase();
  if (/(^|\.)usccb\.org$/.test(h)) return "USCCB";
  if (
    /(diocese|archdiocese|diocesi|arcidiocesi|diocesis|arquidiocesis|archidioecesis|bistum|erzbistum|diecezja|archidiecezja|dioc[eè]se|archidioc[eè]se|episcop)/.test(
      h,
    )
  ) {
    return "DIOCESAN";
  }
  if (
    /(franciscan|dominican|jesuit|benedictine|carmelite|redemptorist|salesian|augustinian|capuchin|cistercian|trappist|oblate|passionist|monaster|abbey|\bosb\b|\bofm\b|\bocd\b)/.test(
      h,
    )
  ) {
    return "RELIGIOUS_ORDER";
  }
  if (
    /pontif|(cathol[a-z]*).*(universit|college|seminar)|(universit|college|seminar).*cathol/.test(h)
  ) {
    return "ACADEMIC";
  }
  if (/cathol|katholisch|catholique|catolic|cattolic/.test(h)) return "TRUSTED_PUBLISHER";
  return "COMMUNITY";
}

/**
 * Hosts the worker never fetches, even in open-internet mode: local / internal
 * addresses and social / login / commerce destinations that never carry citable
 * Catholic reference content. Keeps "look across the whole internet" from
 * wandering into unsafe or useless territory.
 */
const NON_CONTENT_HOST_PATTERNS: RegExp[] = [
  /(^|\.)localhost$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /\.local$/,
  /(^|\.)facebook\.com$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)pinterest\.[a-z.]+$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)amazon\.[a-z.]+$/,
  /(^|\.)ebay\.[a-z.]+$/,
  /(^|\.)login\./,
  /(^|\.)accounts\./,
];

/**
 * Whether the operator has opened the worker up to the wider internet. When on,
 * the worker may fetch sources beyond the explicit registry — any conference of
 * bishops, diocese, EWTN, a Catholic database, or even a general site — because
 * ACCURACY is enforced downstream by cross-source verification + strict QA, not
 * by the fetch allow-list. Default OFF (registry-only). Only "1"/"true" enables.
 */
export function openInternetEnabled(): boolean {
  const v = (process.env.ADMIN_WORKER_OPEN_INTERNET ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Whether the worker may FETCH a host. The explicit registry + the Holy See
 * `.va` TLD are ALWAYS allowed. With open-internet mode enabled the worker may
 * also reach any host that is not obviously non-content (local / social /
 * commerce), so it can pull from lesser-known but accurate sources anywhere —
 * the content still has to pass cross-source verification and strict QA before
 * it can publish, so opening the fetch list never lowers the accuracy bar.
 */
export function isFetchableHost(host: string): boolean {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  if (NON_CONTENT_HOST_PATTERNS.some((re) => re.test(h))) return false;
  if (isApprovedAuthorityHost(h)) return true;
  return openInternetEnabled();
}

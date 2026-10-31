/**
 * What the translation engine may and may not touch.
 *
 * Pure functions only — no database, no network, no model — so every rule is
 * unit-tested exhaustively and the web server and the translator apply the
 * very same decisions.
 *
 *   (a) LATIN AND GREEK STAY AS WRITTEN. A prayer's Latin/Greek text, a title
 *       the whole Church uses in Latin or Greek (Salve Regina, Te Deum, Kyrie
 *       eleison, Lumen Gentium, every Latin incipit of a Church document) and
 *       any Latin or Greek-script passage inside English prose is never sent to
 *       a model as something to translate. Inside a sentence that IS
 *       translated, such a title is a protected span: the translation is kept
 *       only when the span comes back verbatim (`verifyProtectedSpans`).
 *   (b) PARISH NAMES STAY IN THEIR OWN WORDING unless they are written in a
 *       different script from the visitor's language (Hangul, Han, Kana,
 *       Cyrillic, Greek, Arabic, Hebrew, Thai, …). Only then is the name
 *       translated, or transliterated when a translation is not meaningful,
 *       and the original is always shown beside it (`decideParishName`).
 *   (c) SAINTS' NAMES are never machine-translated. The title of a saint's,
 *       a Doctor's or a pope's page is shown as published unless the
 *       interface dictionaries hold a localized form (`name.<slug>`), and a
 *       saint named inside prose ("Saint John Vianney", the page's own saint)
 *       is a protected span that comes back exactly as published.
 *
 * Everything else a page shows from a published item — summaries, bodies,
 * backgrounds, steps, patronages — is translated into the visitor's language.
 */

import type { Locale } from "@/lib/i18n/locales";

/* ------------------------------------------------------------------ */
/*  Scripts                                                           */
/* ------------------------------------------------------------------ */

export type Script =
  | "latin"
  | "greek"
  | "cyrillic"
  | "han"
  | "hangul"
  | "japanese"
  | "arabic"
  | "hebrew"
  | "thai"
  | "devanagari"
  | "other"
  | "none";

const SCRIPT_TESTS: ReadonlyArray<[Exclude<Script, "japanese" | "other" | "none">, RegExp]> = [
  ["latin", /\p{Script=Latin}/u],
  ["greek", /\p{Script=Greek}/u],
  ["cyrillic", /\p{Script=Cyrillic}/u],
  ["han", /\p{Script=Han}/u],
  ["hangul", /\p{Script=Hangul}/u],
  ["arabic", /\p{Script=Arabic}/u],
  ["hebrew", /\p{Script=Hebrew}/u],
  ["thai", /\p{Script=Thai}/u],
  ["devanagari", /\p{Script=Devanagari}/u],
];
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const LETTER = /\p{L}/u;

/** Letter counts per script (combining marks and the katakana prolonged sound mark excluded). */
export function scriptCounts(text: string): Map<Script, number> {
  const counts = new Map<Script, number>();
  for (const ch of String(text ?? "")) {
    if (!LETTER.test(ch) && ch !== "ー") continue;
    let script: Script = "other";
    if (KANA.test(ch) || ch === "ー") script = "japanese";
    else {
      for (const [name, re] of SCRIPT_TESTS) {
        if (re.test(ch)) {
          script = name;
          break;
        }
      }
    }
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  return counts;
}

/**
 * The script a text is written in: the one with the most letters. Japanese is
 * its own script — any kana marks a Han + kana mix as Japanese, because a
 * kanji-and-kana name is not Chinese and a Chinese reader is not served by it
 * as if it were. "none" when there are no letters at all.
 */
export function detectScript(text: string): Script {
  const counts = scriptCounts(text);
  if (counts.size === 0) return "none";
  const kana = counts.get("japanese") ?? 0;
  if (kana > 0) {
    const han = counts.get("han") ?? 0;
    counts.set("japanese", kana + han);
    counts.delete("han");
  }
  let best: Script = "none";
  let bestCount = 0;
  for (const [script, n] of counts) {
    if (n > bestCount) {
      best = script;
      bestCount = n;
    }
  }
  return best;
}

/** True when the text has at least one letter of the given script. */
export function hasScript(text: string, script: Script): boolean {
  return (scriptCounts(text).get(script) ?? 0) > 0;
}

/** The script each site locale is read in. */
export function localeScript(locale: Locale): Script {
  if (locale === "ko") return "hangul";
  if (locale === "zh") return "han";
  return "latin";
}

/* ------------------------------------------------------------------ */
/*  Text folding                                                      */
/* ------------------------------------------------------------------ */

/** Lower-case, accents stripped, typographic apostrophes straightened. */
export function fold(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[‘’ʼ´`]/g, "'")
    .toLowerCase();
}

type Token = { word: string; start: number; end: number; upper: boolean };

const TOKEN_RE = /[\p{L}\p{M}][\p{L}\p{M}'’]*/gu;

function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of String(text ?? "").matchAll(TOKEN_RE)) {
    const raw = m[0];
    const word = fold(raw).replace(/'+$/, "");
    if (!word) continue;
    out.push({ word, start: m.index, end: m.index + raw.length, upper: /^\p{Lu}/u.test(raw) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Liturgical languages                                              */
/* ------------------------------------------------------------------ */

const LITURGICAL_CODES = new Set([
  "la",
  "lat",
  "latin",
  "latina",
  "el",
  "ell",
  "grc",
  "gr",
  "greek",
  "koine",
  "church-latin",
  "ecclesiastical-latin",
]);

/** True for any spelling of Latin or (liturgical) Greek as a language code. */
export function isLiturgicalLanguageCode(code: unknown): boolean {
  if (typeof code !== "string") return false;
  const c = code.trim().toLowerCase();
  return LITURGICAL_CODES.has(c) || LITURGICAL_CODES.has(c.split(/[-_]/)[0] ?? "");
}

/** True when a payload's declared text language is English (or unstated). */
export function isEnglishLanguageCode(code: unknown): boolean {
  if (code == null || code === "") return true;
  if (typeof code !== "string") return false;
  const c = code.trim().toLowerCase();
  return c === "en" || c.startsWith("en-") || c.startsWith("en_") || c === "english";
}

/* ------------------------------------------------------------------ */
/*  Latin                                                             */
/* ------------------------------------------------------------------ */

/**
 * Words that are Latin (or liturgical Greek written in Latin letters) and not
 * everyday English. Ambiguous words — in, a, me, sum, amen, alleluia, maria,
 * jesus — are deliberately absent: they never count for either side.
 */
const LATIN_WORDS = new Set(
  (
    "litania litaniae et est sunt erat fuit erit esse qui quae quod quia quam quoniam cum sed ut sicut nunc semper " +
    "nobis nos noster nostra nostri nostrum nostro nostram nostros nostris vobis vos vester vestra " +
    "tuae tuam tuum tuus tua tuo tui tuis tuos te tibi tu mea meum meus mei meo meam mihi " +
    "sua suum suus sui suo suam eius eum ei eis ea eo hic haec hoc ille illa illud illos " +
    "deus dei deo deum domine dominus domini dominum dominica iesu iesus jesu christe christi " +
    "christo christum christus sancta sancte sancti sanctus sancto sanctam sanctorum sanctis sanctae " +
    "gloria gloriam gloriae patri patris pater patrem filio filii filius filium spiritui spiritus spiritu " +
    "ora orate oremus ave gratia gratiae gratiam gratias plena benedicta benedictus benedicite benedicamus " +
    "fructus ventris mater matris virgo virginis virgine virginem virginum beata beatae beatus beati beatam " +
    "caeli caelis caelum caelorum coeli coelis coelorum coelum terra terrae terram principio saecula " +
    "saeculorum secula seculorum saeculi saeclum per omnia omnes omnium omnipotens omnipotentem omnipotenti " +
    "ab ex de sub inter propter ad non ut " +
    "fiat voluntas adveniat regnum panem quotidianum cotidianum da hodie dimitte debita debitoribus " +
    "inducas tentationem temptationem libera malo sanctificetur nomen credo unum factorem visibilium " +
    "invisibilium natum natus passus sepultus resurrexit ascendit sedet dexteram venturus iudicare vivos " +
    "mortuos ecclesiam ecclesia ecclesiae ecclesiarum catholicam apostolicam communionem remissionem " +
    "peccatorum peccata peccatoribus carnis resurrectionem vitam vitae aeternam aeterna aeternus aeterni " +
    "lux lucis luceat requiem requiescant pax pacem miserere misericordia misericordiae eleison " +
    "kyrie agnus tollis mundi mundum dona salve regina reginae vita dulcedo spes exsules hevae clamamus " +
    "suspiramus gementes flentes lacrimarum valle eia ergo advocata oculos converte exsilium ostende " +
    "clemens pia dulcis magnificat anima animam exsultavit salutari respexit humilitatem ancillae " +
    "generationes fecit magna potens progenie timentibus potentiam brachio dispersit superbos cordis " +
    "deposuit potentes sede exaltavit humiles esurientes implevit bonis divites dimisit inanes suscepit " +
    "puerum recordatus locutus patres semini laudamus confitemur laudate adoramus glorificamus benedicimus " +
    "agimus magnam rex caelestis unigenite suscipe deprecationem solus altissimus tantum sacramentum " +
    "veneremur cernui antiquum documentum novo cedat ritui praestet fides supplementum sensuum defectui " +
    "genitori genitoque laus iubilatio jubilatio salus virtus quoque procedenti utroque compar " +
    "laudatio veni mentes tuorum visita imple superna creasti pectora panis angelicus verum " +
    "laetare meruisti portare dixit stabat dolorosa iuxta juxta crucem lacrimosa dum pendebat " +
    "irae solvet favilla teste sibylla ubi caritas amor congregavit exsultemus iucundemur timeamus " +
    "amemus vivum diligamus sincero tuum praesidium confugimus genetrix despicias necessitatibus " +
    "periculis cunctis gloriosa sanctifica salva inebria lateris passio conforta exaudi intra " +
    "vulnera absconde permittas separari maligno hoste defende hora mortis voca iube venire laudem " +
    "angelis memorare piissima auditum quemquam fugientem auxilia implorantem suffragia petentem " +
    "derelictum confidentia animatus curro venio coram gemens peccator assisto verbi incarnati verba " +
    "despicere propitia exaudire angele custos commisit pietate illumina custodi rege guberna confiteor " +
    "fratres peccavi nimis cogitatione verbo opere omissione culpa precor misereatur dimissis " +
    "perducat indulgentiam absolutionem tribuat angelus nuntiavit concepit ecce ancilla secundum verbum " +
    "caro factum habitavit digni efficiamur promissionibus quaesumus mentibus infunde incarnationem " +
    "cognovimus passionem perducamur eundem romanae pontifex summus urbi orbi motu proprio gentium " +
    "gaudium rerum novarum humanae veritatis evangelium evangelii spe salvi laudato " +
    "amoris laetitia magistra terris sacrosanctum concilium redemptor redemptoris hominis eucharistia " +
    "familiaris consortio mulieris dignitatem centesimus annus quadragesimo anno pascendi dominici " +
    "gregis humani generis mystici corporis divino afflante munificentissimus ineffabilis " +
    "providentissimus aeternus unitatis redintegratio aetate dignitatis gentes presbyterorum " +
    "ordinis optatam totius perfectae caritatis apostolicam actuositatem gravissimum educationis mirifica " +
    "orientalium nuntiandi millennio ineunte tertio adveniente sint ordinatio sacerdotalis vivificantem " +
    "missio sollicitudo rei socialis laborem exercens rosarium mariae veritate fidei dilexit gaudete " +
    "exsultate vivit dignitas infinita fiducia supplicans traditionis custodes summorum pontificum quo " +
    "primum maiorem majorem totus tuus labora lex orandi credendi cathedra operato fidelium " +
    "imprimatur nihil obstat missa solemnis ordo usus antiquior deo sursum corda habemus " +
    "vobiscum tecum ite oremus asperges vidi aquam adoro latens deitas salutaris hostia pange " +
    "gloriosi mysterium sanguinis pretiosi sacris solemniis supernum prodiens puer adeste fideles " +
    "rorate desuper vexilla regis prodeunt attende parce fidelis lignum popule meus exsultet " +
    "exultet iam turba victimae paschali laudes lauda sion salvatorem inviolata alma caelorum " +
    "domina angelorum maris porta archangele proelio nequitiam insidias satanam " +
    "diabolum princeps militiae virtute infernum detrude malignos perditionem pervagantur adiutorium " +
    "auxilium christianorum refugium consolatrix afflictorum infirmorum turris eburnea davidica domus " +
    "aurea foederis arca ianua causa nostrae laetitiae vas spirituale honorabile insigne devotionis " +
    "mystica iustitiae sedes sapientiae populi romani mortalium animos quas primas lamentabili " +
    "sane testem benevolentiae apostolicae curae unam sanctam exsurge donum personae consecrata dabo " +
    "catechesi tradendae reconciliatio paenitentia sacrae disciplinae leges depositum ministerium estis " +
    "praedicate desiderio desideravi veterum sapientia humanum arcanum divinae immortale christianae " +
    "diuturnum illud auspicato concessum divinum munus mirae annum sacrum graves communi arcano consilio " +
    "miserentissimus divini illius magistri caritate compulsi catholici sacerdotii summi pontificatus " +
    "praecones sacra virginitas apostolorum principis pastorum sapientia ecclesiam suam mense maio " +
    "matri sacerdotalis caelibatus marialis cultus paterna benevolentia slavorum apostoli incarnationis " +
    "misericordiae vultus corde admirabile signum aperuit illis haurietis aquas fulgens " +
    "cura mirari connubii casti " +
    // Liturgical Greek in Latin letters.
    "theotokos trisagion hagios ischyros athanatos eleeson eleison hemas axion estin phos hilaron agni " +
    "parthene doxa kai pneumati nyn aei aionas aionon"
  ).split(/\s+/),
);

/** Strongly English words; any of them pulls a passage towards English. */
const ENGLISH_WORDS = new Set(
  (
    "the and of to is are was were be been being that this these those for with as on at by from " +
    "his her its their our your my he she it they we you him them us who whom whose which what when " +
    "where why how all any each every some no not but or if so than then there here have has had do " +
    "does did will would shall should can could may might must into upon through about after before " +
    "over under between against during without within also only very more most such one two first new " +
    "many much other out up down now lord god holy pray prayer thee thou thy thine art hath doth unto ye " +
    "blessed mother father son spirit heaven earth glory grace full womb fruit sinners hour death mercy " +
    "have forgive us our day daily bread kingdom come done name hallowed trespasses temptation evil " +
    "church saint was born died feast day year years life lived became made called known"
  ).split(/\s+/),
);

/** Single words that are titles in their own right (capitalized in prose). */
const SINGLE_WORD_TITLES = new Set([
  "magnificat",
  "benedictus",
  "sanctus",
  "credo",
  "confiteor",
  "kyrie",
  "exsultet",
  "exultet",
  "miserere",
  "trisagion",
  "theotokos",
  "imprimatur",
  "benedicite",
  "inviolata",
  "venite",
  "jubilate",
  "lorica",
  "itinerarium",
]);

function isLatinWord(word: string): boolean {
  if (LATIN_WORDS.has(word)) return true;
  // Unmistakable Latin inflections (genitive/dative plurals).
  return word.length > 5 && /(orum|arum|ibus)$/.test(word) && !ENGLISH_WORDS.has(word);
}

/**
 * Is this passage Latin (or Greek written in Latin letters)? Built for whole
 * lines and sentences — a litany response, a Latin prayer embedded in a guide
 * step, an incipit — not for English prose that merely mentions a Latin title.
 */
export function looksLatin(text: string): boolean {
  const toks = tokens(text);
  if (toks.length === 0) return false;
  if (toks.length === 1) return SINGLE_WORD_TITLES.has(toks[0]!.word);
  // A Latin title inside an English sentence ("Leo XIII wrote Rerum
  // Novarum.") says nothing about the sentence's language: score the words
  // around it. A text that is nothing but such titles is Latin.
  const covered = titleCoverage(toks);
  if (covered.every(Boolean)) return true;
  const words = toks.filter((_, i) => !covered[i]).map((t) => t.word);
  let latin = 0;
  let english = 0;
  for (const w of words) {
    if (isLatinWord(w)) latin++;
    else if (ENGLISH_WORDS.has(w)) english++;
  }
  return latin >= 2 && latin >= english * 3 && latin / words.length >= 0.4;
}

/* ------------------------------------------------------------------ */
/*  Titles the whole Church keeps in Latin or Greek                   */
/* ------------------------------------------------------------------ */

/**
 * Titles used untranslated in every language the site serves. Deliberately
 * excludes titles languages do translate ("Angelus" is "Anioł Pański" in
 * Polish, "Memorare" is "Acordaos" in Spanish, "Corpus Christi" is
 * "Fronleichnam" in German): those are translated like any other words.
 */
export const UNIVERSAL_LATIN_GREEK_TITLES: readonly string[] = [
  // Prayers, hymns, antiphons, canticles and chants.
  "Pater Noster",
  "Ave Maria",
  "Gloria Patri",
  "Salve Regina",
  "Regina Caeli",
  "Regina Coeli",
  "Regina Caeli Laetare",
  "Alma Redemptoris Mater",
  "Ave Regina Caelorum",
  "Ave Regina Coelorum",
  "Sub Tuum Praesidium",
  "Te Deum",
  "Te Deum Laudamus",
  "Magnificat",
  "Benedictus",
  "Nunc Dimittis",
  "Agnus Dei",
  "Ecce Agnus Dei",
  "Kyrie eleison",
  "Christe eleison",
  "Kyrie",
  "Gloria in Excelsis Deo",
  "Gloria in Excelsis",
  "Sanctus",
  "Credo",
  "Confiteor",
  "Anima Christi",
  "Tantum Ergo",
  "Pange Lingua",
  "Adoro Te Devote",
  "Ave Verum Corpus",
  "O Salutaris Hostia",
  "Panis Angelicus",
  "Veni Creator Spiritus",
  "Veni Creator",
  "Veni Sancte Spiritus",
  "Victimae Paschali Laudes",
  "Lauda Sion",
  "Dies Irae",
  "Stabat Mater",
  "Stabat Mater Dolorosa",
  "Ubi Caritas",
  "Ubi Caritas et Amor",
  "Exsultet",
  "Exultet",
  "Te Lucis Ante Terminum",
  "Miserere",
  "Miserere Mei",
  "De Profundis",
  "Requiem Aeternam",
  "Ave Maris Stella",
  "Salve Mater Misericordiae",
  "Rorate Caeli",
  "Rorate Coeli",
  "Vexilla Regis",
  "Ecce Homo",
  "Asperges Me",
  "Vidi Aquam",
  "Sacris Solemniis",
  "Verbum Supernum",
  "Iesu Dulcis Memoria",
  "Jesu Dulcis Memoria",
  "Puer Natus Est",
  "Adeste Fideles",
  "Inviolata",
  "Angele Dei",
  "Sancte Michael Archangele",
  "Benedicite",
  "Jubilate Deo",
  "Laudate Dominum",
  "Non Nobis Domine",
  "Christus Vincit",
  "Tu es Petrus",
  "Ecce Sacerdos Magnus",
  "O Sacrum Convivium",
  "Attende Domine",
  "Parce Domine",
  "Crux Fidelis",
  "Popule Meus",
  "Lumen Christi",
  "Haec Dies",
  "In Paradisum",
  "Libera Me",
  "Pie Jesu",
  "Lux Aeterna",
  "Deo Gratias",
  "Laus Deo",
  "Dominus Vobiscum",
  "Pax Vobiscum",
  "Sursum Corda",
  "Ite, Missa Est",
  "Trisagion",
  "Theotokos",
  "Axion Estin",
  "Phos Hilaron",
  "Agni Parthene",
  "Hagios o Theos",
  // Marian titles kept in Latin everywhere.
  "Salus Populi Romani",
  "Mater Dolorosa",
  "Stella Maris",
  "Mater Ecclesiae",
  "Sedes Sapientiae",
  "Regina Pacis",
  // Mottos, formulas and terms of art.
  "Memento Mori",
  "Totus Tuus",
  "Ad Maiorem Dei Gloriam",
  "Ad Majorem Dei Gloriam",
  "Ora et Labora",
  "Lex Orandi, Lex Credendi",
  "Lex Orandi",
  "Lex Credendi",
  "Ex Cathedra",
  "Ex Opere Operato",
  "In Persona Christi",
  "Sensus Fidei",
  "Sensus Fidelium",
  "Nihil Obstat",
  "Imprimatur",
  "Urbi et Orbi",
  "Motu Proprio",
  "Opus Dei",
  "Missa Solemnis",
  "Novus Ordo",
  "Novus Ordo Missae",
  "Usus Antiquior",
  // Church documents (their incipits are their names in every language).
  "Lumen Gentium",
  "Dei Verbum",
  "Gaudium et Spes",
  "Sacrosanctum Concilium",
  "Nostra Aetate",
  "Dignitatis Humanae",
  "Unitatis Redintegratio",
  "Ad Gentes",
  "Apostolicam Actuositatem",
  "Christus Dominus",
  "Gravissimum Educationis",
  "Inter Mirifica",
  "Optatam Totius",
  "Orientalium Ecclesiarum",
  "Perfectae Caritatis",
  "Presbyterorum Ordinis",
  "Rerum Novarum",
  "Quadragesimo Anno",
  "Mater et Magistra",
  "Pacem in Terris",
  "Populorum Progressio",
  "Humanae Vitae",
  "Evangelii Nuntiandi",
  "Redemptor Hominis",
  "Dives in Misericordia",
  "Laborem Exercens",
  "Familiaris Consortio",
  "Salvifici Doloris",
  "Dominum et Vivificantem",
  "Redemptoris Mater",
  "Sollicitudo Rei Socialis",
  "Mulieris Dignitatem",
  "Christifideles Laici",
  "Redemptoris Missio",
  "Centesimus Annus",
  "Veritatis Splendor",
  "Evangelium Vitae",
  "Ut Unum Sint",
  "Ordinatio Sacerdotalis",
  "Tertio Millennio Adveniente",
  "Fides et Ratio",
  "Novo Millennio Ineunte",
  "Rosarium Virginis Mariae",
  "Ecclesia de Eucharistia",
  "Deus Caritas Est",
  "Spe Salvi",
  "Sacramentum Caritatis",
  "Caritas in Veritate",
  "Verbum Domini",
  "Lumen Fidei",
  "Evangelii Gaudium",
  "Laudato Si'",
  "Amoris Laetitia",
  "Gaudete et Exsultate",
  "Christus Vivit",
  "Querida Amazonia",
  "Fratelli Tutti",
  "Laudate Deum",
  "Dilexit Nos",
  "Dignitas Infinita",
  "Fiducia Supplicans",
  "Pascendi Dominici Gregis",
  "Humani Generis",
  "Mystici Corporis Christi",
  "Mystici Corporis",
  "Divino Afflante Spiritu",
  "Mediator Dei",
  "Munificentissimus Deus",
  "Ineffabilis Deus",
  "Aeterni Patris",
  "Providentissimus Deus",
  "Pastor Aeternus",
  "Dei Filius",
  "Quanta Cura",
  "Mirari Vos",
  "Casti Connubii",
  "Mit brennender Sorge",
  "Divini Redemptoris",
  "Haurietis Aquas",
  "Ad Caeli Reginam",
  "Fulgens Corona",
  "Mortalium Animos",
  "Quas Primas",
  "Lamentabili Sane",
  "Testem Benevolentiae",
  "Apostolicae Curae",
  "Quo Primum",
  "Unam Sanctam",
  "Exsurge Domine",
  "Dominus Iesus",
  "Donum Vitae",
  "Dignitas Personae",
  "Vita Consecrata",
  "Pastores Dabo Vobis",
  "Catechesi Tradendae",
  "Reconciliatio et Paenitentia",
  "Sacrae Disciplinae Leges",
  "Fidei Depositum",
  "Antiquum Ministerium",
  "Vos Estis Lux Mundi",
  "Praedicate Evangelium",
  "Desiderio Desideravi",
  "Traditionis Custodes",
  "Summorum Pontificum",
  "Ecclesia Dei",
  "Veterum Sapientia",
  "Humanum Genus",
  "Immortale Dei",
  "Sapientiae Christianae",
  "Divinum Illud Munus",
  "Annum Sacrum",
  "Ubi Arcano Dei Consilio",
  "Miserentissimus Redemptor",
  "Divini Illius Magistri",
  "Summi Pontificatus",
  "Sacra Virginitas",
  "Princeps Pastorum",
  "Ecclesiam Suam",
  "Mysterium Fidei",
  "Sacerdotalis Caelibatus",
  "Marialis Cultus",
  "Gaudete in Domino",
  "Dies Domini",
  "Incarnationis Mysterium",
  "Misericordiae Vultus",
  "Patris Corde",
  "Admirabile Signum",
  "Aperuit Illis",
  "Spiritus Domini",
];

type TitleNode = { next: Map<string, TitleNode>; end: boolean };

function buildTitleTrie(titles: Iterable<string>): TitleNode {
  const root: TitleNode = { next: new Map(), end: false };
  for (const title of titles) {
    const words = tokens(title).map((t) => t.word);
    if (words.length === 0) continue;
    let node = root;
    for (const w of words) {
      let child = node.next.get(w);
      if (!child) {
        child = { next: new Map(), end: false };
        node.next.set(w, child);
      }
      node = child;
    }
    node.end = true;
  }
  return root;
}

const TITLE_TRIE = buildTitleTrie(UNIVERSAL_LATIN_GREEK_TITLES);

/** Which tokens fall inside a universal title of two or more words (longest match). */
function titleCoverage(toks: readonly Token[]): boolean[] {
  const covered = toks.map(() => false);
  for (let i = 0; i < toks.length; i++) {
    let node: TitleNode | undefined = TITLE_TRIE;
    let endAt = -1;
    for (let j = i; j < toks.length && node; j++) {
      node = node.next.get(toks[j]!.word);
      if (node?.end) endAt = j;
    }
    if (endAt <= i) continue;
    for (let k = i; k <= endAt; k++) covered[k] = true;
    i = endAt;
  }
  return covered;
}
const TITLE_SET = new Set(
  UNIVERSAL_LATIN_GREEK_TITLES.map((t) =>
    tokens(t)
      .map((x) => x.word)
      .join(" "),
  ),
);

/** True when the whole text is one of the universal Latin/Greek titles. */
export function isUniversalLatinGreekTitle(text: string): boolean {
  return TITLE_SET.has(
    tokens(text)
      .map((t) => t.word)
      .join(" "),
  );
}

const ENGLISH_TITLE_WORDS = new Set([
  "of",
  "the",
  "on",
  "and",
  "for",
  "to",
  "a",
  "an",
  "in",
  "with",
  "about",
  "from",
  "by",
  "at",
  "letter",
  "decree",
  "declaration",
  "constitution",
  "encyclical",
  "exhortation",
  "apostolic",
  "catechism",
  "code",
  "canon",
  "law",
  "instruction",
  "message",
  "note",
  "directory",
  "compendium",
  "dogmatic",
  "pastoral",
  "council",
]);

/**
 * A Church document's name that is its incipit — the opening words of the
 * Latin (or Italian, Spanish, German) text, used untranslated everywhere:
 * Lumen Gentium, Laudato Si', Fratelli Tutti, Querida Amazonia. A title with
 * any English word ("Catechism of the Catholic Church", "Decree on
 * Ecumenism") is a description and is translated.
 */
export function isDocumentIncipit(title: string): boolean {
  const t = title.trim();
  if (!t || detectScript(t) !== "latin") return false;
  if (isUniversalLatinGreekTitle(t)) return true;
  const words = tokens(t);
  if (words.length < 2 || words.length > 6) return false;
  if (words.some((w) => ENGLISH_TITLE_WORDS.has(w.word) || ENGLISH_WORDS.has(w.word))) return false;
  // Latin, or Italian/Spanish-shaped ("Fratelli Tutti", "Querida Amazonia"):
  // a word of the Latin lexicon, or every word ending in a vowel. "Spiritual
  // Exercises" is neither, and is translated.
  return words.some((w) => isLatinWord(w.word)) || words.every((w) => /[aeiou]$/.test(w.word));
}

/** "Dei Verbum: Dogmatic Constitution …" → "Dei Verbum"; null when there is no lead. */
export function leadingIncipit(title: string): string | null {
  const m = /^(.+?)\s*(?:[:—–]|\s-\s|\()\s*\S/.exec(title.trim());
  if (!m) return null;
  const lead = m[1]!.trim();
  return isDocumentIncipit(lead) || looksLatin(lead) || isUniversalLatinGreekTitle(lead)
    ? lead
    : null;
}

/* ------------------------------------------------------------------ */
/*  Item titles                                                       */
/* ------------------------------------------------------------------ */

/** Content types whose title is a person's name (rule c). */
const PERSON_TYPES = new Set(["SAINT", "DOCTOR", "POPE"]);

export function isPersonContentType(contentType: string): boolean {
  return PERSON_TYPES.has(contentType);
}

export type TitleDecision =
  /** Shown exactly as published. */
  | { mode: "keep"; reason: "latin-greek" | "person-name" | "incipit" | "parish" | "empty" }
  /** Machine-translated; each `protect` span must survive verbatim. */
  | { mode: "translate"; protect: string[] };

/**
 * How an item's title is treated. Parish titles are decided separately, by
 * `decideParishName` (they may be transliterated, never plainly translated).
 */
export function decideTitle(contentType: string, title: string): TitleDecision {
  const t = String(title ?? "").trim();
  if (!t) return { mode: "keep", reason: "empty" };
  if (contentType === "PARISH") return { mode: "keep", reason: "parish" };
  if (isPersonContentType(contentType)) return { mode: "keep", reason: "person-name" };
  if (detectScript(t) !== "latin") return { mode: "keep", reason: "latin-greek" };
  if (isUniversalLatinGreekTitle(t)) return { mode: "keep", reason: "latin-greek" };
  if (contentType === "CHURCH_DOCUMENT" && isDocumentIncipit(t))
    return { mode: "keep", reason: "incipit" };

  // A title in parts — "Salve Regina (Hail, Holy Queen)", "Eternal Rest
  // (Requiem Aeternam)", "Ora et Labora — The Benedictine Balance", "Psalm
  // 109 (110): Dixit Dominus: The Lord said to my Lord" — keeps its Latin
  // parts verbatim and translates the rest. Only an all-Latin title is kept.
  const parts = titleParts(t);
  if (looksLatin(t) && parts.every((part) => isLatinTitleText(part)))
    return { mode: "keep", reason: "latin-greek" };
  const protect = new Set(findProtectedSpans(t).map((s) => s.text));
  for (const part of parts) if (isLatinTitleText(part)) protect.add(part);
  return { mode: "translate", protect: [...protect] };
}

/** "A (B): C — D" → ["A", "B", "C", "D"], each exactly as it appears in the title. */
export function titleParts(title: string): string[] {
  return title
    .split(/\s*[()]\s*|\s+[—–-]\s+|[—–]|:\s+/u)
    .map((p) =>
      p
        .trim()
        .replace(/^[,;.]+|[,;.]+$/g, "")
        .trim(),
    )
    .filter((p) => p && title.includes(p));
}

/** Endings of Latin words the lexicon may not know ("ineffabilis", "siderum", "dulcissime"). */
const LATIN_ENDING = /(?:is|(?<!o)us|um|ae|orum|arum|ibus|issim[aeiou]|issimus)$/;
/** Endings no Latin word has: "glorious", "mistress", "heaven's", "kindness", "blessed". */
const ENGLISH_ENDING = /(?:ous|ness|ing|ed|ly|ful|ess|ship|ward|wards|'s)$/;

/**
 * Is this short text — a bracketed gloss, one part of a title — the original
 * Latin wording of a title? Known titles and Latin phrases count, and so does
 * an incipit the lexicon does not know ("Creator ineffabilis", "Conditor alme
 * siderum"): Latin letters, no English word, no digits, and a Latin ending.
 */
export function isLatinTitleText(text: string): boolean {
  const t = text.trim();
  if (!t || detectScript(t) !== "latin") return false;
  if (isUniversalLatinGreekTitle(t) || looksLatin(t)) return true;
  if (/\d/.test(t)) return false;
  const words = tokens(t).map((w) => w.word);
  if (!words.length) return false;
  if (
    words.some((w) => ENGLISH_WORDS.has(w) || ENGLISH_TITLE_WORDS.has(w) || ENGLISH_ENDING.test(w))
  )
    return false;
  return words.some((w) => w.length > 3 && (isLatinWord(w) || LATIN_ENDING.test(w)));
}

/* ------------------------------------------------------------------ */
/*  Protected spans inside English prose                              */
/* ------------------------------------------------------------------ */

export interface ProtectedSpan {
  start: number;
  end: number;
  text: string;
  reason: "title" | "greek-script" | "latin-phrase" | "person-name" | "extra";
}

/*
 * Rule (c) inside prose: "Saint John Vianney", "St. Thérèse of Lisieux",
 * "Saints Peter and Paul", "Blessed Carlo Acutis", "Venerable Fulton Sheen".
 * The name runs over capitalized words and the joiners of names ("of the
 * Cross", "the Archangel", "and Paul"); a possessive "'s" is not part of it.
 * A pope's regnal name ("Pope Leo XIII") is not a saint's name and is left to
 * the model, which renders it the way each language does ("el papa León
 * XIII"); "Pope Saint John Paul II" still protects "Saint John Paul II".
 */
const PERSON_NAME_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:Saints?|Sts?\.|St|Blessed|Bl\.|Venerable|Ven\.)` +
    String.raw`\s+\p{Lu}[\p{L}\p{M}'’.-]*` +
    String.raw`(?:\s+(?:(?:of|de|da|di|del|della|von|van|and|y|e|the)\s+(?:the\s+)?)?\p{Lu}[\p{L}\p{M}'’.-]*)*`,
  "gu",
);
/** "All Saints Day", "the Blessed Virgin", "Blessed Sacrament", "Blessed Palms": not a person's name. */
const NOT_A_NAME =
  /^(?:Day|Days|Church|Churches|Parish|Cathedral|Basilica|Chapel|Feast|Litany|School|College|University|Hospital|Virgin|Mother|Sacrament|Trinity|Lord|Lady|Spirit|Ghost|Prayers?|Candles?|Palms?|Water|Salt|Oil|Ashes|Bread|Medals?|Objects|Articles|Souls|Dead|Martyrs|Ones|Saints)$/;
/** A capitalized word that ends a name: "Saint Andrew [Christmas Novena]", "St. Gerard Majella [Annual Novena]". */
const NAME_STOP = new Set(
  (
    "Novena Novenas Christmas Easter Advent Lent Annual Prayer Prayers Chaplet Litany Medal Day Feast " +
    "Church Parish Cathedral Basilica Chapel Shrine School College University Hospital Society Order " +
    "Bread Rosary Crown Cord Scapular Oratory Abbey Monastery Mission Devotion Consecration Bookmark " +
    "Protection Intercession Catholic Faith Our Responsory Hymn Canticle Blessing Tuesday"
  ).split(/\s+/),
);
const NAME_JOINERS = new Set([
  "of",
  "de",
  "da",
  "di",
  "del",
  "della",
  "von",
  "van",
  "and",
  "y",
  "e",
  "the",
]);

/** Saints' and the blessed's names in a text (rule c), possessive "'s" excluded. */
export function findPersonNames(text: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  for (const m of String(text ?? "").matchAll(PERSON_NAME_RE)) {
    // "St. Mary's Church" → "St. Mary"; "… by Saint Francis." → "Saint Francis".
    const raw = m[0].replace(/['’]s(?![\p{L}]).*$/u, "");
    const words = raw.split(/\s+/);
    if (words.length < 2 || NOT_A_NAME.test(words[1]!)) continue;
    let keep = 2;
    while (keep < words.length && !NAME_STOP.has(words[keep]!.replace(/[.'’-]+$/u, ""))) keep++;
    while (keep > 2 && NAME_JOINERS.has(words[keep - 1]!)) keep--;
    const span = words
      .slice(0, keep)
      .join(" ")
      .replace(/[.'’-]+$/u, "");
    if (!text.startsWith(span, m.index)) continue;
    out.push({ start: m.index, end: m.index + span.length, text: span });
  }
  return out;
}

const GREEK_RUN =
  /[\p{Script=Greek}][\p{Script=Greek}\p{M}\s'’·.,;:!-]*[\p{Script=Greek}\p{M}]|[\p{Script=Greek}]/gu;

function addSpan(spans: ProtectedSpan[], span: ProtectedSpan): void {
  if (span.end <= span.start) return;
  for (const s of spans) {
    // Overlap: keep the wider span.
    if (span.start < s.end && s.start < span.end) {
      if (span.end - span.start > s.end - s.start) {
        s.start = span.start;
        s.end = span.end;
        s.text = span.text;
        s.reason = span.reason;
      }
      return;
    }
  }
  spans.push(span);
}

/**
 * The parts of an English sentence that must come back from the model
 * verbatim: universal Latin/Greek titles (and any `extra` terms, such as the
 * item's own incipit or a saint's own name), saints' names (rule c), runs of
 * Greek script, and Latin phrases of two or more unmistakably Latin words
 * ("Ad maiorem Dei gloriam", "ora pro nobis").
 */
export function findProtectedSpans(text: string, extra: readonly string[] = []): ProtectedSpan[] {
  const src = String(text ?? "");
  const spans: ProtectedSpan[] = [];
  const toks = tokens(src);

  // Known titles (longest match from each token), plus caller-supplied terms.
  const tries: Array<[TitleNode, ProtectedSpan["reason"]]> = [[TITLE_TRIE, "title"]];
  const extras = extra.map((e) => e.trim()).filter(Boolean);
  if (extras.length) tries.push([buildTitleTrie(extras), "extra"]);
  for (const [trie, reason] of tries) {
    for (let i = 0; i < toks.length; i++) {
      let node: TitleNode | undefined = trie;
      let endAt = -1;
      for (let j = i; j < toks.length && node; j++) {
        node = node.next.get(toks[j]!.word);
        if (node?.end) endAt = j;
      }
      if (endAt < 0) continue;
      // A one-word title counts in prose only when it is capitalized
      // ("the Magnificat", not "his credo").
      if (endAt === i && reason === "title" && !toks[i]!.upper) continue;
      const start = toks[i]!.start;
      const end = toks[endAt]!.end;
      addSpan(spans, { start, end, text: src.slice(start, end), reason });
      i = endAt;
    }
  }

  // Saints' and the blessed's names (rule c).
  for (const name of findPersonNames(src)) addSpan(spans, { ...name, reason: "person-name" });

  // Greek script, wherever it appears.
  for (const m of src.matchAll(GREEK_RUN)) {
    const raw = m[0].replace(/[\s'’·.,;:!-]+$/u, "");
    if (!raw) continue;
    addSpan(spans, {
      start: m.index,
      end: m.index + raw.length,
      text: raw,
      reason: "greek-script",
    });
  }

  // Latin phrases: runs of Latin words (ambiguous joiners allowed inside).
  const JOINERS = new Set([
    "in",
    "a",
    "me",
    "sum",
    "maria",
    "amen",
    "alleluia",
    "jesus",
    "pro",
    "o",
  ]);
  let runStart = -1;
  let strong = 0;
  let last = -1;
  const flush = () => {
    if (runStart >= 0 && strong >= 2) {
      const start = toks[runStart]!.start;
      const end = toks[last]!.end;
      addSpan(spans, { start, end, text: src.slice(start, end), reason: "latin-phrase" });
    }
    runStart = -1;
    strong = 0;
    last = -1;
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    // A run never crosses sentence punctuation or a long gap.
    if (runStart >= 0 && /[.!?;:()"“”«»]/.test(src.slice(toks[last]!.end, t.start))) flush();
    const latin = isLatinWord(t.word);
    if (latin || (runStart >= 0 && JOINERS.has(t.word))) {
      if (runStart < 0) runStart = i;
      if (latin) strong++;
      last = latin ? i : last;
    } else {
      flush();
    }
  }
  flush();

  return spans.sort((a, b) => a.start - b.start);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A regex that finds `term` regardless of case, accents and spacing. */
function looseTermRegExp(term: string): RegExp {
  const parts: string[] = [];
  for (const ch of fold(term)) {
    if (/\s/.test(ch)) {
      if (parts[parts.length - 1] !== "\\s+") parts.push("\\s+");
    } else if (ch === "'") parts.push("['’ʼ]?");
    else parts.push(`${escapeRegExp(ch)}\\p{M}*`);
  }
  return new RegExp(parts.join(""), "iu");
}

/**
 * Check a model's output against the protected spans of its source. Each span
 * must appear verbatim; one that comes back only with different case or
 * accents ("salve regina", "Magníficat") is restored to the source's exact
 * form. Returns the (restored) output, or null when any span was translated,
 * dropped or mangled — the caller then retries or keeps the English.
 */
export function verifyProtectedSpans(
  output: string,
  spans: ReadonlyArray<Pick<ProtectedSpan, "text">>,
): string | null {
  let out = String(output ?? "");
  const seen = new Set<string>();
  for (const { text } of spans) {
    if (!text || seen.has(text)) continue;
    seen.add(text);
    if (out.includes(text)) continue;
    const nfd = out.normalize("NFD");
    const m = looseTermRegExp(text).exec(nfd);
    if (!m) return null;
    out = (
      nfd.slice(0, m.index) +
      text.normalize("NFD") +
      nfd.slice(m.index + m[0].length)
    ).normalize("NFC");
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Payload fields                                                    */
/* ------------------------------------------------------------------ */

/** Payload keys whose string values are prose a visitor reads. */
const PROSE_KEYS = new Set([
  "summary",
  "body",
  "prayerText",
  "background",
  "biography",
  "history",
  "description",
  "intro",
  "introduction",
  "instructions",
  "practiceInstructions",
  "practiceText",
  "origin",
  "theologicalSignificance",
  "theologicalOverview",
  "significance",
  "iconographyNotes",
  "institution",
  "minister",
  "preparation",
  "recipient",
  "effects",
  "matterAndForm",
  "matter",
  "form",
  "whenToPray",
  "tips",
  "whatYouNeed",
  "steps",
  "days",
  "keyThemes",
  "messageHighlights",
  "occasions",
  "patronages",
  "patronage",
  "doctorTitle",
  "ecclesialRole",
  "tradition",
  "frequency",
  "subject",
  "structure",
  "intentionTheme",
  "decisionAuthority",
  "indulgences",
  "conditions",
  "notes",
  "meditation",
  "reflection",
  "explanation",
  "meaning",
  "purpose",
  "promises",
  "benefits",
]);

/** Keys inside a structured entry (a guide step, a novena day) that are prose. */
const NESTED_PROSE_KEYS = new Set([
  "title",
  "heading",
  "body",
  "text",
  "content",
  "prayer",
  "reflection",
  "meditation",
  "intention",
  "description",
  "instructions",
  "summary",
  "note",
  "notes",
  "matter",
  "form",
  "conditions",
  "explanation",
]);

/** Never translated, at any depth: liturgical texts, quotations, identifiers. */
const NEVER_KEYS = new Set([
  "latin",
  "greek",
  "translations",
  "language",
  "locale",
  "lang",
  // An official text is authoritative wording; a machine rendering of it is
  // not the official text and must not be labelled as one.
  "officialPrayer",
  "officialText",
  "bodyExcerpt",
  "excerpt",
  "quote",
  "quotation",
  "scripture",
  "verse",
  "reading",
]);

const NEVER_KEY_PATTERNS: readonly RegExp[] = [
  /latin/i,
  /greek/i,
  /(?:Slug|Slugs|Url|Urls|Uri|Id|Ids|Key|Keys|Ref|Refs)$/,
  /(?:Name|Names)$/,
];

/** Should the string(s) under this payload key be translated? `nested` = inside an array/object entry. */
export function isTranslatableKey(key: string, nested = false): boolean {
  if (NEVER_KEYS.has(key)) return false;
  if (NEVER_KEY_PATTERNS.some((re) => re.test(key))) return false;
  return nested ? NESTED_PROSE_KEYS.has(key) || PROSE_KEYS.has(key) : PROSE_KEYS.has(key);
}

/**
 * Should a prayer's own text be translated? Only English prayer text is: a
 * payload that declares another language for its text (Latin, Greek, or a
 * vernacular) is shown as written.
 */
export function isTranslatablePrayerText(payload: Record<string, unknown>, text: string): boolean {
  if (!isEnglishLanguageCode(payload.language)) return false;
  return !looksLatin(text) && detectScript(text) === "latin";
}

/* ------------------------------------------------------------------ */
/*  Parish names                                                      */
/* ------------------------------------------------------------------ */

/**
 * Languages the engine can translate a parish name FROM (into English):
 * dedicated OPUS-MT models for Chinese, Japanese, Korean, Russian, Ukrainian,
 * Greek and Arabic, and the multilingual model ("mul") for every other script
 * — Belarusian, Serbian and Bulgarian Cyrillic, Hebrew, Thai, Georgian,
 * Armenian, Ethiopic, Malayalam, Burmese …
 */
export type NameSourceLang = "en" | "zh" | "ja" | "ko" | "ru" | "uk" | "el" | "ar" | "mul";

export type ParishNameDecision =
  /** Same script as the visitor reads (or nothing to translate): shown as published. */
  | { action: "keep"; reason: "same-script" | "no-letters" | "no-meaningful-translation" }
  /** Translated by the engine (from → English → visitor's language); `fallback` meanwhile. */
  | { action: "translate"; from: NameSourceLang; fallback: "romanize" | "original" };

const ENGLISH_CHURCH_WORDS =
  /\b(?:church|parish|cathedral|basilica|chapel|shrine|mission|oratory|abbey|priory|monastery|convent|friary|our lady|saint|st|sts|holy|sacred|heart|blessed|immaculate|assumption|catholic|christ the king|good shepherd|precious blood|queen|cross|trinity|nativity|annunciation|visitation|resurrection|transfiguration|epiphany|of the)\b/i;
const NON_ENGLISH_CHURCH_WORDS =
  // Tested against the folded (accent-free) name, so accents are not spelled
  // out — and "basilica", the same word in English, is not listed.
  /\b(?:iglesia|parroquia|igreja|paroquia|eglise|paroisse|chiesa|parrocchia|kirche|pfarrkirche|pfarrei|kosciol|parafia|bazylika|katedra|catedral|cattedrale|basilique|santuario|sanctuaire|nuestra senora|notre[- ]dame|nossa senhora|nostra signora|unsere liebe frau|matka boza|san|santa|santo|sao|sankt|sw|de la|del|della|des|du|di|do|da|der|die|das|ng|simbahan|nha tho|giao xu|thanh|kapel|kerk|kostel|templo|capilla|cappella|chapelle)\b/i;

/** "St. Mary's Catholic Church" yes; "Parroquia San José", "Notre-Dame de Paris" no. */
export function isEnglishChurchName(name: string): boolean {
  const n = fold(name).replace(/\./g, " ");
  return ENGLISH_CHURCH_WORDS.test(n) && !NON_ENGLISH_CHURCH_WORDS.test(n);
}

const RUSSIAN_SPEAKING = new Set(["RU", "KZ", "KG", "UZ", "TJ", "TM", "MN"]);
/** Letters Russian does not use (Ukrainian, Belarusian, Serbian, Macedonian). */
const NON_RUSSIAN_CYRILLIC = /[іїєґўђјљњћџѓќѕІЇЄҐЎЂЈЉЊЋЏЃЌЅ]/u;
/** Letters only Ukrainian uses (і is shared with Belarusian, so it is not one of them). */
const UKRAINIAN_ONLY = /[їєґЇЄҐ]/u;

/** Which model reads a Cyrillic name: Russian, Ukrainian, or the multilingual one. */
export function cyrillicNameLanguage(
  name: string,
  countryCode?: string | null,
): "ru" | "uk" | "mul" {
  const country = (countryCode ?? "").toUpperCase();
  if (UKRAINIAN_ONLY.test(name)) return "uk";
  if (country === "UA") return /[ўЎ]/u.test(name) ? "mul" : "uk";
  if (NON_RUSSIAN_CYRILLIC.test(name)) return "mul";
  // A Russian-spelled name in Belarus, Moldova or the Baltics is Russian too.
  if (!country || RUSSIAN_SPEAKING.has(country) || ["BY", "MD", "LV", "LT", "EE"].includes(country))
    return "ru";
  return "mul";
}

/** Scripts `romanize()` can transliterate completely. */
export const ROMANIZABLE_SCRIPTS: ReadonlySet<Script> = new Set([
  "cyrillic",
  "greek",
  "hangul",
  "japanese",
]);

/**
 * How a parish name is shown to a visitor reading `locale`.
 *
 * Same script → kept, always: a Spanish, Polish or Vietnamese name stays in
 * its own wording for every Latin-script reader. A different script →
 * translated (into the visitor's language, through English), with the
 * original always shown beside it. Until the translator has done it, a name
 * in a script `romanize()` handles is shown transliterated, otherwise as
 * written. A Latin-script name is translated for a Korean or Chinese reader
 * only when it is English ("St. Mary's Catholic Church"): the engine has no
 * general model for names in the other Latin-script languages, so those stay
 * as written (Latin letters are widely legible).
 */
export function decideParishName(
  name: string,
  locale: Locale,
  opts: { countryCode?: string | null } = {},
): ParishNameDecision {
  const script = detectScript(name);
  if (script === "none") return { action: "keep", reason: "no-letters" };
  const target = localeScript(locale);
  if (script === target) return { action: "keep", reason: "same-script" };

  if (script === "latin") {
    return isEnglishChurchName(name)
      ? { action: "translate", from: "en", fallback: "original" }
      : { action: "keep", reason: "no-meaningful-translation" };
  }

  const country = (opts.countryCode ?? "").toUpperCase();
  const fallback = ROMANIZABLE_SCRIPTS.has(script) ? "romanize" : "original";
  if (script === "hangul") return { action: "translate", from: "ko", fallback };
  if (script === "japanese") return { action: "translate", from: "ja", fallback };
  // A kanji-only name in Japan is Japanese, not Chinese.
  if (script === "han")
    return { action: "translate", from: country === "JP" ? "ja" : "zh", fallback };
  if (script === "cyrillic")
    return { action: "translate", from: cyrillicNameLanguage(name, country), fallback };
  // A modern Greek church name (not a liturgical title: those are never parish names).
  if (script === "greek") return { action: "translate", from: "el", fallback };
  if (script === "arabic") return { action: "translate", from: "ar", fallback };
  return { action: "translate", from: "mul", fallback };
}

/** "Myeongdong Cathedral (명동대성당)": the rendering always names the original too. */
export function withOriginal(rendered: string, original: string): string {
  const r = rendered.trim();
  const o = original.trim();
  if (!r || fold(r) === fold(o)) return o;
  return `${r} (${o})`;
}

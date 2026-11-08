/**
 * The word over a detail page's title, in the reader's language.
 *
 * A page names its item in English, from the stored record: "Title of the Blessed
 * Virgin Mary", "Liturgical symbolism", a guide's "Rosary", a saint's "Blessed". The
 * same words file and group the records, so they stay English there, and are put into
 * the reader's language only where a reader sees them. Every word the pages' label
 * functions can return is listed here, with the curated saints' own titles; a word
 * missing from the list stays English, as the record's other untranslated words do.
 *
 * A saint's stage of the cause ("Saint", "Blessed", "Servant of God"), and a role such
 * as "Religious", cannot be said in many languages without knowing whether the person
 * is a man or a woman ("Santo" or "Santa"), and the record does not say. There the
 * dictionary holds an empty string, and the page shows no word rather than the wrong
 * one. The same record names one saint, two saints or a hundred martyrs alike.
 */
import type { Translator } from "@/lib/i18n/translator";

import { translateTypeLabel } from "./content-type-labels";

const DETAIL_LABEL_KEYS: Readonly<Record<string, string>> = {
  // A saint's stage of the cause, over a name that does not already say it.
  Saint: "label.stage.saint",
  Blessed: "label.stage.blessed",
  Venerable: "label.stage.venerable",
  "Servant of God": "label.stage.servantOfGod",
  // A saint's one title (saintTitleLabel), and the curated saints' own.
  "Apostle and Disciple of Jesus": "label.saint.apostle",
  Prophet: "label.saint.prophet",
  Archangel: "label.saint.archangel",
  "Mother of God": "label.saint.motherOfGod",
  "The Good Thief": "label.saint.goodThief",
  "King and prophet": "label.saint.kingAndProphet",
  "Mother of John the Baptist": "label.saint.motherOfJohnTheBaptist",
  "Father of John the Baptist": "label.saint.fatherOfJohnTheBaptist",
  Patriarch: "label.saint.patriarch",
  "Prophet and lawgiver": "label.saint.prophetAndLawgiver",
  // A Doctor's title. Spanish, Portuguese and German have a word for a man and another
  // for a woman, and four Doctors are women, so it is empty there unless the label also
  // says the Doctor was ordained (DOCTOR_ORDAINED_KEY).
  "Doctor of the Church": "label.saint.doctor",
  // A Doctor's state of life, before "Doctor of the Church".
  Bishop: "label.role.bishop",
  Priest: "label.role.priest",
  Deacon: "label.role.deacon",
  Religious: "label.role.religious",
  "Lay faithful": "label.role.lay",
  // A Marian title.
  "Title of the Blessed Virgin Mary": "label.marian.title",
  "Marian dogma": "label.marian.dogma",
  // A sacrament's group, from its stored subtitle.
  "Sacrament of Christian Initiation": "label.sacrament.initiation",
  "Sacrament of Healing": "label.sacrament.healing",
  "Sacrament at the Service of Communion": "label.sacrament.service",
  "One of the seven sacraments of the Church": "label.sacrament.any",
  // A liturgical entry that is not a day of the calendar.
  "Season of the liturgical year": "label.liturgy.season",
  "The liturgical year": "label.liturgy.year",
  "Order of Mass": "label.liturgy.orderOfMass",
  "Part of the Mass": "label.liturgy.partOfMass",
  "Liturgical book": "label.liturgy.book",
  "Prayer of the Church": "label.liturgy.prayerOfTheChurch",
  "Liturgical rite": "label.liturgy.rite",
  Council: "label.liturgy.council",
  "Liturgical symbolism": "label.liturgy.symbolism",
  "Liturgical glossary": "label.liturgy.glossary",
  "A day of the liturgical calendar": "label.liturgy.day",
  // A guide's kind or category (guideEyebrow).
  Rosary: "label.guide.rosary",
  Chaplet: "label.guide.chaplet",
  Confession: "label.guide.confession",
  Adoration: "label.guide.adoration",
  Consecration: "label.guide.consecration",
  Discernment: "label.guide.discernment",
  Vocation: "label.guide.vocation",
  Lent: "label.guide.lent",
  Advent: "label.guide.advent",
  OCIA: "label.guide.ocia",
  Mass: "label.guide.mass",
  "Liturgy of the Hours": "label.guide.liturgyOfTheHours",
  Sacraments: "label.guide.sacraments",
  Funerals: "label.guide.funerals",
  Marriage: "label.guide.marriage",
  Family: "label.guide.family",
  Seasons: "label.guide.seasons",
  Pilgrimage: "label.guide.pilgrimage",
  Sacramentals: "label.guide.sacramentals",
  Scripture: "label.guide.scripture",
  "Mass & Liturgy": "label.guide.massAndLiturgy",
  // A spiritual practice's kind, from its stored subtitle.
  "Contemplative prayer": "label.practice.contemplativePrayer",
  "Lectio divina": "label.practice.lectioDivina",
  "Daily examen": "label.practice.examen",
  Fasting: "label.practice.fasting",
  Almsgiving: "label.practice.almsgiving",
  "Way of the Cross": "label.practice.wayOfTheCross",
  "Spiritual direction": "label.practice.spiritualDirection",
  "Vocational discernment": "label.practice.vocationalDiscernment",
  Mortification: "label.practice.mortification",
  "Vocal prayer": "label.practice.vocalPrayer",
  "Spiritual reading": "label.practice.spiritualReading",
  Penance: "label.practice.penance",
  "Eucharistic devotion": "label.practice.eucharisticDevotion",
  "Work as prayer": "label.practice.workAsPrayer",
  "Works of mercy": "label.practice.worksOfMercy",
  "Silence and solitude": "label.practice.silence",
  "Family prayer": "label.practice.familyPrayer",
};

/** Every English word above, for the tests that hold each dictionary to them. */
export const DETAIL_LABELS = Object.keys(DETAIL_LABEL_KEYS);

/** The dictionary key of each word above. */
export function detailLabelKey(label: string): string | undefined {
  return DETAIL_LABEL_KEYS[label];
}

/** A pope's dates as a saint's title (saintTitleLabel). */
const POPE_FROM_TO = /^Pope from (\S+) to (\S+)$/;

/** The states of life that only a man holds, which a Doctor's label may open with. */
const ORDAINED_ROLES = new Set(["Bishop", "Priest", "Deacon"]);

/** "Doctor of the Church" said of a man, in the languages whose word depends on it. */
export const DOCTOR_ORDAINED_KEY = "label.saint.doctorOrdained";

/** "Doctor of the Church" said of a woman: Doctora, Doutora, Kirchenlehrerin. */
export const DOCTOR_WOMAN_KEY = "label.saint.doctorWoman";

/**
 * The four women among the Doctors of the Church, under their Doctor and saint records:
 * Teresa of Ávila, Catherine of Siena, Thérèse of Lisieux and Hildegard of Bingen. Every
 * other Doctor is a man, so the label is said of each in the word for them. A woman
 * named a Doctor in future joins this list.
 */
export const WOMEN_DOCTORS: ReadonlySet<string> = new Set([
  "doctor-teresa-of-avila",
  "doctor-catherine-of-siena",
  "doctor-therese-of-lisieux",
  "doctor-hildegard-of-bingen",
  "saint-teresa-of-avila",
  "saint-catherine-of-siena",
  "saint-therese-of-lisieux",
  "saint-hildegard-of-bingen",
]);

/**
 * The labels of the facts under a detail page's title ("Feast day", "Declared
 * Doctor"), by the English word the facts are built with. Each word here has a key
 * in every dictionary; a word missing from the list stays English.
 */
const FACT_LABEL_KEYS: Readonly<Record<string, string>> = {
  Title: "facts.title",
  "Feast day": "saints.feastDay",
  Born: "saints.facts.born",
  Died: "saints.facts.died",
  Patron: "saints.facts.patron",
  "Declared Doctor": "facts.declaredDoctor",
  Pontificate: "facts.pontificate",
  "Birth name": "facts.birthName",
  Status: "facts.status",
  Place: "facts.place",
  Year: "facts.year",
  Visionaries: "facts.visionaries",
  "Under the title": "facts.underTheTitle",
  Apparition: "facts.apparition",
  Apparitions: "facts.apparitions",
  Defined: "facts.defined",
  Region: "facts.region",
  Begins: "facts.begins",
  Ends: "facts.ends",
  When: "facts.when",
  Tradition: "facts.tradition",
  Duration: "facts.duration",
  Type: "facts.type",
  Faithful: "facts.faithful",
  Date: "facts.date",
  "Issued by": "facts.issuedBy",
  Rank: "facts.rank",
  Season: "facts.season",
  "Related saint": "facts.relatedSaint",
  "Related saints": "facts.relatedSaints",
};

/** Every fact label above, for the tests that hold each dictionary to them. */
export const FACT_LABELS = Object.keys(FACT_LABEL_KEYS);

/** A fact's label in the reader's language: "Feast day", "Fiesta", "축일". */
export function factLabel(label: string, t: Translator): string {
  const key = FACT_LABEL_KEYS[label];
  return key ? t(key) : label;
}

/**
 * A page's facts with their labels in the reader's language. The facts are built in
 * English, from the stored record, and the labels are said here, where a reader sees
 * them; a page's `factsInSubtitle` goes through factLabel the same way, so the two
 * still match.
 */
export function translateFacts<T extends { label: string }>(
  items: ReadonlyArray<T | null | undefined>,
  t: Translator,
): Array<T | null | undefined> {
  return items.map((item) => (item ? { ...item, label: factLabel(item.label, t) } : item));
}

/**
 * A detail page's label in the reader's language, or null when that language has no
 * word for it that is true of everyone it may stand over. Parts joined by " · " ("Priest
 * · Doctor of the Church") are put over one by one, and a part with no word is left out.
 */
export function translateDetailLabel(
  label: string,
  t: Translator,
  { slug }: { slug?: string } = {},
): string | null {
  if (label.includes(" · ")) {
    const words = label.split(" · ");
    // Only a man is ordained, so beside "Bishop" a Doctor is a man in every language.
    const ordained = words.some((part) => ORDAINED_ROLES.has(part));
    const parts = words
      .map((part) =>
        ordained && part === "Doctor of the Church"
          ? t(DOCTOR_ORDAINED_KEY) || null
          : translateDetailLabel(part, t, { slug }),
      )
      .filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  // Known by the page it stands over, a Doctor is said in the word for a woman or a man.
  // A label read without its page stays with the word true of either, or none.
  if (label === "Doctor of the Church" && slug) {
    return t(WOMEN_DOCTORS.has(slug) ? DOCTOR_WOMAN_KEY : DOCTOR_ORDAINED_KEY) || null;
  }
  const pope = POPE_FROM_TO.exec(label);
  if (pope) return t("label.saint.popeFromTo", { start: pope[1]!, end: pope[2]! });
  const key = DETAIL_LABEL_KEYS[label];
  if (key) return t(key) || null;
  return translateTypeLabel(label, t);
}

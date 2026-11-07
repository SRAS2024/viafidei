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

/**
 * A detail page's label in the reader's language, or null when that language has no
 * word for it that is true of everyone it may stand over. Parts joined by " · " ("Priest
 * · Doctor of the Church") are put over one by one, and a part with no word is left out.
 */
export function translateDetailLabel(label: string, t: Translator): string | null {
  if (label.includes(" · ")) {
    const parts = label
      .split(" · ")
      .map((part) => translateDetailLabel(part, t))
      .filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  const pope = POPE_FROM_TO.exec(label);
  if (pope) return t("label.saint.popeFromTo", { start: pope[1]!, end: pope[2]! });
  const key = DETAIL_LABEL_KEYS[label];
  if (key) return t(key) || null;
  return translateTypeLabel(label, t);
}

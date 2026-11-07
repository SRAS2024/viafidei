/**
 * What each kind of content is called in the reader's language.
 *
 * The data layer's `contentTypeLabel` stays English, because share images and the
 * worker's checks read it as well, and because it is what rows are grouped by. The
 * pages that show a type to a reader put it through here, so a heading never says
 * "Prayer" beside a Spanish count. It holds no data access, so the header's client
 * component can use what it returns.
 */
import type { Translator } from "@/lib/i18n/translator";

/** The dictionary key for each label `contentTypeLabel` can return. */
const TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  Prayer: "search.type.prayer",
  Litany: "search.type.litany",
  Saint: "search.type.saint",
  Apparition: "search.type.apparition",
  "Our Lady": "search.type.ourLady",
  Pope: "search.type.pope",
  "Doctor of the Church": "search.type.doctor",
  Parish: "search.type.parish",
  Devotion: "search.type.devotion",
  Novena: "search.type.novena",
  Guide: "search.type.guide",
  Sacrament: "search.type.sacrament",
  Liturgy: "search.type.liturgy",
  "Church Document": "search.type.churchDocument",
  Rite: "search.type.rite",
  "Spiritual Life": "search.type.spiritualLife",
};

/** A label from `contentTypeLabel`, in the reader's language. */
export function translateTypeLabel(label: string, t: Translator): string {
  const key = TYPE_LABEL_KEYS[label];
  return key ? t(key) : label;
}

/** Every label at once, English to the reader's language, for a client component. */
export function typeLabelTranslations(t: Translator): Record<string, string> {
  return Object.fromEntries(Object.entries(TYPE_LABEL_KEYS).map(([label, key]) => [label, t(key)]));
}

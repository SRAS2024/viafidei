import type { FactItem } from "@/components/ui/FactList";
import {
  patronageIsAgainst,
  saintCardDetails,
  saintLifeDates,
  saintPatronage,
} from "@/lib/content-shared/saints";
import type { Translator } from "@/lib/i18n/translator";

/**
 * The years a saint lived, one end at a time. saintLifeDates decides what a record
 * can honestly say (a day and month dropped, "c." kept, a disputed date gone) and
 * refuses a birth after the death, in which case neither end is printed.
 */
export function saintLifeEnds(payload: Record<string, unknown>): {
  born: string | null;
  died: string | null;
} {
  if (!saintLifeDates(payload)) return { born: null, died: null };
  const end = (key: "birthDate" | "deathDate", lead: RegExp) =>
    saintLifeDates({ [key]: payload[key] })?.replace(lead, "") ?? null;
  return { born: end("birthDate", /^Born /), died: end("deathDate", /^Died /) };
}

/** A label through the dictionaries, in English until a dictionary carries it. */
function label(t: Translator, key: string, english: string): string {
  const text = t(key);
  return text === key ? english : text;
}

/**
 * A saint's facts, in the owner's order: patronage, feast day, then the dates of the
 * saint's life. The patronage and feast come from the same reading of the record as
 * the catalogue card, so the card and the page agree. A fact the record does not hold
 * is simply left out. There is no canonization row: the owner asked for none, and the
 * records' canonization dates and popes are too unreliable to print ("1677, by Pope
 * Clement XII", who reigned from 1730; a Coptic pope for the Copts of Libya).
 */
export function saintFactItems(payload: Record<string, unknown>, t: Translator): FactItem[] {
  const { patronages, feast } = saintCardDetails(payload);
  const patronage = saintPatronage(patronages);
  const { born, died } = saintLifeEnds(payload);
  const items: Array<FactItem | null> = [
    patronage
      ? {
          label: patronageIsAgainst(patronage)
            ? label(t, "saints.facts.patron", "Patron")
            : t("saints.card.patronOf", { patronages: "" }).trim(),
          value: patronage,
        }
      : null,
    feast ? { label: t("saints.feastDay"), value: feast } : null,
    born ? { label: label(t, "saints.facts.born", "Born"), value: born } : null,
    died ? { label: label(t, "saints.facts.died", "Died"), value: died } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

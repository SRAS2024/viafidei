import { saintLifeEnds } from "@/app/saints/[slug]/facts";
import type { FactItem } from "@/components/ui/FactList";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { popeReignedIn } from "@/lib/content-shared/display-order";
import { saintCardDetails } from "@/lib/content-shared/saints";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The label over a Doctor's name: "Bishop · Doctor of the Church", the same words
 * the stored subtitle opens with. The role is a word about the person, not a field
 * to label, so it stays with the title it belongs to.
 */
export function doctorEyebrow(payload: Record<string, unknown>): string {
  return generateContentSubtitle({
    contentType: "DOCTOR",
    fields: { ecclesialRole: payload.ecclesialRole },
  });
}

/**
 * The life dates at the head of a Doctor's biography: "Saint Augustine (354-430),
 * bishop of Hippo" gives 354 and 430, "(c. 1200-1280)" gives c. 1200 and 1280. Only
 * the opening bracket is read, so a date later in the text is never mistaken for
 * one. A record with dates of its own is read the way a saint's is.
 */
export function doctorLifeEnds(payload: Record<string, unknown>): {
  born: string | null;
  died: string | null;
} {
  const recorded = saintLifeEnds(payload);
  if (recorded.born || recorded.died) return recorded;
  const opening = /^(?:St\. )?[^(.]*\((c\. ?)?(\d{2,4})\s*[-–]\s*(c\. ?)?(\d{2,4})\)/.exec(
    clean(payload.background),
  );
  if (!opening || Number(opening[2]) >= Number(opening[4])) return { born: null, died: null };
  return {
    born: `${opening[1] ? "c. " : ""}${opening[2]}`,
    died: `${opening[3] ? "c. " : ""}${opening[4]}`,
  };
}

/**
 * When and by whom a saint was made a Doctor, as the biography says it: "Declared
 * a Doctor of the Church by Pope Pius XI in 1931" gives "1931, by Pope Pius XI",
 * and "One of the four original Latin Doctors of the Church, confirmed by Pope
 * Boniface VIII in 1298" gives "1298, by Pope Boniface VIII". The line is printed
 * only when that pope was reigning that year, by the written-out line of popes. A
 * date with no pope to hold it against, or a pope and year that disagree, leaves no
 * line at all: a wrong-looking fact is worse than a missing one.
 */
export function doctorDeclared(payload: Record<string, unknown>): string | null {
  const sentence =
    /Doctors? of the Church[^.]*?\bby (Pope(?: Saint| Blessed)? [A-Z]\w+(?: [A-Z]\w*)*) (?:in|on) ((?:\d{1,2} [A-Z][a-z]+ )?(\d{4}))\b/.exec(
      clean(payload.background),
    );
  if (!sentence || !popeReignedIn(sentence[1]!, Number(sentence[3]))) return null;
  return `${sentence[2]}, by ${sentence[1]}`;
}

/**
 * A Doctor's facts: the title the Church knows them by, feast day, dates, and the
 * declaration. A title of plain "Doctor of the Church" only repeats the label above
 * the name, so it is left out.
 */
export function doctorFactItems(payload: Record<string, unknown>): FactItem[] {
  const title = clean(payload.doctorTitle);
  const { feast } = saintCardDetails(payload);
  const { born, died } = doctorLifeEnds(payload);
  const declared = doctorDeclared(payload);
  const items: Array<FactItem | null> = [
    title && title.toLowerCase() !== "doctor of the church"
      ? { label: "Title", value: title }
      : null,
    feast ? { label: "Feast day", value: feast } : null,
    born ? { label: "Born", value: born } : null,
    died ? { label: "Died", value: died } : null,
    declared ? { label: "Declared Doctor", value: declared } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

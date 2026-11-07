import type { FactItem } from "@/components/ui/FactList";
import { saintCardDetails } from "@/lib/content-shared/saints";

function clean(value: unknown): string {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value.trim() : "";
}

/** Nobody reigns this long, so an older papacy with no end date is a gap, not a reign. */
const LONGEST_REIGN_YEARS = 60;

/**
 * A pope's reign as a reader expects it: "1978 – 2005", "c. 99 – c. 107", "336"
 * for one that began and ended in the same year, "Since 2025" for the living
 * pope. Null when the record gives no start.
 */
export function popePontificate(
  payload: Record<string, unknown>,
  currentYear = new Date().getUTCFullYear(),
): string | null {
  const start = clean(payload.papacyStart);
  if (!start) return null;
  const end = clean(payload.papacyEnd);
  if (!end || end.toLowerCase() === "present") {
    const year = Number(start);
    return Number.isFinite(year) && currentYear - year <= LONGEST_REIGN_YEARS
      ? `Since ${start}`
      : start;
  }
  return start === end ? start : `${start} – ${end}`;
}

/**
 * The birth name worth a line: one his papal name does not already say. 34 of the
 * 128 recorded are the papal name itself ("Gregory" under "Pope Saint Gregory the
 * Great"), and a fact that only repeats the title adds nothing.
 */
export function popeBirthName(title: string, value: unknown): string | null {
  const name = clean(value);
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i").test(title) ? null : name;
}

/** A pope's facts: his reign, the name he was born with, and a saint pope's feast. */
export function popeFactItems(title: string, payload: Record<string, unknown>): FactItem[] {
  const pontificate = popePontificate(payload);
  const birthName = popeBirthName(title, payload.birthName);
  const { feast } = saintCardDetails(payload);
  const items: Array<FactItem | null> = [
    pontificate ? { label: "Pontificate", value: pontificate } : null,
    birthName ? { label: "Birth name", value: birthName } : null,
    feast ? { label: "Feast day", value: feast } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

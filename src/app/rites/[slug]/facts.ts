import type { FactItem } from "@/components/ui/FactList";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A rite's facts: what it is, its tradition, where it is celebrated and by how many.
 * The first two are the parts of the line the worker composes ("Byzantine tradition
 * · Church sui iuris", "Latin liturgical use · Milan", "Latin liturgical rite"),
 * built here from the record so the page and that line never disagree. A rite whose
 * family is not recorded has neither.
 */
export function riteFactItems(payload: Record<string, unknown>): FactItem[] {
  const [kind = "", detail = ""] = generateContentSubtitle({
    contentType: "RITE",
    fields: payload,
  }).split(" · ");
  const tradition = kind.endsWith(" tradition") ? kind.slice(0, -" tradition".length) : "";
  const type = tradition ? detail : kind.startsWith("A ") ? "" : kind;
  const place = tradition ? "" : detail;
  const items: Array<FactItem | null> = [
    type ? { label: "Type", value: type } : null,
    tradition ? { label: "Tradition", value: tradition } : null,
    place ? { label: "Place", value: place } : null,
    clean(payload.region) ? { label: "Region", value: clean(payload.region) } : null,
    clean(payload.faithfulEstimate)
      ? { label: "Faithful", value: clean(payload.faithfulEstimate) }
      : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

/**
 * Some summaries only restate the title: "Roman (Latin) Rite, one of the liturgical
 * traditions of the Catholic Church." With the facts above it, that says nothing,
 * so the page opens on the history instead. The stored text is untouched.
 */
export function riteSummaryIsFiller(payload: Record<string, unknown>): boolean {
  return /, one of the liturgical traditions of the Catholic Church\.$/.test(
    clean(payload.summary),
  );
}

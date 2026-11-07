import type { FactItem } from "@/components/ui/FactList";
import { generateContentSubtitle, MARIAN_DOGMA_YEARS } from "@/lib/content-shared/content-subtitle";
import { formatFeastDay } from "@/lib/content-shared/saints";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A year the record holds as a number, or as a string of digits. */
function recordedYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return /^\d+$/.test(clean(value)) ? Number(clean(value)) : null;
}

/**
 * The Church's word on an apparition: "Church-approved Marian apparition",
 * "Marian apparition granted nihil obstat", "Private revelation". The wording is the
 * worker's subtitle, asked for without the place and year, which have their own facts.
 */
export function apparitionStatus(payload: Record<string, unknown>): string {
  return generateContentSubtitle({
    contentType: "APPARITION",
    fields: {
      subject: payload.subject,
      approvedStatus: payload.approvedStatus,
      approvalStatus: payload.approvalStatus,
      status: payload.status,
    },
  });
}

/** "Cova da Iria, Portugal"; null when neither is recorded. */
export function apparitionPlace(payload: Record<string, unknown>): string | null {
  const place = [clean(payload.location), clean(payload.country)].filter(Boolean).join(", ");
  return place || null;
}

/** An apparition's facts other than its visionaries and title, which pages render. */
export function apparitionFactItems(payload: Record<string, unknown>): FactItem[] {
  const place = apparitionPlace(payload);
  const year = recordedYear(payload.yearOfApparition);
  const feast = formatFeastDay(payload.feastDay);
  const items: Array<FactItem | null> = [
    { label: "Status", value: apparitionStatus(payload) },
    place ? { label: "Place", value: place } : null,
    year != null ? { label: "Year", value: String(year) } : null,
    feast ? { label: "Feast day", value: feast } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

/** The year a Marian dogma was defined; null for every other title. */
function dogmaYear(payload: Record<string, unknown>): number | null {
  return recordedYear(payload.dogmaDefinedYear) ?? MARIAN_DOGMA_YEARS[clean(payload.slug)] ?? null;
}

/**
 * The label over a Marian title: "Title of the Blessed Virgin Mary" or "Marian
 * dogma", the words the stored subtitle opens with.
 */
export function marianEyebrow(payload: Record<string, unknown>): string {
  const [kind = ""] = generateContentSubtitle({
    contentType: "MARIAN_TITLE",
    fields: { slug: payload.slug, dogmaDefinedYear: payload.dogmaDefinedYear },
  }).split(" · ");
  return kind;
}

/**
 * A Marian title's facts: its feast, then when it was defined if it is a dogma, or
 * where it is honored if it is not. A dogma belongs to the whole Church.
 */
export function marianFactItems(payload: Record<string, unknown>): FactItem[] {
  const feast = formatFeastDay(payload.feastDay);
  const defined = dogmaYear(payload);
  const region = defined == null ? clean(payload.region) : "";
  const items: Array<FactItem | null> = [
    feast ? { label: "Feast day", value: feast } : null,
    defined != null ? { label: "Defined", value: String(defined) } : null,
    region ? { label: "Region", value: region } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}

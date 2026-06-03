/**
 * Marian apparition labelling (spec — "Marian apparition feast days").
 *
 * Apparition cards show a readable approval status and, when known, the
 * liturgical feast day on which the apparition is celebrated. A feast day
 * stored on the payload always wins; otherwise a small curated lookup
 * supplies the universally-recognised feasts of the major approved
 * apparitions (kept deliberately conservative to stay accurate).
 */
import { formatFeastDay } from "./saints";

const APPROVAL_LABELS: Record<string, string> = {
  approved: "Approved",
  constat_de_supernaturalitate: "Constat de supernaturalitate",
  non_constat: "Non constat de supernaturalitate",
  not_supernatural: "Not supernatural",
  under_investigation: "Under investigation",
  not_yet_judged: "Not yet judged",
  private_revelation: "Private revelation",
};

/** Curated feasts (MM-DD) of the major approved apparitions, matched by name. */
const KNOWN_FEASTS: Array<{ match: RegExp; feast: string }> = [
  { match: /lourdes/i, feast: "02-11" }, // Our Lady of Lourdes
  { match: /f[aá]tima/i, feast: "05-13" }, // Our Lady of Fátima
  { match: /guadalupe/i, feast: "12-12" }, // Our Lady of Guadalupe
  { match: /salette/i, feast: "09-19" }, // Our Lady of La Salette
  { match: /knock/i, feast: "08-21" }, // Our Lady of Knock
  { match: /miraculous medal|rue du bac/i, feast: "11-27" }, // Our Lady of the Miraculous Medal
];

/** The feast day (MM-DD) for an apparition, stored value first then curated lookup. */
export function apparitionFeastDay(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.feastDay === "string" && payload.feastDay.trim()) {
    return payload.feastDay.trim();
  }
  const slug = typeof payload.slug === "string" ? payload.slug : "";
  const title = typeof payload.title === "string" ? payload.title : "";
  const hay = `${slug} ${title}`;
  return KNOWN_FEASTS.find((k) => k.match.test(hay))?.feast;
}

/** Readable approval-status label for an apparition. */
export function apparitionApprovalLabel(payload: Record<string, unknown>): string | undefined {
  const status = payload.approvedStatus;
  if (typeof status !== "string") return undefined;
  return APPROVAL_LABELS[status];
}

/** Catalog eyebrow for an apparition: "Approved · Feast February 11". */
export function apparitionEyebrow(payload: Record<string, unknown>): string | undefined {
  const status = apparitionApprovalLabel(payload);
  const feast = formatFeastDay(apparitionFeastDay(payload));
  const parts = [status, feast ? `Feast ${feast}` : undefined].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : undefined;
}

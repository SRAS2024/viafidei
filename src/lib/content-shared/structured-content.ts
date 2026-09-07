/**
 * Detect "accordion-able" content fields — arrays whose elements each carry a
 * label (day / prayer title / mystery) and a body (prayer text / steps). These
 * render as expandable dropdowns so guides and novenas stay concise while
 * still providing every prayer in order.
 */
export interface DisclosureItem {
  title: string;
  body: string;
}

const LABEL_KEYS = [
  "title",
  "dayTitle",
  "prayerTitle",
  "name",
  "day",
  "mystery",
  "label",
  "heading",
];
const BODY_KEYS = ["text", "prayer", "prayerText", "body", "content", "description", "steps"];

function stringFrom(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "string")) {
    return (value as string[]).join("\n");
  }
  return null;
}

/**
 * Returns one {title, body} per element when the array is a list of
 * label+body objects (e.g. novena days, guide prayers); otherwise null so the
 * caller falls back to its normal rendering.
 */
export function toDisclosureItems(value: unknown): DisclosureItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: DisclosureItem[] = [];
  for (const el of value) {
    if (typeof el !== "object" || el === null || Array.isArray(el)) return null;
    const o = el as Record<string, unknown>;
    const labelKey = LABEL_KEYS.find((k) => typeof o[k] === "string" && (o[k] as string).trim());
    let body: string | null = null;
    for (const k of BODY_KEYS) {
      const s = stringFrom(o[k]);
      if (s) {
        body = s;
        break;
      }
    }
    if (!labelKey || body == null) return null;
    items.push({ title: String(o[labelKey]).trim(), body });
  }
  return items;
}

/** One step of a how-to guide: a number, a title and the instruction itself. */
export interface GuideStep {
  /** 1-based position; falls back to array order when the payload omits it. */
  order: number;
  title: string;
  body: string;
}

/**
 * Reads a guide's `steps` array into ordered, numbered steps.
 *
 * `toDisclosureItems` deliberately drops `order` (a novena day has no number
 * of its own), which is why guide steps used to render as unnumbered collapsed
 * rows. Guides need the number, so they get their own reader: it keeps `order`
 * when the payload carries one, sorts by it, and returns null for anything
 * that is not a list of title+body objects so the caller can fall back.
 */
export function toGuideSteps(value: unknown): GuideStep[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const steps: GuideStep[] = [];
  for (const [index, el] of value.entries()) {
    if (typeof el !== "object" || el === null || Array.isArray(el)) return null;
    const o = el as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const body = stringFrom(o.body ?? o.text ?? o.content);
    if (!title || !body) return null;
    const rawOrder = typeof o.order === "number" && Number.isFinite(o.order) ? o.order : null;
    steps.push({ order: rawOrder ?? index + 1, title, body });
  }
  // A payload with duplicate or missing orders must still read 1, 2, 3 — sort
  // by the stored order, then renumber from the sorted position.
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }));
}

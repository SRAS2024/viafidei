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

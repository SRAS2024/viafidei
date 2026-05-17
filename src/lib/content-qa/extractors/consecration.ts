/**
 * Consecration extractor (Section 8). Produces a typed Consecration
 * package payload with name / background / duration / daily structure /
 * daily prayers / final consecration prayer.
 *
 * Most consecrations are multi-day (33-day, 9-day, 7-day). The
 * extractor counts "Day N" sections and treats the highest number as
 * the configured duration. The final consecration prayer is the
 * paragraph after the last day section.
 */

import type { ConsecrationDay, ConsecrationPackagePayload } from "../contracts/consecration";

export type ConsecrationExtractionResult = {
  complete: boolean;
  payload: ConsecrationPackagePayload;
  provenance: Record<string, string>;
  missingDays: number[];
};

const DAY_HEADER_RE =
  /(?:^|\n)\s*(?:#{1,3}\s*|[*_]{1,2}\s*)?(?:day\s+(\d{1,2})\b|(\d{1,2})(?:st|nd|rd|th)\s+day\b)/i;

function splitDays(body: string): Map<number, string> {
  const days = new Map<number, string>();
  const headers: Array<{ dayNumber: number; index: number }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(DAY_HEADER_RE.source, "gi");
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1] ?? m[2], 10);
    if (n >= 1 && n <= 40) headers.push({ dayNumber: n, index: m.index });
  }
  headers.sort((a, b) => a.index - b.index);
  for (let i = 0; i < headers.length; i += 1) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const chunk = body.slice(start, end).trim();
    if (!days.has(headers[i].dayNumber)) days.set(headers[i].dayNumber, chunk);
  }
  return days;
}

function extractPrayers(chunk: string): string[] {
  const prayers: string[] = [];
  // Match "Prayer:" / "Daily prayer:" sections.
  const re = /(?:^|\n)\s*(?:daily\s+)?prayer[:\s—-]+([\s\S]+?)(?=\n\n|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const p = m[1].trim();
    if (p.length > 5) prayers.push(p);
  }
  return prayers;
}

function extractReadings(chunk: string): string[] {
  const readings: string[] = [];
  const re = /(?:^|\n)\s*(?:reading|scripture)[:\s—-]+([\s\S]+?)(?=\n\n|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const r = m[1].trim();
    if (r.length > 5) readings.push(r);
  }
  return readings;
}

export function extractConsecration(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): ConsecrationExtractionResult {
  const provenance: Record<string, string> = {};
  const missingDays: number[] = [];

  const consecrationName = args.title?.trim() || undefined;
  if (consecrationName) provenance.consecrationName = "title input";

  const firstDayMatch = args.body.search(DAY_HEADER_RE);
  const preamble = firstDayMatch >= 0 ? args.body.slice(0, firstDayMatch).trim() : args.body.trim();
  const background = preamble.split(/\n\n/)[0]?.trim() || undefined;
  if (background) provenance.background = "first paragraph above day headers";

  const daysMap = splitDays(args.body);
  const durationDays = daysMap.size > 0 ? Math.max(...daysMap.keys()) : 0;
  const dailyPrayers: ConsecrationDay[] = [];
  for (let n = 1; n <= durationDays; n += 1) {
    const chunk = daysMap.get(n);
    if (!chunk) {
      missingDays.push(n);
      continue;
    }
    const prayers = extractPrayers(chunk);
    const readings = extractReadings(chunk);
    dailyPrayers.push({
      dayNumber: n,
      prayers,
      readings: readings.length > 0 ? readings : undefined,
    });
  }
  if (dailyPrayers.length > 0) provenance.dailyPrayers = "day-section parser";

  // Final consecration prayer — the last "Consecration Prayer:" / "Final
  // Prayer:" block in the document, or the paragraph after the last
  // day section.
  let finalConsecrationPrayer: string | undefined;
  const finalRe =
    /(?:final\s+(?:consecration\s+)?prayer|consecration\s+prayer)[:\s—-]+([\s\S]+?)(?=\n\n|$)/i;
  const finalMatch = args.body.match(finalRe);
  if (finalMatch) {
    finalConsecrationPrayer = finalMatch[1].trim();
    provenance.finalConsecrationPrayer = "final-prayer header";
  } else if (daysMap.size > 0) {
    const lastDayIndex = Math.max(
      ...Array.from(daysMap.entries()).map(([, chunk]) => args.body.lastIndexOf(chunk)),
    );
    const trailing = args.body.slice(lastDayIndex + (daysMap.get(durationDays)?.length ?? 0));
    const trimmed = trailing.trim();
    if (trimmed.length > 20) {
      finalConsecrationPrayer = trimmed.split(/\n\n/)[0]?.trim();
      provenance.finalConsecrationPrayer = "trailing-paragraph fallback";
    }
  }

  const complete =
    missingDays.length === 0 &&
    durationDays > 0 &&
    !!finalConsecrationPrayer &&
    dailyPrayers.every((d) => d.prayers.length > 0);

  return {
    complete,
    payload: {
      consecrationName,
      background,
      durationDays,
      dailyStructure:
        "Daily prayers + optional readings + final consecration prayer on the last day.",
      dailyPrayers,
      finalConsecrationPrayer,
    },
    provenance,
    missingDays,
  };
}

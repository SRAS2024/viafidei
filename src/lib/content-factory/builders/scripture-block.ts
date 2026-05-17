/**
 * ScriptureBlockBuilder.
 *
 * Scripture blocks are NOT stand-alone catalog entries — they live
 * inside guides, novenas, devotions, sacraments, rosary, and
 * consecration packages. This builder is the helper other builders
 * call when they encounter scripture-shaped content.
 *
 * Rules:
 *   - Uses ONE approved Catholic Bible translation (NABRE, RSV-CE, …)
 *   - Never scrapes scripture from random sources
 *   - Builds reference-only blocks when full text cannot legally be displayed
 *   - Blocks publishing when scripture is required but missing,
 *     malformed, mixed-translation, or paraphrased-but-labeled
 */

import { createHash } from "node:crypto";
import {
  APPROVED_BIBLE_TRANSLATIONS,
  APPROVED_SCRIPTURE_SOURCES,
  APPROVED_LICENSE_STATUSES,
} from "../../content-qa/contracts/scripture";
import { normalizeScriptureReference } from "../normalize";

export type ScriptureBlock = {
  scriptureReference: string;
  scriptureBook: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  scriptureText?: string;
  bibleTranslationKey?: string;
  scriptureSource?: string;
  licenseStatus: "public-domain" | "licensed-display" | "reference-only";
  contentChecksum?: string;
};

export type ScriptureBuildResult =
  | { ok: true; block: ScriptureBlock; provenance: Record<string, string> }
  | { ok: false; reason: string };

const REFERENCE_RE =
  /^(\d?\s?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?$/;

const APP_BIBLE_TRANSLATION_POLICY = "NABRE";

export function buildScriptureBlock(args: {
  reference: string;
  text?: string;
  sourceHost?: string;
  translation?: string;
}): ScriptureBuildResult {
  const ref = normalizeScriptureReference(args.reference);
  const m = REFERENCE_RE.exec(ref);
  if (!m) {
    return { ok: false, reason: `Malformed scripture reference: ${args.reference}` };
  }
  const book = m[1].trim();
  const chapter = parseInt(m[2], 10);
  const verseStart = parseInt(m[3], 10);
  const verseEnd = m[4] ? parseInt(m[4], 10) : undefined;
  if (!Number.isFinite(chapter) || !Number.isFinite(verseStart)) {
    return { ok: false, reason: "Chapter or verse parse failed" };
  }

  const translation = args.translation ?? APP_BIBLE_TRANSLATION_POLICY;
  if (!(APPROVED_BIBLE_TRANSLATIONS as readonly string[]).includes(translation)) {
    return { ok: false, reason: `Translation ${translation} not approved` };
  }

  const host = args.sourceHost ?? null;
  const sourceApproved = host
    ? (APPROVED_SCRIPTURE_SOURCES as readonly string[]).includes(host)
    : false;
  const license: ScriptureBlock["licenseStatus"] =
    args.text &&
    sourceApproved &&
    (APPROVED_LICENSE_STATUSES as readonly string[]).includes("licensed-display")
      ? "licensed-display"
      : "reference-only";

  const block: ScriptureBlock = {
    scriptureReference: ref,
    scriptureBook: book,
    chapter,
    verseStart,
    ...(verseEnd ? { verseEnd } : {}),
    scriptureText: license === "reference-only" ? undefined : args.text,
    bibleTranslationKey: translation,
    scriptureSource: host ?? undefined,
    licenseStatus: license,
    contentChecksum: args.text ? createHash("sha256").update(args.text).digest("hex") : undefined,
  };

  const provenance: Record<string, string> = {
    scriptureReference: "regex parse + normalize",
    scriptureBook: "regex group 1",
    chapter: "regex group 2",
    verseStart: "regex group 3",
    bibleTranslationKey: "app policy default",
    licenseStatus:
      license === "reference-only" ? "reference-only fallback" : "approved source + translation",
  };
  return { ok: true, block, provenance };
}

export const APP_SCRIPTURE_TRANSLATION_POLICY = APP_BIBLE_TRANSLATION_POLICY;

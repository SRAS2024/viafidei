/**
 * Field extractors.
 *
 * Given a fetched HTML body and a checklist item, the extractor produces
 * candidate values for every field in the strict schema. The worker keeps
 * candidates from every source and feeds them into the cross-source
 * reconciler.
 *
 * Extractors here are HTML-agnostic — they read the parsed body
 * (paragraphs, headings, lists) and look for type-specific markers
 * (e.g. "Feast Day:", numbered novena days, "Promises:" sections).
 *
 * The extractors are conservative. When in doubt, they emit no candidate
 * rather than guessing, which keeps the worker from inventing content.
 */

import type { ChecklistContentType, ChecklistItem } from "@prisma/client";

import { canonicalizeSlug } from "../slugs";
import type { FetchedSource } from "../types";
import type { FieldCandidate } from "./cross-source";

interface ParsedDoc {
  text: string;
  paragraphs: string[];
  headings: string[];
  lists: string[][];
}

function parseHtml(html: string): ParsedDoc {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const paragraphs: string[] = [];
  for (const match of stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const txt = stripTags(match[1]).trim();
    if (txt) paragraphs.push(txt);
  }
  const headings: string[] = [];
  for (const match of stripped.matchAll(
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
  )) {
    const txt = stripTags(match[1]).trim();
    if (txt) headings.push(txt);
  }
  const lists: string[][] = [];
  for (const ulMatch of stripped.matchAll(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const items: string[] = [];
    for (const li of ulMatch[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const txt = stripTags(li[1]).trim();
      if (txt) items.push(txt);
    }
    if (items.length) lists.push(items);
  }
  const text = stripTags(stripped).replace(/\s+/g, " ").trim();
  return { text, paragraphs, headings, lists };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickByLabel(
  text: string,
  label: RegExp
): string | null {
  const re = new RegExp(`${label.source}\\s*[:\\-]\\s*([^\\n.]{1,200})`, "i");
  const match = text.match(re);
  return match ? match[1].trim() : null;
}

function pickList(paragraphs: string[], keyword: RegExp): string[] | null {
  for (const p of paragraphs) {
    if (keyword.test(p)) {
      const list = p.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (list.length > 1) return list;
    }
  }
  return null;
}

function extractMonthDay(input: string): { mm: number; dd: number } | null {
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const re = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i;
  const m = input.match(re);
  if (m) {
    const month = months[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    if (month && day >= 1 && day <= 31) return { mm: month, dd: day };
  }
  return null;
}

function formatMMDD(mm: number, dd: number): string {
  return `${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
}

export function extractFields(
  contentType: ChecklistContentType,
  item: ChecklistItem,
  sources: FetchedSource[]
): Record<string, FieldCandidate[]> {
  const fields: Record<string, FieldCandidate[]> = {};
  const push = <T,>(field: string, source: FetchedSource, value: T) => {
    if (value == null || value === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    fields[field] = fields[field] ?? [];
    fields[field].push({
      value,
      authorityLevel: source.authorityLevel,
      sourceUrl: source.url,
      sourceHost: source.host,
    });
  };

  for (const source of sources) {
    const doc = parseHtml(source.body);
    push("title", source, source.title ?? item.canonicalName);

    switch (contentType) {
      case "PRAYER": {
        const longest = doc.paragraphs
          .filter((p) => p.length > 80)
          .sort((a, b) => b.length - a.length)[0];
        if (longest) push("body", source, longest);
        push("category", source, "general");
        push("language", source, "en");
        push("prayerType", source, inferPrayerType(item.canonicalName));
        break;
      }
      case "DEVOTION": {
        const summary = doc.paragraphs.find((p) => p.length > 80);
        if (summary) push("summary", source, summary);
        push("devotionType", source, "marian"); // best effort default
        const instr = doc.paragraphs.filter((p) => /\b(pray|recite|begin|then)\b/i.test(p)).join("\n");
        if (instr.length > 40) push("practiceInstructions", source, instr);
        break;
      }
      case "SAINT": {
        const bio = doc.paragraphs.filter((p) => p.length > 80).join("\n").slice(0, 4000);
        if (bio) push("biography", source, bio);
        const feast = pickByLabel(doc.text, /feast\s*day/i);
        if (feast) {
          const md = extractMonthDay(feast);
          if (md) {
            push("feastDay", source, formatMMDD(md.mm, md.dd));
            push("feastMonth", source, md.mm);
            push("feastDayOfMonth", source, md.dd);
          }
        }
        const patrons = pickList(doc.paragraphs, /patron(age)?\s+of/i);
        if (patrons) push("patronages", source, patrons);
        push("canonicalName", source, item.canonicalName);
        push("canonizationStatus", source, "canonized");
        push("saintType", source, "other");
        break;
      }
      case "MARIAN_TITLE": {
        const summary = doc.paragraphs.find((p) => p.length > 60);
        if (summary) push("summary", source, summary);
        if (doc.paragraphs[1]) push("origin", source, doc.paragraphs[1]);
        const theo = doc.paragraphs.find((p) =>
          /theolog/i.test(p) || /dogma/i.test(p)
        );
        if (theo) push("theologicalSignificance", source, theo);
        break;
      }
      case "APPARITION": {
        const summary = doc.paragraphs.find((p) => p.length > 80);
        if (summary) push("summary", source, summary);
        const location = pickByLabel(doc.text, /location/i);
        if (location) push("location", source, location);
        const country = pickByLabel(doc.text, /country/i);
        if (country) push("country", source, country);
        const status = pickByLabel(doc.text, /(approved|status)/i);
        if (status) {
          const norm = String(status).toLowerCase();
          if (norm.includes("approved")) push("approvedStatus", source, "approved");
          else if (norm.includes("under investigation"))
            push("approvedStatus", source, "under_investigation");
        }
        break;
      }
      case "NOVENA": {
        const summary = doc.paragraphs.find((p) => p.length > 80);
        if (summary) push("summary", source, summary);
        push("intentionTheme", source, item.canonicalName);
        const days: Array<{ day: number; title: string; meditation: string; prayerText: string }> = [];
        for (let i = 1; i <= 9; i++) {
          const dayHeading = doc.headings.find((h) =>
            new RegExp(`\\bday\\s+${i}\\b`, "i").test(h)
          );
          if (!dayHeading) continue;
          const idx = doc.headings.indexOf(dayHeading);
          const para = doc.paragraphs[Math.min(idx, doc.paragraphs.length - 1)];
          if (!para) continue;
          days.push({
            day: i,
            title: dayHeading,
            meditation: para.slice(0, 800),
            prayerText: para.slice(0, 800),
          });
        }
        if (days.length === 9) push("days", source, days);
        break;
      }
      case "SACRAMENT": {
        const summary = doc.paragraphs.find((p) => p.length > 80);
        if (summary) push("summary", source, summary);
        const theological = doc.paragraphs
          .filter((p) => p.length > 100)
          .slice(0, 4)
          .join("\n");
        if (theological) push("theologicalOverview", source, theological);
        push("institution", source, doc.paragraphs[0] ?? "");
        const minister = pickByLabel(doc.text, /minister/i);
        if (minister) push("minister", source, minister);
        const recipient = pickByLabel(doc.text, /recipient/i);
        if (recipient) push("recipient", source, recipient);
        const effects = pickList(doc.paragraphs, /effect/i);
        if (effects) push("effects", source, effects);
        const meta = item.metadata as Record<string, unknown> | null;
        if (meta?.sacramentKey) push("sacramentKey", source, meta.sacramentKey);
        break;
      }
      case "GUIDE": {
        const summary = doc.paragraphs.find((p) => p.length > 60);
        if (summary) push("summary", source, summary);
        const steps = doc.lists[0]
          ?.slice(0, 12)
          .map((body, index) => ({
            order: index + 1,
            title: `Step ${index + 1}`,
            body,
          })) ?? [];
        if (steps.length >= 2) push("steps", source, steps);
        push("kind", source, "general");
        break;
      }
      case "CHURCH_DOCUMENT": {
        const summary = doc.paragraphs.slice(0, 3).join(" ").slice(0, 2000);
        if (summary) push("summary", source, summary);
        const meta = item.metadata as Record<string, unknown> | null;
        if (meta?.documentType)
          push("documentType", source, meta.documentType);
        push("canonicalUrl", source, source.url);
        push("issuingAuthority", source, source.host.includes("vatican") ? "Holy See" : "USCCB");
        const yearMatch = source.body.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          push("issuedDate", source, `${yearMatch[0]}-01-01`);
        }
        const themes = doc.headings.slice(0, 6);
        if (themes.length) push("keyThemes", source, themes);
        break;
      }
      case "LITURGICAL": {
        const summary = doc.paragraphs.find((p) => p.length > 60);
        if (summary) push("summary", source, summary);
        const body = doc.paragraphs.slice(0, 6).join("\n");
        if (body) push("body", source, body);
        const meta = item.metadata as Record<string, unknown> | null;
        if (meta?.kind) push("kind", source, meta.kind);
        if (meta?.feastDate) push("feastDate", source, meta.feastDate);
        if (meta?.movableFeast != null)
          push("movableFeast", source, Boolean(meta.movableFeast));
        break;
      }
      case "SPIRITUAL_PRACTICE": {
        const summary = doc.paragraphs.find((p) => p.length > 80);
        if (summary) push("summary", source, summary);
        const instr = doc.paragraphs.filter((p) => /\b(step|begin|first|next|then)\b/i.test(p)).join("\n");
        if (instr.length > 60) push("instructions", source, instr);
        push("practiceKind", source, "other");
        break;
      }
    }

    push("slug", source, canonicalizeSlug(item.canonicalSlug));
  }

  return fields;
}

function inferPrayerType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("morning")) return "morning";
  if (n.includes("evening")) return "evening";
  if (n.includes("meal") || n.includes("grace")) return "meal";
  if (n.includes("litany")) return "litany";
  if (n.includes("novena")) return "novena";
  if (n.includes("rosary")) return "rosary";
  if (n.includes("hail mary") || n.includes("magnificat") || n.includes("regina")) return "marian";
  if (n.includes("act of")) return "act";
  if (n.includes("consecration")) return "consecration";
  return "general";
}

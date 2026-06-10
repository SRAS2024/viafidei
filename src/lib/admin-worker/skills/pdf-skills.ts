/**
 * PDF handling skill pack. The worker can fetch + detect + classify PDFs and
 * read their text. Text extraction uses the runtime's dependency-free extractor
 * (`pdf-extract`, built on Node's zlib) for the digitally-generated text PDFs
 * the Holy See / USCCB publish; only when a PDF is scanned, encrypted, or
 * otherwise unreadable does the worker fall back to filing a specific OCR /
 * parser developer request rather than feeding the pipeline noise.
 */

import { isApprovedAuthorityHost } from "@/lib/checklist";
import { adminWorkerFetch, type FetcherInput, type FetchedPage } from "../fetcher";
import { writeAdminWorkerLog } from "../logs";
import { extractPdfText } from "../pdf-extract";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

const PDF_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function body(ctx: SkillContext): string {
  const i = ctx.input as Record<string, unknown>;
  return String(i.body ?? i.rawBody ?? "");
}
function url(ctx: SkillContext): string {
  return String((ctx.input as Record<string, unknown>).url ?? "");
}

/**
 * Fetch raw PDF bytes from an approved host. The normal fetcher rejects binary
 * content types, so PDF reading gets its own bounded GET (host-allowlisted,
 * timed out, size-capped). Honours ADMIN_WORKER_SKIP_NETWORK.
 */
async function fetchPdfBytes(pdfUrl: string): Promise<Buffer | null> {
  if (!pdfUrl || process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return null;
  let host = "";
  try {
    host = new URL(pdfUrl).host;
  } catch {
    return null;
  }
  if (!isApprovedAuthorityHost(host)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(pdfUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": PDF_USER_AGENT, Accept: "application/pdf,*/*" },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 40_000_000) return null; // 40 MB cap
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve PDF bytes for a skill: from the URL (fetch) or an inlined %PDF body. */
async function resolvePdfBytes(ctx: SkillContext): Promise<Buffer | null> {
  const u = url(ctx);
  if (u) {
    const fetched = await fetchPdfBytes(u);
    if (fetched) return fetched;
  }
  const b = body(ctx);
  if (b.startsWith("%PDF")) return Buffer.from(b, "latin1");
  return null;
}
function isPdf(ctx: SkillContext): boolean {
  const i = ctx.input as Record<string, unknown>;
  const ct = String(i.contentType ?? "").toLowerCase();
  return (
    ct.includes("pdf") || url(ctx).toLowerCase().endsWith(".pdf") || body(ctx).startsWith("%PDF")
  );
}

/** Route a PDF that needs a parser/OCR to a developer request (no false success). */
async function fileOcrRequest(ctx: SkillContext, why: string) {
  const fingerprint = `missing-skill:pdf_text_extraction`;
  const req = await ctx.prisma.adminWorkerDeveloperRequest
    .upsert({
      where: { fingerprint },
      create: {
        kind: "capability",
        title: "PDF OCR capability needed",
        detail: `${why}. The runtime's text extractor could not read this PDF (scanned or encrypted); an OCR capability is required to extract this document.`,
        severity: "high",
        status: "OPEN",
        source: "skill-runtime",
        fingerprint,
        metadata: { url: url(ctx), capability: "pdf_text_extraction" },
      },
      update: { occurrences: { increment: 1 } },
      select: { id: true },
    })
    .catch(() => null);
  return {
    ok: false,
    detail: req ? "filed PDF text-extraction developer request" : "could not file request",
    outputEntityType: "AdminWorkerDeveloperRequest",
    outputEntityId: req?.id ?? null,
  };
}

export const pdfSkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "detect_pdf",
    purpose: "Detect whether a fetched resource is a PDF.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "PROCEED",
    run: async (ctx) => ({ ok: true, detail: isPdf(ctx) ? "pdf" : "not a pdf" }),
  }),
  makeOpSkill({
    name: "fetch_pdf",
    purpose: "Fetch a PDF document from an approved host.",
    category: "SOURCE",
    inputs: ["url"],
    run: async (ctx) => {
      const page = (await adminWorkerFetch(
        ctx.prisma,
        ctx.input as unknown as FetcherInput,
      )) as FetchedPage;
      return {
        ok: page.succeeded,
        detail: page.succeeded ? "fetched" : (page.rejectionReason ?? `http ${page.httpStatus}`),
        outputEntityType: "AdminWorkerFetchResult",
        outputEntityId: page.fetchResultRowId,
      };
    },
  }),
  makeOpSkill({
    name: "detect_scanned_pdf",
    purpose: "Detect a scanned (image-only) PDF that needs OCR.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "PROCEED",
    run: async (ctx) => {
      const b = body(ctx);
      // A text PDF contains font/text operators; a scanned one is mostly image XObjects.
      const looksScanned = b.startsWith("%PDF") && /\/Image/.test(b) && !/\/Font|BT\s/.test(b);
      return { ok: true, detail: looksScanned ? "scanned (needs OCR)" : "text PDF" };
    },
  }),
  makeOpSkill({
    name: "extract_pdf_metadata",
    purpose: "Extract basic PDF metadata (version, size).",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const b = body(ctx);
      const m = b.match(/^%PDF-(\d+\.\d+)/);
      return { ok: m != null, detail: m ? `PDF ${m[1]}, ${b.length} bytes` : "no PDF header" };
    },
  }),
  makeOpSkill({
    name: "classify_pdf_document_type",
    purpose: "Classify a PDF document type from its URL/structure (encyclical, council, …).",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const u = url(ctx).toLowerCase();
      const type = /encyclical|enciclica/.test(u)
        ? "encyclical"
        : /exhort/.test(u)
          ? "apostolic_exhortation"
          : /const|council|concili/.test(u)
            ? "council_document"
            : /motu/.test(u)
              ? "motu_proprio"
              : "church_document";
      return { ok: true, detail: type };
    },
  }),
  makeOpSkill({
    name: "verify_pdf_citation",
    purpose: "Verify a PDF citation points at an approved host and a .pdf resource.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const u = url(ctx).toLowerCase();
      const ok = /vatican\.va|usccb\.org/.test(u) && (u.endsWith(".pdf") || isPdf(ctx));
      return { ok, detail: ok ? "valid PDF citation" : "not an approved-host PDF" };
    },
  }),
  makeOpSkill({
    name: "route_scanned_pdf_to_review_or_ocr_request",
    purpose: "Route a scanned PDF to human review / file an OCR developer request.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => fileOcrRequest(ctx, "Scanned PDF requires OCR"),
  }),
  makeOpSkill({
    name: "extract_text_pdf",
    purpose:
      "Read a PDF from the web and extract its text with the runtime's zlib-based extractor. Scanned / encrypted PDFs (no usable text) fall back to an OCR developer request.",
    category: "EXTRACTION",
    contentTypes: ["CHURCH_DOCUMENT", "PAPAL_DOCUMENT", "COUNCIL_DOCUMENT"],
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => extractPdfSkill(ctx, "PDF text extraction requested"),
  }),
  makeOpSkill({
    name: "extract_vatican_pdf_document",
    purpose:
      "Read a structured Vatican PDF and extract its text. Scanned / encrypted documents fall back to an OCR developer request.",
    category: "EXTRACTION",
    contentTypes: ["CHURCH_DOCUMENT", "PAPAL_DOCUMENT", "COUNCIL_DOCUMENT"],
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => extractPdfSkill(ctx, "Vatican PDF structured extraction requested"),
  }),
];

/**
 * Shared body for the PDF text-extraction skills: fetch + extract; on a clean
 * read, record a text sample and succeed; otherwise file the OCR request.
 */
async function extractPdfSkill(ctx: SkillContext, requestWhy: string) {
  const buf = await resolvePdfBytes(ctx);
  if (!buf) return fileOcrRequest(ctx, `${requestWhy} (PDF could not be fetched)`);

  const r = extractPdfText(buf);
  if (!r.ok) {
    return fileOcrRequest(
      ctx,
      `${requestWhy} — no usable text (${r.pages || "?"} page(s), ${r.decoded}/${r.streams} streams decoded; likely scanned or encrypted)`,
    );
  }

  await writeAdminWorkerLog(ctx.prisma, {
    category: "SOURCE_READING",
    severity: "INFO",
    eventName: "pdf_text_extracted",
    message: `Extracted ${r.text.length} chars from ${r.pages || "?"} page(s) of ${url(ctx) || "an inlined PDF"}.`,
    sourceUrl: url(ctx) || undefined,
    safeMetadata: {
      chars: r.text.length,
      pages: r.pages,
      streams: r.streams,
      decoded: r.decoded,
      sample: r.text.slice(0, 600),
    },
  }).catch(() => undefined);

  return {
    ok: true,
    detail: `extracted ${r.text.length} chars from ${r.pages || "?"} page(s) (${r.decoded}/${r.streams} streams)`,
  };
}

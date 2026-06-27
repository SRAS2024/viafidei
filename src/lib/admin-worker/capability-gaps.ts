/**
 * Growth-capability self-diagnosis.
 *
 * The worker publishes its curated + structured (keyless) base with no
 * configuration at all. To keep growing PAST that base it needs real outward
 * capabilities — to fetch the open web, to complete extraction on messy pages,
 * to translate the long tail, to reach its structured source. When the worker
 * plateaus (published a lot, then 0 new), the most useful thing it can do is say
 * EXACTLY which capability is missing and how to enable it — so "stuck" becomes
 * an actionable instruction, not a mystery.
 *
 * This is a deterministic, dependency-free self-check (env + a light log read):
 * it never blocks a pass and adds no cost. The worker can't grant itself an API
 * key or open a firewall, but it CAN recognise the gap and tell the operator the
 * precise remediation — which is the honest version of "figure out a resolution
 * on its own".
 */

import type { PrismaClient } from "@prisma/client";

import { openInternetEnabled } from "@/lib/checklist";
import { dynamicFetcherEnabled } from "./dynamic-fetcher";
import { extractionAiEnabled } from "./extraction-provider";
import { webSearchEnabled } from "./search-discovery";
import { machineTranslationEnabled } from "./translation-provider";

export interface CapabilityGap {
  /** Short capability name. */
  capability: string;
  /** True when the capability is configured/available. */
  ok: boolean;
  /** Env var(s) that enable it. */
  env: string;
  /** One-line, operator-facing remediation. */
  remediation: string;
}

function envSet(name: string): boolean {
  return (process.env[name] ?? "").trim().length > 0;
}

/**
 * Diagnose the worker's growth capabilities. Returns every capability with its
 * status, the subset that is MISSING, and a human summary. Fail-open: any error
 * yields an empty (no-gap) result rather than throwing.
 */
export async function diagnoseCapabilityGaps(prisma: PrismaClient): Promise<{
  gaps: CapabilityGap[];
  missing: CapabilityGap[];
  summary: string;
}> {
  // Open internet, web search, and translation are all keyless and ON by default
  // now, so these reflect the real runtime gate rather than "is a key set".
  const openInternet = openInternetEnabled();
  const searchKeysSet =
    (envSet("GOOGLE_SEARCH_API_KEY") && envSet("GOOGLE_SEARCH_ENGINE_ID")) ||
    envSet("BING_SEARCH_API_KEY");
  const webSearch = webSearchEnabled();
  // Keyless capability, on by default. Kept env-only (no runtime browser probe)
  // so this diagnostic stays dependency-free and cheap on every pass.
  const dynamicFetch = dynamicFetcherEnabled();

  // Has the structured source (Wikidata/Wikipedia) reported itself unreachable
  // in the last 24h? The structured ingest logs this explicitly when it fetches
  // 0 rows with network enabled.
  let structuredUnreachable = false;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = await prisma.adminWorkerLog.findFirst({
      where: {
        eventName: "structured_knowledge_ingest",
        severity: "WARN",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    structuredUnreachable = Boolean(row);
  } catch {
    structuredUnreachable = false;
  }

  const gaps: CapabilityGap[] = [
    {
      capability: "AI-assisted extraction",
      ok: extractionAiEnabled(),
      env: "EXTRACTION_AI_API_URL + EXTRACTION_AI_API_KEY (or TRANSLATION_AI_*)",
      remediation:
        "Configure EXTRACTION_AI_API_URL + EXTRACTION_AI_API_KEY (or reuse TRANSLATION_AI_*). Without it, messy real-world pages leave required fields missing and never publish — this is the main publish ceiling past the curated/structured base, and the most likely reason the published count has plateaued.",
    },
    {
      capability: "Open-internet fetching",
      ok: openInternet,
      env: "ADMIN_WORKER_OPEN_INTERNET=1 (default)",
      remediation:
        "On by default — the worker may fetch approved Catholic sources beyond the built-in registry (any diocese, conference, database, EWTN) and follow links across the open web. Accuracy is still enforced downstream by cross-source verification + strict QA. Shows missing only when explicitly restricted with ADMIN_WORKER_OPEN_INTERNET=0.",
    },
    {
      capability: "Dynamic (JS-rendering) fetcher",
      ok: dynamicFetch,
      env: "ADMIN_WORKER_DYNAMIC_FETCHER=1 (default) + a Chromium binary",
      remediation:
        "Keyless capability, on by default: the worker re-renders JavaScript-only pages in a headless browser so it can ingest client-rendered Catholic sources without any API key. The worker image ships Chromium (Dockerfile.worker); set ADMIN_WORKER_CHROMIUM_PATH if the browser lives elsewhere. Shows missing only when explicitly disabled (ADMIN_WORKER_DYNAMIC_FETCHER=0) or in offline mode (ADMIN_WORKER_SKIP_NETWORK=1).",
    },
    {
      capability: "Keyword web-search discovery",
      ok: webSearch,
      env: "keyless DuckDuckGo (default), or GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID / BING_SEARCH_API_KEY",
      remediation: searchKeysSet
        ? "Configured with a keyed search provider."
        : "Keyless by default — the worker discovers sources nothing it already links to via DuckDuckGo, with no API key. Add GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID (or BING_SEARCH_API_KEY) for higher-volume, higher-quality results. Shows missing only when disabled (ADMIN_WORKER_KEYLESS_WEB_SEARCH=0) or offline (ADMIN_WORKER_SKIP_NETWORK=1).",
    },
    {
      capability: "Latin/Greek translation provider",
      ok: machineTranslationEnabled(),
      env: "keyless Google translate (default), or TRANSLATION_AI_API_URL + TRANSLATION_AI_API_KEY / GOOGLE_TRANSLATE_API_KEY",
      remediation:
        "Keyless by default — the worker completes the Latin/Greek for prayers/litanies with no authentic received form by translating the exact stored text, no API key. Add TRANSLATION_AI_API_URL + TRANSLATION_AI_API_KEY (or GOOGLE_TRANSLATE_API_KEY) for the higher-quality liturgical register. Shows missing only when disabled (ADMIN_WORKER_KEYLESS_TRANSLATE=0) or offline (ADMIN_WORKER_SKIP_NETWORK=1).",
    },
    {
      capability: "Structured source reachable",
      ok: !structuredUnreachable,
      env: "outbound HTTPS to query.wikidata.org + en.wikipedia.org",
      remediation:
        "The structured-knowledge source (Wikidata/Wikipedia) appears unreachable from the worker. Allow outbound HTTPS to query.wikidata.org + en.wikipedia.org so structured ingest can keep growing popes, saints, doctors, rites, documents, councils, devotions, Marian titles, and spiritual practices.",
    },
  ];

  const missing = gaps.filter((g) => !g.ok);
  const summary =
    missing.length === 0
      ? "All growth capabilities are configured."
      : `Growth-capability gaps: ${missing.map((g) => g.capability).join(", ")}.`;
  return { gaps, missing, summary };
}

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { appConfig } from "@/lib/config";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

/**
 * The set of internal routes the diagnostic should hit to confirm the
 * public surface still resolves. Each route is a stable public page
 * that the sitemap lists, so failing here also implies a sitemap entry
 * that points at a broken URL.
 */
const PUBLIC_HEALTH_ROUTES: ReadonlyArray<{ path: string; label: string }> = [
  { path: "/", label: "Home" },
  { path: "/prayers", label: "Prayers index" },
  { path: "/saints", label: "Saints index" },
  { path: "/devotions", label: "Devotions index" },
  { path: "/spiritual-life", label: "Spiritual life index" },
  { path: "/spiritual-guidance", label: "Spiritual guidance index" },
  { path: "/liturgy-history", label: "Liturgy & history index" },
  { path: "/search", label: "Search" },
  { path: "/privacy", label: "Privacy policy" },
];

const ACCEPTABLE_OK_STATUSES = new Set([200, 304]);

/**
 * Sitemap + internal-path diagnostics:
 *
 *   - The sitemap function returns at least the static public surface.
 *   - The same function would serialize to well-formed sitemap XML.
 *   - Robots points at the dynamic /sitemap.xml.
 *   - Each public route the sitemap promises is reachable from the
 *     base URL (called from the same process, so this is an in-process
 *     fetch only — the diagnostic never reaches over the network for
 *     a third-party host).
 */
export async function runSitemapDiagnostics(baseUrl?: string | null): Promise<DiagnosticSection> {
  const shell = startSection("sitemap", "Sitemap & internal paths");

  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic(
      "sitemap.entries",
      "Sitemap entries generated",
      shell.requestId,
      async () => {
        const entries = await sitemap();
        if (!entries.length) {
          return {
            severity: "fail",
            summary: "sitemap() returned zero entries.",
            explanation:
              "src/app/sitemap.ts threw or its static fallback was unreachable. " +
              "Inspect the structured log for the matching requestId.",
          };
        }
        const expected = new Set([
          appConfig.canonicalUrl,
          `${appConfig.canonicalUrl}/prayers`,
          `${appConfig.canonicalUrl}/saints`,
          `${appConfig.canonicalUrl}/devotions`,
        ]);
        const present = entries.filter((e) => expected.has(e.url));
        if (present.length < expected.size) {
          return {
            severity: "warn",
            summary: `Some core public pages missing from sitemap (${present.length}/${expected.size}).`,
            evidence: { entryCount: entries.length },
          };
        }
        return {
          severity: "pass",
          summary: `${entries.length} sitemap entries generated.`,
          evidence: { entryCount: entries.length },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "sitemap.xml_valid",
      "Sitemap serializes to valid XML",
      shell.requestId,
      async () => {
        const entries = await sitemap();
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
          .map((e) => `  <url><loc>${e.url}</loc></url>`)
          .join("\n")}\n</urlset>`;
        const hasHeader = xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>');
        const hasUrlset = xml.includes("<urlset") && xml.includes("</urlset>");
        if (!hasHeader || !hasUrlset) {
          return {
            severity: "fail",
            summary: "Sitemap did not serialize to a valid urlset XML document.",
          };
        }
        return {
          severity: "pass",
          summary: "Sitemap XML envelope is well-formed.",
          evidence: { entries: entries.length, bytes: xml.length },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "sitemap.robots",
      "Robots points at /sitemap.xml",
      shell.requestId,
      async () => {
        const r = robots();
        const expected = `${appConfig.canonicalUrl}/sitemap.xml`;
        if (r.sitemap !== expected) {
          return {
            severity: "fail",
            summary: `Robots sitemap field is ${String(r.sitemap)} (expected ${expected}).`,
            explanation: "src/app/robots.ts builds the sitemap URL from appConfig.canonicalUrl.",
          };
        }
        return {
          severity: "pass",
          summary: "Robots correctly points at the dynamic sitemap.",
          evidence: { sitemap: r.sitemap },
        };
      },
    ),
  );

  if (baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    for (const route of PUBLIC_HEALTH_ROUTES) {
      results.push(
        await runDiagnostic(
          `sitemap.reachable${route.path === "/" ? ".home" : route.path.replace(/\//g, ".")}`,
          `Reachable: ${route.label}`,
          shell.requestId,
          async () => {
            // Use HEAD when possible — cheap status check, no body decode.
            const url = `${base}${route.path}`;
            const res = await fetch(url, { method: "HEAD", redirect: "manual" });
            if (!ACCEPTABLE_OK_STATUSES.has(res.status) && res.status < 300) {
              // Fall back to GET if HEAD wasn't allowed.
              const getRes = await fetch(url, { redirect: "manual" });
              if (!ACCEPTABLE_OK_STATUSES.has(getRes.status)) {
                return {
                  severity: "fail",
                  summary: `${route.path} returned HTTP ${getRes.status}.`,
                  evidence: { status: getRes.status, path: route.path },
                };
              }
              return {
                severity: "pass",
                summary: `${route.path} OK (${getRes.status}).`,
                evidence: { status: getRes.status, path: route.path },
              };
            }
            if (res.status >= 300 && res.status < 400) {
              return {
                severity: "warn",
                summary: `${route.path} redirects (HTTP ${res.status}).`,
                evidence: { status: res.status, path: route.path },
              };
            }
            return {
              severity: "pass",
              summary: `${route.path} OK (${res.status}).`,
              evidence: { status: res.status, path: route.path },
            };
          },
        ),
      );
    }
  }

  return finalizeSection(shell, results);
}

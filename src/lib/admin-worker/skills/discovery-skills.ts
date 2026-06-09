/**
 * Source-discovery skill pack. Real wrappers over the discovery orchestrator
 * and its per-method discovery (sitemap, RSS, configured URLs, directories,
 * internal links, search pages). Discovery is a new-source-trust decision, so
 * these are NOT allowed in safe degraded mode. request_dynamic_fetcher_upgrade
 * files a real developer request when a dynamic fetcher is needed.
 */

import { runDiscoveryOrchestrator } from "../discovery-orchestrator";
import { discoverFromAllAuthorities } from "../sitemap-discovery";
import { discoverFromFeed } from "../rss-discovery";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

function via(ctx: SkillContext): Promise<{ ok: boolean; detail?: string }> {
  return runDiscoveryOrchestrator(ctx.prisma, {
    passId: ctx.passId ?? undefined,
    contentType: ctx.contentType ?? undefined,
  })
    .then((o) => ({ ok: true, detail: `discovery ran (${o.strategies?.length ?? 0} strategies)` }))
    .catch((e) => ({ ok: false, detail: e instanceof Error ? e.message : "discovery failed" }));
}

export const discoverySkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "discover_from_sitemap",
    purpose: "Discover candidate URLs from approved hosts' sitemaps.",
    category: "SOURCE",
    brainOps: ["prioritize"],
    run: async (ctx) => {
      const outcomes = await discoverFromAllAuthorities(ctx.prisma).catch(() => []);
      const inserted = outcomes.reduce((n, o) => n + (o.inserted ?? 0), 0);
      return {
        ok: outcomes.length > 0,
        detail: `${inserted} candidate(s) from ${outcomes.length} host(s)`,
      };
    },
  }),
  makeOpSkill({
    name: "discover_from_rss",
    purpose: "Discover candidate URLs from an approved host's RSS/Atom feed.",
    category: "SOURCE",
    inputs: ["feedUrl"],
    run: async (ctx) => {
      const feedUrl = String((ctx.input as Record<string, unknown>).feedUrl ?? "");
      if (!feedUrl) return { ok: false, detail: "no feedUrl" };
      const o = await discoverFromFeed(ctx.prisma, feedUrl);
      return { ok: o.fetched, detail: o.reason ?? `${o.inserted} inserted` };
    },
  }),
  makeOpSkill({
    name: "discover_from_internal_links",
    purpose: "Discover candidate URLs by following internal links from approved pages.",
    category: "SOURCE",
    run: via,
  }),
  makeOpSkill({
    name: "discover_from_configured_urls",
    purpose: "Discover candidates from the configured fixed URL lists.",
    category: "SOURCE",
    run: via,
  }),
  makeOpSkill({
    name: "discover_from_directory_page",
    purpose: "Discover candidates from approved Catholic content directories.",
    category: "SOURCE",
    run: via,
  }),
  makeOpSkill({
    name: "discover_from_search_page",
    purpose: "Discover candidates from approved-source search pages.",
    category: "SOURCE",
    run: via,
  }),
  makeOpSkill({
    name: "request_dynamic_fetcher_upgrade",
    purpose: "File a developer request for a dynamic (JS-rendering) fetcher when one is needed.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const host = String((ctx.input as Record<string, unknown>).host ?? "an approved host");
      const fingerprint = `missing-skill:dynamic_fetcher:${host}`;
      const req = await ctx.prisma.adminWorkerDeveloperRequest
        .upsert({
          where: { fingerprint },
          create: {
            kind: "capability",
            title: `Dynamic fetcher needed for ${host}`,
            detail: `Static HTML on ${host} has no usable rendered text; a dynamic (headless) fetcher is required to acquire this source.`,
            severity: "high",
            status: "OPEN",
            source: "skill-runtime",
            fingerprint,
            metadata: { host, capability: "dynamic_fetcher" },
          },
          update: { occurrences: { increment: 1 } },
          select: { id: true },
        })
        .catch(() => null);
      return {
        ok: req != null,
        detail: req ? "dynamic-fetcher developer request filed" : "could not file request",
        outputEntityType: "AdminWorkerDeveloperRequest",
        outputEntityId: req?.id ?? null,
      };
    },
  }),
];

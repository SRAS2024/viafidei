/**
 * Schema- and UI-awareness (spec: "Add schema-awareness" + "Add UI-awareness").
 *
 * TypeScript inspects the Prisma schema + the route/page tree (it owns the
 * filesystem); the Python brain analyses the summary and returns findings +
 * developer requests, which TypeScript persists. Recommendations only —
 * schema/UI/code changes always require human review. Throttled + fail-open.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import { analyzeSchema, analyzeUi, isBrainEnabled, resolveBrainRoot } from "./intelligence";
import type { SchemaModelSummary } from "./intelligence";
import { BrainCallContext, recordBrainCall, recordDeveloperRequests } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

import type { PrismaClient } from "@prisma/client";

const _SCALARS = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
  "Decimal",
  "BigInt",
]);

/** Parse the Prisma schema into a per-model summary (fields/relations/indexes). */
export function inspectSchema(root = resolveBrainRoot() ?? process.cwd()): SchemaModelSummary[] {
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  if (!existsSync(schemaPath)) return [];
  let text: string;
  try {
    text = readFileSync(schemaPath, "utf8");
  } catch {
    return [];
  }

  // Collect enum names so enum-typed fields aren't miscounted as relations.
  const enumNames = new Set<string>();
  for (const m of text.matchAll(/^enum\s+(\w+)\s*\{/gm)) enumNames.add(m[1]);

  // Collect model blocks.
  const blocks: Array<{ name: string; lines: string[] }> = [];
  const lines = text.split(/\r?\n/);
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    const open = line.match(/^model\s+(\w+)\s*\{/);
    if (open) {
      current = { name: open[1], lines: [] };
      continue;
    }
    if (current) {
      if (line.trim() === "}") {
        blocks.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
    }
  }
  const modelNames = new Set(blocks.map((b) => b.name));

  return blocks.map((b) => {
    let fields = 0;
    let relations = 0;
    let indexes = 0;
    for (const raw of b.lines) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) {
        if (line.startsWith("@@index") || line.startsWith("@@unique")) indexes += 1;
        continue;
      }
      const field = line.match(/^(\w+)\s+([A-Za-z0-9_]+)(\[\])?\??/);
      if (!field) continue;
      fields += 1;
      const baseType = field[2];
      if (modelNames.has(baseType) && !_SCALARS.has(baseType) && !enumNames.has(baseType)) {
        relations += 1;
      }
    }
    return { name: b.name, fields, relations, indexes };
  });
}

interface UiSummary {
  public_routes: string[];
  admin_pages: string[];
}

/** Scan src/app for public routes + admin pages. */
export function inspectUi(root = resolveBrainRoot() ?? process.cwd()): UiSummary {
  const appDir = path.join(root, "src", "app");
  const skip = new Set(["admin", "api"]);
  const publicRoutes: string[] = [];
  const adminPages: string[] = [];
  try {
    for (const entry of readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith("_") || name.startsWith("(")) continue;
      if (skip.has(name)) continue;
      publicRoutes.push(`/${name}`);
    }
  } catch {
    /* ignore */
  }
  try {
    const adminDir = path.join(appDir, "admin");
    for (const entry of readdirSync(adminDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith("("))
        continue;
      adminPages.push(`/admin/${entry.name}`);
    }
  } catch {
    /* ignore */
  }
  return { public_routes: publicRoutes, admin_pages: adminPages };
}

let _lastSchemaAt = 0;
let _lastUiAt = 0;
const THROTTLE_MS = 6 * 60 * 60 * 1000; // at most ~4×/day

export async function runSchemaAwareness(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<{ ran: boolean; requests: number }> {
  if (!isBrainEnabled() || Date.now() - _lastSchemaAt < THROTTLE_MS)
    return { ran: false, requests: 0 };
  _lastSchemaAt = Date.now();
  try {
    const models = inspectSchema();
    if (models.length === 0) return { ran: false, requests: 0 };
    const env = await analyzeSchema(models);
    await recordBrainCall(prisma, "analyze_schema", env, ctx);
    if (!env || !env.ok || !env.result) return { ran: false, requests: 0 };
    const { created, bumped } = await recordDeveloperRequests(
      prisma,
      env.result.developer_requests,
      "schema_awareness",
    );
    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "CLEANUP",
      severity: "INFO",
      eventName: "schema_awareness",
      message: `Schema analysis: ${env.result.findings.model_count} models; ${created} new + ${bumped} bumped developer request(s).`,
      safeMetadata: { findings: env.result.findings },
    }).catch(() => undefined);
    return { ran: true, requests: created + bumped };
  } catch {
    return { ran: false, requests: 0 };
  }
}

export async function runUiAwareness(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<{ ran: boolean; requests: number }> {
  if (!isBrainEnabled() || Date.now() - _lastUiAt < THROTTLE_MS) return { ran: false, requests: 0 };
  _lastUiAt = Date.now();
  try {
    const ui = inspectUi();
    const goals = await prisma.contentGoal
      .findMany({ select: { contentType: true } })
      .catch(() => [] as Array<{ contentType: string }>);
    const contentTypes = goals.map((g) => g.contentType);
    const env = await analyzeUi({ ...ui, content_types: contentTypes });
    await recordBrainCall(prisma, "analyze_ui", env, ctx);
    if (!env || !env.ok || !env.result) return { ran: false, requests: 0 };
    const { created, bumped } = await recordDeveloperRequests(
      prisma,
      env.result.developer_requests,
      "ui_awareness",
    );
    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "CLEANUP",
      severity: "INFO",
      eventName: "ui_awareness",
      message: `UI analysis: ${ui.public_routes.length} public route(s), ${ui.admin_pages.length} admin page(s); ${created} new + ${bumped} bumped developer request(s).`,
      safeMetadata: { findings: env.result.findings },
    }).catch(() => undefined);
    return { ran: true, requests: created + bumped };
  } catch {
    return { ran: false, requests: 0 };
  }
}

/**
 * Deep CODE awareness now lives in ``self-model.ts`` (``runSelfModelPass``) —
 * the unified self-model that replaced the old summary-only code awareness.
 */

/** For tests: reset the awareness throttles. */
export function resetAwarenessThrottle(): void {
  _lastSchemaAt = 0;
  _lastUiAt = 0;
}

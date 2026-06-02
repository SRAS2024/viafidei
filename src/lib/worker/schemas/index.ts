/**
 * Strict content schemas for the checklist-first worker.
 *
 * Each schema defines what fields a content package MUST contain, what
 * fields are optional, the Catholic-accuracy rules, and the exact build
 * instructions the worker uses when generating that package.
 */

import { z } from "zod";
import type { ChecklistContentType } from "@prisma/client";

import { prayerSchema } from "./prayer";
import { devotionSchema } from "./devotion";
import { saintSchema } from "./saint";
import { marianTitleSchema } from "./marian-title";
import { apparitionSchema } from "./apparition";
import { novenaSchema } from "./novena";
import { sacramentSchema } from "./sacrament";
import { guideSchema } from "./guide";
import { churchDocumentSchema } from "./church-document";
import { liturgicalSchema } from "./liturgical";
import { spiritualPracticeSchema } from "./spiritual-practice";
import { parishSchema } from "./parish";

export interface BuildInstruction {
  /// What this content type represents.
  description: string;
  /// Required Catholic-accuracy guards specific to this type.
  accuracyRules: string[];
  /// Required fields the worker MUST populate.
  requiredFields: string[];
  /// Optional fields the worker SHOULD populate when sources permit.
  optionalFields: string[];
  /// Sources to prefer for this content type (host substrings).
  preferredSourceHosts: string[];
  /// Min citations required before a build can be attempted.
  minCitations: number;
  /// Whether human review is required by default.
  requiresHumanReview: boolean;
}

export interface ContentSchema {
  contentType: ChecklistContentType;
  schema: z.ZodTypeAny;
  instruction: BuildInstruction;
}

/// Master registry of every content schema. The worker dispatches by
/// content type and looks up the schema + instruction here.
export const CONTENT_SCHEMAS: Record<ChecklistContentType, ContentSchema> = {
  PRAYER: prayerSchema,
  DEVOTION: devotionSchema,
  SAINT: saintSchema,
  MARIAN_TITLE: marianTitleSchema,
  APPARITION: apparitionSchema,
  NOVENA: novenaSchema,
  SACRAMENT: sacramentSchema,
  GUIDE: guideSchema,
  CHURCH_DOCUMENT: churchDocumentSchema,
  LITURGICAL: liturgicalSchema,
  SPIRITUAL_PRACTICE: spiritualPracticeSchema,
  PARISH: parishSchema,
};

export function getContentSchema(contentType: ChecklistContentType): ContentSchema {
  const schema = CONTENT_SCHEMAS[contentType];
  if (!schema) {
    throw new Error(`No content schema registered for type ${contentType}`);
  }
  return schema;
}

export function validatePayload(
  contentType: ChecklistContentType,
  payload: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] } {
  const schema = getContentSchema(contentType);
  const result = schema.schema.safeParse(payload);
  if (result.success) {
    return { ok: true, data: result.data as Record<string, unknown> };
  }
  return {
    ok: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

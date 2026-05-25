/**
 * AdminWorkerSourceRead helpers (spec §6). Durable extracted text per
 * (sourceUrl, checksum). Reuses an existing read when the checksum
 * has not changed; refetches when the checksum changes.
 */

import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface UpsertSourceReadInput {
  sourceUrl: string;
  sourceHost: string;
  rawBody: string;
  extractedTitle?: string | null;
  extractedText?: string | null;
  extractedHeadings?: Prisma.InputJsonValue;
  detectedContentType?: string | null;
  confidenceScore?: number;
  rejectedSections?: Prisma.InputJsonValue;
  fetchStatus?: number;
  etag?: string;
  lastModifiedHeader?: string;
}

/**
 * Hash the raw body so subsequent reads can short-circuit when the
 * page has not changed.
 */
export function checksumOf(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

/**
 * Try to find an existing read for (sourceUrl, checksum). Returns the
 * existing row when checksum matches — the caller can skip re-extraction.
 */
export async function findExistingRead(prisma: PrismaClient, sourceUrl: string, checksum: string) {
  return prisma.adminWorkerSourceRead.findUnique({
    where: { sourceUrl_checksum: { sourceUrl, checksum } },
  });
}

export async function upsertSourceRead(
  prisma: PrismaClient,
  input: UpsertSourceReadInput,
): Promise<{ id: string; checksum: string; reused: boolean }> {
  const checksum = checksumOf(input.rawBody);
  const existing = await findExistingRead(prisma, input.sourceUrl, checksum);
  if (existing) {
    return { id: existing.id, checksum, reused: true };
  }
  const row = await prisma.adminWorkerSourceRead.create({
    data: {
      sourceUrl: input.sourceUrl,
      sourceHost: input.sourceHost,
      checksum,
      extractedTitle: input.extractedTitle ?? null,
      extractedText: input.extractedText ?? null,
      extractedHeadings: input.extractedHeadings,
      detectedContentType: input.detectedContentType ?? null,
      confidenceScore: input.confidenceScore ?? 0,
      rejectedSections: input.rejectedSections,
      fetchStatus: input.fetchStatus,
      etag: input.etag,
      lastModifiedHeader: input.lastModifiedHeader,
      byteSize: Buffer.byteLength(input.rawBody, "utf8"),
    },
    select: { id: true, checksum: true },
  });
  return { id: row.id, checksum: row.checksum, reused: false };
}

export async function listRecentReads(
  prisma: PrismaClient,
  opts: { host?: string; limit?: number } = {},
) {
  return prisma.adminWorkerSourceRead.findMany({
    where: opts.host ? { sourceHost: opts.host } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
}

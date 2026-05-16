/**
 * Per-source cursor — remember exactly where each adapter / content
 * type / feed last stopped. Used by long-running ingestion of large
 * catalogs (parishes, saints) so a worker restart or crash resumes
 * from the last successful checkpoint instead of starting over.
 *
 * Cursor identity is (adapterKey, cursorKey). The cursorKey is
 * adapter-defined: a page number, a feed URL, a paginated API
 * endpoint, etc. The metadata column carries adapter-specific
 * payload such as the last item id.
 */

import { prisma } from "../db/client";

export type CursorRow = {
  id: string;
  sourceId: string | null;
  adapterKey: string;
  contentType: string | null;
  cursorKey: string;
  lastPosition: string | null;
  lastItemSlug: string | null;
  lastFetchedAt: Date | null;
  itemsProcessed: number;
  completed: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToCursor(row: {
  id: string;
  sourceId: string | null;
  adapterKey: string;
  contentType: string | null;
  cursorKey: string;
  lastPosition: string | null;
  lastItemSlug: string | null;
  lastFetchedAt: Date | null;
  itemsProcessed: number;
  completed: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CursorRow {
  return {
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function getCursor(adapterKey: string, cursorKey: string): Promise<CursorRow | null> {
  const row = await prisma.ingestionCursor.findUnique({
    where: {
      adapterKey_cursorKey: { adapterKey, cursorKey },
    },
  });
  return row ? rowToCursor(row) : null;
}

export type SaveCursorInput = {
  adapterKey: string;
  cursorKey: string;
  sourceId?: string | null;
  contentType?: string | null;
  lastPosition?: string | null;
  lastItemSlug?: string | null;
  itemsProcessed?: number;
  completed?: boolean;
  metadata?: Record<string, unknown>;
};

export async function saveCursor(input: SaveCursorInput): Promise<CursorRow> {
  const now = new Date();
  const upserted = await prisma.ingestionCursor.upsert({
    where: {
      adapterKey_cursorKey: { adapterKey: input.adapterKey, cursorKey: input.cursorKey },
    },
    create: {
      adapterKey: input.adapterKey,
      cursorKey: input.cursorKey,
      sourceId: input.sourceId ?? null,
      contentType: input.contentType ?? null,
      lastPosition: input.lastPosition ?? null,
      lastItemSlug: input.lastItemSlug ?? null,
      itemsProcessed: input.itemsProcessed ?? 0,
      completed: input.completed ?? false,
      metadata: (input.metadata as never) ?? undefined,
      lastFetchedAt: now,
    },
    update: {
      sourceId: input.sourceId ?? undefined,
      contentType: input.contentType ?? undefined,
      lastPosition: input.lastPosition ?? undefined,
      lastItemSlug: input.lastItemSlug ?? undefined,
      itemsProcessed: input.itemsProcessed ?? undefined,
      completed: input.completed ?? undefined,
      metadata: (input.metadata as never) ?? undefined,
      lastFetchedAt: now,
    },
  });
  return rowToCursor(upserted);
}

export async function resetCursor(adapterKey: string, cursorKey: string): Promise<void> {
  await prisma.ingestionCursor.deleteMany({
    where: { adapterKey, cursorKey },
  });
}

export async function listCursorsForSource(sourceId: string): Promise<CursorRow[]> {
  const rows = await prisma.ingestionCursor.findMany({
    where: { sourceId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(rowToCursor);
}

export async function listCursorsForAdapter(adapterKey: string): Promise<CursorRow[]> {
  const rows = await prisma.ingestionCursor.findMany({
    where: { adapterKey },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(rowToCursor);
}

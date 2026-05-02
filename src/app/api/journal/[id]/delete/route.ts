import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteJournalEntry } from "@/lib/data/journal";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const result = await deleteJournalEntry(params.id, user.id);
  if (!result.ok) {
    logger.warn("journal.delete.denied", {
      reason: result.reason,
      userId: user.id,
      entryId: params.id,
      requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
    });
  }
  return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
}

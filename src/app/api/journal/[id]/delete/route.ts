import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteJournalEntry } from "@/lib/data/journal";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  await deleteJournalEntry(params.id, user.id);
  return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
}

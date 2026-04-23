import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  await prisma.journalEntry.deleteMany({ where: { id: params.id, userId: user.id } });
  return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
}

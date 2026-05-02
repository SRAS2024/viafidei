import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEALTH_TIMEOUT_MS = 2000;

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const ping = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db ping timeout")), HEALTH_TIMEOUT_MS),
    );
    await Promise.race([ping, timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function GET() {
  const db = await checkDatabase();
  const status = db.ok ? "ok" : "degraded";
  const httpStatus = db.ok ? 200 : 503;
  return NextResponse.json(
    {
      status,
      service: "viafidei-web",
      timestamp: Date.now(),
      checks: { database: db },
    },
    { status: httpStatus },
  );
}

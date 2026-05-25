import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function runCleanup(now: Date) {
  const buildJobCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [
    expiredPasswordResetTokens,
    expiredEmailVerificationTokens,
    expiredSessions,
    expiredRateLimitBuckets,
    staleBuildJobs,
  ] = await Promise.all([
    prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: now } },
    }),
    prisma.workerBuildJob.deleteMany({
      where: {
        finishedAt: { lt: buildJobCutoff },
        status: { in: ["succeeded", "failed", "cancelled"] },
      },
    }),
  ]);

  return {
    expiredPasswordResetTokens: expiredPasswordResetTokens.count,
    expiredEmailVerificationTokens: expiredEmailVerificationTokens.count,
    expiredSessions: expiredSessions.count,
    expiredRateLimitBuckets: expiredRateLimitBuckets.count,
    staleBuildJobs: staleBuildJobs.count,
  };
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorizedCron(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await runCleanup(now);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    return NextResponse.json({
      ok: true,
      deleted: total,
      breakdown: result,
      cleanedAt: now.toISOString(),
    });
  } catch (error: unknown) {
    console.error("Cleanup failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorizedCron(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const buildJobCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [passwordResets, emailVerifications, sessions, rateLimits, oldBuildJobs] =
    await Promise.all([
      prisma.passwordResetToken.count({ where: { expiresAt: { lt: now } } }),
      prisma.emailVerificationToken.count({ where: { expiresAt: { lt: now } } }),
      prisma.session.count({ where: { expiresAt: { lt: now } } }),
      prisma.rateLimitBucket.count({ where: { resetAt: { lt: now } } }),
      prisma.workerBuildJob.count({
        where: {
          finishedAt: { lt: buildJobCutoff },
          status: { in: ["succeeded", "failed", "cancelled"] },
        },
      }),
    ]);

  return NextResponse.json({
    stale: {
      expiredPasswordResetTokens: passwordResets,
      expiredEmailVerificationTokens: emailVerifications,
      expiredSessions: sessions,
      expiredRateLimitBuckets: rateLimits,
      staleBuildJobs: oldBuildJobs,
    },
    checkedAt: now.toISOString(),
  });
}

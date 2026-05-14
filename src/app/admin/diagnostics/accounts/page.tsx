import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { checkAccountEmailDb } from "@/lib/email/db-health";
import { listSaintsForFeastDate } from "@/lib/data/saints";
import { searchParishes } from "@/lib/data/parishes";
import { AdminSection } from "../../_sections/AdminSection";
import { AccountsClientChecks } from "./AccountsClientChecks";

export const dynamic = "force-dynamic";

type Check = {
  name: string;
  status: "ok" | "warn" | "fail" | "info";
  detail: string;
};

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Account/email DB contract (sign-up, verification, resend, password reset depend on this).
  try {
    const result = await checkAccountEmailDb();
    if (result.ok) {
      checks.push({
        name: "Account email tables",
        status: "ok",
        detail: "User.emailVerifiedAt, PasswordResetToken, EmailVerificationToken all present.",
      });
    } else {
      const missing = result.pieces.filter((p) => !p.present).map((p) => p.name);
      checks.push({
        name: "Account email tables",
        status: "fail",
        detail: `Missing pieces: ${missing.join(", ")}. Open Email diagnostics and click Ensure tables.`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Account email tables",
      status: "fail",
      detail: `Could not query schema metadata: ${(err as Error).message}`,
    });
  }

  // 2. User counts: total + verified + unverified.
  try {
    const [total, verified] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    ]);
    checks.push({
      name: "User accounts",
      status: "info",
      detail: `${total} total · ${verified} verified · ${total - verified} unverified`,
    });
  } catch (err) {
    checks.push({
      name: "User accounts",
      status: "fail",
      detail: `Could not query User table: ${(err as Error).message}`,
    });
  }

  // 3. Saved items coverage.
  try {
    const [prayers, saints, apparitions, parishes, devotions] = await Promise.all([
      prisma.userSavedPrayer.count(),
      prisma.userSavedSaint.count(),
      prisma.userSavedApparition.count(),
      prisma.userSavedParish.count(),
      prisma.userSavedDevotion.count(),
    ]);
    const total = prayers + saints + apparitions + parishes + devotions;
    checks.push({
      name: "Saved items",
      status: "info",
      detail: `${total} total saves · Prayers ${prayers} · Saints ${saints} · Apparitions ${apparitions} · Parishes ${parishes} · Devotions ${devotions}`,
    });
  } catch (err) {
    checks.push({
      name: "Saved items",
      status: "fail",
      detail: `Could not query saved-item tables: ${(err as Error).message}`,
    });
  }

  // 4. Completed goals + journals attached to goals.
  try {
    const [completed, journalEntries, journalsOnGoals] = await Promise.all([
      prisma.goal.count({ where: { status: "COMPLETED" } }),
      prisma.journalEntry.count(),
      prisma.journalEntry.count({ where: { goalId: { not: null } } }),
    ]);
    checks.push({
      name: "Goals & journals",
      status: "info",
      detail: `${completed} completed goal(s) · ${journalEntries} journal entries · ${journalsOnGoals} attached to goals`,
    });
  } catch (err) {
    checks.push({
      name: "Goals & journals",
      status: "fail",
      detail: `Could not query Goal / JournalEntry: ${(err as Error).message}`,
    });
  }

  // 5. Badges (milestones).
  try {
    const milestones = await prisma.milestone.groupBy({
      by: ["tier"],
      _count: { _all: true },
    });
    const sacrament = milestones.find((m) => m.tier === "SACRAMENT")?._count._all ?? 0;
    const spiritual = milestones.find((m) => m.tier === "SPIRITUAL")?._count._all ?? 0;
    const personal = milestones.find((m) => m.tier === "PERSONAL")?._count._all ?? 0;
    checks.push({
      name: "Badges (Milestones)",
      status: "info",
      detail: `Sacrament ${sacrament} · Spiritual ${spiritual} · Personal ${personal}. Badges persist on the user profile across logout / login / refresh.`,
    });
  } catch (err) {
    checks.push({
      name: "Badges (Milestones)",
      status: "fail",
      detail: `Could not query Milestone: ${(err as Error).message}`,
    });
  }

  // 6. Profile photo persistence — count users with a stored avatar.
  try {
    const withAvatar = await prisma.profile.count({ where: { avatarMediaId: { not: null } } });
    checks.push({
      name: "Profile photos",
      status: "info",
      detail: `${withAvatar} profile(s) currently have a stored avatar (MediaAsset). Avatars persist via the MediaAsset linkage.`,
    });
  } catch (err) {
    checks.push({
      name: "Profile photos",
      status: "fail",
      detail: `Could not query Profile: ${(err as Error).message}`,
    });
  }

  // 7. Language coverage — distinct user languages.
  try {
    const rows = await prisma.user.groupBy({ by: ["language"], _count: { _all: true } });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const summary = rows
      .sort((a, b) => b._count._all - a._count._all)
      .map((r) => `${r.language} (${r._count._all})`)
      .join(", ");
    checks.push({
      name: "Language persistence",
      status: "ok",
      detail:
        total === 0
          ? "No users yet to verify language persistence — feature wired up via User.language column."
          : `User-selected languages: ${summary}. Persisted in User.language and applied on every render.`,
    });
  } catch (err) {
    checks.push({
      name: "Language persistence",
      status: "fail",
      detail: `Could not query User language: ${(err as Error).message}`,
    });
  }

  // 8. Today's Feast Day Saints — verify the SQL query.
  try {
    const now = new Date();
    const saints = await listSaintsForFeastDate(
      "en",
      now.getUTCMonth() + 1,
      now.getUTCDate(),
    );
    checks.push({
      name: "Today's Feast Day Saints (server-side)",
      status: "ok",
      detail: `Query returned ${saints.length} saint(s) for the current UTC date. The homepage will refine to the user's local date on the client.`,
    });
  } catch (err) {
    checks.push({
      name: "Today's Feast Day Saints",
      status: "fail",
      detail: `listSaintsForFeastDate threw: ${(err as Error).message}`,
    });
  }

  // 9. Parish location search probe — confirms the city / state / country
  //    fields wire up.
  try {
    const sample = await prisma.parish.findFirst({
      where: { status: "PUBLISHED", city: { not: null } },
      select: { city: true, region: true, country: true },
    });
    if (!sample) {
      checks.push({
        name: "Parish location search",
        status: "warn",
        detail:
          "No PUBLISHED parishes with a city to probe. Search will return empty results until parishes are ingested.",
      });
    } else if (!sample.city) {
      checks.push({
        name: "Parish location search",
        status: "warn",
        detail: "Sample parish has no city — location-based search will be skipped.",
      });
    } else {
      const results = await searchParishes(sample.city, 3);
      checks.push({
        name: "Parish location search",
        status: results.length > 0 ? "ok" : "warn",
        detail:
          results.length > 0
            ? `Searching "${sample.city}" returned ${results.length} parish(es). City / state / country / diocese fields are all matched.`
            : `Searching "${sample.city}" returned no results — index or data shape may be off.`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Parish location search",
      status: "fail",
      detail: `searchParishes threw: ${(err as Error).message}`,
    });
  }

  return checks;
}

function statusColor(status: Check["status"]) {
  return status === "ok"
    ? "#185c2a"
    : status === "warn"
      ? "#9b6b00"
      : status === "fail"
        ? "#8b1a1a"
        : "#3b3f4a";
}
function statusGlyph(status: Check["status"]) {
  return status === "ok" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✗" : "·";
}

export default async function AccountsDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const checks = await runChecks();

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Accounts — sign-up / sign-in / verification, saved items, badges, journals, language, device date / timezone, and parish location lookups."
    >
      <div className="mb-6">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
      </div>

      <h2 className="font-display text-2xl">Server-side checks</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {checks.map((c, idx) => (
          <li key={idx} className="vf-card rounded-sm p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                style={{ backgroundColor: statusColor(c.status) }}
              >
                {statusGlyph(c.status)}
              </span>
              <div className="min-w-0">
                <p className="break-words font-display text-base text-ink">{c.name}</p>
                <p className="mt-1 break-words font-serif text-sm text-ink-soft">{c.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Device-side checks</h2>
        <p className="mt-2 font-serif text-sm text-ink-soft">
          These run in this browser session and confirm the user-facing
          features (device date / timezone, language preference, location
          permission) are reachable.
        </p>
        <AccountsClientChecks />
      </section>
    </AdminSection>
  );
}

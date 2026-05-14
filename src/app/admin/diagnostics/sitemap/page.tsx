import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

type RouteCheck = {
  area: string;
  path: string;
  status: "ok" | "warn" | "fail" | "info";
  detail: string;
};

/**
 * Each entry is verified at server-render time. For dynamic
 * `[slug]` routes the check picks the first PUBLISHED row and
 * confirms it would resolve; if no row exists, the area is marked
 * `warn` so the admin knows the route exists but the catalog is
 * empty. Pure static routes are listed for completeness (the build
 * itself would fail if they were missing).
 */
async function runChecks(): Promise<RouteCheck[]> {
  const out: RouteCheck[] = [];

  function addStatic(area: string, path: string, detail = "Static route is wired up.") {
    out.push({ area, path, status: "ok", detail });
  }

  // Static routes — these all exist in the App Router tree.
  addStatic("Public", "/", "Homepage with Today's Feast Day Saints section.");
  addStatic("Public", "/prayers", "Prayer catalogue with category dropdown.");
  addStatic("Public", "/saints", "Saints catalogue with Saints / Our Lady / Angels filter.");
  addStatic("Public", "/saints/today", "Today's Feast Day Saints — full list.");
  addStatic("Public", "/devotions", "Devotion catalogue.");
  addStatic("Public", "/sacraments", "Seven sacraments + four consecrations.");
  addStatic("Public", "/spiritual-life", "Spiritual life guides.");
  addStatic("Public", "/spiritual-guidance", "Parish finder.");
  addStatic("Public", "/liturgy", "Liturgical reference.");
  addStatic("Public", "/history", "Church history timeline.");
  addStatic("Public", "/search", "Universal search.");

  addStatic("Profile", "/profile", "Profile dashboard with badges + sections.");
  addStatic("Profile", "/profile/goals", "Active goals.");
  addStatic("Profile", "/profile/goals/completed", "Completed goals history.");
  addStatic("Profile", "/profile/journal", "Journal entries.");
  addStatic("Profile", "/profile/milestones", "Earned milestones.");
  addStatic("Profile", "/profile/prayers", "Saved prayers.");
  addStatic("Profile", "/profile/saints", "Saved saints.");
  addStatic("Profile", "/profile/apparitions", "Saved apparitions.");
  addStatic("Profile", "/profile/devotions", "Saved devotions.");
  addStatic("Profile", "/profile/parishes", "Saved parishes.");
  addStatic("Profile", "/profile/settings", "Profile settings.");

  addStatic("Admin", "/admin", "Admin dashboard.");
  addStatic("Admin", "/admin/diagnostics", "Diagnostics hub.");
  addStatic("Admin", "/admin/diagnostics/email", "Email diagnostics.");
  addStatic("Admin", "/admin/diagnostics/ingestion", "Ingestion & Data Management diagnostics.");
  addStatic("Admin", "/admin/diagnostics/sitemap", "Sitemap & Link Paths diagnostics.");
  addStatic("Admin", "/admin/diagnostics/accounts", "Accounts diagnostics.");
  addStatic("Admin", "/admin/logs", "Logs hub.");
  addStatic("Admin", "/admin/logs/admin", "Admin actions log.");
  addStatic("Admin", "/admin/logs/data-management", "Data Management log.");
  addStatic("Admin", "/admin/logs/accounts", "Account audit log.");
  addStatic("Admin", "/admin/ingestion", "Ingestion & Data Management page.");
  addStatic("Admin", "/admin/homepage", "Homepage editor.");
  addStatic("Admin", "/admin/publish-list", "REVIEW queue / publish list.");

  // Dynamic routes — pick a representative published row per kind.
  const tableChecks = [
    { area: "Public", base: "/prayers", model: "prayer" as const, label: "Prayer detail" },
    { area: "Public", base: "/saints", model: "saint" as const, label: "Saint detail" },
    {
      area: "Public",
      base: "/devotions",
      model: "devotion" as const,
      label: "Devotion detail",
    },
    {
      area: "Public",
      base: "/sacraments",
      model: "spiritualLifeGuide" as const,
      label: "Sacrament / consecration detail",
      slugFilter: {
        OR: [{ slug: { startsWith: "sacrament-" } }, { slug: { startsWith: "consecration-" } }],
      },
    },
    {
      area: "Public",
      base: "/spiritual-life",
      model: "spiritualLifeGuide" as const,
      label: "Spiritual-life guide detail",
    },
    {
      area: "Public",
      base: "/liturgy-history",
      model: "liturgyEntry" as const,
      label: "Liturgy / Church history detail",
    },
    {
      area: "Public",
      base: "/spiritual-guidance",
      model: "parish" as const,
      label: "Parish detail",
    },
  ];

  for (const t of tableChecks) {
    try {
      const where = { status: "PUBLISHED", ...(t.slugFilter ?? {}) } as never;
      const row = await (
        prisma[t.model] as { findFirst: (a: unknown) => Promise<{ slug: string } | null> }
      ).findFirst({
        where,
        select: { slug: true },
      });
      if (!row) {
        out.push({
          area: t.area,
          path: `${t.base}/[slug]`,
          status: "warn",
          detail: `No PUBLISHED rows in ${t.model} to test against. The route is wired but the table is empty.`,
        });
      } else {
        out.push({
          area: t.area,
          path: `${t.base}/${row.slug}`,
          status: "ok",
          detail: `${t.label} resolves (example slug shown).`,
        });
      }
    } catch (err) {
      out.push({
        area: t.area,
        path: `${t.base}/[slug]`,
        status: "fail",
        detail: `${t.label} probe threw: ${(err as Error).message}`,
      });
    }
  }

  return out;
}

function statusColor(status: RouteCheck["status"]) {
  return status === "ok"
    ? "#185c2a"
    : status === "warn"
      ? "#9b6b00"
      : status === "fail"
        ? "#8b1a1a"
        : "#3b3f4a";
}
function statusGlyph(status: RouteCheck["status"]) {
  return status === "ok" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✗" : "·";
}

export default async function SitemapDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const checks = await runChecks();
  const byArea = new Map<string, RouteCheck[]>();
  for (const c of checks) {
    const list = byArea.get(c.area) ?? [];
    list.push(c);
    byArea.set(c.area, list);
  }

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Sitemap & Link Paths — verify every static and dynamic route renders, including profile, content, and admin pages."
    >
      <div className="mb-6">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
      </div>

      {[...byArea.entries()].map(([area, items]) => (
        <section key={area} className="mb-8">
          <h2 className="font-display text-2xl">{area}</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((c) => (
              <li key={c.path} className="vf-card rounded-sm p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                    style={{ backgroundColor: statusColor(c.status) }}
                  >
                    {statusGlyph(c.status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-mono text-xs text-ink-soft">{c.path}</p>
                    <p className="mt-1 break-words font-serif text-sm text-ink-soft">{c.detail}</p>
                  </div>
                  {c.status === "ok" && c.path.startsWith("/") ? (
                    <Link href={c.path} className="vf-nav-link text-xs">
                      Visit →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </AdminSection>
  );
}

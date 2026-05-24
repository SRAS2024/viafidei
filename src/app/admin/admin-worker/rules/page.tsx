import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { listRules, type RuleCategory } from "@/lib/admin-worker";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  source_selection: "Source selection",
  content_extraction: "Content extraction",
  content_type_classification: "Content type classification",
  content_package_formatting: "Content package formatting",
  catholic_correctness: "Catholic correctness",
  cross_source_validation: "Cross-source validation",
  publish: "Publishing",
  deletion: "Deletion",
  homepage_design: "Homepage design",
  security: "Security",
  report: "Reporting",
};

/**
 * Visible rule catalogue. Spec section 4 requires the rule engine to
 * be "visible in admin" — this page lists every registered rule,
 * grouped by category, with its version + description.
 */
export default async function AdminWorkerRulesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const all = listRules();
  const byCategory = new Map<RuleCategory, Array<(typeof all)[number]>>();
  for (const rule of all) {
    const list = byCategory.get(rule.category) ?? [];
    list.push(rule);
    byCategory.set(rule.category, list);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin Worker · Rule catalogue</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Every deterministic rule the Admin Worker uses. Rules are versioned and testable; this
            page renders them in the order they were registered.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-indigo-600 underline" href="/admin/admin-worker">
            ← Command Center
          </Link>
        </div>
      </header>

      <p className="text-sm text-ink-soft">
        Total rules: <span className="font-mono">{all.length}</span>
      </p>

      {(Object.keys(CATEGORY_LABELS) as RuleCategory[]).map((category) => {
        const rules = byCategory.get(category) ?? [];
        if (rules.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="font-display text-2xl text-ink">{CATEGORY_LABELS[category]}</h2>
            <p className="mb-2 text-xs italic text-ink-soft">
              {rules.length} rule{rules.length === 1 ? "" : "s"} in this category.
            </p>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded border border-slate-200 bg-white p-3 text-sm shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-base">{rule.id}</span>
                    <span className="text-xs uppercase tracking-wide text-ink-soft">
                      v{rule.version}
                    </span>
                  </div>
                  <p className="mt-1 font-serif">{rule.description}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

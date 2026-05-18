import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getContentReceipt } from "@/lib/diagnostics/content-receipt";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin content receipt panel.
 *
 * Reads `?contentType=...&slug=...` from the URL and renders the
 * 8 spec-listed answers: why it exists, which builder created it,
 * which contract it passed, which source supplied each field,
 * when it became public, whether it counts toward threshold,
 * whether it has ever been updated, whether it has ever failed QA.
 */
export default async function ContentReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ contentType?: string; slug?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const sp = await searchParams;
  const contentType = sp.contentType ?? "";
  const slug = sp.slug ?? "";
  if (!contentType || !slug) {
    return (
      <AdminSection
        titleKey="admin.contentReceipt.title"
        subtitle="Provide ?contentType=...&slug=... to view a content receipt"
      >
        <form
          method="GET"
          className="mx-auto max-w-2xl space-y-3 rounded-2xl border border-ink/10 bg-paper p-6"
        >
          <label className="block">
            <span className="block font-serif text-sm text-ink-soft">Content type</span>
            <input
              name="contentType"
              className="vf-input mt-1 w-full"
              placeholder="Prayer / Saint / Devotion / ..."
              required
            />
          </label>
          <label className="block">
            <span className="block font-serif text-sm text-ink-soft">Slug</span>
            <input name="slug" className="vf-input mt-1 w-full" placeholder="our-father" required />
          </label>
          <button type="submit" className="vf-button-primary w-full">
            Look up receipt
          </button>
        </form>
      </AdminSection>
    );
  }
  const receipt = await getContentReceipt({ contentType, slug }).catch(() => null);
  return (
    <AdminSection titleKey="admin.contentReceipt.title" subtitle={`${contentType} · ${slug}`}>
      {!receipt ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-serif text-red-900">Could not load receipt.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4" data-testid="content-receipt">
          <div className="rounded-2xl border border-ink/10 bg-paper p-5">
            <h2 className="font-serif text-lg font-semibold">Public row</h2>
            {receipt.publicRow ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
                <dt className="text-ink-faint">title</dt>
                <dd>{receipt.publicRow.title}</dd>
                <dt className="text-ink-faint">status</dt>
                <dd>{receipt.publicRow.status}</dd>
                <dt className="text-ink-faint">publicRenderReady</dt>
                <dd>{String(receipt.publicRow.publicRenderReady)}</dd>
                <dt className="text-ink-faint">isThresholdEligible</dt>
                <dd>{String(receipt.publicRow.isThresholdEligible)}</dd>
                <dt className="text-ink-faint">packageValidationStatus</dt>
                <dd>{receipt.publicRow.packageValidationStatus ?? "—"}</dd>
                <dt className="text-ink-faint">contentPackageVersion</dt>
                <dd>{receipt.publicRow.contentPackageVersion ?? "—"}</dd>
                <dt className="text-ink-faint">sourceUrl</dt>
                <dd className="break-all">{receipt.publicRow.sourceUrl ?? "—"}</dd>
                <dt className="text-ink-faint">sourceHost</dt>
                <dd>{receipt.publicRow.sourceHost ?? "—"}</dd>
                <dt className="text-ink-faint">contentChecksum</dt>
                <dd className="break-all">{receipt.publicRow.contentChecksum ?? "—"}</dd>
                <dt className="text-ink-faint">created</dt>
                <dd>{receipt.publicRow.createdAt.toISOString()}</dd>
                <dt className="text-ink-faint">updated</dt>
                <dd>{receipt.publicRow.updatedAt.toISOString()}</dd>
              </dl>
            ) : (
              <p className="mt-2 font-serif text-ink-soft">No public row found for this slug.</p>
            )}
          </div>
          <div className="rounded-2xl border border-ink/10 bg-paper p-5">
            <h2 className="font-serif text-lg font-semibold">Derived answers</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
              <dt className="text-ink-faint">builder</dt>
              <dd>
                {receipt.derived.builderName ?? "—"}
                {receipt.derived.builderVersion ? ` @ ${receipt.derived.builderVersion}` : ""}
              </dd>
              <dt className="text-ink-faint">contract</dt>
              <dd>{receipt.derived.contractName ?? "—"}</dd>
              <dt className="text-ink-faint">becamePublicAt</dt>
              <dd>{receipt.derived.becamePublicAt?.toISOString() ?? "—"}</dd>
              <dt className="text-ink-faint">countsTowardThreshold</dt>
              <dd>{String(receipt.derived.countsTowardThreshold)}</dd>
              <dt className="text-ink-faint">everUpdated</dt>
              <dd>{String(receipt.derived.everUpdated)}</dd>
              <dt className="text-ink-faint">everFailedQA</dt>
              <dd>{String(receipt.derived.everFailedQA)}</dd>
            </dl>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-paper p-5">
            <h2 className="font-serif text-lg font-semibold">Source document</h2>
            {receipt.sourceDocument ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
                <dt className="text-ink-faint">id</dt>
                <dd className="break-all">{receipt.sourceDocument.id}</dd>
                <dt className="text-ink-faint">sourceUrl</dt>
                <dd className="break-all">{receipt.sourceDocument.sourceUrl}</dd>
                <dt className="text-ink-faint">fetchedAt</dt>
                <dd>{receipt.sourceDocument.fetchedAt.toISOString()}</dd>
              </dl>
            ) : (
              <p className="mt-2 font-serif text-ink-soft">No source document recorded.</p>
            )}
          </div>
          <div className="rounded-2xl border border-ink/10 bg-paper p-5">
            <h2 className="font-serif text-lg font-semibold">
              Build log ({receipt.buildLog.length})
            </h2>
            {receipt.buildLog.length === 0 ? (
              <p className="mt-2 font-serif text-ink-soft">No build attempts recorded.</p>
            ) : (
              <table className="mt-2 w-full font-mono text-xs">
                <thead>
                  <tr className="text-left text-ink-faint">
                    <th className="pr-3">when</th>
                    <th className="pr-3">builder</th>
                    <th className="pr-3">status</th>
                    <th className="pr-3">reason</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.buildLog.map((b) => (
                    <tr key={b.id} className="border-t border-ink/5">
                      <td className="pr-3">{b.createdAt.toISOString()}</td>
                      <td className="pr-3">
                        {b.builderName}@{b.builderVersion}
                      </td>
                      <td className="pr-3">{b.buildStatus}</td>
                      <td className="pr-3">{b.failureReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {receipt.qaRejections.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-serif text-lg font-semibold text-amber-900">
                QA rejections ({receipt.qaRejections.length})
              </h2>
              <table className="mt-2 w-full font-mono text-xs">
                <thead>
                  <tr className="text-left text-amber-900">
                    <th className="pr-3">when</th>
                    <th className="pr-3">decision</th>
                    <th className="pr-3">reason</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.qaRejections.map((r) => (
                    <tr key={r.id} className="border-t border-amber-200">
                      <td className="pr-3">{r.createdAt.toISOString()}</td>
                      <td className="pr-3">{r.decision}</td>
                      <td className="pr-3">{r.rejectionReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}

import Link from "next/link";

export default function LiturgyNotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <p className="vf-eyebrow">404</p>
      <h1 className="font-display text-4xl">Entry not found</h1>
      <p className="font-serif text-ink-faint">
        This entry may have been removed or the link is incorrect.
      </p>
      <Link href="/liturgy-history" className="vf-btn vf-btn-ghost">
        ← Back to Liturgy &amp; History
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function PrayerNotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <p className="vf-eyebrow">404</p>
      <h1 className="font-display text-4xl">Prayer not found</h1>
      <p className="font-serif text-ink-faint">
        This prayer may have been removed or the link is incorrect.
      </p>
      <Link href="/prayers" className="vf-btn vf-btn-ghost">
        ← Back to prayers
      </Link>
    </div>
  );
}

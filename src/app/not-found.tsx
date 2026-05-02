import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="vf-wordmark text-2xl text-ink">Page not found</h1>
      <p className="mt-4 text-sm text-ink/70">The page you are looking for could not be found.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="rounded-full bg-ink px-5 py-2 text-sm text-paper hover:bg-ink/90">
          Return home
        </Link>
      </div>
    </div>
  );
}

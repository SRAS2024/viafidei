import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="vf-message">
      <PageHero
        title="Page not found"
        subtitle="The page you are looking for could not be found."
      />
      <Link href="/" className="vf-btn vf-btn-primary">
        Return home
      </Link>
    </div>
  );
}

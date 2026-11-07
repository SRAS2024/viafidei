import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function OurLadyNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Not found"
        subtitle="This page may have been removed or the link is incorrect."
      />
      <Link href="/our-lady" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Our Lady
      </Link>
    </div>
  );
}

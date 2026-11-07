import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function ParishNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Parish not found"
        subtitle="This parish may have been removed or the link is incorrect."
      />
      <Link href="/parishes" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Parishes
      </Link>
    </div>
  );
}

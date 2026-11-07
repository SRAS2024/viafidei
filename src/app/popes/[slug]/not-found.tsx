import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function PopeNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Pope not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/popes" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Popes
      </Link>
    </div>
  );
}

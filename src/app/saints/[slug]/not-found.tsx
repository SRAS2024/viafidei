import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function SaintNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/saints" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Saints & Our Lady
      </Link>
    </div>
  );
}

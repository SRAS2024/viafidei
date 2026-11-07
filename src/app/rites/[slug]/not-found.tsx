import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function RiteNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Rite not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/rites" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Rites
      </Link>
    </div>
  );
}

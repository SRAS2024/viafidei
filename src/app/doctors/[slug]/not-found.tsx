import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function DoctorNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/doctors" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Doctors of the Church
      </Link>
    </div>
  );
}

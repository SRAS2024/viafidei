import Link from "next/link";

/** The way back to the profile from any page beneath it. */
export function ProfileBackLink({ label, href = "/profile" }: { label: string; href?: string }) {
  return (
    <p className="vf-profile-back">
      <Link href={href} className="vf-link-action">
        <span aria-hidden="true">←</span> {label}
      </Link>
    </p>
  );
}

import Link from "next/link";
import { UserSilhouetteIcon } from "../icons/UserSilhouetteIcon";

type Props = {
  href?: string;
  ariaLabel: string;
  src?: string | null;
};

/**
 * Small circular profile icon shown in the header when a user is signed in.
 * Falls back to a gray circle with a white silhouette if no avatar image is
 * available. Wraps in a link to the profile page so the click target opens
 * the user menu / profile area.
 */
export function HeaderProfileIcon({ href = "/profile", ariaLabel, src }: Props) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="vf-header-avatar flex items-center justify-center rounded-full"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <UserSilhouetteIcon size={32} className="block" />
      )}
    </Link>
  );
}

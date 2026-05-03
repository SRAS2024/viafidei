import Link from "next/link";
import { HeaderProfileIcon } from "./HeaderProfileIcon";

type AuthedLabels = {
  profile: string;
  logout: string;
};

type AnonLabels = {
  login: string;
};

type Props =
  | {
      isAuthed: true;
      labels: AuthedLabels;
      avatarSrc?: string | null;
    }
  | { isAuthed: false; labels: AnonLabels };

export function HeaderUserMenu(props: Props) {
  if (props.isAuthed) {
    return (
      <div className="flex items-center gap-3">
        <HeaderProfileIcon
          ariaLabel={props.labels.profile}
          src={props.avatarSrc ?? null}
          href="/profile"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <Link href="/login" className="vf-nav-link">
        {props.labels.login}
      </Link>
    </div>
  );
}

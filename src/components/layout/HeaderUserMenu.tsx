import Link from "next/link";

type AuthedLabels = {
  profile: string;
  logout: string;
};

type AnonLabels = {
  login: string;
  register: string;
};

type Props = { isAuthed: true; labels: AuthedLabels } | { isAuthed: false; labels: AnonLabels };

export function HeaderUserMenu(props: Props) {
  if (props.isAuthed) {
    return (
      <div className="flex items-center gap-5">
        <Link href="/profile" className="vf-nav-link">
          {props.labels.profile}
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="vf-nav-link">
            {props.labels.logout}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <Link href="/login" className="vf-nav-link">
        {props.labels.login}
      </Link>
      <Link href="/register" className="vf-nav-link">
        {props.labels.register}
      </Link>
    </div>
  );
}

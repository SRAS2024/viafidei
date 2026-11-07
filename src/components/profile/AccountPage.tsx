import type { ReactNode } from "react";

/**
 * The frame every public account form shares: log in, create account, forgot
 * and reset password, and verify email. One column, the title close above the
 * fields, and the secondary links at the foot of the same card, so a reader who
 * has met one of these pages has met them all.
 */
export function AccountPage({
  title,
  subtitle,
  links,
  note,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Secondary links under the form's action. */
  links?: ReactNode;
  /** Small print under the card. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="vf-account">
      <div className="vf-account-head">
        <h1 className="vf-account-title">{title}</h1>
        {subtitle ? <p className="vf-account-lede">{subtitle}</p> : null}
      </div>
      <div className="vf-account-card">
        {children}
        {links ? <div className="vf-account-links">{links}</div> : null}
      </div>
      {note ? <p className="vf-account-note vf-fineprint">{note}</p> : null}
    </div>
  );
}

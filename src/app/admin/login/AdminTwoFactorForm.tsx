"use client";

/**
 * Second-factor form for the interactive admin sign-in (security spec item 1).
 *
 * Copy is written in English rather than through `t(...)`: the admin console
 * is a single-operator English surface, and the i18n dictionaries are shared
 * files owned elsewhere in this tree. The public member sign-in is unchanged
 * and still fully translated.
 *
 * The form carries no identity of its own — the server resolves the account
 * from the pending admin session — so there is nothing here for a client to
 * tamper with, and the code never round-trips through a URL.
 */
export function AdminTwoFactorForm() {
  return (
    <div className="flex flex-col gap-5">
      <form method="post" action="/api/auth/admin-2fa/verify" className="flex flex-col gap-5">
        <div>
          <label htmlFor="code" className="vf-label">
            Six-digit code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            // `one-time-code` lets a password manager or the OS offer the code
            // from the email without it being retyped by hand.
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="vf-input"
          />
        </div>
        <button type="submit" className="vf-btn vf-btn-primary mt-2">
          Verify and enter admin
        </button>
      </form>
      <form method="post" action="/api/auth/admin-2fa/resend">
        <button type="submit" className="vf-nav-link">
          Send a new code
        </button>
      </form>
    </div>
  );
}

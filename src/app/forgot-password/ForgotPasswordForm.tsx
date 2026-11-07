"use client";

import { useEffect, useRef, useState } from "react";

type Labels = {
  email: string;
  submit: string;
  /** Success template — must contain `{email}` which is replaced with the typed address. */
  success: string;
  notFound: string;
  /** Rate-limit template — must contain `{minutes}` which is replaced with the wait time. */
  rateLimited: string;
  /** Fallback rate-limit message (no minutes available). */
  rateLimitedFallback: string;
  /** The server would not take the address, though the browser's own check passed it. */
  invalidAddress: string;
  /** Generic transport / unknown error. */
  error: string;
  /** Shown when the email pipeline is not configured server-side or
      Resend rejected the send (unverified domain, restricted key, …). */
  deliveryFailed: string;
};

/** What the server said to a plain post of this form, which comes back as a new page. */
export type ForgotPasswordOutcome =
  | { kind: "ok"; email: string }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "invalid_address" }
  | { kind: "error" };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "delivery_failed" }
  | ForgotPasswordOutcome;

const EMAIL_ERROR_ID = "forgot-email-error";
const FORM_ERROR_ID = "forgot-form-error";

export function ForgotPasswordForm({
  labels,
  outcome,
  email: keptEmail,
}: {
  labels: Labels;
  outcome?: ForgotPasswordOutcome;
  /** The address the reader typed, when a plain post of this form has come back. */
  email?: string;
}) {
  const [status, setStatus] = useState<Status>(outcome ?? { kind: "idle" });
  const [email, setEmail] = useState(keptEmail ?? "");
  const emailRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // The field has no value prop, so hydration cannot wipe what a reader put in it while
  // the page's script was still on its way. This picks that up for the fetch below.
  useEffect(() => {
    if (emailRef.current?.value) setEmail(emailRef.current.value);
  }, []);

  // The form and its button leave the page on success. Focus moves to the message
  // that replaces them, so a keyboard or screen-reader user is not left nowhere.
  const succeeded = status.kind === "ok";
  useEffect(() => {
    if (succeeded) successRef.current?.focus();
  }, [succeeded]);

  // A plain post's answer is already on the page at first paint, where a live region stays
  // silent. Focus on it is what makes a screen reader say it.
  const arrivedRefused = outcome !== undefined && outcome.kind !== "ok";
  useEffect(() => {
    if (arrivedRefused) errorRef.current?.focus();
  }, [arrivedRefused]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "loading") return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        sent?: boolean;
        email?: string;
        details?: { retryAfterSeconds?: number };
      };
      if (res.status === 429) {
        setStatus({
          kind: "rate_limited",
          retryAfterSeconds: data.details?.retryAfterSeconds ?? null,
        });
        return;
      }
      if (data.ok && data.sent) {
        setStatus({ kind: "ok", email: data.email ?? email });
        return;
      }
      if (data.error === "not_found") {
        setStatus({ kind: "not_found" });
        return;
      }
      if (data.error === "invalid") {
        setStatus({ kind: "invalid_address" });
        emailRef.current?.focus();
        return;
      }
      // The account exists but the email never reached the recipient.
      // Three flavors all map to the same user-visible message:
      //   - delivery_failed       (Resend rejected the send)
      //   - email_not_configured  (RESEND_API_KEY missing)
      //   - token_creation_failed (database table missing — the token
      //                            row could not even be written, so
      //                            no email was ever attempted)
      // The user has nothing actionable to do for any of them; the
      // operator sees the underlying reason on /admin/email.
      if (
        data.error === "server_error" &&
        (data.message === "delivery_failed" ||
          data.message === "email_not_configured" ||
          data.message === "token_creation_failed")
      ) {
        setStatus({ kind: "delivery_failed" });
        return;
      }
      setStatus({ kind: "error" });
    } catch {
      setStatus({ kind: "error" });
    }
  }

  function rateLimitText(): string {
    if (status.kind !== "rate_limited") return "";
    if (status.retryAfterSeconds === null || status.retryAfterSeconds <= 0) {
      return labels.rateLimitedFallback;
    }
    const minutes = Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
    return labels.rateLimited.replace("{minutes}", String(minutes));
  }

  if (status.kind === "ok") {
    return (
      <p ref={successRef} tabIndex={-1} role="status" className="vf-notice">
        {labels.success.replace("{email}", () => status.email)}
      </p>
    );
  }

  const formError =
    status.kind === "rate_limited"
      ? rateLimitText()
      : status.kind === "delivery_failed"
        ? labels.deliveryFailed
        : status.kind === "invalid_address"
          ? labels.invalidAddress
          : status.kind === "error"
            ? labels.error
            : null;

  // The browser's own validation stops an empty or malformed address before it is
  // sent, and says why in the reader's language. A real method and action: pressed before
  // the page's script has run, the form still reaches the server, whose answer is a page.
  return (
    <form
      method="post"
      action="/api/auth/forgot-password"
      onSubmit={handleSubmit}
      className="vf-form"
    >
      {/* Above the field, as on the log in form: having heard it, the next stop is the
          address to check. */}
      {formError ? (
        <p
          ref={errorRef}
          id={FORM_ERROR_ID}
          tabIndex={-1}
          role="alert"
          className="vf-notice vf-notice-error"
        >
          {formError}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="vf-label">
          {labels.email}
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="vf-input"
          defaultValue={keptEmail}
          onChange={(e) => {
            setEmail(e.target.value);
            // Clear the "no account" message as soon as the user edits the
            // address — they're likely correcting a typo.
            if (
              status.kind === "not_found" ||
              status.kind === "invalid_address" ||
              status.kind === "error"
            ) {
              setStatus({ kind: "idle" });
            }
          }}
          aria-invalid={status.kind === "not_found" || status.kind === "invalid_address"}
          aria-describedby={
            status.kind === "not_found"
              ? EMAIL_ERROR_ID
              : status.kind === "invalid_address"
                ? FORM_ERROR_ID
                : undefined
          }
        />
        {status.kind === "not_found" ? (
          <p id={EMAIL_ERROR_ID} role="alert" className="vf-field-error">
            {labels.notFound}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary vf-btn-block"
        aria-disabled={status.kind === "loading"}
        aria-busy={status.kind === "loading"}
      >
        {labels.submit}
      </button>
    </form>
  );
}

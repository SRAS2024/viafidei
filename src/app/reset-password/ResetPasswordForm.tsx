"use client";

import Link from "next/link";
import { useState } from "react";

type Labels = {
  newPassword: string;
  confirmPassword: string;
  submit: string;
  successHeading: string;
  backToLogin: string;
  weakPassword: string;
  mismatch: string;
  invalidToken: string;
  expiredToken: string;
  usedToken: string;
  rateLimited: string;
  error: string;
};

type Props = {
  token: string;
  labels: Labels;
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "server_error"; message: string };

const PASSWORD_MIN = 5;
const ERROR_COLOR = "#8b1a1a";

function isStrongPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  return true;
}

type FieldValidation = "weak" | "mismatch" | null;

export function ResetPasswordForm({ token, labels }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  // Inline validation mirrors the register form: hidden until the user has
  // typed and either left a field or attempted to submit, and clears
  // automatically once the input becomes valid.
  const validation: FieldValidation = (() => {
    if (!touched) return null;
    if (password.length === 0) return null;
    if (!isStrongPassword(password)) return "weak";
    if (passwordConfirm.length > 0 && password !== passwordConfirm) return "mismatch";
    return null;
  })();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (status.kind === "loading") return;
    if (!isStrongPassword(password)) return;
    if (password !== passwordConfirm) return;

    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (data.ok) {
        setStatus({ kind: "success" });
        return;
      }
      if (res.status === 429) {
        setStatus({ kind: "server_error", message: labels.rateLimited });
        return;
      }
      if (data.error === "not_found") {
        setStatus({ kind: "server_error", message: labels.invalidToken });
        return;
      }
      if (data.message === "expired") {
        setStatus({ kind: "server_error", message: labels.expiredToken });
        return;
      }
      if (data.message === "used") {
        setStatus({ kind: "server_error", message: labels.usedToken });
        return;
      }
      // The "weak" / "mismatch" cases are caught by inline validation
      // above, but if the server still returns one (e.g. via direct API
      // call) fall through to the generic server-error message.
      setStatus({ kind: "server_error", message: labels.error });
    } catch {
      setStatus({ kind: "server_error", message: labels.error });
    }
  }

  if (status.kind === "success") {
    return (
      <div className="text-center">
        <p
          role="status"
          aria-live="polite"
          className="font-display text-2xl text-ink"
          data-testid="reset-success-heading"
        >
          {labels.successHeading}
        </p>
        <p className="mt-4 text-xs text-ink-faint">
          <Link
            href="/login"
            className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            {labels.backToLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="password" className="vf-label">
          {labels.newPassword}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={PASSWORD_MIN}
          required
          autoComplete="new-password"
          className="vf-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={validation === "weak"}
          aria-describedby={validation === "weak" ? "reset-password-error" : undefined}
        />
        {validation === "weak" ? (
          <p
            id="reset-password-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: ERROR_COLOR }}
          >
            {labels.weakPassword}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="vf-label">
          {labels.confirmPassword}
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          minLength={PASSWORD_MIN}
          required
          autoComplete="new-password"
          className="vf-input"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={validation === "mismatch"}
          aria-describedby={validation === "mismatch" ? "reset-confirm-error" : undefined}
        />
        {validation === "mismatch" ? (
          <p
            id="reset-confirm-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: ERROR_COLOR }}
          >
            {labels.mismatch}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary mt-2"
        disabled={status.kind === "loading"}
        aria-busy={status.kind === "loading"}
      >
        {labels.submit}
      </button>
      {status.kind === "server_error" ? (
        <p role="alert" className="text-center text-sm" style={{ color: ERROR_COLOR }}>
          {status.message}
        </p>
      ) : null}
    </form>
  );
}

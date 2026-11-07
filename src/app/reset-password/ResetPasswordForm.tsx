"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { checkPasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

type Labels = {
  newPassword: string;
  confirmPassword: string;
  submit: string;
  successHeading: string;
  backToLogin: string;
  show: string;
  hide: string;
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

const PASSWORD_MIN = PASSWORD_MIN_LENGTH;

function isStrongPassword(value: string): boolean {
  return checkPasswordStrength(value) === null;
}

type FieldValidation = "weak" | "mismatch" | null;

export function ResetPasswordForm({ token, labels }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);

  // Inline validation mirrors the register form: hidden until the user has
  // typed and either left a field or attempted to submit, and clears
  // automatically once the input becomes valid. A submit with the fields still
  // empty is a real attempt too: without a message it would simply do nothing.
  const validation: FieldValidation = (() => {
    if (!touched) return null;
    if (password.length === 0 && !submitted) return null;
    if (!isStrongPassword(password)) return "weak";
    if ((passwordConfirm.length > 0 || submitted) && password !== passwordConfirm) {
      return "mismatch";
    }
    return null;
  })();

  // The form leaves the page on success; focus moves to what replaces it.
  const succeeded = status.kind === "success";
  useEffect(() => {
    if (succeeded) successRef.current?.focus();
  }, [succeeded]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    setSubmitted(true);
    if (status.kind === "loading") return;
    if (!isStrongPassword(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (password !== passwordConfirm) {
      confirmRef.current?.focus();
      return;
    }

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
      <div className="vf-form">
        <p
          ref={successRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="vf-notice"
          data-testid="reset-success-heading"
        >
          {labels.successHeading}
        </p>
        <Link href="/login" className="vf-btn vf-btn-primary vf-btn-block">
          {labels.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="vf-form" noValidate>
      <div className="vf-field-split">
        <label htmlFor="password" className="vf-label">
          {labels.newPassword}
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
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
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="vf-field-toggle vf-link-action"
        >
          {showPassword ? labels.hide : labels.show}
        </button>
        {validation === "weak" ? (
          <p id="reset-password-error" role="alert" className="vf-field-error">
            {labels.weakPassword}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="vf-label">
          {labels.confirmPassword}
        </label>
        <input
          ref={confirmRef}
          id="passwordConfirm"
          name="passwordConfirm"
          type={showPassword ? "text" : "password"}
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
          <p id="reset-confirm-error" role="alert" className="vf-field-error">
            {labels.mismatch}
          </p>
        ) : null}
      </div>
      {status.kind === "server_error" ? (
        <p role="alert" className="vf-notice vf-notice-error">
          {status.message}
        </p>
      ) : null}
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

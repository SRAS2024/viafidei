"use client";

import Link from "next/link";
import { useState } from "react";

const PASSWORD_MIN = 5;

export type RegisterFormLabels = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  passwordRequirements: string;
  submit: string;
  show: string;
  hide: string;
  weakPassword: string;
  mismatch: string;
  privacyBefore: string;
  privacyLink: string;
  privacyAfter: string;
};

function isStrongPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  return true;
}

type ValidationKind = "weak" | "mismatch";

const ERROR_COLOR = "#8b1a1a";

export function RegisterForm({ labels }: { labels: RegisterFormLabels }) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // Validation kicks in only after the user has interacted with the password
  // fields. The requirements message is hidden by default and surfaces only
  // when a constraint is broken — never as a passive hint.
  const [touched, setTouched] = useState(false);

  const validation: ValidationKind | null = (() => {
    if (!touched) return null;
    if (password.length === 0) return null;
    if (!isStrongPassword(password)) return "weak";
    if (passwordConfirm.length > 0 && password !== passwordConfirm) return "mismatch";
    return null;
  })();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setTouched(true);
    if (!isStrongPassword(password)) {
      event.preventDefault();
      return;
    }
    if (password !== passwordConfirm) {
      event.preventDefault();
      return;
    }
  }

  return (
    <form
      method="post"
      action="/api/auth/register"
      className="flex flex-col gap-5"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="vf-label">
            {labels.firstName}
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            className="vf-input"
            autoComplete="given-name"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="vf-label">
            {labels.lastName}
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            className="vf-input"
            autoComplete="family-name"
            maxLength={80}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="vf-label">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="vf-input"
          autoComplete="email"
          maxLength={200}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="vf-label">
            {labels.password}
          </label>
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="vf-nav-link">
            {showPassword ? labels.hide : labels.show}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={PASSWORD_MIN}
          aria-describedby={validation === "weak" ? "password-error" : undefined}
          aria-invalid={validation === "weak"}
          className="vf-input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {validation === "weak" ? (
          <p
            id="password-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: ERROR_COLOR }}
          >
            {labels.passwordRequirements}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="vf-label">
          {labels.passwordConfirm}
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type={showPassword ? "text" : "password"}
          required
          minLength={PASSWORD_MIN}
          aria-describedby={validation === "mismatch" ? "passwordConfirm-error" : undefined}
          aria-invalid={validation === "mismatch"}
          className="vf-input"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {validation === "mismatch" ? (
          <p
            id="passwordConfirm-error"
            role="alert"
            className="mt-1 font-serif text-xs"
            style={{ color: ERROR_COLOR }}
          >
            {labels.mismatch}
          </p>
        ) : null}
      </div>

      <p className="font-serif text-xs text-ink-faint" data-testid="register-privacy-notice">
        {labels.privacyBefore}
        <Link
          href="/privacy"
          className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {labels.privacyLink}
        </Link>
        {labels.privacyAfter}
      </p>

      <button type="submit" className="vf-btn vf-btn-primary mt-2">
        {labels.submit}
      </button>
    </form>
  );
}

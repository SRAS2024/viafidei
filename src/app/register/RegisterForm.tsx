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

export function RegisterForm({ labels }: { labels: RegisterFormLabels }) {
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setClientError(null);
    const form = event.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
    const passwordConfirm =
      (form.elements.namedItem("passwordConfirm") as HTMLInputElement | null)?.value ?? "";
    if (!isStrongPassword(password)) {
      event.preventDefault();
      setClientError(labels.weakPassword);
      return;
    }
    if (password !== passwordConfirm) {
      event.preventDefault();
      setClientError(labels.mismatch);
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
          pattern="(?=.*[A-Z])(?=.*\d).{5,}"
          aria-describedby="password-requirements"
          className="vf-input"
          autoComplete="new-password"
        />
        <p id="password-requirements" className="mt-1 font-serif text-xs text-ink-faint">
          {labels.passwordRequirements}
        </p>
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
          className="vf-input"
          autoComplete="new-password"
        />
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

      {clientError ? (
        <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
          {clientError}
        </p>
      ) : null}

      <button type="submit" className="vf-btn vf-btn-primary mt-2">
        {labels.submit}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

const ERROR_ID = "login-error";

export function LoginForm({
  labels,
  next,
  email,
  error,
}: {
  labels: {
    email: string;
    password: string;
    submit: string;
    show: string;
    hide: string;
  };
  next?: string;
  /** The address the reader typed, when the server sent them back after a failed attempt. */
  email?: string;
  /** Set when the server sent the reader back here after a failed attempt. */
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // The form posts and the server redirects back with the failure in the URL, so
  // the message is already on the page at first paint and a live region stays
  // silent. Focusing the field makes a screen reader read it with its error.
  useEffect(() => {
    if (error) emailRef.current?.focus();
  }, [error]);

  const invalid = error ? { "aria-invalid": true, "aria-describedby": ERROR_ID } : {};

  return (
    <form method="post" action="/api/auth/login" className="vf-form">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {error ? (
        <p id={ERROR_ID} role="alert" className="vf-notice vf-notice-error">
          {error}
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
          defaultValue={email}
          {...invalid}
        />
      </div>
      <div className="vf-field-split">
        <label htmlFor="password" className="vf-label">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className="vf-input"
          {...invalid}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="vf-field-toggle vf-link-action"
        >
          {showPassword ? labels.hide : labels.show}
        </button>
      </div>
      <button type="submit" className="vf-btn vf-btn-primary vf-btn-block">
        {labels.submit}
      </button>
    </form>
  );
}

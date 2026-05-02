"use client";

import { useState } from "react";

export function LoginForm({
  labels,
  next,
}: {
  labels: {
    email: string;
    password: string;
    submit: string;
    forgot: string;
    show: string;
    hide: string;
  };
  next?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form method="post" action="/api/auth/login" className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="email" className="vf-label">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="vf-input"
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
          autoComplete="current-password"
          required
          className="vf-input"
        />
      </div>
      <button type="submit" className="vf-btn vf-btn-primary mt-2">
        {labels.submit}
      </button>
      <a
        href="/forgot-password"
        className="text-center text-sm text-ink-faint underline-offset-4 hover:underline"
      >
        {labels.forgot}
      </a>
    </form>
  );
}

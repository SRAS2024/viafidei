"use client";

import { useState } from "react";

export function RegisterForm({
  labels,
}: {
  labels: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
    submit: string;
    show: string;
    hide: string;
  };
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form method="post" action="/api/auth/register" className="flex flex-col gap-5">
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
          minLength={12}
          className="vf-input"
          autoComplete="new-password"
        />
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
          minLength={12}
          className="vf-input"
          autoComplete="new-password"
        />
      </div>

      <button type="submit" className="vf-btn vf-btn-primary mt-2">
        {labels.submit}
      </button>
    </form>
  );
}

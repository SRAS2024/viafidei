"use client";

import { useState } from "react";

export function AdminLoginForm({
  labels,
}: {
  labels: { username: string; password: string; submit: string; show: string; hide: string };
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form method="post" action="/api/admin/login" className="flex flex-col gap-5">
      <div>
        <label htmlFor="username" className="vf-label">
          {labels.username}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="vf-input"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="vf-label">
            {labels.password}
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="vf-nav-link"
          >
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
    </form>
  );
}

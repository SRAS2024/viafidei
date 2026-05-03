"use client";

import { useState } from "react";

type Labels = {
  email: string;
  submit: string;
  success: string;
  rateLimited: string;
  error: string;
};

export function ForgotPasswordForm({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "rate_limited" | "error">(
    "idle",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!data.ok) {
        setStatus("error");
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <p role="status" className="text-center font-serif text-sm text-ink-soft">
        {labels.success}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
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
      <button
        type="submit"
        className="vf-btn vf-btn-primary mt-2"
        disabled={status === "loading"}
        aria-busy={status === "loading"}
      >
        {labels.submit}
      </button>
      {status === "rate_limited" ? (
        <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
          {labels.rateLimited}
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
          {labels.error}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Labels = {
  newPassword: string;
  confirmPassword: string;
  submit: string;
  weakPassword: string;
  mismatch: string;
  invalidToken: string;
  expiredToken: string;
  usedToken: string;
  error: string;
  successRedirectTo: string;
};

type Props = {
  token: string;
  labels: Labels;
};

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

export function ResetPasswordForm({ token, labels }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "loading") return;
    const form = event.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
    const passwordConfirm =
      (form.elements.namedItem("passwordConfirm") as HTMLInputElement | null)?.value ?? "";

    if (password.length < 12) {
      setState({ kind: "error", message: labels.weakPassword });
      return;
    }
    if (password !== passwordConfirm) {
      setState({ kind: "error", message: labels.mismatch });
      return;
    }

    setState({ kind: "loading" });
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
        router.push(labels.successRedirectTo);
        return;
      }
      if (data.error === "not_found") {
        setState({ kind: "error", message: labels.invalidToken });
        return;
      }
      if (data.message === "expired") {
        setState({ kind: "error", message: labels.expiredToken });
        return;
      }
      if (data.message === "used") {
        setState({ kind: "error", message: labels.usedToken });
        return;
      }
      setState({ kind: "error", message: labels.error });
    } catch {
      setState({ kind: "error", message: labels.error });
    }
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
          minLength={12}
          required
          autoComplete="new-password"
          className="vf-input"
        />
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="vf-label">
          {labels.confirmPassword}
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
          className="vf-input"
        />
      </div>
      <button
        type="submit"
        className="vf-btn vf-btn-primary mt-2"
        disabled={state.kind === "loading"}
        aria-busy={state.kind === "loading"}
      >
        {labels.submit}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type Labels = {
  checking: string;
  success: string;
  invalid: string;
  expired: string;
  used: string;
  rateLimited: string;
  error: string;
};

type Status = "checking" | "success" | "invalid" | "expired" | "used" | "rate_limited" | "error";

export function VerifyEmailClient({ token, labels }: { token: string; labels: Labels }) {
  const [status, setStatus] = useState<Status>("checking");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
        };
        if (cancelled) return;
        if (data.ok) {
          setStatus("success");
          return;
        }
        if (res.status === 429) {
          setStatus("rate_limited");
          return;
        }
        if (data.message === "expired") {
          setStatus("expired");
          return;
        }
        if (data.message === "used") {
          setStatus("used");
          return;
        }
        if (data.error === "not_found") {
          setStatus("invalid");
          return;
        }
        setStatus("invalid");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "checking" || status === "success") {
    // One element whose text changes, so the outcome is announced where a new
    // element carrying it might not be.
    return (
      <p role="status" aria-live="polite" className="vf-notice">
        {status === "checking" ? labels.checking : labels.success}
      </p>
    );
  }
  const message =
    status === "expired"
      ? labels.expired
      : status === "used"
        ? labels.used
        : status === "rate_limited"
          ? labels.rateLimited
          : status === "error"
            ? labels.error
            : labels.invalid;
  return (
    <p role="alert" className="vf-notice vf-notice-error">
      {message}
    </p>
  );
}

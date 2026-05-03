"use client";

import { useEffect, useRef, useState } from "react";

type Labels = {
  checking: string;
  success: string;
  invalid: string;
  expired: string;
  used: string;
};

type Status = "checking" | "success" | "invalid" | "expired" | "used";

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
        if (data.message === "expired") {
          setStatus("expired");
          return;
        }
        if (data.message === "used") {
          setStatus("used");
          return;
        }
        setStatus("invalid");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "checking") {
    return (
      <p role="status" className="text-center font-serif text-sm text-ink-soft" aria-live="polite">
        {labels.checking}
      </p>
    );
  }
  if (status === "success") {
    return (
      <p role="status" className="text-center font-serif text-sm text-ink" aria-live="polite">
        {labels.success}
      </p>
    );
  }
  const message =
    status === "expired" ? labels.expired : status === "used" ? labels.used : labels.invalid;
  return (
    <p role="alert" className="text-center text-sm" style={{ color: "#8b1a1a" }}>
      {message}
    </p>
  );
}

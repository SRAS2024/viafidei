"use client";

import { useEffect, useState } from "react";

const WELCOME_DURATION_MS = 2500;

export function AdminWelcomeGate({
  greeting,
  loadingLabel,
  locale,
  children,
}: {
  greeting: string;
  loadingLabel: string;
  locale: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / WELCOME_DURATION_MS);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase("done");
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (phase === "done") return <>{children}</>;

  const pct = Math.round(progress * 100);

  return (
    <div
      lang={locale}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-6 text-center"
    >
      <p className="vf-eyebrow">{loadingLabel}</p>
      <h1 className="font-display text-6xl text-ink" style={{ letterSpacing: "-0.01em" }}>
        {greeting}
      </h1>

      <div
        className="relative h-1.5 w-80 max-w-full overflow-hidden rounded-full"
        style={{ background: "rgba(17,17,17,0.08)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ease-linear"
          style={{
            width: `${pct}%`,
            background: "#7aa7dc",
            boxShadow: "0 0 12px rgba(122, 167, 220, 0.45)",
          }}
        />
      </div>

      <p className="vf-eyebrow" style={{ color: "#1f3a8a" }}>
        {pct}%
      </p>
    </div>
  );
}

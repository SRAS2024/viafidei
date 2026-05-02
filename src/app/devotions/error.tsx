"use client";

export default function DevotionsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center font-serif text-ink-faint">
      <p>Something went wrong loading devotions.</p>
      <button className="vf-btn vf-btn-ghost" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

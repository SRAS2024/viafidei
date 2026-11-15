"use client";

import { useId, useState } from "react";

import { type Voice } from "@/lib/pray-along/voice-choice";

type Props = {
  initialVoice: Voice;
  labels: {
    heading: string;
    female: string;
    male: string;
    saved: string;
    failed: string;
  };
};

/**
 * The voice that prays along with a member: two buttons, the chosen one pressed,
 * like the light / dark choice above it. The choice is saved to the profile at once,
 * and the next press of any megaphone uses it; the outcome is said in a status region.
 */
export function AudioVoicePicker({ initialVoice, labels }: Props) {
  const [voice, setVoice] = useState<Voice>(initialVoice);
  const [outcome, setOutcome] = useState<"saved" | "failed" | null>(null);
  const headingId = useId();

  async function choose(next: Voice) {
    const previous = voice;
    setVoice(next);
    setOutcome(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioVoice: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setOutcome("saved");
    } catch {
      setVoice(previous);
      setOutcome("failed");
    }
  }

  return (
    <div>
      <p id={headingId} className="vf-label">
        {labels.heading}
      </p>
      <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          aria-pressed={voice === "female"}
          onClick={() => void choose("female")}
        >
          {labels.female}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          aria-pressed={voice === "male"}
          onClick={() => void choose("male")}
        >
          {labels.male}
        </button>
      </div>
      <p role="status" className="vf-fineprint mt-1.5">
        {outcome === "saved" ? labels.saved : outcome === "failed" ? labels.failed : ""}
      </p>
    </div>
  );
}

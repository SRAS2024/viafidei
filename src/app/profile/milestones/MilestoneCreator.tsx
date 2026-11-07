"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Tier = "SACRAMENT" | "SPIRITUAL" | "PERSONAL";

type Preset = { slug: string; title: string };

const SACRAMENTS: Preset[] = [
  { slug: "baptism", title: "Baptism" },
  { slug: "confirmation", title: "Confirmation" },
  { slug: "first-communion", title: "First Holy Communion" },
  { slug: "reconciliation", title: "First Reconciliation" },
  { slug: "anointing", title: "Anointing of the Sick" },
  { slug: "holy-orders", title: "Holy Orders" },
  { slug: "matrimony", title: "Matrimony" },
];

const SPIRITUAL_PRESETS: Preset[] = [
  { slug: "pilgrimage", title: "Pilgrimage" },
  { slug: "consecration-mary", title: "Consecration to Our Lady" },
  { slug: "retreat", title: "Spiritual Retreat" },
  { slug: "rosary-daily", title: "Daily Rosary habit" },
  { slug: "scripture-reading", title: "Completed Scripture reading" },
  { slug: "divine-mercy", title: "Divine Mercy Novena" },
];

type Props = {
  /** Which kind of milestone this control records. */
  tier: Tier;
  /** That kind's name, for the group of presets. */
  heading: string;
  existingSlugs: string[];
  labels: {
    record: string;
    alreadyRecorded: string;
    addCustom: string;
    customTitle: string;
    customDesc: string;
    save: string;
    cancel: string;
  };
};

export function MilestoneCreator({ tier, heading, existingSlugs, labels }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Said aloud once a milestone is saved: the new row appears out of the reader's way.
  const [recordedNote, setRecordedNote] = useState("");
  const router = useRouter();
  const addRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const refocusAdd = useRef(false);

  useEffect(() => {
    if (customOpen) {
      titleRef.current?.focus();
    } else if (refocusAdd.current) {
      refocusAdd.current = false;
      addRef.current?.focus();
    }
  }, [customOpen]);

  function recordPreset(preset: Preset) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, slug: preset.slug, title: preset.title }),
      });
      if (res.ok) setRecordedNote(`${preset.title}: ${labels.alreadyRecorded}`);
      else setError("Failed to save milestone.");
      router.refresh();
    });
  }

  function saveCustom() {
    if (!customTitle.trim() || pending) return;
    const slug = `personal-${Date.now()}`;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier: "PERSONAL" as Tier,
          slug,
          title: customTitle.trim(),
          description: customDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        setError("Failed to save milestone.");
        return;
      }
      setRecordedNote(`${customTitle.trim()}: ${labels.alreadyRecorded}`);
      setCustomTitle("");
      setCustomDesc("");
      refocusAdd.current = true;
      setCustomOpen(false);
      router.refresh();
    });
  }

  const presets = tier === "SACRAMENT" ? SACRAMENTS : tier === "SPIRITUAL" ? SPIRITUAL_PRESETS : [];

  const errorNote = error ? (
    <p role="alert" className="vf-notice vf-notice-error mt-3">
      {error}
    </p>
  ) : null;

  // On the page before there is anything to say, so its text is announced.
  const recordedStatus = (
    <p role="status" aria-live="polite" className="sr-only">
      {recordedNote}
    </p>
  );

  if (tier !== "PERSONAL") {
    return (
      <>
        <div role="group" aria-label={`${labels.record}: ${heading}`} className="vf-chip-row">
          {presets.map((s) => {
            const recorded = existingSlugs.includes(s.slug);
            // Not `disabled`: focus would fall off a chip the moment it records.
            return (
              <button
                key={s.slug}
                type="button"
                aria-disabled={recorded}
                aria-label={recorded ? `${s.title}: ${labels.alreadyRecorded}` : undefined}
                onClick={() => {
                  if (!recorded) recordPreset(s);
                }}
                className={`vf-chip ${recorded ? "vf-filter-active" : ""}`}
              >
                {recorded ? <span aria-hidden="true">✓</span> : null}
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>
        {errorNote}
        {recordedStatus}
      </>
    );
  }

  if (!customOpen) {
    return (
      <>
        <button
          ref={addRef}
          type="button"
          className="vf-btn vf-btn-ghost"
          onClick={() => setCustomOpen(true)}
        >
          <span aria-hidden="true">+</span> {labels.addCustom}
        </button>
        {errorNote}
        {recordedStatus}
      </>
    );
  }

  return (
    <form
      className="vf-panel vf-form"
      onSubmit={(e) => {
        e.preventDefault();
        saveCustom();
      }}
    >
      <div>
        <label className="vf-label" htmlFor="custom-title">
          {labels.customTitle}
        </label>
        <input
          ref={titleRef}
          id="custom-title"
          className="vf-input"
          required
          maxLength={200}
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="vf-label" htmlFor="custom-desc">
          {labels.customDesc}
        </label>
        <textarea
          id="custom-desc"
          rows={2}
          className="vf-input"
          maxLength={4000}
          value={customDesc}
          onChange={(e) => setCustomDesc(e.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="vf-notice vf-notice-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="vf-btn vf-btn-primary"
          disabled={!customTitle.trim()}
          aria-disabled={pending}
          aria-busy={pending}
        >
          {labels.save}
        </button>
        <button
          type="button"
          className="vf-btn vf-btn-ghost"
          onClick={() => {
            refocusAdd.current = true;
            setCustomOpen(false);
            setCustomTitle("");
            setCustomDesc("");
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

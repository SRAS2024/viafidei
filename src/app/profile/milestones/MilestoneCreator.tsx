"use client";

import { useState, useTransition } from "react";
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
  existingSlugs: string[];
  labels: {
    sacraments: string;
    spiritual: string;
    personal: string;
    record: string;
    alreadyRecorded: string;
    addCustom: string;
    customTitle: string;
    customDesc: string;
    save: string;
    cancel: string;
  };
};

export function MilestoneCreator({ existingSlugs, labels }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function recordPreset(preset: Preset, tier: Tier) {
    startTransition(async () => {
      await fetch("/api/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, slug: preset.slug, title: preset.title }),
      });
      router.refresh();
    });
  }

  function saveCustom() {
    if (!customTitle.trim()) return;
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
      setCustomTitle("");
      setCustomDesc("");
      setCustomOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mb-10">
      <section className="mb-8">
        <h2 className="font-display text-2xl">{labels.sacraments}</h2>
        <div className="vf-rule my-3" />
        <div className="flex flex-wrap gap-2">
          {SACRAMENTS.map((s) => {
            const recorded = existingSlugs.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                disabled={recorded || pending}
                onClick={() => recordPreset(s, "SACRAMENT")}
                className={`rounded-sm border px-3 py-1.5 text-sm font-serif transition ${
                  recorded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                    : "border-ink/20 hover:border-ink/40 text-ink"
                }`}
              >
                {recorded ? `✓ ${s.title}` : s.title}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-2xl">{labels.spiritual}</h2>
        <div className="vf-rule my-3" />
        <div className="flex flex-wrap gap-2">
          {SPIRITUAL_PRESETS.map((s) => {
            const recorded = existingSlugs.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                disabled={recorded || pending}
                onClick={() => recordPreset(s, "SPIRITUAL")}
                className={`rounded-sm border px-3 py-1.5 text-sm font-serif transition ${
                  recorded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                    : "border-ink/20 hover:border-ink/40 text-ink"
                }`}
              >
                {recorded ? `✓ ${s.title}` : s.title}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">{labels.personal}</h2>
        <div className="vf-rule my-3" />
        {customOpen ? (
          <div className="vf-card rounded-sm p-6">
            <label className="vf-label" htmlFor="custom-title">
              {labels.customTitle}
            </label>
            <input
              id="custom-title"
              className="vf-input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              autoFocus
            />
            <label className="vf-label mt-4" htmlFor="custom-desc">
              {labels.customDesc}
            </label>
            <textarea
              id="custom-desc"
              rows={2}
              className="vf-input"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
            {error ? <p className="mt-2 text-sm text-liturgical-red">{error}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="vf-btn vf-btn-cancel"
                onClick={() => {
                  setCustomOpen(false);
                  setCustomTitle("");
                  setCustomDesc("");
                }}
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                disabled={pending || !customTitle.trim()}
                onClick={saveCustom}
              >
                {pending ? "…" : labels.save}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="vf-btn vf-btn-ghost text-sm"
            onClick={() => setCustomOpen(true)}
          >
            + {labels.addCustom}
          </button>
        )}
      </section>
    </div>
  );
}

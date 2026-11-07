"use client";

import { useEffect, useRef, useState } from "react";
import type { CatholicRite } from "@/lib/content-shared/rites";

type Option = { value: CatholicRite; label: string };

type Props = {
  initialRite: CatholicRite;
  options: Option[];
  /** The menu's name; the section's heading already says it to the eye. */
  label: string;
  /** Said and shown once a choice has been kept. */
  savedLabel: string;
};

const RITE_COOKIE_NAME = "vf_rite";

function persistRiteCookie(rite: CatholicRite) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${RITE_COOKIE_NAME}=${rite}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

export function RitePicker({ initialRite, options, label, savedLabel }: Props) {
  const [rite, setRite] = useState<CatholicRite>(initialRite);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onChange = (next: CatholicRite) => {
    setRite(next);
    persistRiteCookie(next);
    setSaved(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <label htmlFor="rite" className="sr-only">
        {label}
      </label>
      <select
        id="rite"
        className="vf-input"
        value={rite}
        onChange={(e) => onChange(e.target.value as CatholicRite)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Always on the page, so the word is announced when it appears. The mark and the word
          sit side by side rather than in one line of text: Safari's accessibility tree loses
          the rest of a line that begins with something hidden from it, here the word itself. */}
      <p
        role="status"
        aria-live="polite"
        className="vf-fineprint mt-1.5 flex min-h-[1.375rem] gap-1"
      >
        {saved ? (
          <>
            <span aria-hidden="true">✓</span>
            <span>{savedLabel}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

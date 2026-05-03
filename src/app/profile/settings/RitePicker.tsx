"use client";

import { useState } from "react";
import type { CatholicRite } from "@/lib/content/rites";

type Option = { value: CatholicRite; label: string };

type Props = {
  initialRite: CatholicRite;
  options: Option[];
};

const RITE_COOKIE_NAME = "vf_rite";

function persistRiteCookie(rite: CatholicRite) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${RITE_COOKIE_NAME}=${rite}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

export function RitePicker({ initialRite, options }: Props) {
  const [rite, setRite] = useState<CatholicRite>(initialRite);
  const [saved, setSaved] = useState(false);

  const onChange = (next: CatholicRite) => {
    setRite(next);
    persistRiteCookie(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <select
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
      {saved ? <p className="mt-2 text-xs text-ink-faint">✓</p> : null}
    </div>
  );
}

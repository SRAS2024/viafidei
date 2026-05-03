"use client";

import { useEffect, useState } from "react";

type Props = {
  initialTheme: "light" | "dark" | null;
  labels: {
    heading: string;
    light: string;
    dark: string;
  };
};

const THEME_COOKIE_NAME = "vf_theme";

function applyThemeToDocument(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function persistThemeCookie(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

async function persistThemeServer(theme: "light" | "dark") {
  try {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
  } catch {
    // network blip — local cookie is still applied
  }
}

export function ThemeAppearancePicker({ initialTheme, labels }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme ?? "light");

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const onChoose = (next: "light" | "dark") => {
    setTheme(next);
    applyThemeToDocument(next);
    persistThemeCookie(next);
    void persistThemeServer(next);
  };

  return (
    <div>
      <p className="vf-label">{labels.heading}</p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          className={`vf-btn ${theme === "light" ? "vf-btn-primary" : "vf-btn-ghost"}`}
          aria-pressed={theme === "light"}
          onClick={() => onChoose("light")}
        >
          {labels.light}
        </button>
        <button
          type="button"
          className={`vf-btn ${theme === "dark" ? "vf-btn-primary" : "vf-btn-ghost"}`}
          aria-pressed={theme === "dark"}
          onClick={() => onChoose("dark")}
        >
          {labels.dark}
        </button>
      </div>
    </div>
  );
}

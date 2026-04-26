import { getTranslator } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getTranslator();
  return (
    <footer className="mt-24 border-t border-ink/10 bg-paper/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="vf-ornament" aria-hidden="true">
          <svg
            width="18"
            height="22"
            viewBox="0 0 18 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Miniature hand-sketched cross */}
            <path d="M8 1.5 V 20.5" />
            <path d="M10 1.5 V 20.5" />
            <path d="M1 7 H 17" />
            <path d="M1 9.5 H 17" />
            <path d="M8.6 4 Q 8.8 12 8.4 18" strokeWidth="0.4" opacity="0.5" />
          </svg>
        </div>
        <p className="font-serif text-sm text-ink-faint">{t("footer.copy")}</p>
        <p className="vf-eyebrow">{t("footer.canonical")}</p>
      </div>
    </footer>
  );
}

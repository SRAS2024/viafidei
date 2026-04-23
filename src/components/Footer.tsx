import { getTranslator } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getTranslator();
  return (
    <footer className="mt-24 border-t border-ink/10 bg-paper/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="vf-ornament">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M12 3 V 21" />
            <path d="M7 7 H 17" />
          </svg>
        </div>
        <p className="font-serif text-sm text-ink-faint">{t("footer.copy")}</p>
        <p className="vf-eyebrow">{t("footer.canonical")}</p>
      </div>
    </footer>
  );
}

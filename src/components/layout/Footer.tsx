import { getTranslator } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getTranslator();
  return (
    <footer className="mt-12 border-t border-ink/10 bg-paper/40">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center sm:px-6">
        <p className="font-sans text-xs text-ink-faint">{t("footer.copyright")}</p>
      </div>
    </footer>
  );
}

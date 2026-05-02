import { getTranslator } from "@/lib/i18n/server";
import { CrossOrnament } from "../icons/CrossOrnament";

export async function Footer() {
  const { t } = await getTranslator();
  return (
    <footer className="mt-24 border-t border-ink/10 bg-paper/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="vf-ornament" aria-hidden="true">
          <CrossOrnament />
        </div>
        <p className="font-serif text-sm text-ink-faint">{t("footer.copy")}</p>
        <p className="vf-eyebrow">{t("footer.canonical")}</p>
      </div>
    </footer>
  );
}

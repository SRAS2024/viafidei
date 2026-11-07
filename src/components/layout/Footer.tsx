import { getTranslator } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getTranslator();
  return (
    <footer className="mt-10 border-t border-ink/10 bg-paper/40">
      <div className="mx-auto max-w-6xl px-[min(1rem,5vw)] py-6 text-center sm:px-6">
        <p className="vf-fineprint">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

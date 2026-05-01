import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export function HomeNewcomer({ t }: { t: Translator }) {
  return (
    <section className="vf-card rounded-sm p-12 text-center">
      <p className="vf-eyebrow">V.</p>
      <h2 className="mt-3 font-display text-4xl">{t("home.newcomer.title")}</h2>
      <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
        {t("home.newcomer.body")}
      </p>
      <div className="mt-8 flex justify-center">
        <Link href="/spiritual-life" className="vf-btn vf-btn-primary">
          {t("nav.spiritualLife")}
        </Link>
      </div>
    </section>
  );
}

import type { Translator } from "@/lib/i18n/translator";

export function HomeMission({ t }: { t: Translator }) {
  return (
    <section className="grid gap-10 md:grid-cols-2">
      <article className="vf-card rounded-sm p-10">
        <p className="vf-eyebrow">I.</p>
        <h2 className="mt-3 font-display text-3xl">{t("home.mission.title")}</h2>
        <p className="mt-5 font-serif text-lg leading-relaxed text-ink-soft">
          {t("home.mission.body")}
        </p>
      </article>
      <article className="vf-card rounded-sm p-10">
        <p className="vf-eyebrow">II.</p>
        <h2 className="mt-3 font-display text-3xl">{t("home.catholic.title")}</h2>
        <p className="mt-5 font-serif text-lg leading-relaxed text-ink-soft">
          {t("home.catholic.body")}
        </p>
      </article>
    </section>
  );
}

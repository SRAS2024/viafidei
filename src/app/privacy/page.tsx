import { getTranslator } from "@/lib/i18n/server";
import { Logo } from "@/components/icons/Logo";

export const metadata = {
  title: "Privacy policy",
  description: "How Via Fidei handles your information.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPolicyPage() {
  const { t } = await getTranslator();

  const sections: Array<{ titleKey: string; bodyKey: string }> = [
    { titleKey: "privacy.notSold.title", bodyKey: "privacy.notSold.body" },
    { titleKey: "privacy.notShared.title", bodyKey: "privacy.notShared.body" },
    { titleKey: "privacy.collect.title", bodyKey: "privacy.collect.body" },
    { titleKey: "privacy.email.title", bodyKey: "privacy.email.body" },
    { titleKey: "privacy.processors.title", bodyKey: "privacy.processors.body" },
    { titleKey: "privacy.security.title", bodyKey: "privacy.security.body" },
    { titleKey: "privacy.contact.title", bodyKey: "privacy.contact.body" },
  ];

  return (
    <article className="mx-auto max-w-3xl pt-12 pb-16">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center justify-center" aria-hidden="true">
          <Logo size={56} />
        </div>
        <p className="vf-eyebrow">Via Fidei</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-4xl">{t("privacy.title")}</h1>
        <p className="mx-auto mt-3 max-w-xl font-serif text-ink-soft">{t("privacy.subtitle")}</p>
      </div>

      <div className="vf-card mt-10 rounded-sm p-8">
        <p className="font-serif text-ink">{t("privacy.intro")}</p>

        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.titleKey}>
              <h2 className="font-display text-2xl">{t(s.titleKey)}</h2>
              <p className="mt-2 font-serif text-ink-soft">{t(s.bodyKey)}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

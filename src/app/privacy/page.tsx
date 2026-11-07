import { getTranslator } from "@/lib/i18n/server";

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
    <article className="vf-detail">
      <header className="vf-detail-header">
        <p className="vf-eyebrow">Via Fidei</p>
        <h1 className="vf-detail-title">{t("privacy.title")}</h1>
        <p className="vf-lede">{t("privacy.subtitle")}</p>
      </header>

      <div className="vf-reading break-words">
        <p>{t("privacy.intro")}</p>
      </div>

      <div className="mt-[var(--space-related)]">
        {sections.map((s) => (
          <section key={s.titleKey} className="vf-detail-section">
            <h2 className="vf-subhead">{t(s.titleKey)}</h2>
            <div className="vf-reading break-words">
              <p>{t(s.bodyKey)}</p>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

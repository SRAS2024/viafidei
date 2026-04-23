import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getTranslator } from "@/lib/i18n/server";
import { AdminWelcomeGate } from "./AdminWelcomeGate";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const { t, locale } = await getTranslator();

  if (searchParams.welcome === "1") {
    return (
      <AdminWelcomeGate
        greeting={t("admin.loading.greeting")}
        locale={locale}
        loadingLabel={t("common.loading")}
      >
        <AdminDashboard
          labels={{
            title: t("admin.dashboard.title"),
            subtitle: t("admin.dashboard.subtitle"),
            signOut: t("admin.signOut"),
            welcome: t("admin.welcomeLine"),
            prayers: t("admin.card.prayers"),
            saints: t("admin.card.saints"),
            apparitions: t("admin.card.apparitions"),
            parishes: t("admin.card.parishes"),
            liturgy: t("admin.card.liturgy"),
            translations: t("admin.card.translations"),
            ingestion: t("admin.card.ingestion"),
            search: t("admin.card.search"),
            audit: t("admin.card.audit"),
            media: t("admin.card.media"),
            homepage: t("admin.card.homepage"),
            favicon: t("admin.card.favicon"),
          }}
        />
      </AdminWelcomeGate>
    );
  }

  return (
    <AdminDashboard
      labels={{
        title: t("admin.dashboard.title"),
        subtitle: t("admin.dashboard.subtitle"),
        signOut: t("admin.signOut"),
        welcome: t("admin.welcomeLine"),
        prayers: t("admin.card.prayers"),
        saints: t("admin.card.saints"),
        apparitions: t("admin.card.apparitions"),
        parishes: t("admin.card.parishes"),
        liturgy: t("admin.card.liturgy"),
        translations: t("admin.card.translations"),
        ingestion: t("admin.card.ingestion"),
        search: t("admin.card.search"),
        audit: t("admin.card.audit"),
        media: t("admin.card.media"),
        homepage: t("admin.card.homepage"),
        favicon: t("admin.card.favicon"),
      }}
    />
  );
}

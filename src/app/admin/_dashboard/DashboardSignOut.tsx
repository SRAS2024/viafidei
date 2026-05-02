import type { Translator } from "@/lib/i18n/translator";

export function DashboardSignOut({ t }: { t: Translator }) {
  return (
    <div className="mt-14 flex justify-center">
      <form action="/api/admin/logout" method="post">
        <button type="submit" className="vf-btn vf-btn-ghost">
          {t("admin.signOut")}
        </button>
      </form>
    </div>
  );
}

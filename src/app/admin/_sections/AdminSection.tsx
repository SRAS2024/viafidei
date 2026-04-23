import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";

export async function AdminSection({
  titleKey,
  subtitle,
  children,
}: {
  titleKey: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const { t } = await getTranslator();
  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <Link href="/admin" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="vf-nav-link">
            {t("admin.signOut")}
          </button>
        </form>
      </div>
      <div className="text-center">
        <h1 className="font-display text-5xl text-ink">{t(titleKey)}</h1>
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-reading font-serif text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      <div className="mt-12">{children}</div>
    </div>
  );
}

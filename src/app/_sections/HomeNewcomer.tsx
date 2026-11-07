import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

/** The welcome for someone new to the faith: the first half of "Begin here". */
export function HomeNewcomer({ t }: { t: Translator }) {
  return (
    <div className="vf-home-begin-intro">
      <h3 className="vf-subhead">{t("home.newcomer.title")}</h3>
      <p className="vf-reading text-ink-soft">{t("home.newcomer.body")}</p>
      <Link href="/spiritual-life" className="vf-btn vf-btn-primary mt-5">
        {t("nav.spiritualLife")}
      </Link>
    </div>
  );
}

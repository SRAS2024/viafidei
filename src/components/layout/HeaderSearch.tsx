import { typeLabelTranslations } from "@/lib/content-shared/content-type-labels";
import type { Translator } from "@/lib/i18n/translator";

import { HeaderSearchClient, type SuggestLabels } from "./HeaderSearchClient";

type Props = {
  t: Translator;
  locale: string;
  /** "panel" opens the field in a full-width row under the phone's header bar. */
  variant?: "inline" | "panel";
};

const PLURAL_FORMS = ["zero", "one", "two", "few", "many", "other"] as const;

/** The words of the suggestions in the reader's language, for the browser to fill in. */
export function suggestLabels(t: Translator, locale: string): SuggestLabels {
  const count: SuggestLabels["count"] = {};
  for (const form of PLURAL_FORMS) {
    const key = `search.suggest.count.${form}`;
    const text = t(key);
    if (text !== key) count[form] = text;
  }
  return {
    locale,
    types: typeLabelTranslations(t),
    searching: t("search.suggest.searching"),
    unavailable: t("search.suggest.unavailable"),
    none: t("search.suggest.none"),
    count,
    list: t("search.suggest.list"),
    keysSpoken: t("search.suggest.keysSpoken"),
    keysShown: t("search.suggest.keysShown"),
    all: t("search.suggest.all"),
  };
}

export function HeaderSearch({ t, locale, variant }: Props) {
  return (
    <HeaderSearchClient
      placeholder={t("search.placeholder")}
      ariaLabel={t("search.site")}
      labels={suggestLabels(t, locale)}
      variant={variant}
    />
  );
}

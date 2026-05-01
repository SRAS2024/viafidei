export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_LABELS,
  isSupportedLocale,
  normalizeLocale,
  type Locale,
} from "./locales";
export {
  createTranslator,
  getDictionary,
  type Translator,
  type Dict,
} from "./translator";
export {
  getLocale,
  getTranslator,
  LOCALE_COOKIE_NAME,
} from "./server";

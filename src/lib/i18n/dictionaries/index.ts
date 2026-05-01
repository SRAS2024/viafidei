import type { Locale } from "../locales";
import type { Dict } from "./types";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { de } from "./de";
import { pt } from "./pt";
import { pl } from "./pl";
import { la } from "./la";
import { tl } from "./tl";
import { vi } from "./vi";
import { ko } from "./ko";
import { zh } from "./zh";

export type { Dict };

export const DICTIONARIES: Record<Locale, Dict> = {
  en,
  es,
  fr,
  it,
  de,
  pt,
  pl,
  la,
  tl,
  vi,
  ko,
  zh,
};

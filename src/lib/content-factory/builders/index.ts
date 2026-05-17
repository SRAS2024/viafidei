/**
 * Builder registry. Maps each ContentTypeKey to its builder.
 * Adding a new content type means adding the file + an entry here.
 */

import type { Builder, ContentTypeKey } from "../types";
import { PrayerBuilder } from "./prayer";
import { SaintBuilder } from "./saint";
import { MarianApparitionBuilder } from "./apparition";
import { ParishBuilder } from "./parish";
import { DevotionBuilder } from "./devotion";
import { NovenaBuilder } from "./novena";
import { SacramentBuilder } from "./sacrament";
import { RosaryBuilder } from "./rosary";
import { ConsecrationBuilder } from "./consecration";
import { SpiritualGuidanceBuilder } from "./spiritual-guidance";
import { LiturgyBuilder } from "./liturgy";
import { HistoryBuilder } from "./history";

export const BUILDER_REGISTRY: Record<ContentTypeKey, Builder> = {
  Prayer: PrayerBuilder,
  Saint: SaintBuilder,
  MarianApparition: MarianApparitionBuilder,
  Parish: ParishBuilder,
  Devotion: DevotionBuilder,
  Novena: NovenaBuilder,
  Sacrament: SacramentBuilder,
  Rosary: RosaryBuilder,
  Consecration: ConsecrationBuilder,
  SpiritualGuidance: SpiritualGuidanceBuilder,
  Liturgy: LiturgyBuilder,
  History: HistoryBuilder,
};

export function getBuilder(contentType: ContentTypeKey): Builder {
  const b = BUILDER_REGISTRY[contentType];
  if (!b) throw new Error(`No builder registered for content type ${contentType}`);
  return b;
}

export {
  PrayerBuilder,
  SaintBuilder,
  MarianApparitionBuilder,
  ParishBuilder,
  DevotionBuilder,
  NovenaBuilder,
  SacramentBuilder,
  RosaryBuilder,
  ConsecrationBuilder,
  SpiritualGuidanceBuilder,
  LiturgyBuilder,
  HistoryBuilder,
};
export { buildScriptureBlock, APP_SCRIPTURE_TRANSLATION_POLICY } from "./scripture-block";

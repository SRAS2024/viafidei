/**
 * The GUIDE registry.
 *
 * Every guide now lives in a per-topic file under `./guides/`. The nine
 * hand-written guides that used to live in THIS file were thin (a summary and
 * five or six one-line steps, no intro / whatYouNeed / tips / duration) and
 * every one of their slugs has been rewritten in a `./guides/*` file with the
 * full schema, so the legacy entries were deleted rather than kept alongside:
 * two entries with the same slug would seed two ChecklistItem rows.
 *
 * NOTE ON MODULE RESOLUTION: this file (`guides.ts`) sits beside a `guides/`
 * DIRECTORY. Node, tsx, vite and webpack all try extension resolution before
 * directory resolution, so the bare specifier `./guides` (used by `./index`,
 * and `@/lib/checklist/knowledge/guides` used by tests) resolves HERE, to
 * `guides.ts`, and never to the directory. The group files below are therefore
 * imported by their full explicit path (`./guides/rosary-chaplets`) so nothing
 * depends on directory-index resolution. `tests/checklist/knowledge.test.ts`
 * pins this behaviour with a real import.
 */

import type { CuratedEntry } from "./index";

import { confessionAndAdorationGuides } from "./guides/confession-adoration";
import { consecrationAndDiscernmentGuides } from "./guides/consecration-discernment";
import { prayerAndDevotionGuidesOne } from "./guides/prayer-devotions-1";
import { prayerAndDevotionGuidesTwo } from "./guides/prayer-devotions-2";
import { rosaryAndChapletGuides } from "./guides/rosary-chaplets";
import { sacramentGuidesOne } from "./guides/sacraments-1";
import { sacramentGuidesTwo } from "./guides/sacraments-2";
import { seasonsAndOciaGuides } from "./guides/seasons-ocia";

export const guideKnowledge: CuratedEntry[] = [
  ...rosaryAndChapletGuides,
  ...confessionAndAdorationGuides,
  ...prayerAndDevotionGuidesOne,
  ...prayerAndDevotionGuidesTwo,
  ...consecrationAndDiscernmentGuides,
  ...sacramentGuidesOne,
  ...sacramentGuidesTwo,
  ...seasonsAndOciaGuides,
];

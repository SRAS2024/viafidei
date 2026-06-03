import type { ChecklistSeed } from "./index";
import { CATHOLIC_RITES } from "@/lib/content-shared/rites";

const RITE_NAMES: Record<string, string> = {
  roman: "Roman (Latin) Rite",
  byzantine: "Byzantine Rite",
  maronite: "Maronite Rite",
  chaldean: "Chaldean Rite",
  coptic: "Coptic Rite",
  syroMalabar: "Syro-Malabar Rite",
  syroMalankara: "Syro-Malankara Rite",
  armenian: "Armenian Rite",
  ethiopic: "Ethiopic (Ge'ez) Rite",
  melkite: "Melkite Greek Rite",
  ukrainian: "Ukrainian Greek Catholic Rite",
  ruthenian: "Ruthenian Rite",
};

/**
 * Seed the recognized Catholic rites (the canonical list in
 * content-shared/rites.ts). Each becomes a rite record with a History
 * section the Admin Worker fills from approved sources.
 */
export const ritesChecklist: ChecklistSeed[] = CATHOLIC_RITES.map((rite, i) => ({
  canonicalName: RITE_NAMES[rite] ?? rite,
  canonicalSlug: `rite-${rite.replace(/([A-Z])/g, "-$1").toLowerCase()}`,
  priority: 10 + i,
  authorityLevelHint: "VATICAN",
  metadata: { riteKey: rite },
}));

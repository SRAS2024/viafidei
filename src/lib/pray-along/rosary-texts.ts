/**
 * The words the Rosary says that are not a prayer of their own: each mystery's
 * announcement before its decade, the versicle and response after the Hail, Holy
 * Queen, and the closing prayer. The prayers themselves (the Creed, the Our Father,
 * the Hail Mary, the Glory Be, the Fatima Prayer, the Hail, Holy Queen) are the site's
 * own prayer records, in the language the reader prays them in.
 *
 * English follows the site's own Rosary guide (how-to-pray-the-rosary) and the mystery
 * names in src/lib/content-shared/rosary.ts. Each other language follows the wording
 * of its bishops' conference or of the Holy See, as gathered and checked for this
 * feature (sources in docs/pray-along-audio.md). A language without an entry says
 * these parts in English.
 *
 * Pure: no I/O, no React.
 */

import type { MysterySetKey } from "@/lib/content-shared/rosary";

import type { AudioLang } from "./languages";

export interface RosaryTexts {
  /** Each set's five announcements, in order, as a leader says them aloud. */
  announcements: Readonly<Record<MysterySetKey, readonly string[]>>;
  versicle: string;
  response: string;
  letUsPray: string;
  closingPrayer: string;
}

const ENGLISH: RosaryTexts = {
  announcements: {
    joyful: [
      "The First Joyful Mystery: The Annunciation.",
      "The Second Joyful Mystery: The Visitation.",
      "The Third Joyful Mystery: The Nativity.",
      "The Fourth Joyful Mystery: The Presentation in the Temple.",
      "The Fifth Joyful Mystery: The Finding of Jesus in the Temple.",
    ],
    sorrowful: [
      "The First Sorrowful Mystery: The Agony in the Garden.",
      "The Second Sorrowful Mystery: The Scourging at the Pillar.",
      "The Third Sorrowful Mystery: The Crowning with Thorns.",
      "The Fourth Sorrowful Mystery: The Carrying of the Cross.",
      "The Fifth Sorrowful Mystery: The Crucifixion and Death of Our Lord.",
    ],
    glorious: [
      "The First Glorious Mystery: The Resurrection.",
      "The Second Glorious Mystery: The Ascension.",
      "The Third Glorious Mystery: The Descent of the Holy Spirit.",
      "The Fourth Glorious Mystery: The Assumption of Mary.",
      "The Fifth Glorious Mystery: The Coronation of Mary as Queen of Heaven.",
    ],
    luminous: [
      "The First Luminous Mystery: The Baptism of Jesus in the Jordan.",
      "The Second Luminous Mystery: The Wedding at Cana.",
      "The Third Luminous Mystery: The Proclamation of the Kingdom of God.",
      "The Fourth Luminous Mystery: The Transfiguration.",
      "The Fifth Luminous Mystery: The Institution of the Eucharist.",
    ],
  },
  versicle: "Pray for us, O holy Mother of God.",
  response: "That we may be made worthy of the promises of Christ.",
  letUsPray: "Let us pray.",
  closingPrayer:
    "O God, whose only begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.",
};

/** Filled from the checked texts of every language the Rosary is prayed in here. */
const ROSARY_TEXTS: Partial<Record<AudioLang, RosaryTexts>> = {
  en: ENGLISH,
};

/** The Rosary's own words in `lang`, or null when there are none in that language. */
export function rosaryTextsFor(lang: AudioLang): RosaryTexts | null {
  return ROSARY_TEXTS[lang] ?? null;
}

import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const USCCB = "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers";

function litany(slug: string, title: string, category: string, body: string): CuratedEntry {
  return {
    contentType: "PRAYER",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, USCCB],
    payload: {
      slug,
      title,
      body,
      prayerType: "litany",
      category,
      language: "en",
      occasions: ["devotion"],
      relatedSaints: [],
      citations: [VATICAN, USCCB],
    },
  };
}

/**
 * Approved Catholic litanies — sustained sequences of invocations and
 * responses. Curated as PRAYER entries with prayerType "litany" so they
 * surface on the /litanies tab (categorizePrayer routes any litany there).
 * Texts are the traditional approved forms, reproduced verbatim. Ground-truth
 * content the worker can publish without a live fetch.
 *
 * Only the Sacred Heart litany still lives here. The Litany of Loreto, the
 * Litany of Saint Joseph and the Litany of Humility were deleted from this
 * file because `./prayers/batch-1.ts` republishes those three slugs from the
 * Holy See's own text (Loreto with the 2020 invocations, Saint Joseph with the
 * official Latin issued 1 May 2021) — two entries with one slug would seed two
 * ChecklistItem rows. batch-1 deliberately did NOT rewrite the Sacred Heart
 * litany, so this correct text stands.
 */
export const litanyKnowledge: CuratedEntry[] = [
  litany(
    "litany-of-the-sacred-heart-of-jesus",
    "Litany of the Sacred Heart of Jesus",
    "christological",
    [
      "Lord, have mercy. Christ, have mercy. Lord, have mercy.",
      "Christ, hear us. Christ, graciously hear us.",
      "God the Father of heaven, have mercy on us.",
      "God the Son, Redeemer of the world, have mercy on us.",
      "God the Holy Spirit, have mercy on us.",
      "Holy Trinity, one God, have mercy on us.",
      "",
      "Heart of Jesus, Son of the Eternal Father, have mercy on us.",
      "Heart of Jesus, formed by the Holy Spirit in the womb of the Virgin Mother, have mercy on us.",
      "Heart of Jesus, substantially united to the Word of God, have mercy on us.",
      "Heart of Jesus, of infinite majesty, have mercy on us.",
      "Heart of Jesus, holy temple of God, have mercy on us.",
      "Heart of Jesus, tabernacle of the Most High, have mercy on us.",
      "Heart of Jesus, house of God and gate of heaven, have mercy on us.",
      "Heart of Jesus, burning furnace of charity, have mercy on us.",
      "Heart of Jesus, abode of justice and love, have mercy on us.",
      "Heart of Jesus, full of goodness and love, have mercy on us.",
      "Heart of Jesus, abyss of all virtues, have mercy on us.",
      "Heart of Jesus, most worthy of all praise, have mercy on us.",
      "Heart of Jesus, king and center of all hearts, have mercy on us.",
      "Heart of Jesus, in whom are all the treasures of wisdom and knowledge, have mercy on us.",
      "Heart of Jesus, in whom dwells the fullness of divinity, have mercy on us.",
      "Heart of Jesus, in whom the Father was well pleased, have mercy on us.",
      "Heart of Jesus, of whose fullness we have all received, have mercy on us.",
      "Heart of Jesus, desire of the everlasting hills, have mercy on us.",
      "Heart of Jesus, patient and most merciful, have mercy on us.",
      "Heart of Jesus, enriching all who invoke you, have mercy on us.",
      "Heart of Jesus, fountain of life and holiness, have mercy on us.",
      "Heart of Jesus, propitiation for our sins, have mercy on us.",
      "Heart of Jesus, filled with reproaches, have mercy on us.",
      "Heart of Jesus, bruised for our offenses, have mercy on us.",
      "Heart of Jesus, obedient unto death, have mercy on us.",
      "Heart of Jesus, pierced with a lance, have mercy on us.",
      "Heart of Jesus, source of all consolation, have mercy on us.",
      "Heart of Jesus, our life and resurrection, have mercy on us.",
      "Heart of Jesus, our peace and reconciliation, have mercy on us.",
      "Heart of Jesus, victim for our sins, have mercy on us.",
      "Heart of Jesus, salvation of those who hope in you, have mercy on us.",
      "Heart of Jesus, hope of those who die in you, have mercy on us.",
      "Heart of Jesus, delight of all the saints, have mercy on us.",
      "",
      "Lamb of God, who take away the sins of the world, spare us, O Lord.",
      "Lamb of God, who take away the sins of the world, graciously hear us, O Lord.",
      "Lamb of God, who take away the sins of the world, have mercy on us.",
    ].join("\n"),
  ),
];

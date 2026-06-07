/**
 * Rite families for the /rites tab. Splits published RITE items into the Latin
 * (Western) Rite and the Eastern Catholic rites by their `riteKey` (the
 * canonical key from content-shared/rites.ts), all in full communion with Rome.
 */
import { fieldIn, titleMatches, type PayloadFilter } from "./payload-filter";

export const RITE_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  {
    key: "latin",
    label: "Latin (Western)",
    matches: (p) => fieldIn(p, "riteKey", ["roman"]) || titleMatches(p, /\b(roman|latin)\b/i),
  },
  {
    key: "eastern",
    label: "Eastern Catholic",
    matches: (p) => {
      const k = p.riteKey;
      return typeof k === "string" && k.length > 0 && k !== "roman";
    },
  },
];

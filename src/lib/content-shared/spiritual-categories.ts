/**
 * Spiritual-life categories for the /spiritual-life tab. Splits published
 * SPIRITUAL_PRACTICE items by their `practiceKind` into Prayer, Penance &
 * Almsgiving, Pilgrimage, and Discernment & Direction.
 */
import { fieldIn, type PayloadFilter } from "./payload-filter";

export const SPIRITUAL_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  {
    key: "prayer",
    label: "Prayer",
    matches: (p) => fieldIn(p, "practiceKind", ["contemplative_prayer", "lectio_divina", "examen"]),
  },
  {
    key: "penance",
    label: "Penance & Almsgiving",
    matches: (p) =>
      fieldIn(p, "practiceKind", [
        "fasting",
        "almsgiving",
        "mortification",
        "stations_of_the_cross",
      ]),
  },
  {
    key: "pilgrimage",
    label: "Pilgrimage",
    matches: (p) => fieldIn(p, "practiceKind", ["pilgrimage"]),
  },
  {
    key: "discernment",
    label: "Discernment & Direction",
    matches: (p) => fieldIn(p, "practiceKind", ["discernment", "vocation", "spiritual_direction"]),
  },
];

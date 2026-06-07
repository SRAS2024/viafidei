/**
 * Liturgy categories for the /liturgy tab. Splits published LITURGICAL items by
 * their `kind` so visitors can browse Feasts & Solemnities, Memorials, the
 * liturgical Seasons, the Mass & sacramental Rites, and explanatory entries.
 */
import { fieldIn, type PayloadFilter } from "./payload-filter";

export const LITURGICAL_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  {
    key: "feasts",
    label: "Feasts & Solemnities",
    matches: (p) => fieldIn(p, "kind", ["feast", "solemnity"]),
  },
  {
    key: "memorials",
    label: "Memorials",
    matches: (p) => fieldIn(p, "kind", ["memorial", "optional_memorial"]),
  },
  {
    key: "seasons",
    label: "Seasons",
    matches: (p) => fieldIn(p, "kind", ["liturgical_season", "liturgical_year"]),
  },
  {
    key: "mass-rites",
    label: "Mass & Rites",
    matches: (p) =>
      fieldIn(p, "kind", ["mass_structure", "marriage_rite", "funeral_rite", "ordination_rite"]),
  },
  {
    key: "explained",
    label: "Explained",
    matches: (p) => fieldIn(p, "kind", ["council_event", "symbolism", "glossary_term"]),
  },
];

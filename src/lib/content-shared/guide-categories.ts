/**
 * Guide categories for the /guides tab. Splits published GUIDE items by their
 * `kind` so visitors can jump straight to Chaplets (the Divine Mercy Chaplet
 * and others), the Rosary, sacramental-life guides, and the rest.
 */
import { fieldIn, titleMatches, type PayloadFilter } from "./payload-filter";

export const GUIDE_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  {
    key: "chaplets",
    label: "Chaplets",
    matches: (p) => fieldIn(p, "kind", ["chaplet"]) || titleMatches(p, /chaplet/i),
  },
  {
    key: "rosary",
    label: "Rosary",
    matches: (p) => fieldIn(p, "kind", ["rosary"]) || titleMatches(p, /rosary/i),
  },
  {
    key: "sacramental",
    label: "Sacramental Life",
    matches: (p) =>
      fieldIn(p, "kind", ["confession", "adoration", "consecration"]) ||
      typeof p.sacramentKey === "string",
  },
  {
    key: "discernment",
    label: "Discernment & Vocation",
    matches: (p) => fieldIn(p, "kind", ["discernment", "vocation"]),
  },
  {
    key: "seasonal",
    label: "Seasonal",
    matches: (p) => fieldIn(p, "kind", ["lent_preparation", "advent_preparation"]),
  },
  {
    key: "rcia",
    label: "RCIA / OCIA",
    matches: (p) => fieldIn(p, "kind", ["rcia", "ocia"]),
  },
  { key: "general", label: "General", matches: (p) => fieldIn(p, "kind", ["general"]) },
];

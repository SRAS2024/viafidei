import type { ChecklistSeed } from "./index";

/**
 * Seed parishes — notable, unambiguously real basilicas, cathedrals, and
 * shrines that the worker can verify from approved directory sources. The
 * Admin Worker expands the directory from approved sources beyond this seed;
 * these anchor the catalog with well-documented records.
 */
export const parishesChecklist: ChecklistSeed[] = [
  {
    canonicalName: "Basilica of the National Shrine of the Immaculate Conception",
    canonicalSlug: "basilica-national-shrine-immaculate-conception",
    priority: 10,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    metadata: { designation: "minor-basilica", city: "Washington", state: "DC" },
  },
  {
    canonicalName: "Cathedral of Saint Patrick (New York)",
    canonicalSlug: "cathedral-saint-patrick-new-york",
    priority: 10,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    metadata: { designation: "cathedral", city: "New York", state: "NY" },
  },
  {
    canonicalName: "Basilica of Saint Mary (Minneapolis)",
    canonicalSlug: "basilica-saint-mary-minneapolis",
    priority: 15,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    metadata: { designation: "minor-basilica", city: "Minneapolis", state: "MN" },
  },
  {
    canonicalName: "Cathedral Basilica of Saint Louis",
    canonicalSlug: "cathedral-basilica-saint-louis",
    priority: 15,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    metadata: { designation: "minor-basilica", city: "Saint Louis", state: "MO" },
  },
  {
    canonicalName: "National Shrine of Our Lady of Guadalupe (La Crosse)",
    canonicalSlug: "national-shrine-our-lady-of-guadalupe-la-crosse",
    priority: 20,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    metadata: { designation: "shrine", city: "La Crosse", state: "WI" },
  },
];

import type { ChecklistSeed } from "./index";

/**
 * Seed Doctors of the Church — a sample of the 37 formally-declared Doctors
 * that anchors the tab. The Admin Worker expands to the full set from approved
 * sources. `metadata.doctorTitle` is the honorific epithet.
 */
export const doctorsChecklist: ChecklistSeed[] = [
  {
    canonicalName: "Saint Augustine of Hippo",
    canonicalSlug: "doctor-augustine-of-hippo",
    priority: 10,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Doctor of Grace", feastDay: "August 28" },
  },
  {
    canonicalName: "Saint Thomas Aquinas",
    canonicalSlug: "doctor-thomas-aquinas",
    priority: 10,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Angelic Doctor", feastDay: "January 28" },
  },
  {
    canonicalName: "Saint Jerome",
    canonicalSlug: "doctor-jerome",
    priority: 15,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Doctor of Biblical Science", feastDay: "September 30" },
  },
  {
    canonicalName: "Saint Teresa of Ávila",
    canonicalSlug: "doctor-teresa-of-avila",
    priority: 15,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Doctor of Prayer", feastDay: "October 15" },
  },
  {
    canonicalName: "Saint Catherine of Siena",
    canonicalSlug: "doctor-catherine-of-siena",
    priority: 15,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Doctor of Unity", feastDay: "April 29" },
  },
  {
    canonicalName: "Saint Thérèse of Lisieux",
    canonicalSlug: "doctor-therese-of-lisieux",
    priority: 15,
    authorityLevelHint: "VATICAN",
    metadata: { doctorTitle: "Doctor of Merciful Love", feastDay: "October 1" },
  },
];

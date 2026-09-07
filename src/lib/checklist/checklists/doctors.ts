import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** There are thirty-seven Doctors of the Church, all curated — no extras. */
export const doctorsExtras: ChecklistSeed[] = [];

/**
 * The thirty-seven Doctors of the Church (knowledge/doctors.ts).
 * `metadata.doctorTitle` is the honorific epithet; `metadata.feastDay` is MM-DD.
 */
export const doctorsChecklist: ChecklistSeed[] = curatedChecklist("DOCTOR", {
  metadataFields: ["doctorTitle", "feastDay", "ecclesialRole"],
  extras: doctorsExtras,
});

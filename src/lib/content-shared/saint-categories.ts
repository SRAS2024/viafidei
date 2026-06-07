/**
 * Saint categories for the /saints tab. Splits published SAINT items by their
 * `saintType` so the catalog can be browsed by the Church's traditional
 * groupings (Martyrs, Doctors, Apostles, Popes, Bishops, Religious & Founders,
 * Virgins, Laity). "confessor"/"other" appear only under "All".
 */
import { fieldIn, type PayloadFilter } from "./payload-filter";

export const SAINT_FILTERS: readonly PayloadFilter[] = [
  { key: "all", label: "All", matches: () => true },
  { key: "martyrs", label: "Martyrs", matches: (p) => fieldIn(p, "saintType", ["martyr"]) },
  {
    key: "doctors",
    label: "Doctors",
    matches: (p) => fieldIn(p, "saintType", ["doctor_of_the_church"]),
  },
  {
    key: "apostles",
    label: "Apostles & Evangelists",
    matches: (p) => fieldIn(p, "saintType", ["apostle", "evangelist"]),
  },
  { key: "popes", label: "Popes", matches: (p) => fieldIn(p, "saintType", ["pope"]) },
  { key: "bishops", label: "Bishops", matches: (p) => fieldIn(p, "saintType", ["bishop"]) },
  {
    key: "religious",
    label: "Religious & Founders",
    matches: (p) => fieldIn(p, "saintType", ["religious", "founder", "missionary"]),
  },
  { key: "virgins", label: "Virgins", matches: (p) => fieldIn(p, "saintType", ["virgin"]) },
  { key: "laity", label: "Laity", matches: (p) => fieldIn(p, "saintType", ["lay"]) },
];

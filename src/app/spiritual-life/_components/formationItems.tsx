import {
  RosaryIcon,
  ConfessionIcon,
  AdorationIcon,
  ConsecrationIcon,
  VocationsIcon,
} from "@/components/icons/SpiritualLifeIcons";

export type FormationTone = "marian" | "eucharist" | "ink";

export type FormationItem = {
  id: string;
  key: string;
  tone: FormationTone;
  icon: React.ReactNode;
};

export const FORMATION_ITEMS: FormationItem[] = [
  { id: "rosary", key: "spiritualLife.rosary", tone: "marian", icon: <RosaryIcon /> },
  { id: "confession", key: "spiritualLife.confession", tone: "ink", icon: <ConfessionIcon /> },
  { id: "adoration", key: "spiritualLife.adoration", tone: "eucharist", icon: <AdorationIcon /> },
  {
    id: "consecration",
    key: "spiritualLife.consecration",
    tone: "marian",
    icon: <ConsecrationIcon />,
  },
  { id: "vocations", key: "spiritualLife.vocations", tone: "ink", icon: <VocationsIcon /> },
];

export function toneClass(tone: FormationTone): string {
  switch (tone) {
    case "marian":
      return "vf-icon-marian";
    case "eucharist":
      return "vf-icon-eucharist";
    default:
      return "text-ink";
  }
}

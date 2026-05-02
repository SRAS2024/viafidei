export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "I." },
  { href: "/admin/prayers", labelKey: "admin.card.prayers", eyebrow: "II." },
  { href: "/admin/saints", labelKey: "admin.card.saints", eyebrow: "III." },
  { href: "/admin/apparitions", labelKey: "admin.card.apparitions", eyebrow: "IV." },
  { href: "/admin/parishes", labelKey: "admin.card.parishes", eyebrow: "V." },
  { href: "/admin/liturgy", labelKey: "admin.card.liturgy", eyebrow: "VI." },
  { href: "/admin/translations", labelKey: "admin.card.translations", eyebrow: "VII." },
  { href: "/admin/ingestion", labelKey: "admin.card.ingestion", eyebrow: "VIII." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "IX." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "X." },
  { href: "/admin/favicon", labelKey: "admin.card.favicon", eyebrow: "XI." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XII." },
];

import { redirect } from "next/navigation";

// The old combined /liturgy-history index is now split into two top-level
// tabs: /liturgy (Mass + liturgical year + rites + symbolism + glossary)
// and /history (chronological timeline + council documents). Anyone
// landing on the old URL goes to the History tab — it carries the
// timeline that was the most-linked-to part of the old page. The
// /liturgy-history/[slug] detail route stays in place so existing
// deep-links to individual entries keep working.

export const dynamic = "force-dynamic";

export default function LiturgyHistoryIndexPage(): never {
  redirect("/history");
}

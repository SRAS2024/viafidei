import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getTranslationCounts } from "@/lib/data/translations";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const counts = await getTranslationCounts();
  return jsonOk({ counts });
}

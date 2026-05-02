import { jsonOk } from "@/lib/http";
import { GOAL_TEMPLATES } from "@/lib/data/goal-templates";

export async function GET() {
  return jsonOk({ templates: GOAL_TEMPLATES });
}

import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { redirectTo } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  const session = await getSession();
  session.destroy();
  return redirectTo(req, "/");
}

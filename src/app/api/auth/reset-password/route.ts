import { type NextRequest } from "next/server";
import { consumePasswordResetToken, resetPasswordSchema } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`reset:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = resetPasswordSchema.safeParse(body.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "mismatch") {
      return jsonError("invalid", { message: "mismatch" });
    }
    if (issue?.message === "weak") {
      return jsonError("invalid", { message: "weak" });
    }
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("invalid", { message: result.reason });
  }
  return jsonOk({ reset: true });
}

import { type NextRequest } from "next/server";
import { z } from "zod";
import { consumePasswordResetToken } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z
  .object({
    token: z.string().min(20).max(256),
    password: z.string().min(12).max(256),
    passwordConfirm: z.string().min(12).max(256),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`reset:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("invalid", { message: result.reason });
  }
  return jsonOk({ reset: true });
}

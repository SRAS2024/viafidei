/**
 * Signed ban-device link handler. The admin clicks a URL from a
 * Security Breach email; this route verifies the signature, writes a
 * BannedDevice row, and renders a plain confirmation page. The
 * action is idempotent: clicking the same link twice does not
 * unban or duplicate.
 *
 * The link is single-use in the practical sense — the BannedDevice
 * row is keyed on `deviceCredentialHash`, so a second click on a
 * link for the same device finds the existing row and reports
 * "already banned".
 *
 * No admin authentication is required because the token itself
 * (HMAC-signed with SESSION_SECRET) authenticates the request. The
 * token expires after 24 hours.
 */

import { type NextRequest } from "next/server";
import { decodeBanToken } from "@/lib/security/ban-token";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

type Params = { token: string };

export async function GET(
  req: NextRequest,
  context: { params: Promise<Params> },
): Promise<Response> {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const { token } = await context.params;
  const decoded = decodeBanToken(token);
  if (!decoded.ok) {
    logger.warn("security.ban_token.invalid", { reason: decoded.reason, requestId });
    return renderHtml(
      400,
      buildPage({
        heading: "Ban link is not valid",
        body:
          decoded.reason === "expired"
            ? "This ban link has expired. Send a new request from the most recent Security Breach email."
            : "This ban link could not be verified.",
      }),
    );
  }
  const { securityEventId, deviceCredentialHash } = decoded.claims;
  // Look up the original event to surface context on the confirmation
  // page. The event row may have been pruned; we tolerate that.
  const event = await prisma.securityEvent
    .findUnique({ where: { id: securityEventId } })
    .catch(() => null);

  const existing = await prisma.bannedDevice
    .findUnique({ where: { deviceCredentialHash } })
    .catch(() => null);

  if (existing && existing.active) {
    logger.info("security.ban_device.already_banned", {
      requestId,
      bannedDeviceId: existing.id,
      securityEventId,
    });
    return renderHtml(
      200,
      buildPage({
        heading: "Device already banned",
        body: `This device was banned at ${existing.createdAt.toISOString()}. No further action needed.`,
      }),
    );
  }

  const now = new Date();
  await prisma.bannedDevice.create({
    data: {
      deviceCredentialHash,
      banReason: event?.eventType ?? "signed_ban_link",
      securityEventId,
      createdBy: "signed_ban_link",
      firstSeenAt: now,
      lastSeenAt: now,
      ipAddressHash: event?.ipAddressHash ?? null,
      userAgentHash: event?.userAgentHash ?? null,
      active: true,
    },
  });
  // Revoke any active sessions whose stored device-credential hash
  // matches. Best-effort — the security row is the durable record
  // regardless of whether sessions could be wiped here.
  await prisma.session
    .deleteMany({ where: { deviceCredentialHash } })
    .catch(() => undefined);

  logger.info("security.ban_device.banned", {
    requestId,
    securityEventId,
  });

  return renderHtml(
    200,
    buildPage({
      heading: "Device banned",
      body: `The device that triggered SecurityEvent ${securityEventId} has been banned. Future requests from that device credential will be blocked before any page renders.`,
    }),
  );
}

function renderHtml(status: number, html: string): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function buildPage({ heading, body }: { heading: string; body: string }): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<title>Via Fidei security</title>",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "</head>",
    "<body style=\"font-family: ui-serif, Georgia, serif; max-width: 640px; margin: 80px auto; padding: 0 24px; color: #111\">",
    `<h1 style=\"font-size: 28px; margin-bottom: 16px\">${escapeHtml(heading)}</h1>`,
    `<p style=\"font-size: 16px; line-height: 1.5\">${escapeHtml(body)}</p>`,
    "</body>",
    "</html>",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

#!/usr/bin/env tsx
/**
 * Send the one-off "Thank you!" letter (src/lib/email/thank-you.ts) to Via
 * Fidei's members, each in the language saved on their account.
 *
 *   npx tsx scripts/email/send-thank-you.ts --railway                       # dry run: recipients + figures, sends nothing
 *   npx tsx scripts/email/send-thank-you.ts --railway --preview-dir <dir>   # also write every language's HTML + text
 *   npx tsx scripts/email/send-thank-you.ts --railway --send --only <email> --ledger <file>
 *   npx tsx scripts/email/send-thank-you.ts --railway --send --all --ledger <file>
 *
 * --railway resolves the production database (public proxy URL) and the Resend
 * key from the linked Railway project, in memory only; without it DATABASE_URL
 * and RESEND_API_KEY come from the environment. Nothing secret is printed.
 *
 * A second run never sends twice: every delivered member is written to the
 * --ledger file and skipped next time, and each send carries a Resend
 * idempotency key built from the member's id.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { CHURCH_HISTORY_EVENTS } from "../../src/lib/content-shared/church-history-events";
import { SAINT_DUPLICATE_OF } from "../../src/lib/content-shared/saints";
import { sendTransactionalEmail } from "../../src/lib/email/resend";
import {
  renderThankYouEmail,
  THANK_YOU_LOCALES,
  type SiteContentCounts,
} from "../../src/lib/email/thank-you";
import { resolveEmailLocale } from "../../src/lib/email/translations";

const SITE_URL = "https://etviafidei.com";
const CAMPAIGN = "via-fidei-thank-you-2026-11";
const PAUSE_MS = 700; // Resend's default ceiling is a couple of requests a second.

type Args = {
  railway: boolean;
  send: boolean;
  all: boolean;
  only: string | null;
  ledger: string | null;
  previewDir: string | null;
};

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : null;
  };
  return {
    railway: argv.includes("--railway"),
    send: argv.includes("--send"),
    all: argv.includes("--all"),
    only: value("--only"),
    ledger: value("--ledger"),
    previewDir: value("--preview-dir"),
  };
}

function railwayJson(args: string[]): Record<string, string> {
  const out = execFileSync("railway", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
  });
  return JSON.parse(out) as Record<string, string>;
}

/** Production database (public proxy) and Resend key, from the linked Railway project. */
function loadRailwayEnvironment(): void {
  const helper = path.join(__dirname, "..", "desktop-app", "railway-public-db-url.mjs");
  const out = execFileSync(process.execPath, [helper], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const resolved = out
    .trim()
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as {
          publicDbUrl?: string;
          webService?: string;
          environment?: string;
        };
      } catch {
        return null;
      }
    })
    .find((v) => v?.publicDbUrl);
  if (!resolved?.publicDbUrl || !resolved.webService) {
    throw new Error("could not resolve the Railway project — run `railway login && railway link`");
  }
  process.env.DATABASE_URL = resolved.publicDbUrl;
  const vars = railwayJson([
    "variables",
    "--service",
    resolved.webService,
    ...(resolved.environment ? ["--environment", resolved.environment] : []),
    "--json",
  ]);
  if (!vars.RESEND_API_KEY) throw new Error(`RESEND_API_KEY is not set on ${resolved.webService}`);
  process.env.RESEND_API_KEY = vars.RESEND_API_KEY;
}

/** The figures a visitor sees: published rows per section, saints without the hidden duplicates. */
async function readCounts(prisma: PrismaClient): Promise<SiteContentCounts> {
  const grouped = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: true,
  });
  const count = (type: string) => grouped.find((g) => g.contentType === type)?._count ?? 0;

  // A duplicate saint record is hidden only while its canonical record is live
  // (src/lib/data/published.ts, liveSaintDuplicates); mirror that exactly.
  const related = await prisma.publishedContent.findMany({
    where: {
      contentType: "SAINT",
      isPublished: true,
      slug: { in: [...Object.keys(SAINT_DUPLICATE_OF), ...Object.values(SAINT_DUPLICATE_OF)] },
    },
    select: { slug: true },
  });
  const live = new Set(related.map((r) => r.slug));
  const hidden = Object.keys(SAINT_DUPLICATE_OF).filter(
    (slug) => live.has(slug) && live.has(SAINT_DUPLICATE_OF[slug]!),
  ).length;

  // The Litanies tab lists the prayers whose subtype is "litany" (src/app/litanies).
  const litanies = await prisma.publishedContent.count({
    where: { contentType: "PRAYER", isPublished: true, subtype: "litany" },
  });

  return {
    prayers: count("PRAYER"),
    litanies,
    devotions: count("DEVOTION"),
    novenas: count("NOVENA"),
    saints: count("SAINT") - hidden,
    apparitions: count("APPARITION"),
    marianTitles: count("MARIAN_TITLE"),
    doctors: count("DOCTOR"),
    popes: count("POPE"),
    parishes: count("PARISH"),
    spiritualLife: count("SPIRITUAL_PRACTICE"),
    guides: count("GUIDE"),
    liturgy: count("LITURGICAL"),
    rites: count("RITE"),
    // The History timeline's events (its documents are counted under Church Documents).
    history: CHURCH_HISTORY_EVENTS.length,
    churchDocuments: count("CHURCH_DOCUMENT"),
  };
}

type Ledger = { campaign: string; sent: Record<string, { at: string; locale: string }> };

function readLedger(file: string): Ledger {
  if (!existsSync(file)) return { campaign: CAMPAIGN, sent: {} };
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Ledger;
  if (parsed.campaign !== CAMPAIGN) throw new Error(`ledger ${file} belongs to another campaign`);
  return parsed;
}

function mask(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.send && !args.all && !args.only) throw new Error("--send needs --all or --only <email>");
  if (args.send && args.all && args.only) throw new Error("use --all or --only, not both");
  if (args.send && !args.ledger) throw new Error("--send needs --ledger <file>");
  if (args.railway) loadRailwayEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (or pass --railway)");

  const prisma = new PrismaClient();
  try {
    const counts = await readCounts(prisma);
    console.log("figures:", JSON.stringify(counts));

    if (args.previewDir) {
      mkdirSync(args.previewDir, { recursive: true });
      for (const locale of THANK_YOU_LOCALES) {
        const r = renderThankYouEmail({ language: locale, counts, siteUrl: SITE_URL });
        writeFileSync(path.join(args.previewDir, `thank-you.${locale}.html`), r.htmlBody);
        writeFileSync(
          path.join(args.previewDir, `thank-you.${locale}.txt`),
          `Subject: ${r.subject}\n\n${r.textBody}`,
        );
      }
      console.log(`previews written to ${args.previewDir} (${THANK_YOU_LOCALES.length} languages)`);
    }

    const users = await prisma.user.findMany({
      where: args.only ? { email: args.only } : {},
      select: { id: true, email: true, language: true },
      orderBy: { createdAt: "asc" },
    });
    if (args.only && users.length !== 1)
      throw new Error(`no member with the address given to --only`);

    const ledger = args.ledger ? readLedger(args.ledger) : { campaign: CAMPAIGN, sent: {} };
    const pending = users.filter((u) => !ledger.sent[u.id]);
    const byLocale: Record<string, number> = {};
    for (const u of pending) {
      const { locale } = renderThankYouEmail({ language: u.language, counts, siteUrl: SITE_URL });
      // Every member must get the letter in the language saved on their account.
      if (locale !== resolveEmailLocale(u.language)) {
        throw new Error(`no letter written in "${u.language}" — refusing to send it in English`);
      }
      byLocale[locale] = (byLocale[locale] ?? 0) + 1;
    }
    console.log(
      `members: ${users.length}; already sent: ${users.length - pending.length}; to send: ${pending.length}`,
      JSON.stringify(byLocale),
    );

    if (!args.send) {
      console.log("dry run — nothing sent");
      return;
    }
    if (!process.env.RESEND_API_KEY)
      throw new Error("RESEND_API_KEY is not set (or pass --railway)");

    let sent = 0;
    let failed = 0;
    for (const user of pending) {
      const email = renderThankYouEmail({ language: user.language, counts, siteUrl: SITE_URL });
      let result = await sendTransactionalEmail({
        to: user.email,
        subject: email.subject,
        textBody: email.textBody,
        htmlBody: email.htmlBody,
        idempotencyKey: `${CAMPAIGN}/${user.id}`,
      });
      for (let attempt = 1; !result.ok && result.statusCode === 429 && attempt <= 4; attempt++) {
        await sleep(2_000 * attempt);
        result = await sendTransactionalEmail({
          to: user.email,
          subject: email.subject,
          textBody: email.textBody,
          htmlBody: email.htmlBody,
          idempotencyKey: `${CAMPAIGN}/${user.id}`,
        });
      }
      if (result.ok && result.delivery === "sent") {
        sent++;
        ledger.sent[user.id] = { at: new Date().toISOString(), locale: email.locale };
        writeFileSync(args.ledger!, JSON.stringify(ledger, null, 2));
        console.log(`sent  ${email.locale}  ${mask(user.email)}`);
      } else {
        failed++;
        const why = result.ok
          ? result.reason
          : `${result.errorName ?? result.reason}: ${result.errorMessage ?? ""}`;
        console.log(`FAIL  ${email.locale}  ${mask(user.email)}  ${why}`);
      }
      await sleep(PAUSE_MS);
    }
    console.log(`done — sent ${sent}, failed ${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

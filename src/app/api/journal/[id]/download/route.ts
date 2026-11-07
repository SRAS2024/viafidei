import { type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getTranslator } from "@/lib/i18n/server";
import { redirectTo } from "@/lib/security/request";
import { escapeHtml, renderJournalBody } from "./render-entry";

/**
 * "Download as PDF" endpoint for a journal entry.
 *
 * Returns a self-contained HTML document with a print stylesheet that opens the browser's
 * print dialog as it loads. The dialog has a built-in "Save as PDF" destination on every
 * major desktop platform, so the user gets a real PDF without us pulling in a server-side
 * PDF library.
 *
 * The page's one script is a file of the site's own, public/journal-print.js. This
 * response carries the site's Content-Security-Policy like every other, and that policy
 * refuses inline script: an inline window.print() here was blocked in every browser, and
 * the reader got a bare page with no dialog. The same file gives the page's button its
 * click, for a reader who dismissed the dialog or whose browser did not show it.
 *
 * This route is admin-gated (requireUser) and only ever serves the
 * authenticated user's own journal entries.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) {
    // The button opens this in a new tab, where a plain "Unauthorized" would be a dead end.
    return redirectTo(req, "/login?next=/profile/journal");
  }
  const entry = await prisma.journalEntry.findUnique({ where: { id: id } });
  if (!entry || entry.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }
  const { t, locale } = await getTranslator();
  const safeTitle = escapeHtml(entry.title);
  const safeBody = renderJournalBody(entry.body);

  const dateLabel = entry.createdAt.toISOString().slice(0, 10);
  const longDate = entry.createdAt.toLocaleDateString(locale, { dateStyle: "long" });

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; padding: 0; font-family: "Cormorant Garamond", "Iowan Old Style", Georgia, serif; color: #1a1a1a; background: #fff; }
    body { padding: 2rem 1.5rem; line-height: 1.55; max-width: 720px; margin: 0 auto; overflow-wrap: anywhere; }
    h1 { font-size: 2.2rem; margin: 0 0 .3rem 0; font-weight: 600; letter-spacing: 0.005em; }
    .meta { color: #5f5f5f; font-size: .9rem; margin-bottom: 1.5rem; border-bottom: 1px solid #d0c8be; padding-bottom: 1rem; }
    h2 { font-size: 1.4rem; margin-top: 1.4rem; margin-bottom: .4rem; }
    p { margin: .6rem 0; }
    blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #b8a07a; color: #4a4a4a; font-style: italic; }
    ul, ol { padding-left: 1.4rem; }
    li { margin: .25rem 0; }
    .footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #d0c8be; font-size: .8rem; color: #5f5f5f; text-align: center; }
    .print-action { margin: 0 0 1.5rem 0; }
    .print-action button { min-height: 44px; padding: 0 1rem; font: inherit; color: #fff; background: #1f3a8a; border: 1px solid #1f3a8a; border-radius: 3px; cursor: pointer; }
    @media print {
      body { padding: 1rem; }
      .no-print { display: none !important; }
    }
  </style>
  <script src="/journal-print.js" defer></script>
</head>
<body>
  <main>
    <p class="print-action no-print"><button type="button" id="print-entry">${escapeHtml(t("profile.journal.printButton"))}</button></p>
    <h1>${safeTitle}</h1>
    <p class="meta">${escapeHtml(t("brand.name"))} · ${escapeHtml(t("profile.tab.journal"))} · ${escapeHtml(longDate)}</p>
    ${safeBody}
  </main>
  <footer class="footer">${escapeHtml(t("brand.name"))}</footer>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="journal-${dateLabel}-${entry.id.slice(0, 8)}.html"`,
      // A private page: no shared cache keeps it, and no browser cache outlives the sign-in.
      "Cache-Control": "private, no-store",
    },
  });
}

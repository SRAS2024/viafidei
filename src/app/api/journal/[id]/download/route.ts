import { type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

/**
 * "Download as PDF" endpoint for a journal entry.
 *
 * Returns a self-contained HTML document with a print stylesheet and an
 * onload `window.print()` call. The browser's print dialog has a built-in
 * "Save as PDF" destination on every major desktop platform, so the user
 * gets a real PDF without us pulling in a server-side PDF library.
 *
 * This route is admin-gated (requireUser) and only ever serves the
 * authenticated user's own journal entries.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const entry = await prisma.journalEntry.findUnique({ where: { id: id } });
  if (!entry || entry.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }
  const safeTitle = entry.title.replace(/[<>&]/g, "");
  const safeBody = entry.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Minimal Markdown rendering: bold, italic, headings, blockquotes,
    // bullets. Block-level paragraphs are split on double newlines.
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trim();
      if (/^##\s+/.test(trimmed)) {
        return `<h2>${trimmed.replace(/^##\s+/, "")}</h2>`;
      }
      if (/^>\s+/.test(trimmed)) {
        return `<blockquote>${trimmed.replace(/^>\s+/, "")}</blockquote>`;
      }
      if (/^(?:[-*]\s+|\d+\.\s+)/.test(trimmed)) {
        const items = trimmed
          .split(/\n/)
          .filter((l) => /^(?:[-*]\s+|\d+\.\s+)/.test(l))
          .map((l) => `<li>${l.replace(/^(?:[-*]\s+|\d+\.\s+)/, "")}</li>`)
          .join("");
        const ordered = /^\d+\.\s+/.test(trimmed);
        return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }
      // Inline bold + italic.
      const inline = trimmed
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/\n/g, "<br/>");
      return `<p>${inline}</p>`;
    })
    .join("\n");

  const dateLabel = entry.createdAt.toISOString().slice(0, 10);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; padding: 0; font-family: "Cormorant Garamond", "Iowan Old Style", Georgia, serif; color: #1a1a1a; }
    body { padding: 2rem 1.5rem; line-height: 1.55; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 2.2rem; margin: 0 0 .3rem 0; font-weight: 600; letter-spacing: 0.005em; }
    .meta { color: #6b6b6b; font-size: .9rem; margin-bottom: 1.5rem; border-bottom: 1px solid #d0c8be; padding-bottom: 1rem; }
    h2 { font-size: 1.4rem; margin-top: 1.4rem; margin-bottom: .4rem; }
    p { margin: .6rem 0; }
    blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #b8a07a; color: #4a4a4a; font-style: italic; }
    ul, ol { padding-left: 1.4rem; }
    li { margin: .25rem 0; }
    .footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #d0c8be; font-size: .8rem; color: #8a8a8a; text-align: center; }
    @media print {
      body { padding: 1rem; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p class="meta">Via Fidei journal · ${dateLabel}</p>
  ${safeBody}
  <p class="footer">Via Fidei</p>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 200); });
  </script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="journal-${dateLabel}-${entry.id.slice(0, 8)}.html"`,
    },
  });
}

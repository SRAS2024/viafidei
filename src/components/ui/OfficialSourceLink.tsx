type Props = {
  /**
   * The upstream URL the row was ingested from. Most ingested content
   * carries it as `externalSourceKey`. Seeded rows have no upstream URL
   * and pass `null` so the component renders nothing.
   */
  url: string | null | undefined;
  /**
   * Optional override for the "Source" label (e.g. "Read on vatican.va")
   * — defaults to a friendly summary derived from the URL host.
   */
  label?: string;
  /**
   * The quiet heading over the link (default "Official source"). `null` renders
   * the link alone, for a page footer that already frames it — a Church
   * document's "Read the full document" is the document, not a citation.
   */
  caption?: string | null;
};

function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    return host;
  } catch {
    return "the official source";
  }
}

/**
 * Renders the official Church / source link for a single piece of
 * content at the bottom of its detail page. The link is rendered only
 * when the row carries an HTTP(S) externalSourceKey — seeded content
 * with no upstream URL omits the section entirely. The component is
 * deliberately small and visually quiet so it does not compete with
 * the body of the page.
 */
export function OfficialSourceLink({ url, label, caption = "Official source" }: Props) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  const friendly = label ?? `Read on ${hostLabel(url)}`;
  if (caption === null) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="vf-btn vf-btn-ghost">
        {friendly} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return (
    <div className="vf-credits vf-fineprint">
      <span className="font-medium">{caption}:</span>{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="break-words">
        {friendly} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

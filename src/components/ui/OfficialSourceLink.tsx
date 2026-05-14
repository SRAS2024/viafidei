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
export function OfficialSourceLink({ url, label }: Props) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  const friendly = label ?? `Read on ${hostLabel(url)}`;
  return (
    <div className="mt-10 border-t border-ink/10 pt-6 text-center">
      <p className="vf-eyebrow text-ink-faint">Official source</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="vf-nav-link mt-2 inline-block break-all"
      >
        {friendly} ↗
      </a>
    </div>
  );
}

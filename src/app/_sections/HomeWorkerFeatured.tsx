import Link from "next/link";

import { featuredHrefFor, type FeaturedBlockView } from "@/lib/data/homepage";

/** Pretty content-type eyebrow for a featured rail (e.g. "Prayers"). */
function railEyebrow(blockType: string): string {
  const label = blockType.replace(/^featured-/, "").replace(/-/g, " ");
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Live homepage featured rails, driven by worker-published
 * `featured-*` blocks. Rendered only when a Homepage Makeover has been
 * published; otherwise the homepage falls back to its static featured
 * section. Mirrors the visual language of the static rails so a
 * published makeover looks native.
 */
export function HomeWorkerFeatured({ blocks }: { blocks: FeaturedBlockView[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-24">
      {blocks.map((block) => (
        <section key={block.blockKey}>
          <div className="mb-10 text-center">
            <p className="vf-eyebrow">{railEyebrow(block.blockType)}</p>
            <h2 className="mt-3 font-display text-4xl">{block.heading}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {block.items.map((item) => (
              <Link
                key={`${block.blockKey}:${item.slug}`}
                href={featuredHrefFor(block.blockType, item.slug)}
                className="vf-card block rounded-sm p-8 transition hover:border-ink/30"
              >
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-4 font-serif text-sm text-ink-faint">Open →</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

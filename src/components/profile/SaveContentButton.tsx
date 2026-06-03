import { requireUser } from "@/lib/auth";
import { isSaved, type SavedKind } from "@/lib/data/saved";

import { SaveButton, type SaveKind } from "./SaveButton";

/**
 * The content types a signed-in user can save, mapped to the public save
 * route segment (SaveKind, e.g. "prayers" → POST /api/saved/prayers) and the
 * data-layer kind. Each entry must have a matching /api/saved/* route; any
 * other content type renders no button rather than a button that 404s.
 */
export const SAVEABLE_CONTENT: Record<string, { kind: SaveKind; savedKind: SavedKind }> = {
  PRAYER: { kind: "prayers", savedKind: "prayer" },
  SAINT: { kind: "saints", savedKind: "saint" },
  APPARITION: { kind: "apparitions", savedKind: "apparition" },
  DEVOTION: { kind: "devotions", savedKind: "devotion" },
  PARISH: { kind: "parishes", savedKind: "parish" },
  NOVENA: { kind: "novenas", savedKind: "novena" },
};

/**
 * Server component: renders the Save/Add button for a published content item,
 * resolving the viewer's auth state and whether they've already saved it. For
 * a content type with no save route it renders nothing, so it is safe to drop
 * onto any detail page. A signed-out viewer still sees the button — clicking
 * it opens the login-required popup.
 */
export async function SaveContentButton({
  contentType,
  slug,
  className,
}: {
  contentType: string;
  slug: string;
  className?: string;
}) {
  const entry = SAVEABLE_CONTENT[contentType];
  if (!entry) return null;
  const user = await requireUser();
  const initiallySaved = user ? await isSaved(entry.savedKind, user.id, slug) : false;
  return (
    <SaveButton
      kind={entry.kind}
      entityId={slug}
      initiallySaved={initiallySaved}
      isAuthed={Boolean(user)}
      className={className}
    />
  );
}

"use client";

import { useState } from "react";
import {
  HeroBlockEditor,
  MissionBlockEditor,
  HomepagePreview,
  EditorActions,
  useBlockState,
  type HomepageBlock,
} from "./_components";

type Props = {
  pageId: string;
  initialBlocks: HomepageBlock[];
};

export function HomepageMirrorEditor({ pageId, initialBlocks }: Props) {
  const { blocks, updateField } = useBlockState(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hero = blocks.find((b) => b.blockKey === "hero");
  const mission = blocks.find((b) => b.blockKey === "mission");

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, blocks }),
      });
      if (!res.ok) throw new Error("save failed");
      setMessage("Saved · live preview updated");
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <p className="vf-eyebrow">Editor</p>
        {hero ? (
          <HeroBlockEditor
            block={hero}
            onChange={(path, value) => updateField("hero", path, value)}
          />
        ) : null}
        {mission ? (
          <MissionBlockEditor
            block={mission}
            onChange={(path, value) => updateField("mission", path, value)}
          />
        ) : null}
        <EditorActions saving={saving} message={message} onSave={onSave} />
      </div>
      <HomepagePreview hero={hero} mission={mission} />
    </div>
  );
}

import type { HomepageBlock } from "./types";

type Props = {
  hero?: HomepageBlock;
  mission?: HomepageBlock;
};

function readSide(block: HomepageBlock | undefined, side: "left" | "right") {
  if (!block) return {};
  const value = block.configJson[side];
  return (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) ?? {};
}

export function HomepagePreview({ hero, mission }: Props) {
  const left = readSide(mission, "left");
  const right = readSide(mission, "right");
  return (
    <div>
      <p className="vf-eyebrow">Live preview</p>
      <div className="vf-card mt-3 rounded-sm p-8">
        {hero ? (
          <div className="text-center">
            <p className="vf-eyebrow">{String(hero.configJson.eyebrow ?? "")}</p>
            <div className="vf-rule mx-auto my-5" />
            <h1 className="font-display text-4xl">{String(hero.configJson.title ?? "")}</h1>
            <p className="mt-4 font-serif text-ink-soft">{String(hero.configJson.lede ?? "")}</p>
          </div>
        ) : null}
        {mission ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <article>
              <h2 className="font-display text-2xl">{String(left.title ?? "")}</h2>
              <p className="mt-3 font-serif text-ink-soft">{String(left.body ?? "")}</p>
            </article>
            <article>
              <h2 className="font-display text-2xl">{String(right.title ?? "")}</h2>
              <p className="mt-3 font-serif text-ink-soft">{String(right.body ?? "")}</p>
            </article>
          </div>
        ) : null}
      </div>
    </div>
  );
}

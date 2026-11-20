import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import type { MysterySetKey } from "@/lib/content-shared/rosary";
import { getProfileForUser } from "@/lib/data/profile";
import { getLocale } from "@/lib/i18n/server";
import { toAudioLang } from "@/lib/pray-along/languages";
import {
  scriptForGuide,
  scriptForNovenaDay,
  scriptForPrayer,
  scriptForRosary,
  type BuiltScript,
} from "@/lib/pray-along/server";
import { buildManifest } from "@/lib/pray-along/store";
import { isRate, type Rate } from "@/lib/pray-along/rate";
import { DEFAULT_VOICE, voiceOrDefault, type Voice } from "@/lib/pray-along/voice-choice";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,180}$/;
const SETS: readonly MysterySetKey[] = ["joyful", "sorrowful", "glorious", "luminous"];
const CHOSEN = /^[a-z]{2,3}$/;

const NO_STORE = { "cache-control": "private, no-store" };

function bad(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

interface Listener {
  voice: Voice;
  /** The speed a member last chose (it follows them to every browser), or null. */
  rate: Rate | null;
  member: boolean;
}

const VISITOR: Listener = { voice: DEFAULT_VOICE, rate: null, member: false };

/** The listener: a member's voice and speed, otherwise the female voice (the owner's rule). */
async function listener(): Promise<Listener> {
  try {
    const user = await requireUser();
    if (!user) return VISITOR;
    const profile = await getProfileForUser(user.id);
    const rate = profile?.audioRate;
    return {
      voice: voiceOrDefault(profile?.audioVoice),
      rate: isRate(rate) ? rate : null,
      member: true,
    };
  } catch {
    return VISITOR;
  }
}

/**
 * The pray-along playlist for one press of the button: the clips and pauses that pray
 * the page's prayer in the listener's voice, in the language the page shows it in.
 *
 *   ?kind=prayer&slug=hail-mary
 *   ?kind=novena&slug=divine-mercy-novena&day=3
 *   ?kind=rosary&set=joyful
 *   ?kind=guide&slug=how-to-pray-the-rosary&set=sorrowful
 *   &chosen=la   the reader's Latin / Greek choice (the prayer-language chips)
 *
 * The words come from the published record, never from the request. A clip that is
 * not made yet is filed for the voice engine and listed with ready=false; the player
 * asks again and plays what is ready.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIpOrNull(req);
  const limit = await rateLimit(`pray-along:${ip ?? "unknown"}`, RATE_POLICIES.prayAlong, {
    ipAddress: ip,
  });
  if (!limit.ok) return bad(429, "rate_limited");

  const params = req.nextUrl.searchParams;
  const kind = params.get("kind");
  const slug = params.get("slug") ?? "";
  const setParam = params.get("set");
  const set = SETS.includes(setParam as MysterySetKey) ? (setParam as MysterySetKey) : null;
  const chosenRaw = (params.get("chosen") ?? "").toLowerCase();
  const chosen = CHOSEN.test(chosenRaw) ? chosenRaw : null;
  const pageLang = toAudioLang(await getLocale()) ?? "en";

  let built: BuiltScript | null = null;
  try {
    if (kind === "prayer") {
      if (!SLUG.test(slug)) return bad(400, "invalid");
      built = await scriptForPrayer(slug, chosen, pageLang);
    } else if (kind === "novena") {
      const day = Number(params.get("day"));
      if (!SLUG.test(slug) || !Number.isInteger(day) || day < 1 || day > 60) {
        return bad(400, "invalid");
      }
      built = await scriptForNovenaDay(slug, day - 1, chosen, pageLang);
    } else if (kind === "rosary") {
      built = await scriptForRosary(set ?? "joyful", chosen, pageLang);
    } else if (kind === "guide") {
      if (!SLUG.test(slug)) return bad(400, "invalid");
      built = await scriptForGuide(slug, chosen, pageLang, set);
    } else {
      return bad(400, "invalid");
    }
  } catch {
    return bad(500, "error");
  }
  if (!built || built.script.items.length === 0) return bad(404, "not_found");

  const { voice, rate, member } = await listener();
  const manifest = await buildManifest(built.script, voice);
  return Response.json(
    {
      title: built.title,
      lang: manifest.lang,
      voice: manifest.voice,
      rate,
      member,
      total: manifest.total,
      ready: manifest.ready,
      items: manifest.items.map((item) =>
        item.type === "pause"
          ? item
          : { type: "clip", url: `/api/pray-along/clip/${item.key}`, ready: item.ready },
      ),
    },
    { headers: NO_STORE },
  );
}

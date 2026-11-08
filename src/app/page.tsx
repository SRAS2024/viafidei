import type { Metadata } from "next";

import { getSession } from "@/lib/auth/session";
import { sessionCredentialsCurrent } from "@/lib/auth/user";
import { getTranslator } from "@/lib/i18n/server";
import { listFeaturedPrayers } from "@/lib/data/published";
import { HomeBeginHere, HomeFeatured, HomeHero, HomeMission, HomeTodaySection } from "./_sections";
import type { FeaturedPrayer } from "./_sections/HomeFeatured";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Read as the header reads it, so the two never disagree: a sign-in that a password reset
 * has ended is no sign-in, and /profile would only send it to log in. A failed lookup says
 * nothing about the sign-in, and a cookie that cannot be read is a signed-out reader.
 */
async function isSignedIn(): Promise<boolean> {
  try {
    const session = await getSession();
    return (
      session.role === "USER" &&
      !!session.userId &&
      (await sessionCredentialsCurrent(session).catch(() => true))
    );
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const { t, locale } = await getTranslator();
  const signedIn = await isSignedIn();

  // The featured rail rotates by itself: `listFeaturedPrayers` picks six
  // prayers deterministically from the day's key, so the set is stable within
  // a day (no reshuffle between server render and reload) and different
  // tomorrow — the site keeps cycling even when the worker is off. It reads
  // six titles, not every prayer body, and the card's line is the CATEGORY LABEL,
  // so a stored value like "theological-virtue" never reaches the page. Nothing
  // stored on the HomePage record takes its place: that record belongs to the
  // admin's hand editor, and section III is always the day's prayers.
  const dayKey = new Date().toISOString().slice(0, 10);
  const featured = await listFeaturedPrayers(dayKey).catch(() => []);
  const featuredPrayers: FeaturedPrayer[] = featured.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.categoryLabel,
    slug: p.slug,
  }));

  return (
    <div className="vf-stack-section">
      <HomeHero t={t} signedIn={signedIn} />
      <HomeBeginHere t={t} />
      <HomeTodaySection t={t} locale={locale} />
      <HomeFeatured t={t} items={featuredPrayers} />
      <HomeMission t={t} />
    </div>
  );
}

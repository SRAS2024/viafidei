import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PublishedDetail } from "@/components/ui";
import { MapsAddressLink } from "@/components/ui/MapsAddressLink";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PARISH", slug));
}

export default async function ParishDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("PARISH", slug);
  if (!item) notFound();

  // Build the most precise destination for directions: the full postal address,
  // with exact coordinates passed through when the record carries them.
  const p = item.payload as Record<string, unknown>;
  const fullAddress = [p.address, p.city, p.state, p.country]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
  const latitude = typeof p.latitude === "number" ? p.latitude : undefined;
  const longitude = typeof p.longitude === "number" ? p.longitude : undefined;
  const website = typeof p.website === "string" && p.website.trim() ? p.website.trim() : null;

  return (
    <PublishedDetail
      item={item}
      primaryFields={["background", "summary"]}
      // `website` is intentionally NOT listed — it renders as the "Go to site"
      // button in the footer instead of a raw URL line.
      secondaryFields={[
        "designation",
        "address",
        "phone",
        "massTimes",
        "confessionTimes",
        "city",
        "state",
        "country",
        "diocese",
      ]}
      fieldRenderers={{
        // Tapping the address opens directions in the device's native map app
        // (Apple Maps on iOS/iPadOS, Google Maps elsewhere).
        address: (value) => (
          <MapsAddressLink
            variant="inline"
            className="inline-flex items-start gap-1.5 text-liturgical-blue underline-offset-2 hover:underline"
            address={fullAddress || String(value)}
            latitude={latitude}
            longitude={longitude}
          />
        ),
        // Phone as a tel: link so it dials on a phone.
        phone: (value) => {
          const raw = String(value);
          const dial = raw.replace(/[^\d+]/g, "");
          return dial ? (
            <a href={`tel:${dial}`} className="text-liturgical-blue hover:underline">
              {raw}
            </a>
          ) : (
            raw
          );
        },
      }}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {fullAddress ? (
            <MapsAddressLink
              variant="block"
              address={fullAddress}
              latitude={latitude}
              longitude={longitude}
            />
          ) : null}
          <SaveContentButton contentType="PARISH" slug={slug} />
        </div>
      }
      footer={
        website ? (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="vf-btn vf-btn-ghost inline-flex items-center gap-2 !px-3 !py-1.5 text-sm"
          >
            Go to site
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
            </svg>
          </a>
        ) : null
      }
    />
  );
}

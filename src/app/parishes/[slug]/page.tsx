import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PublishedDetail } from "@/components/ui";
import { MapsAddressLink } from "@/components/ui/MapsAddressLink";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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

  return (
    <PublishedDetail
      item={item}
      primaryFields={["background", "summary"]}
      secondaryFields={["designation", "address", "city", "state", "country", "diocese", "website"]}
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
    />
  );
}

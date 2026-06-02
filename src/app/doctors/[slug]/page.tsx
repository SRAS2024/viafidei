import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function DoctorDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DOCTOR", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      primaryFields={["background", "summary"]}
      secondaryFields={["doctorTitle", "feastDay"]}
    />
  );
}

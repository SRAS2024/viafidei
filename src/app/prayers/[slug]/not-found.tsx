import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("prayer");

export default function PrayerNotFound() {
  return notFoundPage("prayer");
}

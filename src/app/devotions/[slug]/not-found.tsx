import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("devotion");

export default function DevotionNotFound() {
  return notFoundPage("devotion");
}

import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("liturgy");

export default function LiturgyNotFound() {
  return notFoundPage("liturgy");
}

import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("guide");

export default function GuideNotFound() {
  return notFoundPage("guide");
}

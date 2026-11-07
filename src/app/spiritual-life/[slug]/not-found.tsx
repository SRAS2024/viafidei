import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("practice");

export default function SpiritualLifeNotFound() {
  return notFoundPage("practice");
}

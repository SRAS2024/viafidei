import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("novena");

export default function NovenaNotFound() {
  return notFoundPage("novena");
}

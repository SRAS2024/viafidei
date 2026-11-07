import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("sacrament");

export default function SacramentNotFound() {
  return notFoundPage("sacrament");
}

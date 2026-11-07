import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("parish");

export default function ParishNotFound() {
  return notFoundPage("parish");
}

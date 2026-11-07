import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("pope");

export default function PopeNotFound() {
  return notFoundPage("pope");
}

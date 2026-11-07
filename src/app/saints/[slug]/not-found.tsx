import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("saint");

export default function SaintNotFound() {
  return notFoundPage("saint");
}

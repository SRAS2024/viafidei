import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("page");

export default function NotFound() {
  return notFoundPage("page");
}

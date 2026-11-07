import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("rite");

export default function RiteNotFound() {
  return notFoundPage("rite");
}

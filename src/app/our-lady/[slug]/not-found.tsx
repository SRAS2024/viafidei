import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("ourLady");

export default function OurLadyNotFound() {
  return notFoundPage("ourLady");
}

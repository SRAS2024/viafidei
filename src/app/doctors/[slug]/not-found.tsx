import { notFoundMetadata, notFoundPage } from "@/components/ui/NotFoundMessage";

export const generateMetadata = () => notFoundMetadata("doctor");

export default function DoctorNotFound() {
  return notFoundPage("doctor");
}

import Link from "next/link";
import { Logo } from "../icons/Logo";

type Props = {
  brandName: string;
  tagline: string;
  locale: string;
};

export function HeaderBrand({ brandName, tagline, locale }: Props) {
  return (
    <Link
      href="/"
      aria-label={brandName}
      className="group flex items-center gap-3 sm:gap-4"
    >
      <Logo size={56} className="shrink-0" />
      <span className="flex flex-col items-start">
        <span className="vf-wordmark text-[1.15rem] leading-none text-ink sm:text-[1.4rem]">
          {brandName}
        </span>
        <span className="vf-eyebrow mt-1.5" lang={locale}>
          {tagline}
        </span>
      </span>
    </Link>
  );
}

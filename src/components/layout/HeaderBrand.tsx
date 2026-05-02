import Link from "next/link";
import { Logo } from "../icons/Logo";

type Props = {
  brandName: string;
  locale: string;
};

export function HeaderBrand({ brandName, locale }: Props) {
  return (
    <Link
      href="/"
      aria-label={brandName}
      lang={locale}
      className="group flex items-center gap-3 sm:gap-4"
    >
      <Logo size={44} className="shrink-0" />
      <span className="vf-wordmark text-[1.1rem] leading-none text-ink sm:text-[1.35rem]">
        {brandName}
      </span>
    </Link>
  );
}

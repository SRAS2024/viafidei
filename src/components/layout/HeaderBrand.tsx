import Link from "next/link";
import { Logo } from "../icons/Logo";

type Props = {
  brandName: string;
  locale: string;
  centered?: boolean;
};

export function HeaderBrand({ brandName, locale, centered = false }: Props) {
  if (centered) {
    return (
      <Link
        href="/"
        aria-label={brandName}
        lang={locale}
        className="group flex flex-col items-center gap-2"
      >
        <Logo size={56} className="shrink-0" />
        <span className="vf-wordmark text-[1.05rem] leading-none text-ink sm:text-[1.45rem]">
          {brandName}
        </span>
      </Link>
    );
  }
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

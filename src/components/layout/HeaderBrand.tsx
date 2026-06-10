import Link from "next/link";
import { Crucifix } from "../icons/Crucifix";

type Props = {
  brandName: string;
  locale: string;
  centered?: boolean;
};

export function HeaderBrand({ brandName, locale, centered = false }: Props) {
  // The sketched crucifix sits to the LEFT of the wordmark in both layouts; the
  // homepage hero just renders it larger and centers the pair as a group.
  return (
    <Link
      href="/"
      aria-label={brandName}
      lang={locale}
      className={`group inline-flex items-center ${centered ? "gap-3 sm:gap-4" : "gap-2.5 sm:gap-3.5"}`}
    >
      <Crucifix
        size={centered ? 56 : 40}
        className="shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
      />
      <span
        className={`vf-wordmark leading-none text-ink ${
          centered ? "text-[1.2rem] sm:text-[1.7rem]" : "text-[1.1rem] sm:text-[1.35rem]"
        }`}
      >
        {brandName}
      </span>
    </Link>
  );
}

import Link from "next/link";

type Props = {
  brandName: string;
  locale: string;
  centered?: boolean;
};

export function HeaderBrand({ brandName, locale, centered = false }: Props) {
  // The sketched crucifix logo sits to the LEFT of the wordmark in both layouts.
  // The SAME artwork is used in light and dark themes — its colours are never
  // changed; only the page background and lettering shift between themes. That
  // holds only because every white in the drawing (the perizoma, the INRI board)
  // is OPAQUE in the PNG: a transparent white shows the page through it, which
  // turned the loincloth and the sign black in dark mode
  // (pinned by tests/components/crucifix-logo.test.ts).
  const w = centered ? 56 : 40;
  const h = Math.round((w * 491) / 360); // preserve the artwork's aspect ratio
  const imgClass =
    "shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-0.5";
  return (
    <Link
      href="/"
      aria-label={brandName}
      lang={locale}
      className={`group inline-flex items-center ${centered ? "gap-3 sm:gap-4" : "gap-2.5 sm:gap-3.5"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/crucifix-logo.png"
        alt=""
        aria-hidden="true"
        width={w}
        height={h}
        className={imgClass}
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

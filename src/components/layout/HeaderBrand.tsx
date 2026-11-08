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
  const w = centered ? 44 : 38;
  const h = Math.round((w * 491) / 360); // preserve the artwork's aspect ratio
  return (
    <Link
      href="/"
      aria-label={brandName}
      lang={locale}
      className={`group inline-flex items-center ${centered ? "gap-3.5" : "gap-[min(0.625rem,3.125vw)]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/crucifix-logo.png"
        alt=""
        aria-hidden="true"
        width={w}
        height={h}
        className="shrink-0"
      />
      {/* In the phone's bar the name keeps to one line and leaves room for the two
          buttons beside it, however large the reader's text. That holds from 320
          wide only because every gap in the bar is capped by the width as the name
          is: a gap in plain rem doubles with the text and took the room it needs. */}
      <span
        className={`vf-wordmark leading-none text-ink ${
          centered
            ? "text-[1.5rem]"
            : "[font-size:min(1.125rem,6vw)] sm:[font-size:min(1.25rem,6vw)]"
        }`}
      >
        {brandName}
      </span>
    </Link>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="text-ink"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="32" cy="32" r="28" strokeWidth="0.8" opacity="0.35" />
        <path d="M32 6 V 58" />
        <path d="M22 18 H 42" />
        <path d="M16 44 Q 32 36 48 44" opacity="0.5" />
        <path d="M26 50 L 32 56 L 38 50" opacity="0.5" />
      </g>
    </svg>
  );
}

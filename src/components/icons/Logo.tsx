type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 44, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 80"
      role="img"
      aria-label="Via Fidei"
      className={["text-ink", className].filter(Boolean).join(" ")}
    >
      <defs>
        <clipPath id="vf-cross-clip">
          <path d="M28 4 Q32 3.4 36 4 L36 23 L60 23 Q60.4 24 60 25 L60 31 Q60.4 32 60 33 L36 33 L36 75 Q36.4 77 36 77.6 Q34 78.4 32 78.4 Q30 78.4 28 77.6 Q27.6 77 28 75 L28 33 L4 33 Q3.6 32 4 31 L4 25 Q3.6 24 4 23 L28 23 Z" />
        </clipPath>
        <linearGradient id="vf-cross-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.06" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <path
        d="M28 4 Q32 3.4 36 4 L36 23 L60 23 Q60.4 24 60 25 L60 31 Q60.4 32 60 33 L36 33 L36 75 Q36.4 77 36 77.6 Q34 78.4 32 78.4 Q30 78.4 28 77.6 Q27.6 77 28 75 L28 33 L4 33 Q3.6 32 4 31 L4 25 Q3.6 24 4 23 L28 23 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <g clipPath="url(#vf-cross-clip)">
        <rect x="0" y="0" width="64" height="80" fill="url(#vf-cross-shade)" />
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M30 5.5 Q30.4 14 30 22.5" strokeWidth="0.35" opacity="0.45" />
          <path d="M32 5 Q32.5 14 32 22.5" strokeWidth="0.35" opacity="0.32" />
          <path d="M34 5.5 Q34.4 14 34 22.5" strokeWidth="0.35" opacity="0.45" />

          <path d="M30 33.5 Q30.4 56 30 76.5" strokeWidth="0.35" opacity="0.45" />
          <path d="M31.7 33.5 Q32.3 56 31.8 77" strokeWidth="0.35" opacity="0.32" />
          <path d="M33.6 33.5 Q34 56 33.6 76.5" strokeWidth="0.35" opacity="0.45" />

          <path d="M5 25.4 Q22 26 36 25.7 Q48 25.5 59 25.9" strokeWidth="0.35" opacity="0.45" />
          <path d="M5 28.2 Q22 28.6 36 28.4 Q48 28.1 59 28.5" strokeWidth="0.35" opacity="0.32" />
          <path d="M5 30.8 Q22 31.2 36 30.9 Q48 30.6 59 31" strokeWidth="0.35" opacity="0.45" />

          <ellipse cx="32" cy="46" rx="0.7" ry="0.5" strokeWidth="0.35" opacity="0.55" />
          <ellipse cx="33.2" cy="64" rx="0.6" ry="0.45" strokeWidth="0.35" opacity="0.45" />
          <ellipse cx="14" cy="28.5" rx="0.55" ry="0.45" strokeWidth="0.35" opacity="0.45" />
          <ellipse cx="50" cy="28" rx="0.55" ry="0.45" strokeWidth="0.35" opacity="0.45" />
        </g>
      </g>
    </svg>
  );
}

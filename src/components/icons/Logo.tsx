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
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M28.4 4.6 Q27.8 6.6 27.8 9 L27.6 30.5 Q27.5 31.4 27.4 32 L27.4 73.4 Q27.5 75.4 28.5 76.8"
          strokeWidth="1.1"
        />
        <path
          d="M35.6 4.8 Q36.4 6.8 36.4 9 L36.6 30.5 Q36.6 31.4 36.7 32 L36.7 73.5 Q36.6 75.5 35.6 76.9"
          strokeWidth="1.1"
        />
        <path d="M28.4 4.7 Q32 3.5 35.6 4.8" strokeWidth="1.1" />
        <path d="M28.5 76.9 Q32 78.2 35.6 76.9" strokeWidth="1.1" />
        <path
          d="M5 24.4 Q7.2 23.6 9.6 23.6 L54.4 23.4 Q57 23.4 59 24.2"
          strokeWidth="1.1"
        />
        <path
          d="M5 32.4 Q7.2 33.4 9.6 33.4 L54.4 33.6 Q57 33.6 59 32.6"
          strokeWidth="1.1"
        />
        <path d="M5 24.5 Q3.6 28.4 5 32.4" strokeWidth="1.1" />
        <path d="M59 24.3 Q60.4 28.4 59 32.5" strokeWidth="1.1" />
        <path d="M30 9 Q30.4 18 30 28" strokeWidth="0.45" opacity="0.55" />
        <path d="M32 12 Q32.6 24 32 35" strokeWidth="0.45" opacity="0.45" />
        <path d="M34 8 Q34.4 17 34 27" strokeWidth="0.45" opacity="0.5" />
        <path d="M30.4 38 Q30.8 50 30.2 64" strokeWidth="0.45" opacity="0.5" />
        <path d="M32.6 40 Q33 54 32.4 68" strokeWidth="0.45" opacity="0.45" />
        <path d="M34.4 38 Q34.8 52 34.2 66" strokeWidth="0.45" opacity="0.55" />
        <path d="M9 26 Q22 26.6 36 26.2 Q48 25.9 56 26.4" strokeWidth="0.45" opacity="0.55" />
        <path d="M9 28.5 Q22 29 36 28.7 Q48 28.4 56 28.9" strokeWidth="0.45" opacity="0.45" />
        <path d="M9 31 Q22 31.4 36 31.1 Q48 30.8 56 31.3" strokeWidth="0.45" opacity="0.5" />
        <circle cx="31.6" cy="50" r="0.55" strokeWidth="0.4" opacity="0.55" />
        <circle cx="33.2" cy="18" r="0.55" strokeWidth="0.4" opacity="0.5" />
        <circle cx="46" cy="29" r="0.55" strokeWidth="0.4" opacity="0.5" />
        <circle cx="16" cy="28.4" r="0.45" strokeWidth="0.4" opacity="0.5" />
      </g>
    </svg>
  );
}

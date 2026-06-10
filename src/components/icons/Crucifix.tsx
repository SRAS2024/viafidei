type CrucifixProps = {
  size?: number;
  className?: string;
  /** When true, draws only the bare wood cross (no corpus) — used for tiny marks. */
  bare?: boolean;
};

/**
 * A reverent, hand-sketched crucifix in a fine line / engraving style: the wood
 * cross with its grain, the corpus of Christ with arms outstretched, the bowed
 * head crowned with thorns, hair and beard, the perizoma (loincloth), the nail
 * wounds, the side wound, and the INRI titulus. Drawn entirely in `currentColor`
 * strokes so it inherits the ink color and stays crisp at any size. Not a
 * photoreal portrait — a clean, dignified devotional sketch.
 */
export function Crucifix({ size = 44, className, bare = false }: CrucifixProps) {
  // Aspect ~ 64x88 keeps room for the figure's legs below the crossbeam.
  const height = (size * 88) / 64;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={height}
      viewBox="0 0 64 88"
      role="img"
      aria-label="Via Fidei"
      className={["text-ink", className].filter(Boolean).join(" ")}
    >
      <defs>
        <clipPath id="vf-cross-clip">
          <path d="M28 8 Q32 7.4 36 8 L36 27 L60 27 Q60.4 28 60 29 L60 35 Q60.4 36 60 37 L36 37 L36 83 Q36.4 85 36 85.6 Q34 86.4 32 86.4 Q30 86.4 28 85.6 Q27.6 85 28 83 L28 37 L4 37 Q3.6 36 4 35 L4 29 Q3.6 28 4 27 L28 27 Z" />
        </clipPath>
        <linearGradient id="vf-cross-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {/* ── The wood cross ─────────────────────────────────────────────── */}
      <path
        d="M28 8 Q32 7.4 36 8 L36 27 L60 27 Q60.4 28 60 29 L60 35 Q60.4 36 60 37 L36 37 L36 83 Q36.4 85 36 85.6 Q34 86.4 32 86.4 Q30 86.4 28 85.6 Q27.6 85 28 83 L28 37 L4 37 Q3.6 36 4 35 L4 29 Q3.6 28 4 27 L28 27 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g clipPath="url(#vf-cross-clip)">
        <rect x="0" y="0" width="64" height="88" fill="url(#vf-cross-shade)" />
        <g fill="none" stroke="currentColor" strokeLinecap="round" opacity="0.5">
          <path d="M5 29.4 Q22 30 36 29.7 Q48 29.5 59 29.9" strokeWidth="0.3" />
          <path d="M5 32.2 Q22 32.6 36 32.4 Q48 32.1 59 32.5" strokeWidth="0.3" opacity="0.7" />
          <path d="M5 34.8 Q22 35.2 36 34.9 Q48 34.6 59 35" strokeWidth="0.3" />
          <path d="M30 74 Q30.4 80 30 85" strokeWidth="0.3" />
          <path d="M33.7 74 Q34 80 33.7 85" strokeWidth="0.3" opacity="0.7" />
        </g>
      </g>

      {bare ? null : (
        <>
          {/* ── INRI titulus ────────────────────────────────────────────── */}
          <g fill="none" stroke="currentColor" strokeLinejoin="round">
            <rect x="25.5" y="10.5" width="13" height="4" rx="0.6" strokeWidth="0.7" />
            <path
              d="M27.5 12.6 h1 M30 11.6 v2 M31.6 12.6 h1.2 M34.2 11.6 v2 M35.8 11.6 v2"
              strokeWidth="0.45"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>

          {/* ── The corpus of Christ ────────────────────────────────────── */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Bowed head — face outline, left open where the beard takes over */}
            <path
              d="M30 23.6 Q28.4 22.2 28.5 19.3 Q28.7 15.9 31.7 15.3 Q34.7 15.9 34.9 19.3 Q35 22.2 33.4 23.6"
              strokeWidth="0.8"
            />

            {/* Hair framing the face down to the shoulders */}
            <path d="M28.7 17.1 Q26.5 19.5 27.2 23.6 Q27.6 26 29 27.4" strokeWidth="0.7" />
            <path d="M34.9 17.1 Q37.1 19.4 36.4 23.2 Q36 25.4 34.8 26.8" strokeWidth="0.7" />
            <path
              d="M31.7 15.4 Q31.1 16.5 30.3 16.9 M31.7 15.4 Q32.3 16.5 33.1 16.9"
              strokeWidth="0.45"
              opacity="0.85"
            />

            {/* Crown of thorns — brow band + radiating thorns */}
            <g strokeWidth="0.6">
              <path d="M27.9 17.9 Q31.8 15.1 35.7 17.9" />
              <path
                d="M28.5 17.2 l-0.9 -0.7 M30 16.1 l-0.5 -1 M31.8 15.5 l0 -1.1 M33.6 16.1 l0.5 -1 M35.1 17.2 l0.9 -0.7"
                strokeWidth="0.42"
                opacity="0.9"
              />
              <path d="M28.1 18.7 l-1 0.1 M35.5 18.7 l1 0.1" strokeWidth="0.42" opacity="0.8" />
            </g>

            {/* Solemn face — downcast closed eyes, brows, nose, hidden mouth */}
            <g strokeWidth="0.45" opacity="0.9">
              <path d="M29.6 18.8 q1 -0.5 2.1 -0.1" />
              <path d="M32.3 18.7 q1 -0.45 2.1 0.05" />
              <path d="M29.7 19.7 q1 0.55 2 0.05" />
              <path d="M32.3 19.75 q1 0.5 2 0" />
              <path d="M31.9 19.5 Q31.5 21 31 21.6 q0.8 0.4 1.6 0.05" />
              <path d="M30.9 22.9 q1 0.25 2 0" opacity="0.8" />
            </g>

            {/* Beard converging to a point (clearly a beard, not a smile) */}
            <path d="M28.6 20.6 Q28.3 24.4 31.9 26.5" strokeWidth="0.55" />
            <path d="M35 20.6 Q35.3 24.4 31.9 26.5" strokeWidth="0.55" />
            <path
              d="M30.2 22.2 Q31.9 22.9 31.8 22.4 Q31.9 22.9 33.6 22.2"
              strokeWidth="0.42"
              opacity="0.85"
            />
            <path
              d="M30.2 23.6 Q31.9 24.7 33.6 23.6 M30.9 25 q1 0.55 2 0"
              strokeWidth="0.4"
              opacity="0.8"
            />

            {/* Neck + shoulders */}
            <path d="M30.6 25.9 L30.5 27 M33.2 25.9 L33.3 27" strokeWidth="0.55" opacity="0.9" />
            <path d="M30.3 27.1 Q32 26.4 33.7 27.1" strokeWidth="0.7" />

            {/* Arms with volume, tapering to the nailed hands along the beam */}
            <path d="M30.2 27.2 Q22 27 13.5 29" />
            <path d="M30 28.9 Q22 29.3 13.7 30.3" />
            <path d="M13.5 29 Q12.7 29.6 13.7 30.3" strokeWidth="0.7" />
            <path d="M33.8 27.2 Q42 27 50.5 29" />
            <path d="M34 28.9 Q42 29.3 50.3 30.3" />
            <path d="M50.5 29 Q51.3 29.6 50.3 30.3" strokeWidth="0.7" />
            {/* Hands + nail wounds */}
            <path
              d="M13.4 30.3 q-1.1 0.5 -0.7 1.5 M13.1 29.7 l0.3 1.4"
              strokeWidth="0.55"
              opacity="0.9"
            />
            <path
              d="M50.6 30.3 q1.1 0.5 0.7 1.5 M50.9 29.7 l-0.3 1.4"
              strokeWidth="0.55"
              opacity="0.9"
            />

            {/* Torso — chest bulging then narrowing to the waist */}
            <path d="M30 28.9 Q28.5 33 28.9 38 Q29.1 42.5 30.4 46" />
            <path d="M34 28.9 Q35.5 33 35.1 38 Q34.9 42.5 33.6 46" />
            {/* Ribcage arcs + faint sternum + navel */}
            <g strokeWidth="0.45" opacity="0.8">
              <path d="M32 29.8 L32 33" strokeWidth="0.35" opacity="0.6" />
              <path d="M29.6 33.6 Q32 34.8 34.4 33.6" />
              <path d="M29.6 35.4 Q32 36.5 34.4 35.4" />
              <path d="M29.9 37.2 Q32 38.2 34.1 37.2" />
              <path d="M31 40.2 q1 0.5 2 0" opacity="0.7" />
              <path d="M31.95 42.8 l0 0.1" strokeWidth="0.6" />
            </g>
            {/* Side wound */}
            <path
              d="M34.5 38.7 q1.1 0.3 0.3 1.2 q-1 0.2 -0.3 -1.2 Z"
              strokeWidth="0.4"
              opacity="0.85"
            />

            {/* Perizoma (loincloth) with knot + hanging end + folds */}
            <path
              d="M28.7 46 Q32 47.9 35.3 46 L35.9 49.6 Q36.2 51.6 34.7 52.9 Q32 54.1 29.3 52.9 Q27.8 51.6 28.1 49.6 Z"
              strokeWidth="0.8"
            />
            <path d="M28.5 46.4 Q27.1 47.8 27.7 49.9 L29.1 53" strokeWidth="0.55" opacity="0.9" />
            <path d="M27.7 48.8 Q26.8 50.8 27.5 53.6" strokeWidth="0.45" opacity="0.8" />
            <path
              d="M29.6 48.6 Q32 50 34.4 48.6 M29.9 50.4 q2.1 1.05 4.2 0"
              strokeWidth="0.4"
              opacity="0.8"
            />

            {/* Legs, knees slightly bent and together, to the crossed feet */}
            <path d="M29.9 52.8 Q28.6 58.5 30 63 Q30.8 66 31.7 68" />
            <path
              d="M31.9 53 Q31.6 58.5 31.7 63 Q31.9 65.5 32 67"
              strokeWidth="0.6"
              opacity="0.85"
            />
            <path d="M34.1 52.8 Q35.4 58.5 34 63 Q33.2 66 32.3 68" />
            <path
              d="M32.1 53 Q32.4 58.5 32.3 63 Q32.1 65.5 32 67"
              strokeWidth="0.6"
              opacity="0.85"
            />
            <path
              d="M29.5 59.8 q1.1 0.45 1.9 0 M32.6 59.8 q1.1 0.45 1.9 0"
              strokeWidth="0.4"
              opacity="0.75"
            />

            {/* Crossed feet pierced by a single nail */}
            <path d="M30 67.3 Q32 68.2 34 67.3" strokeWidth="0.7" />
            <path d="M30.2 68.4 Q32 69.9 33.8 68.4" strokeWidth="0.8" />
            <path
              d="M30.9 69.7 l-0.3 1.6 M33.1 69.7 l0.3 1.6 M32 70.1 l0 1.5"
              strokeWidth="0.5"
              opacity="0.85"
            />
            <path d="M32 67.6 l0 2.6" strokeWidth="0.8" />
          </g>
        </>
      )}
    </svg>
  );
}

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
            {/* Faint flesh shading so the limbs and torso read as rounded
                volume — the body modelled on the cross, not a stick figure. */}
            <g fill="currentColor" fillOpacity="0.07" stroke="none">
              {/* arms */}
              <path d="M30.4 26.6 Q24 26.2 18 27.2 Q15 27.7 12.9 28.7 Q12.2 29.1 12.5 29.7 Q12.9 30.4 13.9 30.3 Q18 29.9 24 29.6 Q28 29.4 30.6 29.2 Z" />
              <path d="M33.6 26.6 Q40 26.2 46 27.2 Q49 27.7 51.1 28.7 Q51.8 29.1 51.5 29.7 Q51.1 30.4 50.1 30.3 Q46 29.9 40 29.6 Q36 29.4 33.4 29.2 Z" />
              {/* torso */}
              <path d="M30.2 26.8 Q28.4 31 28.7 37 Q28.9 42 30.2 46 L33.8 46 Q35.1 42 35.3 37 Q35.6 31 33.8 26.8 Z" />
              {/* legs */}
              <path d="M30.4 53.2 Q28.9 54.6 28.7 57.8 Q28.6 60 29.5 60.6 Q29.7 63.4 30.6 65.6 Q31 67 31.5 68 L32 67.6 Q31.5 64 31.2 60.4 Q31 56.6 31.8 53.4 Z" />
              <path d="M33.6 53.2 Q35.1 54.6 35.3 57.8 Q35.4 60 34.5 60.6 Q34.3 63.4 33.4 65.6 Q33 67 32.5 68 L32 67.6 Q32.5 64 32.8 60.4 Q33 56.6 32.2 53.4 Z" />
            </g>

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
            <path d="M30.2 23.6 Q31.9 24.7 33.6 23.6" strokeWidth="0.4" opacity="0.8" />

            {/* Neck + shoulders */}
            <path d="M30.6 25.9 L30.5 27 M33.2 25.9 L33.3 27" strokeWidth="0.55" opacity="0.9" />

            {/* Arms — tapered silhouettes (deltoid → forearm → nailed hand) */}
            <path d="M30.4 26.6 Q24 26.2 18 27.2 Q15 27.7 12.9 28.7 Q12.2 29.1 12.5 29.7 Q12.9 30.4 13.9 30.3 Q18 29.9 24 29.6 Q28 29.4 30.6 29.2" />
            <path d="M33.6 26.6 Q40 26.2 46 27.2 Q49 27.7 51.1 28.7 Q51.8 29.1 51.5 29.7 Q51.1 30.4 50.1 30.3 Q46 29.9 40 29.6 Q36 29.4 33.4 29.2" />
            <path d="M22 28 Q17 28.4 13.6 29.2" strokeWidth="0.35" opacity="0.5" />
            <path d="M42 28 Q47 28.4 50.4 29.2" strokeWidth="0.35" opacity="0.5" />
            {/* Hands + nail wounds */}
            <path
              d="M12.9 29 q-1 0.3 -1.1 1 q0 0.7 1 0.9 M12.4 28.9 l0.3 1.6"
              strokeWidth="0.5"
              opacity="0.95"
            />
            <path
              d="M51.1 29 q1 0.3 1.1 1 q0 0.7 -1 0.9 M51.6 28.9 l-0.3 1.6"
              strokeWidth="0.5"
              opacity="0.95"
            />

            {/* Torso — chest bulging then narrowing to the waist */}
            <path d="M30.2 26.8 Q28.4 31 28.7 37 Q28.9 42 30.2 46" />
            <path d="M33.8 26.8 Q35.6 31 35.3 37 Q35.1 42 33.8 46" />
            {/* Ribcage arcs + sternum + flank + navel */}
            <g strokeWidth="0.45" opacity="0.8">
              <path d="M32 28.4 L32 33" strokeWidth="0.35" opacity="0.6" />
              <path d="M29.7 33.4 Q32 34.6 34.3 33.4" />
              <path d="M29.7 35.4 Q32 36.5 34.3 35.4" />
              <path d="M30 37.4 Q32 38.4 34 37.4" />
              <path d="M30.8 31 Q29.6 33.6 30 37.6" strokeWidth="0.3" opacity="0.5" />
              <path d="M31 40.4 q1 0.5 2 0" opacity="0.7" />
              <path d="M31.95 43 l0 0.1" strokeWidth="0.55" />
            </g>
            {/* Side wound */}
            <path
              d="M34.4 38.6 q1.1 0.3 0.3 1.2 q-1 0.2 -0.3 -1.2 Z"
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

            {/* Legs — tapered silhouettes (thigh → knee → calf), feet together */}
            <path d="M30.4 53.2 Q28.9 54.6 28.7 57.8 Q28.6 60 29.5 60.6 Q29.7 63.4 30.6 65.6 Q31 67 31.5 68" />
            <path
              d="M31.8 53.4 Q31 56.6 31.2 60.4 Q31.5 64 32 67.6"
              strokeWidth="0.5"
              opacity="0.8"
            />
            <path d="M33.6 53.2 Q35.1 54.6 35.3 57.8 Q35.4 60 34.5 60.6 Q34.3 63.4 33.4 65.6 Q33 67 32.5 68" />
            <path
              d="M32.2 53.4 Q33 56.6 32.8 60.4 Q32.5 64 32 67.6"
              strokeWidth="0.5"
              opacity="0.8"
            />
            {/* Knee caps */}
            <path
              d="M28.9 59.4 q1.3 0.6 2.3 0.2 M32.8 59.6 q1.3 0.4 2.3 -0.2"
              strokeWidth="0.35"
              opacity="0.55"
            />

            {/* Crossed feet pierced by a single nail */}
            <path d="M30 67.4 Q32 68.4 34 67.4" strokeWidth="0.7" />
            <path d="M30.2 68.5 Q32 70 33.8 68.5" strokeWidth="0.8" />
            <path
              d="M30.9 69.8 l-0.3 1.5 M33.1 69.8 l0.3 1.5 M32 70.2 l0 1.4"
              strokeWidth="0.5"
              opacity="0.85"
            />
            <path d="M32 67.7 l0 2.5" strokeWidth="0.8" />
          </g>
        </>
      )}
    </svg>
  );
}

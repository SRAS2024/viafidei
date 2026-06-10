type CrucifixProps = {
  size?: number;
  className?: string;
  /** When true, draws only the bare wood cross (no corpus) — used for tiny marks. */
  bare?: boolean;
};

/**
 * A reverent, hand-sketched crucifix in a fine line / engraving style: the wood
 * cross with its grain, and the corpus of Christ modelled with real anatomical
 * mass — broad shoulders, a full chest with ribcage, the bowed head crowned with
 * thorns, hair and beard, arms outstretched to the nailed hands, the side wound,
 * the perizoma (loincloth), and the legs to the crossed feet pierced by a single
 * nail, with the INRI titulus above. The body is built from a single translucent
 * silhouette (so it reads as a figure, not a stick), then finished with
 * `currentColor` sketch linework so it inherits the ink color and stays crisp at
 * any size. A clean, dignified devotional sketch — not a photoreal portrait.
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
        <g fill="none" stroke="currentColor" strokeLinecap="round" opacity="0.4">
          <path d="M5 29.6 Q32 30 59 29.8" strokeWidth="0.3" />
          <path d="M5 34.8 Q32 35.1 59 34.9" strokeWidth="0.3" />
          <path d="M30 74 Q30.4 80 30 85" strokeWidth="0.3" />
          <path d="M33.7 74 Q34 80 33.7 85" strokeWidth="0.3" />
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

          {/* ── Body mass: one translucent silhouette so the corpus reads as
              a figure with volume (group opacity merges the overlaps). ──── */}
          <g fill="currentColor" opacity="0.18">
            <ellipse cx="32" cy="20.8" rx="3.5" ry="4.1" />
            <path d="M30.7 23.6 L33.3 23.6 L33.7 27.6 L30.3 27.6 Z" />
            <path d="M29.2 26.2 C 22 25.5, 16 26, 12.5 27 C 11.7 27.2, 11.7 29, 12.8 29.1 C 17 29.2, 23 29.1, 29.6 29.1 Z" />
            <path d="M34.8 26.2 C 42 25.5, 48 26, 51.5 27 C 52.3 27.2, 52.3 29, 51.2 29.1 C 47 29.2, 41 29.1, 34.4 29.1 Z" />
            <path d="M29 27.2 C 27.9 31, 27.8 35, 28.6 39 C 29.1 42.4, 29.6 44.4, 30.1 46.2 L 33.9 46.2 C 34.4 44.4, 34.9 42.4, 35.4 39 C 36.2 35, 36.1 31, 35 27.2 Z" />
            <path d="M30.2 52.9 C 28.2 54.5, 27.9 58, 28.5 61.4 C 28.95 64.2, 29.9 66.6, 31.1 68.5 L 31.7 68.2 C 31.4 64, 31.2 60, 31.5 56 C 31.6 54.5, 31.6 53.4, 31.5 52.9 Z" />
            <path d="M33.8 52.9 C 35.8 54.5, 36.1 58, 35.5 61.4 C 35.05 64.2, 34.1 66.6, 32.9 68.5 L 32.3 68.2 C 32.6 64, 32.8 60, 32.5 56 C 32.4 54.5, 32.4 53.4, 32.5 52.9 Z" />
          </g>

          {/* ── Sketch linework: outline + anatomical definition ───────────── */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Bowed head, hair, crown of thorns */}
            <path
              d="M28.7 21 C 28.4 17.2, 29.8 15.4, 32 15.3 C 34.2 15.4, 35.6 17.2, 35.3 21 C 35.1 23.6, 33.7 25, 32 25.1 C 30.3 25, 28.9 23.6, 28.7 21 Z"
              strokeWidth="0.7"
            />
            <path d="M28.8 18 C 26.6 20.2, 27.2 24.4, 28.6 27.4" strokeWidth="0.6" />
            <path d="M35.2 18 C 37.4 20, 36.8 24.2, 35.4 27.2" strokeWidth="0.6" />
            <g strokeWidth="0.55">
              <path d="M28 18 Q32 15, 36 18" />
              <path
                d="M28.6 17.4 l-0.9 -0.8 M30.2 16.2 l-0.5 -1.1 M32 15.6 l0 -1.2 M33.8 16.2 l0.5 -1.1 M35.4 17.4 l0.9 -0.8"
                strokeWidth="0.4"
                opacity="0.9"
              />
            </g>
            {/* Downcast face: closed eyes, brows, nose */}
            <g strokeWidth="0.42" opacity="0.9">
              <path d="M29.4 19.2 q1.1 -0.5 2.2 -0.1" />
              <path d="M32.4 19.1 q1.1 -0.45 2.2 0.05" />
              <path d="M29.6 20.2 q1.1 0.6 2.1 0.05" />
              <path d="M32.3 20.25 q1.1 0.55 2.1 0" />
              <path d="M32 20 Q31.5 21.8, 30.9 22.5 q0.9 0.45 1.8 0.05" />
            </g>
            {/* Beard converging to a point */}
            <path d="M28.7 21.6 Q28.5 25.4, 32 27.4 Q35.5 25.4, 35.3 21.6" strokeWidth="0.5" />
            <path
              d="M30 23.2 Q32 24.4, 34 23.2 M30.7 24.8 q1.3 0.7 2.6 0"
              strokeWidth="0.4"
              opacity="0.8"
            />

            {/* Shoulders + arms to the nailed hands */}
            <path d="M29.2 26.2 C 22 25.5, 16 26, 12.5 27 C 11.7 27.2, 11.7 29, 12.8 29.1 C 17 29.2, 23 29.1, 29.6 29.1" />
            <path d="M34.8 26.2 C 42 25.5, 48 26, 51.5 27 C 52.3 27.2, 52.3 29, 51.2 29.1 C 47 29.2, 41 29.1, 34.4 29.1" />
            <path d="M24 27 Q18 27.2, 13 27.9" strokeWidth="0.35" opacity="0.5" />
            <path d="M40 27 Q46 27.2, 51 27.9" strokeWidth="0.35" opacity="0.5" />
            <path
              d="M12.5 27 q-1 0.4 -1 1.1 q0 0.8 1 1 M12.1 26.9 l0.3 1.7"
              strokeWidth="0.5"
              opacity="0.95"
            />
            <path
              d="M51.5 27 q1 0.4 1 1.1 q0 0.8 -1 1 M51.9 26.9 l-0.3 1.7"
              strokeWidth="0.5"
              opacity="0.95"
            />

            {/* Torso outline + pectorals, ribs, sternum, abdomen, navel */}
            <path d="M29 27.2 C 27.9 31, 27.8 35, 28.6 39 C 29.1 42.4, 29.6 44.4, 30.1 46.2" />
            <path d="M35 27.2 C 36.1 31, 36.2 35, 35.4 39 C 34.9 42.4, 34.4 44.4, 33.9 46.2" />
            <g strokeWidth="0.42" opacity="0.8">
              <path d="M29.6 29.4 Q32 31.4, 34.4 29.4" />
              <path d="M32 29.8 L32 34" />
              <path d="M29.4 34 Q32 35.4, 34.6 34" />
              <path d="M29.6 36.4 Q32 37.7, 34.4 36.4" />
              <path d="M30 38.8 Q32 39.9, 34 38.8" />
              <path d="M31 41 q1 0.5 2 0 M31 43 q1 0.5 2 0" opacity="0.7" />
              <path d="M31.95 44.6 l0 0.1" strokeWidth="0.55" />
            </g>
            {/* Side wound */}
            <path
              d="M34.4 36.4 q1.2 0.3 0.3 1.3 q-1.1 0.2 -0.3 -1.3 Z"
              strokeWidth="0.4"
              opacity="0.85"
            />
            {/* Shadow-side cross-hatch for volume */}
            <g strokeWidth="0.28" opacity="0.4">
              <path d="M29 31 l1.6 1.4 M28.9 33 l1.8 1.6 M29 35 l1.8 1.6 M29.3 37 l1.6 1.4" />
            </g>

            {/* Perizoma (loincloth) — paper fill occludes the hips in any theme */}
            <path
              d="M28.4 45.6 Q32 47.6, 35.6 45.6 L36.3 49.6 Q36.6 51.8, 34.9 53.2 Q32 54.6, 29.1 53.2 Q27.4 51.8, 27.7 49.6 Z"
              fill="var(--paper)"
              strokeWidth="0.75"
            />
            <path d="M28.2 46 Q26.7 47.6, 27.4 50 L29 53.4" strokeWidth="0.5" opacity="0.9" />
            <path
              d="M29.4 48.4 Q32 50, 34.6 48.4 M29.7 50.4 q2.3 1.1 4.6 0"
              strokeWidth="0.4"
              opacity="0.8"
            />

            {/* Legs (outer + inner edges so the two read distinct), knees */}
            <path d="M30.2 52.9 C 28.2 54.5, 27.9 58, 28.5 61.4 C 28.95 64.2, 29.9 66.6, 31.1 68.5" />
            <path d="M33.8 52.9 C 35.8 54.5, 36.1 58, 35.5 61.4 C 35.05 64.2, 34.1 66.6, 32.9 68.5" />
            <path d="M31.5 53.4 C 31.6 56, 31.4 62, 31.7 68" strokeWidth="0.5" opacity="0.75" />
            <path d="M32.5 53.4 C 32.4 56, 32.6 62, 32.3 68" strokeWidth="0.5" opacity="0.75" />
            <path
              d="M28.7 60.8 q1.5 0.7 2.5 0.2 M32.8 61 q1.5 0.5 2.5 -0.2"
              strokeWidth="0.35"
              opacity="0.55"
            />
            <g strokeWidth="0.26" opacity="0.4">
              <path d="M28.7 56 l1.4 1.2 M28.6 58.5 l1.5 1.3 M29 63 l1.3 1.1" />
            </g>

            {/* Crossed feet pierced by a single nail */}
            <path d="M29.8 67.8 Q32 68.9, 34.2 67.8" strokeWidth="0.7" />
            <path d="M30 69 Q32 70.6, 34 69" strokeWidth="0.8" />
            <path
              d="M30.8 70.4 l-0.3 1.6 M33.2 70.4 l0.3 1.6 M32 70.8 l0 1.5"
              strokeWidth="0.5"
              opacity="0.85"
            />
            <path d="M32 67.9 l0 2.6" strokeWidth="0.8" />
          </g>
        </>
      )}
    </svg>
  );
}

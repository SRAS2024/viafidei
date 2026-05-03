type Props = {
  size?: number;
  className?: string;
};

/**
 * Default avatar fallback. Renders a gray circular background with a simple
 * white human silhouette — used when the signed-in user has not uploaded a
 * profile photo.
 */
export function UserSilhouetteIcon({ size = 32, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="#9b9b9b" />
      <circle cx="16" cy="13" r="5" fill="#ffffff" />
      <path d="M5.5 28 C 7 21.5, 25 21.5, 26.5 28 Z" fill="#ffffff" />
    </svg>
  );
}

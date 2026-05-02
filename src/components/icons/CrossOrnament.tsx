type Props = { className?: string };

export function CrossOrnament({ className }: Props) {
  return (
    <svg
      width="18"
      height="22"
      viewBox="0 0 18 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 1.5 V 20.5" />
      <path d="M10 1.5 V 20.5" />
      <path d="M1 7 H 17" />
      <path d="M1 9.5 H 17" />
      <path d="M8.6 4 Q 8.8 12 8.4 18" strokeWidth="0.4" opacity="0.5" />
    </svg>
  );
}

export function SimpleCross({ className }: Props) {
  return (
    <svg
      width="18"
      height="22"
      viewBox="0 0 18 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      className={className}
    >
      <path d="M8 2 V 20" />
      <path d="M10 2 V 20" />
      <path d="M2 7 H 16" />
      <path d="M2 9 H 16" />
    </svg>
  );
}

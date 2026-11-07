/**
 * One line of placeholder text, as tall as a real line of the text around it, so
 * a part's placeholder takes up exactly the room its finished text will. Set in
 * the real text's own class; it takes its height from that line height.
 */
export function SkeletonLine({ className = "w-full" }: { className?: string }) {
  return (
    <span className="vf-home-skeleton-line">
      <span className={`vf-skeleton ${className}`} />
    </span>
  );
}

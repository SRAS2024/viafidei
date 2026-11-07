/**
 * One line of text that has not arrived yet, for the parish pages' loading
 * placeholders. It sits inside the finished page's own classes, so the line box
 * it holds open is the real line's, at any text size; only its width is a guess.
 */
export function LoadingLine({ className }: { className: string }) {
  return <span className={`vf-skeleton inline-block h-[0.62em] align-middle ${className}`} />;
}

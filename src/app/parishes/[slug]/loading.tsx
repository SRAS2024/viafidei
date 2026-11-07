import { LoadingLine } from "../LoadingLine";

/**
 * A parish page on its way: the same centred column, name, designation, address
 * lines and row of controls. Without this the directory's placeholder, three
 * columns of cards, would stand in for a page that has none.
 */
export default function ParishLoading() {
  return (
    <div className="vf-detail" aria-busy="true" data-testid="detail-loading">
      <p role="status" className="sr-only">
        Loading the latest published content…
      </p>
      <div className="vf-detail-header" aria-hidden="true">
        <div className="vf-detail-title leading-[var(--lh-heading)]">
          <LoadingLine className="w-4/5" />
        </div>
        <p className="vf-detail-subtitle">
          <LoadingLine className="w-24" />
        </p>
        <div className="vf-address">
          <span>
            <LoadingLine className="w-1/2" />
          </span>
          <span>
            <LoadingLine className="w-2/5" />
          </span>
          <span>
            <LoadingLine className="w-1/5" />
          </span>
        </div>
        <div className="vf-detail-actions">
          <span className="vf-skeleton h-10 w-[9.375rem]" />
          <span className="vf-skeleton h-10 w-24" />
          <span className="vf-skeleton h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

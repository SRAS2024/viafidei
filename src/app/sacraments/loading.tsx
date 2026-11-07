import { SACRAMENT_GROUPS, SacramentCard, sacramentGridClass, sacramentsOf } from "./groups";

/**
 * The seven sacraments never change, so the placeholder is the finished page with
 * its cards not yet links: nothing moves when the content arrives.
 */
export default function SacramentsLoading() {
  return (
    <div role="status" aria-busy="true" data-testid="tab-loading">
      <section className="vf-page-hero">
        <p className="vf-eyebrow">Sacraments</p>
        <h1 className="vf-page-hero-title text-ink">The Seven Sacraments</h1>
        <p className="vf-page-hero-lede">
          The seven sacraments of the Catholic Church — channels of grace instituted by Christ.
        </p>
      </section>
      <div className="vf-sacrament-groups" aria-hidden="true">
        {SACRAMENT_GROUPS.map((group) => (
          <section key={group.key}>
            <div className="vf-section-head">
              <h2 className="vf-section-title">{group.title}</h2>
            </div>
            <ul className={sacramentGridClass(group)}>
              {sacramentsOf(group).map((sacrament) => (
                <li key={sacrament.key}>
                  <SacramentCard sacrament={sacrament} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

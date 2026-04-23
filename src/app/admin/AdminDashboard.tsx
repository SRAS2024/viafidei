import Link from "next/link";

type Labels = {
  title: string;
  subtitle: string;
  signOut: string;
  welcome: string;
  prayers: string;
  saints: string;
  apparitions: string;
  parishes: string;
  liturgy: string;
  translations: string;
  ingestion: string;
  search: string;
  audit: string;
  media: string;
  homepage: string;
  favicon: string;
};

export function AdminDashboard({ labels }: { labels: Labels }) {
  const cards: Array<{ href: string; key: keyof Labels; eyebrow: string }> = [
    { href: "/admin/homepage", key: "homepage", eyebrow: "I." },
    { href: "/admin/prayers", key: "prayers", eyebrow: "II." },
    { href: "/admin/saints", key: "saints", eyebrow: "III." },
    { href: "/admin/apparitions", key: "apparitions", eyebrow: "IV." },
    { href: "/admin/parishes", key: "parishes", eyebrow: "V." },
    { href: "/admin/liturgy", key: "liturgy", eyebrow: "VI." },
    { href: "/admin/translations", key: "translations", eyebrow: "VII." },
    { href: "/admin/ingestion", key: "ingestion", eyebrow: "VIII." },
    { href: "/admin/search", key: "search", eyebrow: "IX." },
    { href: "/admin/media", key: "media", eyebrow: "X." },
    { href: "/admin/favicon", key: "favicon", eyebrow: "XI." },
    { href: "/admin/audit", key: "audit", eyebrow: "XII." },
  ];

  return (
    <div>
      <section className="text-center">
        <h1 className="font-display text-5xl text-ink">{labels.title}</h1>
        <p className="mx-auto mt-4 max-w-reading font-serif text-lg text-ink-soft">
          {labels.subtitle}
        </p>
        <p className="mt-3 text-xs italic text-ink-faint">{labels.welcome}</p>
      </section>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="vf-card block min-h-[130px] rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
          >
            <p className="vf-eyebrow">{c.eyebrow}</p>
            <h2 className="mt-3 font-display text-2xl">{labels[c.key]}</h2>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="vf-btn vf-btn-ghost">
            {labels.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}

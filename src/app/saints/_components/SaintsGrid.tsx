import { SimpleCross } from "@/components/icons/CrossOrnament";
import { SaintCard } from "./SaintCard";

type SaintForCard = Parameters<typeof SaintCard>[0]["saint"];

type Props = {
  saints: SaintForCard[];
  feastDayLabel: string;
  emptyMessage: string;
};

export function SaintsGrid({ saints, feastDayLabel, emptyMessage }: Props) {
  return (
    <section>
      <div className="vf-ornament mb-8" aria-hidden="true">
        <SimpleCross />
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {saints.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            {emptyMessage}
          </div>
        ) : (
          saints.map((s) => (
            <SaintCard key={s.id} saint={s} feastDayLabel={feastDayLabel} />
          ))
        )}
      </div>
    </section>
  );
}

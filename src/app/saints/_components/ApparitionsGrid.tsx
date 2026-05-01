import { MarianMonogram } from "@/components/icons/MarianMonogram";
import { ApparitionCard } from "./ApparitionCard";

type ApparitionForCard = Parameters<typeof ApparitionCard>[0]["apparition"];

type Props = {
  apparitions: ApparitionForCard[];
  heading: string;
  emptyMessage: string;
};

export function ApparitionsGrid({ apparitions, heading, emptyMessage }: Props) {
  return (
    <section className="mt-20">
      <div className="text-center">
        <div className="vf-icon-marian mx-auto mb-3 inline-flex">
          <MarianMonogram />
        </div>
        <h2 className="font-display text-3xl text-ink">{heading}</h2>
        <div className="vf-rule mx-auto my-5" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {apparitions.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            {emptyMessage}
          </div>
        ) : (
          apparitions.map((a) => <ApparitionCard key={a.id} apparition={a} />)
        )}
      </div>
    </section>
  );
}

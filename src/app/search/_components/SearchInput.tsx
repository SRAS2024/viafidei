import { SearchIcon } from "@/components/icons/SearchIcon";

type Props = {
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  submitLabel: string;
};

export function SearchInput({ defaultValue, placeholder, ariaLabel, submitLabel }: Props) {
  return (
    <form
      method="get"
      role="search"
      className="mx-auto mb-12 flex max-w-xl items-center gap-2"
    >
      <div className="vf-card flex w-full items-center gap-2 rounded-sm px-3">
        <SearchIcon className="shrink-0 text-ink-faint" />
        <input
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full border-0 bg-transparent px-1 py-3 font-serif text-base text-ink outline-none placeholder:italic placeholder:text-ink-faint"
        />
      </div>
      <button type="submit" className="vf-btn vf-btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}

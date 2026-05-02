import { SearchIcon } from "../icons/SearchIcon";

type Props = {
  placeholder: string;
  ariaLabel: string;
};

export function HeaderSearch({ placeholder, ariaLabel }: Props) {
  return (
    <form
      method="get"
      action="/search"
      role="search"
      className="vf-header-search flex w-full items-center gap-2 sm:w-auto sm:max-w-xs"
    >
      <SearchIcon size={14} className="shrink-0 text-ink-faint" />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="vf-header-search-input"
      />
    </form>
  );
}

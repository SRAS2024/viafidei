import { HeaderSearchClient } from "./HeaderSearchClient";

type Props = {
  placeholder: string;
  ariaLabel: string;
  /** "panel" opens the field in a full-width row under the phone's header bar. */
  variant?: "inline" | "panel";
};

export function HeaderSearch(props: Props) {
  return <HeaderSearchClient {...props} />;
}

import { HeaderSearchClient } from "./HeaderSearchClient";

type Props = {
  placeholder: string;
  ariaLabel: string;
};

export function HeaderSearch(props: Props) {
  return <HeaderSearchClient {...props} />;
}

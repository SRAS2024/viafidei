/**
 * The dot between two facts on one line: a mark for the eye, a comma's pause for a voice.
 * The space stays real text outside the hidden dot, because it is all that keeps the two
 * facts' words apart once Safari's accessibility tree has joined the line into one item.
 */
export function MetaSeparator() {
  return (
    <>
      <span className="vf-sr-inline">,</span>
      {/* No break before the dot, so a line never starts with it. */}
      {"\u00a0"}
      <span aria-hidden="true">· </span>
    </>
  );
}

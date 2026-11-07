/**
 * The Lectionary's weekday cycle, seen as the numeral and spoken as the number,
 * which is how the cycle is said aloud: "cycle two". A speech voice reads "II" as
 * two letters. Every page that names the cycle uses this, so it sounds the same.
 *
 * The number comes first. Where the cycle stands alone, as it does in a fact's value,
 * Safari's accessibility tree drops a line's whole text if the line begins with something
 * hidden from it, and the number would go with the numeral.
 */
export function WeekdayCycle({ cycle }: { cycle: "I" | "II" }) {
  return (
    <>
      <span className="vf-sr-inline">{cycle === "I" ? 1 : 2}</span>
      <span aria-hidden="true">{cycle}</span>
    </>
  );
}

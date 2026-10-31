/**
 * Strict command-line flags for the booster scripts.
 *
 * A booster WRITES to the production database, so a flag the operator did not
 * mean must never be read as one they did. The first parser split on "=" and
 * kept the name: `--apply=false` and `--apply=0` turned --apply ON (the name
 * was present), a bare `apply` without dashes did the same, and a numeric
 * flag of 0 (`--limit=0`, `--batch=0`) sent the sweep round a loop that
 * re-read the same page from the Query Service forever. Here a flag is
 * `--name` or `--name=value`, a switch takes no value, a value flag needs
 * one, a number is checked against its floor, and anything else is a usage
 * error before any connection is made.
 */

export interface FlagSpec {
  /** Switches: `--apply`. A value (`--apply=false`) is refused. */
  switches: readonly string[];
  /** Flags that carry a value: `--limit=40`. */
  values: readonly string[];
}

export type ParsedFlags =
  | { ok: true; flags: ReadonlyMap<string, string | true> }
  | { ok: false; error: string };

const FLAG_RE = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/;

/** Parse `args` against `spec`; the first problem found is the error. */
export function parseBoosterFlags(args: readonly string[], spec: FlagSpec): ParsedFlags {
  const flags = new Map<string, string | true>();
  for (const arg of args) {
    const m = FLAG_RE.exec(arg);
    if (!m) return { ok: false, error: `"${arg}" is not an option (use --name or --name=value)` };
    const name = m[1];
    const value = m[2];
    if (flags.has(name)) return { ok: false, error: `--${name} is given twice` };
    if (spec.switches.includes(name)) {
      if (value !== undefined) return { ok: false, error: `--${name} takes no value` };
      flags.set(name, true);
    } else if (spec.values.includes(name)) {
      if (value === undefined || value.trim() === "") {
        return { ok: false, error: `--${name} needs a value (--${name}=…)` };
      }
      flags.set(name, value.trim());
    } else {
      return { ok: false, error: `unknown option --${name}` };
    }
  }
  return { ok: true, flags };
}

/**
 * A whole-number flag no smaller than `min`: its value, `undefined` when the
 * flag is absent, or an error message.
 */
export function wholeNumberFlag(
  flags: ReadonlyMap<string, string | true>,
  name: string,
  min: number,
): { value?: number; error?: string } {
  const raw = flags.get(name);
  if (raw === undefined) return {};
  const n = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < min) {
    return { error: `--${name} must be a whole number of at least ${min}` };
  }
  return { value: n };
}

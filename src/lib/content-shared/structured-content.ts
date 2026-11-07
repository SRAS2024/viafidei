/**
 * Detect "accordion-able" content fields — arrays whose elements each carry a
 * label (day / prayer title / mystery) and a body (prayer text / steps). These
 * render as expandable dropdowns so guides and novenas stay concise while
 * still providing every prayer in order.
 */
export interface DisclosureItem {
  title: string;
  body: string;
  /** "Day 3" for a novena day that carries its number; shown above the title. */
  eyebrow?: string;
}

const LABEL_KEYS = [
  "title",
  "dayTitle",
  "prayerTitle",
  "name",
  "day",
  "mystery",
  "label",
  "heading",
];
const BODY_KEYS = ["text", "prayer", "prayerText", "body", "content", "description", "steps"];

/** "Day 3", or "Third Tuesday: Guarding the Tongue" on the third day. */
function titleCountsDay(title: string, day: number): boolean {
  if (new RegExp(`^day\\s+${day}\\b`, "i").test(title)) return true;
  const [first, second] = title.toLowerCase().split(/[\s:]+/);
  return (
    first === ORDINALS[day - 1]?.toLowerCase() &&
    /^(?:day|sun|mon|tues|wednes|thurs|fri|satur)(?:day)?$/.test(second ?? "")
  );
}

function stringFrom(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "string")) {
    return (value as string[]).join("\n");
  }
  return null;
}

/**
 * Returns one {title, body} per element when the array is a list of
 * label+body objects (e.g. novena days, guide prayers); otherwise null so the
 * caller falls back to its normal rendering.
 *
 * A novena day stores its number as `day: 3` beside its title, so it becomes
 * the eyebrow ("Day 3") over the day's title; a day with a number and no title
 * is titled "Day 3". A title that already counts the day ("Day 3", "Third Tuesday:
 * Guarding the Tongue") needs no eyebrow. A long body with no paragraphs of its
 * own is paragraphed at sentence ends, so a prayer of two thousand characters can
 * be read on a phone.
 */
export function toDisclosureItems(value: unknown): DisclosureItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: DisclosureItem[] = [];
  for (const el of value) {
    if (typeof el !== "object" || el === null || Array.isArray(el)) return null;
    const o = el as Record<string, unknown>;
    const labelKey = LABEL_KEYS.find((k) => typeof o[k] === "string" && (o[k] as string).trim());
    let body: string | null = null;
    for (const k of BODY_KEYS) {
      const s = stringFrom(o[k]);
      if (s) {
        body = s;
        break;
      }
    }
    const dayNumber =
      typeof o.day === "number" && Number.isInteger(o.day) && o.day > 0 ? o.day : null;
    const dayLabel = dayNumber ? `Day ${dayNumber}` : null;
    if ((!labelKey && !dayLabel) || body == null) return null;
    const paragraphed = splitParagraphs(body).join("\n\n");
    if (labelKey) {
      const title = String(o[labelKey]).trim();
      items.push({
        title,
        body: paragraphed,
        ...(dayLabel && !titleCountsDay(title, dayNumber!) ? { eyebrow: dayLabel } : {}),
      });
    } else {
      items.push({ title: dayLabel!, body: paragraphed });
    }
  }
  return items;
}

/** One step of a how-to guide: a number, a title and the instruction itself. */
export interface GuideStep {
  /** 1-based position; falls back to array order when the payload omits it. */
  order: number;
  title: string;
  body: string;
}

/**
 * Reads a guide's `steps` array into ordered, numbered steps.
 *
 * `toDisclosureItems` deliberately drops `order` (it keeps only a novena's
 * `day` number, as an eyebrow), which is why guide steps used to render as
 * unnumbered collapsed rows. Guides need the number, so they get their own reader: it keeps `order`
 * when the payload carries one, sorts by it, and returns null for anything
 * that is not a list of title+body objects so the caller can fall back.
 */
export function toGuideSteps(value: unknown): GuideStep[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const steps: GuideStep[] = [];
  for (const [index, el] of value.entries()) {
    if (typeof el !== "object" || el === null || Array.isArray(el)) return null;
    const o = el as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const body = stringFrom(o.body ?? o.text ?? o.content);
    if (!title || !body) return null;
    const rawOrder = typeof o.order === "number" && Number.isFinite(o.order) ? o.order : null;
    steps.push({ order: rawOrder ?? index + 1, title, body });
  }
  // A payload with duplicate or missing orders must still read 1, 2, 3 — sort
  // by the stored order, then renumber from the sorted position.
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }));
}

/* ------------------------------------------------------------------
 * Reading structure out of running text.
 *
 * A how-to is stored as one string, so Lectio Divina's four movements reached
 * the page as one paragraph. What follows finds the structure the words already
 * have and hands it to the page: the steps of a sequence, paragraphs at sentence
 * ends, the words a reader is told to say. Nothing here rewrites anything. Every
 * word comes back in order; only a list numeral ("2.", "Second,") becomes the
 * list's own number, and a first letter takes a capital where a sentence's
 * middle now starts a line. Each reader is conservative on purpose: text it is
 * not sure of stays as it was, because a wrong list is worse than a long
 * paragraph. The text may be in any language (src/lib/translation), and one that
 * does not parse simply reads as paragraphs.
 * ------------------------------------------------------------------ */

interface QuoteSpan {
  /** The opening mark. */
  start: number;
  /** Just past the closing mark. */
  end: number;
}

/**
 * Where a single-quoted span closes. An apostrophe inside a word ("God's") never
 * closes one. One after an s ("the Apostles' Creed") closes it only if nothing
 * better follows before the next quotation opens.
 */
function closingSingleQuote(text: string, open: number): number {
  let afterPlural = -1;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" && text[i + 1] === "\n") break;
    if (ch !== "'" && ch !== "’") continue;
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";
    if (/[\p{L}\p{N}]/u.test(next)) {
      if (/\s/.test(prev)) break; // The next quotation is opening.
      continue;
    }
    if (/\s/.test(prev)) continue;
    if (/s/i.test(prev) && /\s/.test(next) && /\p{L}/u.test(text[i + 2] ?? "")) {
      if (afterPlural < 0) afterPlural = i;
      continue;
    }
    return i;
  }
  return afterPlural;
}

/** Every quotation in straight or curly marks, in order, none inside another. */
function findQuotes(text: string): QuoteSpan[] {
  const spans: QuoteSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    let close = -1;
    if (ch === '"' || ch === "“") {
      const rest = text.slice(i + 1).search(/["”]/);
      close = rest < 0 ? -1 : i + 1 + rest;
      if (close > 0 && text.slice(i, close).includes("\n\n")) close = -1;
    } else if (ch === "‘") {
      close = closingSingleQuote(text, i);
    } else if (ch === "'") {
      const prev = text[i - 1] ?? "";
      const opens = (prev === "" || /[\s([{—–"“]/.test(prev)) && /\S/.test(text[i + 1] ?? " ");
      if (opens) close = closingSingleQuote(text, i);
    }
    if (close > i) {
      spans.push({ start: i, end: close + 1 });
      i = close + 1;
    } else {
      i += 1;
    }
  }
  return spans;
}

/** Titles and short forms whose period never ends a sentence. */
const ALWAYS_ABBREVIATED =
  /^(?:St|Sts|Ss|SS|Fr|Frs|Msgr|Mgr|Bp|Abp|Card|Bl|Ven|Sr|Br|Mr|Mrs|Ms|Dr|Prof|Rev|Revd|Hon|Mt|cf|Cf|vs|viz|etc|e\.g|i\.e|eg|ie)$/;
/** Book, canon and month short forms: abbreviated when a number follows ("Ps. 51", "no. 69"). */
const ABBREVIATED_BEFORE_NUMBER =
  /^(?:Gen|Ex|Lev|Num|Deut|Dt|Josh|Judg|Ps|Pss|Prov|Eccl|Wis|Sir|Isa|Is|Jer|Lam|Bar|Ezek|Dan|Hos|Mic|Zech|Mal|Matt|Mk|Lk|Jn|Rom|Cor|Gal|Eph|Phil|Col|Thess|Tim|Heb|Jas|Pet|no|nos|No|Nos|n|nn|p|pp|c|ca|ch|chap|vol|Vol|ed|art|Art|can|Can|para|v|vv|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/;

/**
 * Where each sentence of `text` ends, just past its punctuation and any closing
 * mark, when another sentence follows. A quotation or a bracket is never broken
 * into, an ellipsis is a pause, and a period after an initial or a short form
 * (St., e.g., Ps. 51) ends nothing.
 */
function sentenceEnds(text: string): number[] {
  const quotes = findQuotes(text);
  const inQuote = (i: number) => quotes.some((q) => q.start < i && i < q.end);
  const depths: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" || text[i] === "[") depth += 1;
    depths[i] = depth;
    if ((text[i] === ")" || text[i] === "]") && depth > 0) depth -= 1;
  }

  const ends: number[] = [];
  const candidate = /([.!?]+)["'”’)\]]*(?=\s+["'“‘([]?[\p{Lu}\p{Lo}\p{N}])/gu;
  for (const match of text.matchAll(candidate)) {
    const mark = match[1];
    const end = match.index + match[0].length;
    if (mark.startsWith("..")) continue;
    if (inQuote(end) || (depths[end - 1] ?? 0) > (/[)\]]$/.test(match[0]) ? 1 : 0)) continue;
    // "... forsaken me?' (Matthew 27:46)": the citation still belongs to it.
    if (/^\s+\([^)]*\d[^)]*\)/.test(text.slice(end))) continue;
    if (mark === ".") {
      const word = /[\p{L}.]*$/u.exec(text.slice(Math.max(0, match.index - 12), match.index))?.[0];
      if (word && word.length === 1 && /\p{Lu}/u.test(word)) continue;
      if (word && ALWAYS_ABBREVIATED.test(word)) continue;
      if (word && ABBREVIATED_BEFORE_NUMBER.test(word) && /^\s+\d/.test(text.slice(end))) continue;
    }
    ends.push(end);
  }
  return ends;
}

/* ------------------------------------------------------------------ steps */

/** One step found in running instructions. */
export interface SequenceStep {
  /** The number the text gives it: "Fourth:" is 4. */
  order: number;
  /** The step's name, when every step of the sequence opens with one. */
  title: string | null;
  body: string;
}

export interface ParsedSequence {
  /** Text before the first step, "" when the text opens with it. */
  lead: string;
  steps: SequenceStep[];
  /** Text after the last step, "" when the text closes with it. */
  trailing: string;
  /** Set when these are the named parts of something rather than things to do in turn. */
  parts?: true;
}

/** Where a step's numeral sits (`start`) and its own words begin (`end`). */
interface StepMarker {
  start: number;
  end: number;
  order: number;
}

/** True when a list can open here: the start of the text or the end of a sentence or lead-in. */
function opensList(text: string, index: number): boolean {
  const before = text.slice(0, index).trimEnd();
  return before === "" || /[.!?:;"'”’)\]]$/.test(before);
}

/** The first run of consecutive numbers from 1, opening where a list can open. */
function consecutiveRun(
  candidates: StepMarker[],
  text: string,
  minimum: number,
): StepMarker[] | null {
  for (let i = 0; i < candidates.length; i++) {
    const first = candidates[i]!;
    if (first.order !== 1 || !opensList(text, first.start)) continue;
    const run = [first];
    for (const next of candidates.slice(i + 1)) {
      if (next.order === run[run.length - 1]!.order + 1) run.push(next);
    }
    if (run.length >= minimum) return run;
  }
  return null;
}

function markersFrom(text: string, pattern: RegExp): StepMarker[] {
  return [...text.matchAll(pattern)].map((m) => ({
    start: m.index + (m[1]?.length ?? 0),
    end: m.index + m[0].length,
    order: Number(m[2]),
  }));
}

/** "Step 1: ... Step 2: ..." */
const STEP_WORD = /(^|\s)Step\s+(\d{1,2})\s*[:.]\s+/gi;
/** "1. ... 2. ..." or "1) ... 2) ...", inline or one to a line, each opening with a capital. */
const NUMERAL = /(^|\s)(\d{1,2})[.)]\s+(?=["'“‘([]?[\p{Lu}\p{Lo}])/gu;
/** "(1) ...; (2) ..." */
const BRACKETED_NUMERAL = /()\((\d{1,2})\)\s+/g;

const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
];
const ORDINAL_WORD = new RegExp(
  `(^|[.!?:;"'”’)\\]]\\s+)(${ORDINALS.join("|")})(?:ly)?([,:])\\s+`,
  "g",
);

/**
 * "First, ... Second, ... Third, ...", each at the start of a sentence, at least
 * three of them, in order, with one punctuation. A run that does not start at
 * First has to open the text: a guide that spreads nine salutations over three
 * steps says "Fourth: ..." at the start of the second.
 */
function ordinalMarkers(text: string): StepMarker[] | null {
  const words = [...text.matchAll(ORDINAL_WORD)];
  for (let i = 0; i < words.length; i++) {
    const first = words[i]!;
    const firstOrder = ORDINALS.indexOf(first[2]!);
    if (firstOrder !== 0 && first.index !== 0) continue;
    const run = [first];
    for (const next of words.slice(i + 1)) {
      const last = run[run.length - 1]!;
      if (ORDINALS.indexOf(next[2]!) === ORDINALS.indexOf(last[2]!) + 1 && next[3] === first[3]) {
        run.push(next);
      }
    }
    if (run.length >= 3) {
      return run.map((m) => ({
        start: m.index + m[1]!.length,
        end: m.index + m[0].length,
        order: ORDINALS.indexOf(m[2]!) + 1,
      }));
    }
  }
  return null;
}

const COUNT_WORDS: Readonly<Record<string, number>> = {
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
};
const COUNT_WORD = new RegExp(`\\b(${Object.keys(COUNT_WORDS).join("|")})\\b`, "gi");

/**
 * "Take the seven last words in order: a; b; c; d; e; f; g." A lead-in that names
 * its number, then exactly that many items separated by semicolons: the text has
 * counted them for us, so they are a list even with no numerals.
 */
function countedMarkers(text: string): StepMarker[] | null {
  const quotes = findQuotes(text);
  const inQuote = (i: number) => quotes.some((q) => q.start < i && i < q.end);
  const ends = sentenceEnds(text);
  for (let colon = text.indexOf(":"); colon >= 0; colon = text.indexOf(":", colon + 1)) {
    if (inQuote(colon)) continue;
    const opening = ends.filter((e) => e < colon).pop() ?? 0;
    const closing = ends.find((e) => e > colon) ?? text.length;
    const lastCount = [...text.slice(opening, colon).matchAll(COUNT_WORD)].pop();
    // "the other six:" counts something else; "the seven last words:" counts these.
    if (
      !lastCount ||
      !/\p{L}/u.test(text.slice(lastCount.index + opening + lastCount[0].length, colon))
    ) {
      continue;
    }
    const count = COUNT_WORDS[lastCount[1]!.toLowerCase()]!;
    const markers = itemsAfterColon(text, colon, closing, inQuote);
    if (markers.length === count) return markers;
  }
  return null;
}

/** Where each sentence of `text` begins, the first included. */
function sentenceStarts(text: string): number[] {
  return [0, ...sentenceEnds(text).map((end) => end + /^\s*/.exec(text.slice(end))![0].length)];
}

/** The sentence-openers that bound a how-to: its first step and its last. */
const OPENS_STEPS = /^(?:Begin|Start)\b/;
const CLOSES_STEPS = /^(?:Conclude|Close|End|Finish|Finally|Lastly|At the end)\b/;

/**
 * "Begin with the Sign of the Cross. Pray one Our Father. Then meditate. Conclude
 * with the Hail Holy Queen." A sentence that opens with Begin and a later one that
 * opens with Conclude say the sentences from one to the other are the steps of
 * something, one to a sentence. It takes at least one between them: "Begin ...
 * End ..." alone is two remarks, and "Begin ... Then ..." alone is how a good many
 * counsels start without being a sequence at all.
 */
function bookendedMarkers(text: string): StepMarker[] | null {
  const starts = sentenceStarts(text);
  const opening = starts.findIndex((start) => OPENS_STEPS.test(text.slice(start)));
  if (opening < 0) return null;
  const closing = starts.findIndex(
    (start, i) => i >= opening + 2 && CLOSES_STEPS.test(text.slice(start)),
  );
  if (closing < 0) return null;
  return starts
    .slice(opening, closing + 1)
    .map((start, i) => ({ start, end: start, order: i + 1 }));
}

/** The items of a list set out after a colon, the colon's own sentence ending at `closing`. */
function itemsAfterColon(
  text: string,
  colon: number,
  closing: number,
  inQuote: (index: number) => boolean,
): StepMarker[] {
  let start = colon + 1;
  while (/\s/.test(text[start] ?? "")) start += 1;
  const markers: StepMarker[] = [{ start: colon + 1, end: start, order: 1 }];
  let depth = 0;
  for (let i = start; i < closing; i++) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch !== ";" || depth !== 0 || inQuote(i)) continue;
    let next = i + 1;
    while (/\s/.test(text[next] ?? "")) next += 1;
    markers.push({ start: next, end: next, order: markers.length + 1 });
  }
  return markers;
}

/** A lead-in that says what follows comes in order; "the Order of Mass" is a name. */
const NAMES_AN_ORDER = /\b(?:order|sequence|shape|stages)\b[^.!?;]*$/;

/**
 * "A traditional shape for the hour: begin with an act of adoration; read the
 * Gospel; make reparation; intercede; end with the Divine Praises." "The usual order
 * is: the processional cross; the faithful; the choir." A list after a colon, whose
 * lead-in says it comes in order, holds the steps however many it has.
 */
function orderedListMarkers(text: string): StepMarker[] | null {
  const quotes = findQuotes(text);
  const inQuote = (i: number) => quotes.some((q) => q.start < i && i < q.end);
  const ends = sentenceEnds(text);
  for (let colon = text.indexOf(":"); colon >= 0; colon = text.indexOf(":", colon + 1)) {
    if (inQuote(colon)) continue;
    const opening = ends.filter((e) => e < colon).pop() ?? 0;
    if (!NAMES_AN_ORDER.test(text.slice(opening, colon))) continue;
    const closing = ends.find((e) => e > colon) ?? text.length;
    const markers = itemsAfterColon(text, colon, closing, inQuote);
    if (markers.length >= 3) return markers;
  }
  return null;
}

const PART_ORDINALS = [...ORDINALS, "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth"];
const ORDINAL_PART = new RegExp(`^The (${PART_ORDINALS.join("|")}) (\\p{Lu}\\p{Ll}+)\\b(?!:)`, "u");

/**
 * "The First Week considers sin. The Second Week contemplates the life of Christ.
 * The Third Week ...": at least three sentences that name the same part in counted
 * order, from the first. Each keeps its name in its own words, since the sentence
 * has no sense without it. A guide's "The Second Station: ..." is not one of these:
 * those run across several steps and keep the paragraphs `splitParagraphs` gives them.
 */
function ordinalPartMarkers(text: string): StepMarker[] | null {
  const markers: StepMarker[] = [];
  let noun: string | null = null;
  for (const start of sentenceStarts(text)) {
    const part = ORDINAL_PART.exec(text.slice(start));
    if (!part) continue;
    const order = PART_ORDINALS.indexOf(part[1]!) + 1;
    if (order === 1 && markers.length === 0) noun = part[2]!;
    if (part[2] === noun && order === markers.length + 1)
      markers.push({ start, end: start, order });
  }
  return markers.length >= 3 ? markers : null;
}

/**
 * A name and a colon opening a sentence: "Prayer:", "Liturgy of the Word:". Not one
 * that hands over words to say ("Answer: 'His mercy endures for ever.'"), which is a
 * dialogue and is set as one (`splitSpokenWords`).
 */
const LABEL = /^\p{Lu}[\p{L}'’-]*(?: [\p{L}'’-]+){0,4}:\s+(?!["'“‘])\S/u;

/**
 * "Prayer: the fixed times. Word and study: what you will read. Penance: the Friday
 * penance. Charity: the works of mercy." At least three sentences in a row, each
 * opening with a short name and a colon, are the named parts of something. The name
 * becomes the step's title (`buildSequence`).
 */
function labelledMarkers(text: string): StepMarker[] | null {
  const starts = sentenceStarts(text);
  const isLabelled = (start: number) => {
    const sentence = text.slice(start);
    return LABEL.test(sentence) && !OPENS_A_PART.test(sentence);
  };
  for (let i = 0; i < starts.length; i++) {
    let last = i;
    while (last < starts.length && isLabelled(starts[last]!)) last += 1;
    if (last - i >= 3) {
      return starts.slice(i, last).map((start, n) => ({ start, end: start, order: n + 1 }));
    }
    i = Math.max(i, last);
  }
  return null;
}

/**
 * Instructions that plainly are a sequence, though nothing in their wording could
 * tell a program so: "Make or buy a wreath. On the First Sunday of Advent, light the
 * first candle. Each evening afterwards ...". Each line is the words that open each
 * step of one how-to, read and marked by hand. The words are matched exactly and in
 * order, so a text that is edited stops matching and simply reads as paragraphs, as
 * text in another language does. Counsels that merely follow one another, with no
 * order the reader has to keep ("Keep one book going. Read with a pencil."), are not
 * marked: a wrong list is worse than a long paragraph.
 */
const MARKED_SEQUENCES: ReadonlyArray<readonly string[]> = [
  // Guides: the postures at Mass, what canon 874 asks of a godparent or sponsor, and
  // the feasts commonly chosen for a Marian consecration, in the year's order.
  [
    "stand from the entrance chant",
    "sit for the first reading",
    "stand for the Alleluia",
    "sit for the homily",
    "stand for the Creed",
    "sit during the preparation",
    "stand from the invitation",
    "kneel from after",
    "stand for the Our Father",
    "kneel after the Lamb",
    "and stand for the prayer after Communion",
  ],
  [
    "be chosen by the parents",
    "be at least sixteen",
    "be a Catholic who",
    "not be under any canonical penalty",
    "and not be the father or mother",
  ],
  [
    "the Immaculate Conception (8 December)",
    "Our Lady of Guadalupe (12 December)",
    "the Solemnity of Mary, Mother of God (1 January)",
    "Our Lady of Lourdes (11 February)",
    "the Annunciation (25 March)",
    "Our Lady of Fatima (13 May)",
    "the Visitation (31 May)",
    "the Immaculate Heart of Mary (the Saturday",
    "Our Lady of Mount Carmel (16 July)",
    "the Assumption (15 August)",
    "the Queenship of Mary (22 August)",
    "the Nativity of Mary (8 September)",
    "Our Lady of the Rosary (7 October)",
    "and the Presentation of Mary (21 November)",
  ],
  // The Hours: Morning and Evening Prayer as Night Prayer beside them already reads.
  [
    "If this is the first Hour",
    "Sing or say the hymn",
    "Pray the first psalm",
    "Read the short Scripture reading",
    "Say the responsory line by line",
    "Stand and make the Sign of the Cross for the Benedictus",
    "Pray the intercessions",
    "If no priest or deacon",
  ],
  [
    "Begin 'God, come to my assistance",
    "The hymn follows",
    "Pray two psalms",
    "Read the short reading, pause",
    "Stand and make the Sign of the Cross for the Magnificat",
    "The intercessions at Evening Prayer",
    "Then the Our Father",
  ],
  // The candles week by week, the figures of the crib from the back, and its blessing.
  ["In the first week", "In the second week", "In the third week", "In the fourth week"],
  [
    "the stable or cave",
    "then the animals inside",
    "then Mary and Joseph",
    "The angel goes above",
    "Set the three Magi",
  ],
  [
    "All gather before the crib",
    "one member reads",
    "the leader says the prayer of blessing",
    "and all end with the Our Father",
  ],
  // The Rosary's opening, bead by bead: the mysteries' four guides, then the general one.
  [
    "Make the Sign of the Cross",
    "Holding the crucifix",
    "On the first large bead",
    "on the next three small beads",
    "then pray the Glory Be",
  ],
  ["On the first large bead", "On each of the next three small beads", "On the chain or space"],
  ["Begin clearly", "Then lead the Apostles' Creed", "On the opening beads lead"],
  ["Open with the Sign of the Cross", "then for each mystery", "Close with the Salve Regina"],
  // The shape of something said each time: the O Antiphons, a station, the Christmas novena.
  ["the day's antiphon", "the Magnificat, 'My soul", "a Glory Be;", "and the antiphon again"],
  [
    "The leader announces it",
    "All genuflect or bow",
    "Then the meditation is read",
    "Pray the Our Father",
  ],
  ["Read the Gospel of the day's Mass", "Then pray the day's O Antiphon", "End with a Hail Mary"],
  // Blessing a home, and enthroning the Sacred Heart in it.
  ["Gather the family", "Then pray in your own words", "Sprinkle each room"],
  [
    "Gather at the door",
    "make the Sign of the Cross",
    "read the Gospel of the Magi",
    "and pray that all who enter",
    "then write the inscription",
    "and close with the Our Father",
  ],
  [
    "Gather around the prepared place",
    "Begin with the Sign of the Cross",
    "The priest blesses the image",
    "Then the head of the household",
  ],
  // Confession from the penitent's side, and the evening examen.
  [
    "When you go into the confessional",
    "Then tell Father your sins",
    "When you finish, say",
    "Father will talk with you",
    "Then pray the Act of Contrition",
    "Father will say the words",
  ],
  ["'Bless me, Father", "Then: 'I am sorry", "Then the Act of Contrition", "Then 'Amen'"],
  ["Begin as usual", "Then go through your notes", "When you finish, add"],
  [
    "Begin with the Sign of the Cross and 'Bless me",
    "say your sins plainly",
    "listen to the priest's counsel",
    "pray the Act of Contrition",
    "and receive absolution",
  ],
  [
    "Thank him for what was good",
    "Ask the Holy Spirit for light",
    "Be sorry for the failures",
    "Finally, look to tomorrow",
  ],
  // The rites a reader takes part in, each in the order it runs.
  [
    "The priest greets the sick person",
    "If the sick person wishes to confess",
    "A short passage of Scripture",
    "Then the priest lays his hands",
    "He anoints the hands",
    "A prayer follows",
  ],
  [
    "Sit or stand with your candidate",
    "After the homily the candidates",
    "Then the candidates come forward",
    "The bishop anoints",
    "Then you both return",
  ],
  ["The Vigil for the Deceased", "The Funeral Liturgy is", "The Rite of Committal"],
  // Devotions.
  [
    "Pray thirteen small decades",
    "On the first bead of each decade",
    "After the thirteenth decade",
  ],
  ["Pray one Our Father and three Hail Marys in honor", "then conclude with four Our Fathers"],
  ["Take the chaplet", "On the first three beads", "On the remaining twelve beads", "Close with"],
  ["Begin at the medal", "Then on each of the thirty-three beads"],
  ["Make or buy a wreath", "On the First Sunday of Advent", "Each evening afterwards"],
  ["Enter the church quietly", "Kneel or sit near it", "Then speak simply", "Before leaving"],
  [
    "The Blessed Sacrament is exposed",
    "A period of adoration follows",
    "Toward the end",
    "Vested in humeral veil",
    "The Divine Praises are then said",
  ],
  [
    "After returning to your place",
    "Make an act of faith in the presence",
    "Stay for ten or fifteen minutes",
    "End by offering",
  ],
  ["Take the three versicles in turn", "Then say the versicle"],
  [
    "Arrange nine households",
    "Each evening the pilgrims",
    "On the first eight nights",
    "On the ninth night",
  ],
  ["Take part first", "Then, before the churches close", "In each, kneel"],
  ["Kneel before a crucifix", "Take the wounds one at a time", "Close with the prayer"],
  ["Use a small evergreen", "Prepare one symbol", "Each evening gather"],
  ["Set a statue or image", "Make a wreath of fresh flowers", "Sing a Marian hymn"],
  [
    "The procession normally sets out",
    "Walk in order behind the cross",
    "Where the route allows",
    "At the end return",
  ],
  ["Recollect yourself", "Make an act of faith in the real presence", "Remain a little while"],
  [
    "Prepare by going to confession",
    "Choose a Marian feast",
    "Kneel before an image",
    "Renew the act",
  ],
  ["Ask your parish when", "Prepare a basket", "Bring it to church", "Begin the Easter breakfast"],
  ["Plan the table", "Set up three tiers", "Ask a priest to bless"],
  ["First be enrolled", "Afterwards a medal", "Wear it constantly"],
  ["Be enrolled by a priest", "and afterwards wear it"],
  ["Be enrolled by a priest", "and then wear it"],
  ["Ask a Dominican house", "Then keep the undertaking"],
  ["Ask a priest to bless the medal", "Then wear it, or keep it", "Use it with an act of faith"],
  [
    "days of emptying oneself",
    "knowledge of self",
    "knowledge of Mary",
    "and knowledge of Jesus",
    "then pronounce the act",
  ],
  ["With the right hand touch the forehead", "then the breast", "then the left shoulder"],
  ["approach quietly", "kneel or bow", "and kiss or touch the reliquary", "Then pray — not"],
  ["Say or sing the four acclamations", "and close with the prayer"],
  ["begin with adoration", "then thanksgiving", "reparation,", "and intercession"],
  // Practices.
  ["Set aside a fixed time", "Place yourself", "Take a scene", "Conclude with thanksgiving"],
  ["Begin with vocal prayer", "then meditation on a scene"],
  [
    "Come before the Blessed Sacrament",
    "Begin with an act of faith and adoration",
    "then converse with the Lord",
    "read Scripture",
    "pray the Rosary or the Liturgy",
    "intercede for the world",
    "and rest in loving silence",
  ],
  [
    "the introductory verse",
    "a hymn,",
    "two psalms and an Old",
    "a short Scripture reading",
    "the Gospel canticle",
    "intercessions,",
    "the Our Father,",
    "and the concluding prayer",
  ],
  ["three versicles with their responses", "then the versicle"],
  [
    "Keep the same hour",
    "Sit still, close the eyes",
    "Then withdraw the senses",
    "Use a short vocal prayer",
    "When thoughts scatter",
    "Ask for nothing in particular",
    "Expect dryness",
    "Carry the recollection",
  ],
  [
    "the Sign of the Cross,",
    "the Our Father,",
    "the Hail Mary,",
    "the Glory Be,",
    "the prayer to the Guardian Angel,",
    "and then intercessions",
  ],
  [
    "Book with a retreat house",
    "Arrange the practical things",
    "Keep the house's horarium",
    "Take one short Scripture passage",
    "Go to confession while you are there",
    "Expect the first day",
    "On the last day",
  ],
  [
    "Fix the day and keep it",
    "Prepare with an examination",
    "In the confessional",
    "Listen to the counsel",
    "Make an Act of Contrition",
    "Then ask the confessor",
  ],
  [
    "Before you speak, ask three questions",
    "Pray for the person first",
    "Then speak privately",
    "If a private word fails",
  ],
  ["Read the passage twice", "Then stay with", "Ask the plain questions", "End with a moment"],
  ["Begin with the morning exercise", "Then, through the day", "Afterwards, thank him"],
  [
    "Begin with the Sign of the Cross and one line",
    "Then say the chosen prayer",
    "When distraction",
  ],
];

/** The hand-marked sequence `text` is, when it is one. */
function markedSequence(text: string): StepMarker[] | null {
  for (const openers of MARKED_SEQUENCES) {
    const markers: StepMarker[] = [];
    let from = 0;
    for (const opener of openers) {
      const start = text.indexOf(opener, from);
      if (start < 0 || (start > 0 && !/\s/.test(text[start - 1]!))) break;
      markers.push({ start, end: start, order: markers.length + 1 });
      from = start + opener.length;
    }
    if (markers.length === openers.length) return markers;
  }
  return null;
}

const NAMED_STEP = /^([^:.!?;"“‘'(]+(?:\([^)]*\)[^:.!?;"“‘'(]*)?):\s+(\S[\s\S]*)$/u;
const MAX_NAME_WORDS = 7;

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildSequence(text: string, markers: StepMarker[]): ParsedSequence {
  const raw = markers.map((marker, i) =>
    text.slice(marker.end, markers[i + 1]?.start ?? text.length).trim(),
  );
  let trailing = "";
  const lastIndex = raw.length - 1;
  const onOwnLines = markers.every((m) => m.start === 0 || /\n\s*$/.test(text.slice(0, m.start)));
  const last = raw[lastIndex]!;
  if (onOwnLines) {
    const lineEnd = last.indexOf("\n");
    if (lineEnd >= 0) {
      trailing = last.slice(lineEnd).trim();
      raw[lastIndex] = last.slice(0, lineEnd).trim();
    }
  } else {
    // The last step is as long as the shortest before it. Lectio Divina's steps
    // are one sentence each, so its closing sentence about Pope Benedict is not
    // part of the fourth movement.
    const sentencesPerStep = Math.min(
      ...raw.slice(0, -1).map((step) => sentenceEnds(step).length + 1),
    );
    const cut = sentenceEnds(last)[sentencesPerStep - 1];
    if (cut !== undefined) {
      trailing = last.slice(cut).trim();
      raw[lastIndex] = last.slice(0, cut).trim();
    }
  }

  // Semicolons, commas and a dash that closes an aside only separated the items, and
  // the list now does that. A joining "and" stays on the step it follows, so that no
  // word is lost.
  const isList = raw
    .slice(0, -1)
    .every((step) => /;$/.test(step) || !/[.!?]["'”’)\]]*$/.test(step));
  const steps = raw.map((step, i) => {
    let body = step.replace(/\s*[;,—]$/, "");
    if (i < lastIndex && /^and\s/i.test(raw[i + 1]!)) body = `${body}; and`;
    if (i > 0 && /^and\s/i.test(raw[i]!)) body = body.replace(/^and\s+/i, "");
    if (i === lastIndex && isList) body = body.replace(/\.$/, "");
    return body;
  });

  const named = steps.map((step) => NAMED_STEP.exec(step));
  const everyStepNamed = named.every(
    (match) => match && match[1]!.trim().split(/\s+/).length <= MAX_NAME_WORDS,
  );
  return {
    lead: text.slice(0, markers[0]!.start).trim(),
    steps: steps.map((body, i) =>
      everyStepNamed
        ? {
            order: markers[i]!.order,
            title: capitalized(named[i]![1]!.trim()),
            body: capitalized(named[i]![2]!),
          }
        : { order: markers[i]!.order, title: null, body: capitalized(body) },
    ),
    trailing,
  };
}

/**
 * The steps of a sequence in running instructions, or null when the text does
 * not unambiguously hold one. It finds "1. X 2. Y 3. Z" inline or one to a line,
 * "(1) X; (2) Y; (3) Z", "Step 1: X", "First, X Second, Y Third, Z", a counted list
 * ("the seven last words: a; b; ..."), "The First Week ... The Second Week ...",
 * named parts ("Prayer: ... Word and study: ..."), a run of sentences from "Begin"
 * to "Conclude", and the how-tos marked by hand above. Numbers must run
 * consecutively from the start of a sentence, so "1 Cor. 13", "(Luke 11:41)" and "in
 * 1917." never fire it. A step that opens with a name and a colon, when all of them
 * do, becomes a title and a body.
 */
export function parseSequence(text: string): ParsedSequence | null {
  const value = text.trim();
  if (!value) return null;
  const markers =
    markedSequence(value) ??
    consecutiveRun(markersFrom(value, STEP_WORD), value, 2) ??
    consecutiveRun(markersFrom(value, NUMERAL), value, /\n/.test(value) ? 2 : 3) ??
    consecutiveRun(markersFrom(value, BRACKETED_NUMERAL), value, 3) ??
    ordinalMarkers(value) ??
    countedMarkers(value) ??
    ordinalPartMarkers(value);
  if (markers) return buildSequence(value, markers);
  const parts = labelledMarkers(value);
  if (parts) return { ...buildSequence(value, parts), parts: true };
  const steps = orderedListMarkers(value) ?? bookendedMarkers(value);
  return steps ? buildSequence(value, steps) : null;
}

/* ------------------------------------------------------------- paragraphs */

/** Above this a paragraph is too long to read comfortably on a page or a phone. */
const LONG_PARAGRAPH = 600;
/** A step's text sits beside its number on a shorter line, so it breaks sooner. */
export const LONG_STEP_PARAGRAPH = 450;
/** What a split aims for, about five lines at the reading measure. */
const IDEAL_PARAGRAPH = 380;
/** A new paragraph should not open by leaning on the last one ("This is why..."). */
const LEANS_BACK =
  /^(?:["'“‘]?)(?:It|This|These|That|Those|They|He|She|His|Her|Their|Its|Such|Both|Each|Also|And|But|Or|So|For|Yet|Nor|Thus|Hence|Here|There|Which|Who|Whose|Instead|Otherwise|However|Second|Third|Fourth|Fifth)\b/;
/** A sentence that opens a new turn of the instructions is a good place to break. */
const TURNS =
  /^(?:Then|Finally|Next|Afterwards|After|Before|When|While|If|Where|During|Once|Many|Some|Others|Note|Keep|Never|Remember)\b/;

/** A sentence that opens a numbered part: "The Second Station: Jesus takes up his Cross." */
const OPENS_A_PART =
  /^The (?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|Thirteenth|Fourteenth|Fifteenth) \p{Lu}\p{Ll}+:/u;

function splitLongParagraph(paragraph: string, limit: number): string[] {
  if (paragraph.includes("\n")) return [paragraph];
  const ends = sentenceEnds(paragraph);
  const partStarts = ends
    .map((end) => end + (paragraph.slice(end).length - paragraph.slice(end).trimStart().length))
    .filter((start) => OPENS_A_PART.test(paragraph.slice(start)));
  // A walk through numbered parts takes a paragraph for each, whatever its length.
  if (partStarts.length > 0 || OPENS_A_PART.test(paragraph)) {
    const cutsAt = [0, ...partStarts.filter((start) => start > 0), paragraph.length];
    return cutsAt
      .slice(0, -1)
      .map((start, i) => paragraph.slice(start, cutsAt[i + 1]).trim())
      .flatMap((piece) => {
        if (!OPENS_A_PART.test(piece)) return splitBySentences(piece, limit);
        // "... your own falls. At each:" is said of all of them, not of this one.
        const cue = /^(.*[.!?]["'”’)]*)\s+([^.!?:]{1,30}:)$/su.exec(piece);
        return cue ? [cue[1]!, cue[2]!] : [piece];
      });
  }
  return splitBySentences(paragraph, limit);
}

function splitBySentences(paragraph: string, limit: number): string[] {
  if (paragraph.length <= limit) return [paragraph];
  const cuts = [0, ...sentenceEnds(paragraph), paragraph.length];
  if (cuts.length < 3) return [paragraph];
  // The cheapest way to group the sentences: each paragraph near the ideal
  // length, none tiny, and breaks at the sentences that can start one. Staying over
  // the limit costs more than a short paragraph does: a long sentence with two short
  // ones after it used to keep them all together rather than leave them on their own.
  const best: { cost: number; from: number }[] = [{ cost: 0, from: 0 }];
  for (let end = 1; end < cuts.length; end++) {
    let chosen = { cost: Infinity, from: 0 };
    for (let start = 0; start < end; start++) {
      const piece = paragraph.slice(cuts[start], cuts[end]).trim();
      let cost = best[start]!.cost + (piece.length - IDEAL_PARAGRAPH) ** 2;
      if (piece.length > limit) cost += 40000 + 6 * (piece.length - limit) ** 2;
      if (piece.length < 140) cost += 60000;
      if (start > 0 && LEANS_BACK.test(piece)) cost += 30000;
      if (start > 0 && TURNS.test(piece)) cost -= 12000;
      if (cost < chosen.cost) chosen = { cost, from: start };
    }
    best.push(chosen);
  }
  const pieces: string[] = [];
  for (let end = cuts.length - 1; end > 0; end = best[end]!.from) {
    pieces.unshift(paragraph.slice(cuts[best[end]!.from], cuts[end]).trim());
  }
  return pieces;
}

/**
 * Text as paragraphs: the blank lines it has, and a paragraph over about 600
 * characters broken at sentence ends into shorter ones. The words are the same.
 * A paragraph with its own line breaks (versicles, a stanza) is left alone.
 */
export function splitParagraphs(text: string, limit = LONG_PARAGRAPH): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitLongParagraph(paragraph, limit));
}

/* ------------------------------------------------------------ spoken words */

/** A stretch of text as it should be set: instruction, or words to say aloud. */
export type ReadingBlock = { kind: "text"; text: string } | { kind: "spoken"; lines: string[] };

const SAYING_VERBS =
  "say|says|saying|pray|prays|praying|respond|responds|responding|answer|answers|answering|reply|replies|replying|recite|recites|reciting|repeat|repeats|repeating|sing|sings|singing|begin|begins|declare|declares";
/** Right before a quotation with no colon: `you answer, 'Thanks be to God.'`, `then the versicle '...'` */
const ENDS_WITH_SAYING = new RegExp(
  `\\b(?:(?:${SAYING_VERBS})(?:\\s+(?:aloud|inwardly|quietly|silently|simply|slowly|either|together))?|(?:with|say|pray) the words|(?:the|its) (?:versicle|response|invocation|antiphon|concluding prayer|closing prayer)),?\\s*$`,
  "i",
);
/**
 * A lead-in with a colon that plainly hands the reader words to say: a verb of
 * saying, the liturgy's own speakers, or the name of what is said.
 */
const HANDS_OVER_WORDS = new RegExp(
  `\\b(?:${SAYING_VERBS}|conclude|close|end|add|adds|announce|tell|ask|invite|renew|commend|priest|deacon|celebrant|minister|bishop|reader|leader|people|prayer|act|invocation|formula|forms?|words|versicle|response|dialogue|blessing|sentence|salutation|antiphon|canticle|creed|confiteor|magnificat|offering)\\b`,
  "i",
);
/** A lead-in that is only a cue: "All:", "Then:", "Second:". */
const CUE =
  /^(?:all|response|at the end|then\b[^:]*|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth):$/i;
/** "... the Salve Regina, then:" */
const ENDS_WITH_THEN = /\bthen:$/i;
/** A colon before this many words sets them apart whatever the lead-in says. */
const SET_APART_WORDS = 9;
/** Somebody's words reported, not words handed to the reader. */
const REPORTS_SPEECH =
  /\b(?:said|wrote|writes|taught|teaches|counsell?ed|counsels|described|describes|called|calls|urged|urges|warned|warns|insisted|insists|puts? it|notes|observes|explains)\s*[:,]?$/i;
/** Scripture's or a teacher's own words: "Mary answers:", "the Catechism says:". */
const NARRATES_SPEECH =
  /\b(?:Jesus|Mary|Elizabeth|Simeon|Gabriel|voice|Catechism|Council|Pope)(?:\s+\w+)?\s+(?:says|prays|answers|sings|replies|cries|commands|asks|tells|lists)\b/;
/** The people of the Gospels in a lead-in: what follows is the story, not a prayer. */
const NAMES_THE_GOSPEL = /\b(?:Jesus|Mary|Joseph|Elizabeth|Simeon|Gabriel|Peter|Paul|Pilate)\b/;
const CITATION_FOLLOWS = /^\s*\([^)]*\d[^)]*\)/;
/** `'a', 'b', 'c'` names several things and stays in the sentence. */
const LIST_OF_QUOTATIONS = /^[,;]\s*["'“‘]/;
/** The words between two sets of words to say: `'May God bless you,' or simply 'In the name...'` */
const JOINS_SPOKEN = /^(?:or|and|then|or simply|or else|and then)$/i;
const MIN_SPOKEN_WORDS = 3;

/**
 * "Blessed be God. Blessed be his holy Name. Blessed be Jesus Christ ...": sentences
 * that all open the same way are said a line at a time, as the Divine Praises are, the
 * people repeating each. Four of them at least, since two or three alike is only style.
 */
function litanyLines(words: string): string[] | null {
  const ends = sentenceEnds(words);
  if (ends.length < 3) return null;
  const lines = [0, ...ends].map((start, i) => words.slice(start, ends[i]).trim());
  const opening = (line: string) => line.split(/\s+/).slice(0, 2).join(" ");
  return lines.every((line) => opening(line) === opening(lines[0]!)) ? lines : null;
}

/**
 * One line per speaker: a versicle and its response never share a line, and when
 * a dialogue runs on ("R. And with your spirit. Lift up your hearts. R. We lift
 * them up to the Lord."), the next speaker starts where the response's sentence ends.
 * A litany's lines are its own (`litanyLines`).
 */
function spokenLines(words: string): string[] {
  const litany = litanyLines(words);
  if (litany) return litany;
  return words
    .split(/\s+(?=[VR]\.\s+\p{Lu})/u)
    .flatMap((line) => {
      if (!line.startsWith("R. ")) return [line];
      const end = sentenceEnds(line)[0];
      return end === undefined ? [line] : [line.slice(0, end), line.slice(end)];
    })
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Text split into instructions and the words it tells a reader to say. Quoted
 * words are set apart only when it is clear they are spoken: after a verb of
 * saying, or a lead-in and colon that names a prayer or a speaker. Quotations
 * side by side are one exchange. A saint's sentence, a Scripture verse with its
 * reference, a hymn's name and a one-word answer stay in the running text, as do
 * quotations in brackets. Unquoted "V. ... R. ..." lines are spoken as well.
 */
export function splitSpokenWords(text: string): ReadingBlock[] {
  const quotes = findQuotes(text);
  const ends = sentenceEnds(text);
  const ranges: { start: number; end: number; lines: string[] }[] = [];

  const bracketDepth = (index: number) => {
    let depth = 0;
    for (const ch of text.slice(0, index)) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
    }
    return depth;
  };

  let i = 0;
  while (i < quotes.length) {
    const runStart = i > 0 ? quotes[i - 1]!.end : 0;
    const words = [text.slice(quotes[i]!.start + 1, quotes[i]!.end - 1).trim()];
    let j = i;
    // Quotations with nothing between them, or only "R.", are one exchange.
    while (j + 1 < quotes.length) {
      const between = text.slice(quotes[j]!.end, quotes[j + 1]!.start).trim();
      if (between && !/^[VR]\.$/.test(between)) break;
      j += 1;
      const said = text.slice(quotes[j]!.start + 1, quotes[j]!.end - 1).trim();
      words.push(between ? `${between} ${said}` : said);
    }
    const start = quotes[i]!.start;
    const end = quotes[j]!.end;
    i = j + 1;

    const sinceLast = Math.max(ends.filter((e) => e <= start).pop() ?? 0, runStart);
    const lead = text.slice(sinceLast, start).trim();
    const previous = ranges[ranges.length - 1];
    const joined =
      previous !== undefined &&
      JOINS_SPOKEN.test(
        text
          .slice(previous.end, start)
          .replace(/[,\s]+/g, " ")
          .trim(),
      );
    const wordCount = words.join(" ").split(/\s+/).length;
    const handedOver =
      start === 0 ||
      joined ||
      ENDS_WITH_SAYING.test(lead) ||
      (lead.endsWith(":") &&
        (HANDS_OVER_WORDS.test(lead) ||
          CUE.test(lead) ||
          ENDS_WITH_THEN.test(lead) ||
          (wordCount >= SET_APART_WORDS && !NAMES_THE_GOSPEL.test(lead))));
    if (!handedOver || REPORTS_SPEECH.test(lead) || NARRATES_SPEECH.test(lead)) continue;
    if (bracketDepth(start) > 0 || wordCount < MIN_SPOKEN_WORDS) continue;
    if (CITATION_FOLLOWS.test(text.slice(end)) || LIST_OF_QUOTATIONS.test(text.slice(end)))
      continue;
    if (/^\p{Ll}/u.test(words[0]!)) continue;
    ranges.push({ start, end, lines: words.flatMap(spokenLines) });
  }

  // "V. Pray for us ... R. That we may be made worthy ...", and the collect that
  // follows it when one does, unquoted.
  const versicle = /(^|\s)V\.\s+(?=\p{Lu})/gu;
  for (const match of text.matchAll(versicle)) {
    const start = match.index + match[1]!.length;
    if (quotes.some((q) => q.start < start && start < q.end) || !opensList(text, start)) continue;
    const response = text.indexOf(" R. ", start);
    if (response < 0) continue;
    let end = ends.find((e) => e > response) ?? text.length;
    const after = text.slice(end).trimStart();
    const amen = /^Let us pray\b/.test(after) ? /\bAmen\./.exec(after) : null;
    if (amen) end = text.length - after.length + amen.index + amen[0].length;
    ranges.push({
      start,
      end,
      lines: [
        text.slice(start, response).trim(),
        ...text
          .slice(response, end)
          .split(/\s+(?=Let us pray\b)/)
          .map((line) => line.trim())
          .filter(Boolean),
      ],
    });
  }
  ranges.sort((a, b) => a.start - b.start);

  const blocks: ReadingBlock[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start < at) continue;
    const before = text.slice(at, range.start).trim();
    if (before) blocks.push({ kind: "text", text: before });
    at = range.end;
    // Punctuation outside the closing mark goes with the words it closes.
    const closing = /^[,;.]+/.exec(text.slice(at));
    const lines = [...range.lines];
    if (closing) {
      lines[lines.length - 1] += closing[0];
      at += closing[0].length;
    }
    blocks.push({ kind: "spoken", lines });
  }
  const rest = text.slice(at).trim();
  if (rest) blocks.push({ kind: "text", text: rest });
  return blocks;
}

/**
 * Text as it should be set on a reading page: instructions in paragraphs of a
 * readable length, and the words to say apart from them.
 */
export function readingBlocks(text: string, limit = LONG_PARAGRAPH): ReadingBlock[] {
  return splitSpokenWords(text).flatMap((block): ReadingBlock[] =>
    block.kind === "text"
      ? splitParagraphs(block.text, limit).map((paragraph) => ({ kind: "text", text: paragraph }))
      : [block],
  );
}

/** A fact under a title: "Begins: 16 March". */
export interface LabelledFact {
  label: string;
  value: string;
}

const STARTS_ON_A_DAY =
  /^(?:\d|(?:Late|Early|Mid|January|February|March|April|May|June|July|August|September|October|November|December)\b|Any\s+(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day\b)/;

/**
 * When a novena is kept, from its one stored line. "16 March, ending on 24 March,
 * the eve of the solemnity" is two facts, when it begins and when it ends. "Any
 * time" and "The nine days before any feast of Our Lady" are one, and neither is a
 * date on which anything begins.
 */
export function novenaTimingFacts(stored: unknown): LabelledFact[] {
  if (typeof stored !== "string" || !stored.trim()) return [];
  const value = stored.trim();
  const ending = /^(.+?),?\s+(?:ending on|ending|concluding on|concluding)\s+(.+)$/.exec(value);
  if (ending) {
    return [
      { label: "Begins", value: ending[1]! },
      { label: "Ends", value: capitalized(ending[2]!) },
    ];
  }
  return [{ label: STARTS_ON_A_DAY.test(value) ? "Begins" : "When", value }];
}

/**
 * Whether a novena's days show the meditation each one stores. They do not, and that
 * is the owner's call: the older novenas' meditations are templated, and the owner has
 * been told they are there. To show them, render a day's `meditation` in the days
 * renderer of src/app/novenas/[slug]/page.tsx and set this to true. The stored
 * backgrounds still say what they always said about them, so every sentence comes back.
 */
export const NOVENA_DAY_MEDITATIONS_SHOWN = false;

/**
 * What a stored background says about the day meditations, and what it reads without
 * them. Each was read by hand, in all 104 novenas. A sentence that is only about them
 * goes, and one that says something else as well keeps the rest, every other word as
 * stored. Where the novena as written is made of meditations or considerations, which a
 * reader has just been told in its summary, the page says plainly that it does not give
 * them, so that nobody opens a day looking for one.
 */
const DAY_MEDITATION_NOTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\s*The day meditations are editorial\./g, ""],
  [
    /\bThe day meditations are editorial(?: introductions)?, and the indulgence (notes are|note is) omitted\./g,
    "The indulgence $1 omitted.",
  ],
  [
    /; the day meditations are editorial(?: introductions)?,? and the indulgence notes are omitted\./g,
    "; the indulgence notes are omitted.",
  ],
  [/; the day meditations are editorial\./g, "."],
  [/, and the day meditations are editorial introductions written for a child\./g, "."],
  [/, so the day meditations here are editorial introductions to each day's virtue\./g, "."],
  [/; the meditations are short editorial introductions\./g, "."],
  [/\s*The meditations (?:below|above) are short editorial introductions[^.]*\./g, ""],
  [
    /; his meditations, which precede them, are summarised in the day meditations (?:below|above)\./g,
    "; his meditations, which precede them, are not reproduced here.",
  ],
  [
    /; the considerations are summarised in the day meditations (?:below|above), and only the prayers are reproduced\./g,
    "; only the prayers are reproduced.",
  ],
  [
    /, and the considerations are summarised in the day meditations\./g,
    ", and the considerations are not reproduced.",
  ],
  [
    /; they are summarised in the day meditations, and the indulgence notes are omitted\./g,
    "; they and the indulgence notes are omitted.",
  ],
  [
    /, summarised in the day meditations, is followed by a prayer\./g,
    " is followed by a prayer; the considerations are not reproduced here.",
  ],
  [/, which the day meditations summarise\./g, "."],
  [
    /\bThe meditations are summarised in the day meditations; the prayers are reproduced in full\./g,
    "The meditations are not reproduced here; the prayers are reproduced in full.",
  ],
  [
    /\bthe addresses are summarised in the day meditations and are best read/g,
    "the addresses are best read",
  ],
  [
    /\bEach day's consideration is summarised in the day meditation\./g,
    "The considerations are not reproduced here.",
  ],
  [
    /\band gives these meditations on the Litany of Loreto/g,
    "and gives meditations on the Litany of Loreto",
  ],
  // His name goes with the first half of the sentence, and the second half needs it.
  [
    /\bThe meditations given here are short editorial introductions to the subject (St\. \p{L}+) assigns each day; his own meditations/gu,
    "$1's own meditations",
  ],
  // These two say nothing of it themselves, though their summaries say what the novena
  // is made of: nine meditations, and a different meditation each day.
  [
    /(\bwrote this novena as nine meditations on charity, the gift proper to the Holy Spirit\.)/g,
    "$1 His meditations are not reproduced here, and the prayers above are his own.",
  ],
  [
    /(\bthe nine meditation subjects above are those of the received Redemptorist novena)\./g,
    "$1; the meditations themselves are not reproduced here.",
  ],
];

/**
 * A novena's background as a reader should meet it: true where it stands. While the
 * days do not show their meditations, it does not say they do. It runs on the stored
 * English before the page is put into the reader's language, so a translation is of
 * what is shown, and it works on a row whatever its age.
 */
export function novenaBackgroundForDisplay(
  background: string,
  meditationsShown = NOVENA_DAY_MEDITATIONS_SHOWN,
): string {
  if (meditationsShown) return background;
  return DAY_MEDITATION_NOTES.reduce(
    (text, [note, rest]) => text.replace(note, rest),
    background,
  ).trim();
}

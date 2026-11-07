/**
 * Reading a prayer's stored text for what each line of it is.
 *
 * Prayers are stored as plain text: lines, blank lines between stanzas, "V." and
 * "R." where a leader and the people alternate, an instruction in brackets where
 * the reader is told to do something, and in a litany a response repeated at the
 * end of line after line. `parsePrayerText` types all of that so `PrayerText` can
 * set it, and so a reader can tell at a glance what is spoken, by whom, and what
 * is only being asked of them.
 *
 * Two rules govern everything here, because this text is prayer.
 *
 * Nothing is lost. Every word and every character comes back in its order: the
 * markers, runs and lines read end to end are the stored text, whitespace aside
 * (`prayerStanzasText`). The parser only draws lines around what is there.
 *
 * When unsure, it is spoken. A line becomes an instruction or a note only when it
 * is unmistakably one. "Say to Aaron and his sons", "Make me love Thee" and "Then
 * shalt thou accept the sacrifice" read like commands and are Scripture and
 * prayer, so an instruction has to match a narrow pattern, not merely begin with
 * a verb. A missed instruction reads as the text it always was; a spoken line
 * dressed as an instruction would tell the reader not to say it.
 *
 * Pure: no I/O, no React. English and Latin words are recognised by name; other
 * languages still get their stanzas, markers, bracketed instructions and repeated
 * responses, all of which are language-free. It runs in the browser too, so its
 * patterns avoid lookbehind, which a Safari before 16.4 cannot even parse.
 */

/**
 * What a line is. `spoken` is the default; `versicle` is the leader's part and
 * `response` the people's; a `rubric` tells the reader what to do; a `note` says
 * something about the prayer; a `heading` names a part of it ("First Decade.").
 */
export type PrayerLineKind = "spoken" | "versicle" | "response" | "rubric" | "note" | "heading";

/**
 * What a stretch of a line is. `response` is the people's part inside a line,
 * `rubric` an instruction inside one ("(Thrice.)", "Pater noster."), `note` a
 * reference closing one ("(Lk 1:26-27)"), `symbol` a printed sign that is not a
 * word ("*", "+"), and `separator` a character that only stood for a line break
 * when two lines were stored as one (" /").
 */
export type PrayerRunRole = "text" | "response" | "rubric" | "note" | "symbol" | "separator";

export interface PrayerRun {
  text: string;
  role: PrayerRunRole;
}

export interface PrayerLine {
  kind: PrayerLineKind;
  /** The line's marker exactly as written ("V.", "R:", "All:", "3.", "Ant."). */
  marker?: string;
  /** The marker fits the hanging margin ("V.", "All:", "3."), or runs in ("Antiphon."). */
  markerHangs?: boolean;
  /** The rest of the line, in order. */
  runs: PrayerRun[];
  /** Carries on the marked line above it, so its text lines up with that line's text. */
  continuation?: boolean;
  /** A paragraph rather than a verse: wrapped lines do not hang. */
  prose?: boolean;
}

export interface PrayerStanza {
  lines: PrayerLine[];
}

/** A line's words as stored, its marker included. */
export function prayerLineText(line: PrayerLine): string {
  const body = line.runs.map((run) => run.text).join("");
  return line.marker ? `${line.marker} ${body}` : body;
}

/**
 * The stanzas read back as text. Whitespace aside, this is what was parsed, which
 * is the promise the tests hold every published prayer to.
 */
export function prayerStanzasText(stanzas: readonly PrayerStanza[]): string {
  return stanzas.map((stanza) => stanza.lines.map(prayerLineText).join("\n")).join("\n\n");
}

/* -------------------------------------------------------------------------- */
/* Markers                                                                    */
/* -------------------------------------------------------------------------- */

/** The leader's and the people's marks, and the words some texts use for them. */
const VERSICLE_MARK = /^(V[.:]|V\/\.?|℣\.?)\s+/;
const RESPONSE_MARK = /^(R[.:]|R\/\.?|℟\.?)\s+/;
const VERSICLE_WORD = /^((?:Leader|Priest|Celebrant|Reader|Lector|Deacon|Cantor|Minister):)\s+/i;
const RESPONSE_WORD = /^((?:All|People|Response|Assembly|Congregation|Omnes):)\s+/i;
const NUMBER_MARK = /^(\d{1,2}[.)])\s+/;

/** Marks this short sit in the hanging margin, so the words line up down the page. */
const HANGING_MARKER_MAX_LENGTH = 4;

/**
 * Names of a part of a prayer that run into the line they introduce:
 * "Ant. Into the way of peace.", "Meditation. “The Holy Spirit…”". The last two
 * are read and thought over rather than said, so they are notes.
 */
const RUN_IN_LABEL = /^(Ant[.:]|Antiphon[.:]|Ps\.)\s+/;
const RUN_IN_NOTE_LABEL = /^(Meditation\.|Application\.)\s+/;

/* -------------------------------------------------------------------------- */
/* Headings                                                                   */
/* -------------------------------------------------------------------------- */

const ORDINAL =
  "First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|Thirteenth|Fourteenth|Fifteenth|Last";

/** A number and a few words naming a part: "II. All Angels and Saints." */
const NUMBERED_TITLE = /^([IVXLC]+)\.\s+\p{Lu}[^.!?:;,]{0,50}\.$/u;

const HEADING_PATTERNS: readonly RegExp[] = [
  // A part's bare number: "II", "VII."
  /^[IVXLC]+\.?$/,
  new RegExp(
    `^(?:${ORDINAL}) (?:Decade|Mystery|Offering|Sorrow|Joy|Word|Part|Prayer|Day|Set of Beads)\\.?$`,
  ),
  new RegExp(`^(?:${ORDINAL}) Word: `),
  new RegExp(`^(?:${ORDINAL}) Mystery\\. \\p{Lu}[^.!?]{0,80}\\.$`, "u"),
  /^Station [IVXLC]+\.(?: |$)/,
  /^Prayer [IVXLC]+\.?$/,
  /^(?:Antiphon|Prayer|Hymn|Collect|Ejaculation|Concluding prayers?|Closing prayers?|The Preparatory Prayers|Short Act of Contrition|Act of (?:Faith|Hope|Charity|Love|Contrition))[.:]?$/,
  /^For (?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\.$/,
];

/**
 * "V" is also the Roman five. "V. To the Wound in the sacred Side." after "IV. To
 * the Wound in the Left Foot." is the next entry in a numbered list, and only then:
 * everywhere else "V." followed by words is a versicle.
 */
function isHeading(text: string, followsNumberedFour: boolean): boolean {
  const numbered = NUMBERED_TITLE.exec(text);
  if (numbered && (numbered[1] !== "V" || followsNumberedFour)) return true;
  return HEADING_PATTERNS.some((pattern) => pattern.test(text));
}

/* -------------------------------------------------------------------------- */
/* Instructions and notes                                                     */
/* -------------------------------------------------------------------------- */

const PRAYER_NAME =
  "Pater(?: noster)?|Ave(?: Maria)?|Gloria(?: Patri)?|Credo|Requiem(?: (?:ae|æ)ternam)?|De profundis|Miserere|Salve(?: Regina)?|Our Fathers?|Hail Marys?|Glory [Bb]e(?: to the Father)?";
const PRAYER_COUNT =
  "once|twice|thrice|(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|\\d+) times";
const NAMED_PRAYER = `(?:${PRAYER_NAME})(?: (?:${PRAYER_COUNT}))?`;
const NAMED_PRAYERS = `${NAMED_PRAYER}(?:(?:,|;|\\.)?(?: and)? ${NAMED_PRAYER})*`;

/** A line that only names prayers to say: "Pater, Ave, Gloria.", "Our Father." */
const POINTER_LINE = new RegExp(`^(?:${NAMED_PRAYERS})\\s*(?:[.…:]|\\. \\. \\.)*$`);

/** "Our Father (silently as far as):" */
const POINTER_WITH_ASIDE = /^(?:Our Father|Hail Mary|Glory [Bb]e) \([^)]*\)[.:]?$/;

/** The same at the end of a spoken line, after its sentence: "… in a stable. Pater noster." */
const POINTER_TAIL = new RegExp(`([.!?”"])\\s+(?:${NAMED_PRAYERS})\\s*(?:[.…]|\\. \\. \\.)*$`);

/**
 * Instructions that are not in brackets. Each is narrow on purpose: see the rule
 * at the top of this file.
 */
const RUBRIC_PATTERNS: readonly RegExp[] = [
  /^(?:Then|Next|Afterwards) (?:say|pray|recite|sing|repeat|add)\b/,
  /^Then on the\b.*\bsay\b/,
  /^Say (?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+|thrice|twice|once)\b/,
  /^All say\b/,
  /^Repeat (?:step|Pater|this|the)\b/,
  /^(?:Begin|End|Conclude|Finish|Close) with\b/,
  /^Make the Sign of the Cross\b/,
  /\bsay the following\b/,
  /[,;] then say[,:]?$/,
  /\band say:$/,
  /\bsay, or sing,$/,
  /\. Then say \S+ times:$/,
  /^(?:The|This|Here)\b.{0,60}\b(?:is|are|must be) (?:recited|repeated)\b/,
  /^End of (?:the )?Decade\b/i,
  /^At the beginning of each decade\b/,
  /^(?:Pater|Ave(?: Maria)?)(?: and Ave)? (?:once|twice|thrice|\w+ times)\b/,
  /^Tantum ergo,? with Versicle\b/,
  /\bV\. and R\. as above\.$/,
  /^O Jesu, etc\., as above\.$/,
];

/** Remarks about the prayer, not said and not asking anything of the reader. */
const NOTE_PATTERNS: readonly RegExp[] = [
  /^Prayed on\b/,
  /^To be (?:said|prayed|recited|sung)\b/,
  /^These words are to be said\b/,
];

/** A whole line in brackets, unless a trailing comma shows it is mid-sentence Scripture. */
function isBracketedInstruction(text: string): boolean {
  if (/^\[.*\]$|^\{.*\}$/.test(text)) return true;
  return /^\(.*\)[.:;]?$/.test(text) && !/,\)[.:;]?$/.test(text);
}

/** One bare word is a hymn's line ("Gloria"): a pointer ends like a sentence or names more. */
function isPointerLine(text: string): boolean {
  return POINTER_LINE.test(text) && /[.…:]$|,| and /.test(text);
}

function isRubric(text: string): boolean {
  return (
    isBracketedInstruction(text) ||
    isPointerLine(text) ||
    POINTER_WITH_ASIDE.test(text) ||
    RUBRIC_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function isNote(text: string): boolean {
  return NOTE_PATTERNS.some((pattern) => pattern.test(text));
}

/** An instruction in brackets inside a spoken line: "(Thrice.)", "(here express his name)". */
const INLINE_RUBRIC =
  /[([](?:here\b|mention\b|name\b|pause\b|request\b|thrice\b|twice\b|three times\b|silently\b)[^()[\]]*[)\]][.:]?/gi;

/** A Scripture reference closing a line: "(Lk 1:26-27)", "(St Luke iv, 1, 2)", "(1 Cor. 13)". */
const CITATION_TAIL =
  /\s+\((?:St\.? )?(?:[1-3I]{1,2} )?\p{Lu}\p{L}+\.?(?: [ivxlc]+[.,]?| \d+[:,]?)[\divxlc\s:,.;–-]*\)\.?$/u;

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

/** Set apart wherever they close a line, once the text is plainly a litany. */
const KNOWN_RESPONSES: ReadonlySet<string> = new Set([
  "pray for us",
  "pray for me",
  "pray for them",
  "have mercy on us",
  "have mercy on me",
  "merciful jesus, have mercy on me",
  "have mercy on them",
  "have mercy upon us",
  "have mercy on us and on the whole world",
  "have mercy on us, o lord",
  "have mercy on us, o jesus",
  "spare us, o lord",
  "spare us o lord",
  "spare us, o jesus",
  "graciously hear us, o lord",
  "graciously hear us, o jesus",
  "graciously spare us, o jesus",
  "hear us, o lord",
  "hear us, o jesus",
  "deliver us, o lord",
  "deliver us, o jesus",
  "deliver me, o jesus",
  "lord, save your people",
  "lord, hear our prayer",
  "we beseech you, hear us",
  "we beseech thee, hear us",
  "ora pro nobis",
  "orate pro nobis",
  "miserere nobis",
  "parce nobis, domine",
  "exaudi nos, domine",
  "libera nos, domine",
  "te rogamus, audi nos",
]);

/** Lines that are the people's whole part even with no mark to say so. */
const WHOLE_LINE_RESPONSES: ReadonlySet<string> = new Set([
  "christ, graciously hear us",
  "christ graciously hear us",
  "jesus, graciously hear us",
  "jesus graciously hear us",
  "christe, exaudi nos",
  "christe exaudi nos",
  "that we may be made worthy of the promises of christ",
  "ut digni efficiamur promissionibus christi",
]);

/** How many lines must close with known responses for a text to be plainly a litany. */
const LITANY_MIN_LINES = 3;
/** How often an unknown response must repeat to be recognised. */
const REPEATED_MIN_LINES = 3;
/** Past these lengths a line is a petition, and its close is a clause, not a response. */
const REPEATED_RESPONSE_MAX_LENGTH = 50;
const REPEATED_LINE_MAX_LENGTH = 160;

/** "Holy Mary," opens an invocation. "Lord," and "Ave, ave," open a call that is one piece. */
const NOT_AN_INVOCATION = /^(?:(?:lord|christ|jesus|god|ave|kyrie|christe)[,;]?\s*)+$/i;

function responseKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?;:,]+$/, "")
    .replace(/\s+/g, " ");
}

/**
 * Where a line's possible responses start: after each comma, semicolon or colon,
 * nearest the start first, and only those with no sentence break inside them, so
 * a response is always the last thing said.
 */
function responseStarts(text: string): number[] {
  const starts: number[] = [];
  for (const match of text.matchAll(/[,;:]\s+/g)) {
    const start = (match.index ?? 0) + match[0].length;
    if (!/[.!?:;]\s/.test(text.slice(start))) starts.push(start);
  }
  return starts;
}

/** "Lord, have mercy on us. Lord, have mercy on us.": the call, then the people. */
function doubledCallStart(text: string): number | null {
  const match = /^(.+?[.;!]\s+)(.+)$/.exec(text);
  if (!match) return null;
  return responseKey(match[1]!) === responseKey(match[2]!) ? match[1]!.length : null;
}

/** "Christ, hear us. Christ, graciously hear us.": the last sentence is the people's. */
function graciouslyHearStart(text: string): number | null {
  const match = /^(.*[.;!]\s+)(.+)$/.exec(text);
  if (!match) return null;
  return /\bgraciously hear us[.!]?$/i.test(match[2]!) ? match[1]!.length : null;
}

/** "Lamb of God, who takes away the sins of the world, send us Thy Spirit." */
function lambOfGodStart(text: string): number | null {
  const match = /^(?:Lamb of God|Agnus Dei)\b.*?\b(?:world|mundi)[,;]\s+/i.exec(text);
  return match ? match[0].length : null;
}

interface ResponseCounts {
  /** Lines each possible response closes. A line counts once per response. */
  lines: Map<string, number>;
  /** Of those, the lines where the sentence ends with it. */
  closing: Map<string, number>;
  /** What is said before it each time: a response answers different invocations. */
  invocations: Map<string, Set<string>>;
  /** The text is plainly a litany, so a known response is one even if it is only here once. */
  isLitany: boolean;
}

function countResponses(lines: readonly string[]): ResponseCounts {
  const counts = new Map<string, number>();
  const closing = new Map<string, number>();
  const invocations = new Map<string, Set<string>>();
  let knownLines = 0;
  for (const line of lines) {
    const seen = new Set<string>();
    for (const start of responseStarts(line)) {
      const key = responseKey(line.slice(start));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!line.endsWith(",")) closing.set(key, (closing.get(key) ?? 0) + 1);
      if (!invocations.has(key)) invocations.set(key, new Set());
      invocations.get(key)!.add(responseKey(line.slice(0, start)));
    }
    if ([...seen].some((key) => KNOWN_RESPONSES.has(key))) knownLines += 1;
  }
  return { lines: counts, closing, invocations, isLitany: knownLines >= LITANY_MIN_LINES };
}

/** "O Jesus" alone calls on Him; the response is the petition before it. */
const VOCATIVE_ONLY = /^o\s+[\p{L} ]+$/iu;

function isRepeatedResponse(text: string, start: number, counts: ResponseCounts): boolean {
  const response = text.slice(start);
  const key = responseKey(response);
  return (
    (counts.lines.get(key) ?? 0) >= REPEATED_MIN_LINES &&
    // A whole line said again ("Spare, O Lord, spare thy people.") answers nothing.
    (counts.invocations.get(key)?.size ?? 0) >= 2 &&
    text.length <= REPEATED_LINE_MAX_LENGTH &&
    response.length <= REPEATED_RESPONSE_MAX_LENGTH &&
    // A clause ("and have mercy on me") or a pointer ("Heart of Mary, etc.") goes on.
    !/^(?:and|et)\b/i.test(key) &&
    !/\betc$/i.test(key) &&
    !VOCATIVE_ONLY.test(key)
  );
}

/** Where the response begins in this spoken text, or null when it has none. */
function findResponseStart(text: string, counts: ResponseCounts): number | null {
  if (WHOLE_LINE_RESPONSES.has(responseKey(text))) return 0;
  const special = doubledCallStart(text) ?? graciouslyHearStart(text) ?? lambOfGodStart(text);
  if (special !== null) return special;

  const starts = responseStarts(text).filter((start) => {
    const key = responseKey(text.slice(start));
    // A comma after it means the sentence goes on, unless it closes other lines:
    // "alleluia," in the Regina Caeli is, and "Sanctus Deus," in a hymn verse is not.
    const goesOn = text.endsWith(",") && !counts.closing.get(key);
    return !goesOn && !NOT_AN_INVOCATION.test(text.slice(0, start));
  });
  // What is known comes first, so "Pater de caelis, Deus, miserere nobis." answers
  // "miserere nobis" however often "Deus, miserere nobis" repeats.
  const known = starts.find((start) => {
    const key = responseKey(text.slice(start));
    return KNOWN_RESPONSES.has(key) && (counts.isLitany || (counts.lines.get(key) ?? 0) >= 2);
  });
  return known ?? starts.find((start) => isRepeatedResponse(text, start, counts)) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Runs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Printed signs that are not words: the "*" that divides a responsory, the crosses
 * in a blessing, and the rule left for a name ("Pope ________"). They stay on the
 * page and a screen reader skips them.
 */
const SYMBOL_SPLIT = /([*+✠✝†☩]|_{2,})/;
const SYMBOL = /^(?:[*+✠✝†☩]|_{2,})$/;

/** A closing pointer to a refrain: "… and teach us in her ways to go. R." */
const REFRAIN_POINTER = /\s+(R\.)$/;

function pushRun(runs: PrayerRun[], text: string, role: PrayerRunRole): void {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && last.role === role) last.text += text;
  else runs.push({ text, role });
}

function pushWithSymbols(runs: PrayerRun[], text: string, role: PrayerRunRole): void {
  for (const part of text.split(SYMBOL_SPLIT)) {
    pushRun(runs, part, SYMBOL.test(part) ? "symbol" : role);
  }
}

/** Sets a stretch of a line, keeping the instructions in brackets inside it apart. */
function pushWithInlineRubrics(runs: PrayerRun[], text: string, role: PrayerRunRole): void {
  let last = 0;
  for (const match of text.matchAll(INLINE_RUBRIC)) {
    const index = match.index ?? 0;
    pushWithSymbols(runs, text.slice(last, index), role);
    pushRun(runs, match[0], "rubric");
    last = index + match[0].length;
  }
  pushWithSymbols(runs, text.slice(last), role);
}

/** What closes a line and is not part of its sentence: a pointer or a reference. */
function splitClose(text: string): {
  head: string;
  gap: string;
  close: string;
  role: PrayerRunRole;
} {
  const pointer = POINTER_TAIL.exec(text);
  const citation = pointer ? null : CITATION_TAIL.exec(text);
  const match = pointer ?? citation;
  if (!match) return { head: text, gap: "", close: "", role: "text" };
  // A pointer's match opens with the end of the sentence before it.
  const start = match.index + (pointer ? pointer[1]!.length : 0);
  const close = text.slice(start).trimStart();
  return {
    head: text.slice(0, start),
    gap: text.slice(start, text.length - close.length),
    close,
    role: pointer ? "rubric" : "note",
  };
}

function lineRuns(
  text: string,
  kind: PrayerLineKind,
  role: PrayerRunRole,
  counts: ResponseCounts,
): PrayerRun[] {
  const runs: PrayerRun[] = [];
  if (kind === "rubric" || kind === "heading") {
    pushWithSymbols(runs, text, role);
    return runs;
  }
  const refrain = REFRAIN_POINTER.exec(text);
  const body = refrain ? text.slice(0, refrain.index) : text;
  const { head, gap, close, role: closeRole } = splitClose(body);
  const start = kind === "spoken" ? findResponseStart(head, counts) : null;
  if (start === null) {
    pushWithInlineRubrics(runs, head, role);
  } else {
    pushWithInlineRubrics(runs, head.slice(0, start), "text");
    pushWithInlineRubrics(runs, head.slice(start), "response");
  }
  if (close) {
    pushRun(runs, gap, "text");
    pushRun(runs, close, closeRole);
  }
  if (refrain) {
    pushRun(runs, " ", "text");
    pushRun(runs, refrain[1]!, "response");
  }
  return runs;
}

/* -------------------------------------------------------------------------- */
/* Lines                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Two parts stored on one line: "V. May they rest in peace. R. Amen." and, with a
 * slash standing for the line break, "V. The Lord be with you. / R. And also with
 * you." A sentence has to have ended before the mark, or "Station V. Simon" would
 * split, and a word has to follow it, or a closing "R." pointing to a refrain would.
 */
const INLINE_MARK = /([.!?;:”")])( \/)? (?=[VR]\. \p{Lu})/gu;

interface StoredLine {
  text: string;
  /** What stood at the end of this line for the line break, kept so nothing is lost. */
  separator?: string;
  /** Stored on one line with the line before: they stay in the same stanza. */
  sameStoredLine?: boolean;
}

function splitInlineMarks(line: string): StoredLine[] {
  // An instruction that only mentions the marks is one line: "V. and R. as above."
  const parts: StoredLine[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE_MARK)) {
    const index = match.index ?? 0;
    parts.push({ text: line.slice(last, index + match[1]!.length), separator: match[2] });
    last = index + match[0].length;
  }
  parts.push({ text: line.slice(last) });
  return parts.map((part, i) => (i > 0 ? { ...part, sameStoredLine: true } : part));
}

/** A line read for its kind and marker, its words not yet set into runs. */
interface ReadLine extends StoredLine {
  kind: PrayerLineKind;
  role: PrayerRunRole;
  marker?: string;
}

function readWords(
  text: string,
  followsNumberedFour: boolean,
): Omit<ReadLine, "text"> & { words: string } {
  // A number first, so "2. Then say the following:" is a numbered instruction.
  const number = NUMBER_MARK.exec(text);
  if (number) {
    const words = text.slice(number[0].length);
    return isRubric(words)
      ? { kind: "rubric", role: "rubric", marker: number[1], words }
      : { kind: "spoken", role: "text", marker: number[1], words };
  }

  const unmarked = (kind: PrayerLineKind, role: PrayerRunRole) => ({ kind, role, words: text });
  if (isHeading(text, followsNumberedFour)) return unmarked("heading", "text");
  if (isRubric(text)) return unmarked("rubric", "rubric");
  if (isNote(text)) return unmarked("note", "note");

  const marks: ReadonlyArray<[RegExp, PrayerLineKind, PrayerRunRole]> = [
    [VERSICLE_MARK, "versicle", "text"],
    [RESPONSE_MARK, "response", "response"],
    [VERSICLE_WORD, "versicle", "text"],
    [RESPONSE_WORD, "response", "response"],
    [RUN_IN_NOTE_LABEL, "note", "note"],
    [RUN_IN_LABEL, "spoken", "text"],
  ];
  for (const [pattern, kind, role] of marks) {
    const match = pattern.exec(text);
    if (match) return { kind, role, marker: match[1], words: text.slice(match[0].length) };
  }
  return unmarked("spoken", "text");
}

function readLine(stored: StoredLine, followsNumberedFour: boolean): ReadLine {
  const { words, ...read } = readWords(stored.text, followsNumberedFour);
  return { ...stored, ...read, text: words };
}

/* -------------------------------------------------------------------------- */
/* Stanzas                                                                    */
/* -------------------------------------------------------------------------- */

/** "Let us pray" opening a collect, in the ways the texts write it. */
const LET_US_PRAY = /^(?:Let us pray|Oremus)\b/i;
/** The same with nothing else on the line, so it leads into the next. */
const LET_US_PRAY_ALONE = /^(?:Let us pray|Oremus)[.:,]?$/i;

function endsSentence(line: PrayerLine): boolean {
  return /[.!?”")\]]$/.test(prayerLineText(line));
}

/** Leads into what follows it: "Then say three times," */
function leadsIn(line: PrayerLine): boolean {
  return /[:,]\)?$/.test(prayerLineText(line));
}

function startsNewThought(line: PrayerLine): boolean {
  return !!line.marker || /^["“‘']?\p{Lu}/u.test(prayerLineText(line));
}

function isLetUsPray(line: PrayerLine): boolean {
  return line.kind === "spoken" && LET_US_PRAY.test(prayerLineText(line));
}

/**
 * Whether a stanza break belongs before this line though the text has no blank
 * line there. Plenty of prayers are stored as one unbroken run: the Angelus has
 * three versicle pairs, each closed by "(Hail Mary)", and then a collect. These
 * are the seams such a text has anyway.
 */
function breaksBefore(
  line: PrayerLine,
  previous: PrayerLine,
  beforePrevious?: PrayerLine,
): boolean {
  if (line.kind === "heading" || isLetUsPray(line)) return true;
  if (line.continuation) return false;
  // An instruction closes the part before it, unless it stops a sentence midway.
  if (previous.kind === "rubric" && !leadsIn(previous) && startsNewThought(line)) {
    return !beforePrevious || endsSentence(beforePrevious);
  }
  // From a spoken verse to the leader's versicle: "O sweet Virgin Mary!" then "V."
  if (line.kind === "versicle" && previous.kind === "spoken") return !leadsIn(previous);
  // From the people's response back to a spoken line: "R. …" then a collect.
  return line.kind === "spoken" && previous.kind === "response";
}

/** A heading, a lone "Let us pray" or a leading instruction stays with what it introduces. */
function introducesNext(stanza: PrayerStanza): boolean {
  const last = stanza.lines[stanza.lines.length - 1];
  if (!last) return false;
  if (last.kind === "heading" || LET_US_PRAY_ALONE.test(prayerLineText(last))) return true;
  return last.kind === "rubric" && leadsIn(last) && stanza.lines.every((l) => l.kind === "rubric");
}

/**
 * A paragraph rather than a verse: a line alone in its stanza, or a long one beside
 * one other, and every note. Only lines in a run of verses hang when they wrap.
 */
const PROSE_MIN_LENGTH = 90;

function markProse(stanza: PrayerStanza): void {
  const spoken = stanza.lines.filter(
    (line) =>
      line.kind === "spoken" &&
      !line.markerHangs &&
      !line.continuation &&
      !LET_US_PRAY_ALONE.test(prayerLineText(line)),
  );
  for (const line of spoken) {
    const long = prayerLineText(line).length >= PROSE_MIN_LENGTH;
    if (spoken.length === 1 || (spoken.length === 2 && long)) line.prose = true;
  }
  for (const line of stanza.lines) {
    if (line.kind === "note") line.prose = true;
  }
}

/**
 * Carries a marked line's part on to a next line that only finishes it: the rest
 * of its sentence, or the "Amen." that closes it.
 */
function markContinuations(lines: PrayerLine[]): void {
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    if (!previous || line.kind !== "spoken" || line.marker) return;
    if (!previous.markerHangs && !previous.continuation) return;
    if (previous.kind === "rubric" || previous.kind === "note") return;
    const finishes = !endsSentence(previous) && /^\p{Ll}/u.test(prayerLineText(line));
    if (!finishes && !/^Amen\.?$/i.test(prayerLineText(line))) return;
    line.kind = previous.kind;
    line.continuation = true;
    if (previous.kind === "response") {
      for (const run of line.runs) if (run.role === "text") run.role = "response";
    }
  });
}

/* -------------------------------------------------------------------------- */
/* The parser                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Parses a prayer's stored text into stanzas of typed lines. Blank lines separate
 * stanzas, and each stored line stays a line, apart from two parts stored on one
 * (`INLINE_MARK`) and the seams `breaksBefore` adds between stanzas.
 */
export function parsePrayerText(text: string): PrayerStanza[] {
  let followsNumberedFour = false;
  const blocks: ReadLine[][] = text
    .replace(/\r\n?/g, "\n")
    .split(/\n[^\S\n]*\n\s*/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap(splitInlineMarks)
        .map((stored) => {
          const read = readLine(stored, followsNumberedFour);
          if (/^IV\.\s/.test(stored.text)) followsNumberedFour = true;
          else if (/^V\.\s/.test(stored.text)) followsNumberedFour = false;
          return read;
        }),
    )
    .filter((block) => block.length > 0);

  // Responses are counted across the whole text, so one repeated from stanza to
  // stanza is recognised in all of them. What closes a line is not part of it.
  const counts = countResponses(
    blocks.flat().flatMap((line) => {
      if (line.kind !== "spoken") return [];
      return [splitClose(line.text.replace(REFRAIN_POINTER, "")).head];
    }),
  );

  const stanzas: PrayerStanza[] = [];
  for (const block of blocks) {
    const lines = block.map(({ kind, role, marker, text: words, separator }) => {
      const line: PrayerLine = { kind, runs: lineRuns(words, kind, role, counts) };
      if (marker) {
        line.marker = marker;
        if (marker.length <= HANGING_MARKER_MAX_LENGTH) line.markerHangs = true;
      }
      if (separator) pushRun(line.runs, separator, "separator");
      return line;
    });
    markContinuations(lines);

    let current: PrayerLine[] = [];
    lines.forEach((line, i) => {
      const seam = !block[i]!.sameStoredLine && i > 0;
      if (current.length > 0 && seam && breaksBefore(line, lines[i - 1]!, lines[i - 2])) {
        stanzas.push({ lines: current });
        current = [];
      }
      current.push(line);
    });
    if (current.length > 0) stanzas.push({ lines: current });
  }

  // A stanza that only introduces the next one runs into it.
  const merged: PrayerStanza[] = [];
  for (const stanza of stanzas) {
    const previous = merged[merged.length - 1];
    if (previous && introducesNext(previous)) previous.lines.push(...stanza.lines);
    else merged.push({ lines: [...stanza.lines] });
  }

  merged.forEach(markProse);
  return merged;
}

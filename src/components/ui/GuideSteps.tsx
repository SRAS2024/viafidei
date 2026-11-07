import type { ReactNode } from "react";

import {
  LONG_STEP_PARAGRAPH,
  parseSequence,
  readingBlocks,
  type SequenceStep,
} from "@/lib/content-shared/structured-content";
import { createTranslator, type Translator } from "@/lib/i18n/translator";
import { displayOverlay, attachDisplay } from "@/lib/translation/display";

import { PrayerLinkedText } from "./PrayerLinkedText";
import { PrayerText } from "./PrayerText";

type LinkedPrayers = React.ComponentProps<typeof PrayerLinkedText>["prayers"];
type PanelLevel = 2 | 3 | 4;

/** Until a page says who is reading. A page passes the reader's own (`getTranslator`). */
const ENGLISH = createTranslator("en");

/**
 * Running text as a reader should meet it: instructions in paragraphs of a
 * readable length, and the words they say to say set apart in prayer type, with
 * every word in its place (`readingBlocks`). Prayers named in an instruction stay
 * inline-expandable through PrayerLinkedText. It renders paragraphs and blocks
 * with no wrapper, so a `.vf-reading` parent spaces them.
 */
export function ReadingText({
  text,
  prayers,
  headingLevel = 3,
  paragraphLimit,
}: {
  text: string;
  prayers?: LinkedPrayers;
  /** Heading level of an opened prayer's title: one below the text's own heading. */
  headingLevel?: PanelLevel;
  /** Where a paragraph is broken, when not at the usual length. */
  paragraphLimit?: number;
}) {
  const linked = prayers && prayers.length > 0 ? prayers : null;
  return (
    <>
      {readingBlocks(text, paragraphLimit).map((block, i) =>
        block.kind === "spoken" ? (
          <blockquote key={i} className="vf-spoken">
            <PrayerText text={block.lines.join("\n")} />
          </blockquote>
        ) : linked ? (
          <PrayerLinkedText
            key={i}
            text={block.text}
            prayers={linked}
            headingLevel={headingLevel}
          />
        ) : (
          <p key={i} className="whitespace-pre-line">
            {block.text}
          </p>
        ),
      )}
    </>
  );
}

/**
 * A sequence inside a step (the fourteen stations in "How to Pray the Stations",
 * the three doors in choosing a Confirmation saint). Its numbers are the list's
 * own, smaller than the step's, so the step stays the unit a reader follows. A
 * guide that spreads nine salutations over three steps keeps counting: "Fourth:"
 * starts at 4. A part's name may be a prayer's ("Our Father: leader to ..."), which
 * opens from there like any other prayer the text names.
 */
function NestedSteps({
  steps,
  prayers,
  headingLevel,
}: {
  steps: SequenceStep[];
  prayers?: LinkedPrayers;
  headingLevel: PanelLevel;
}) {
  const first = steps[0]?.order ?? 1;
  const linked = prayers && prayers.length > 0 ? prayers : null;
  return (
    <ol className="vf-substeps" start={first === 1 ? undefined : first}>
      {steps.map((step) => (
        <li key={step.order}>
          {step.title && linked ? (
            <PrayerLinkedText
              text={step.title}
              prayers={linked}
              headingLevel={headingLevel}
              className="vf-substep-title"
            />
          ) : step.title ? (
            <p className="vf-substep-title">{step.title}</p>
          ) : null}
          <ReadingText
            text={step.body}
            prayers={prayers}
            headingLevel={headingLevel}
            paragraphLimit={LONG_STEP_PARAGRAPH}
          />
        </li>
      ))}
    </ol>
  );
}

/** A step's own words, which may themselves hold a sequence. */
function StepBody({
  body,
  prayers,
  headingLevel,
}: {
  body: string;
  prayers?: LinkedPrayers;
  headingLevel: PanelLevel;
}) {
  const nested = parseSequence(body);
  const words = (text: string) => (
    <ReadingText
      text={text}
      prayers={prayers}
      headingLevel={headingLevel}
      paragraphLimit={LONG_STEP_PARAGRAPH}
    />
  );
  if (!nested) return words(body);
  return (
    <>
      {nested.lead ? words(nested.lead) : null}
      <NestedSteps steps={nested.steps} prayers={prayers} headingLevel={headingLevel} />
      {nested.trailing ? words(nested.trailing) : null}
    </>
  );
}

/** A step of any how-to: a guide's always has a title, a parsed one may not. */
export interface StepItem {
  order: number;
  title?: string | null;
  body: string;
}

/** A list of short items with no names of their own (the sorrows, the stations). */
const SHORT_ITEM = 90;

type StepTitleLevel = 2 | 3;

const nextLevel = (level: StepTitleLevel): PanelLevel => (level === 2 ? 3 : 4);

/**
 * The steps of a how-to, as a numbered ordered list that is OPEN.
 *
 * Guides used to render each step as a closed accordion row with no numeral,
 * so "How to Go to Confession" was six chevrons and a reader had to tap each
 * one in order to find out what to do. A how-to has to be readable straight
 * through — on a phone, kneeling, mid-prayer — so every step's text is on the
 * page from the first paint, in order, with its number.
 *
 * VoiceOver stops calling a list a list once its markers are gone, so the role is
 * said out loud, and the number it cannot see is said as "Step 1:", in the reader's
 * language. Prayer names inside a step stay inline-expandable when the guide's
 * prayers are supplied; without them the body is plain text.
 */
export function GuideSteps({
  steps,
  prayers,
  headingId,
  titleLevel = 3,
  itemName = "Step",
  t = ENGLISH,
}: {
  steps: StepItem[];
  prayers?: LinkedPrayers;
  /** Id of the "Steps" heading, so the list is labelled by it. */
  headingId?: string;
  /** Heading level of a step's title: one below the heading the list sits under. */
  titleLevel?: StepTitleLevel;
  /** What a screen reader calls each number: the parts of the Mass are not steps. */
  itemName?: "Step" | "Part";
  t?: Translator;
}) {
  if (steps.length === 0) return null;
  const tight = steps.every((step) => !step.title && step.body.length <= SHORT_ITEM);
  const first = steps[0]?.order ?? 1;
  const StepTitle = `h${titleLevel}` as const;
  const said = (n: number) =>
    `${itemName === "Part" ? t("steps.part", { n }) : t("steps.step", { n })} `;
  return (
    // VoiceOver stops calling a list a list once its markers are gone.
    <ol
      role="list"
      aria-labelledby={headingId}
      start={first === 1 ? undefined : first}
      className={tight ? "vf-steps vf-steps-tight" : "vf-steps"}
    >
      {steps.map((step) => (
        <li key={step.order} className="vf-step">
          <span aria-hidden="true" className="vf-step-number">
            {step.order}
          </span>
          {step.title ? (
            <StepTitle className="vf-step-title text-ink">
              <span className="sr-only">{said(step.order)}</span>
              {step.title}
            </StepTitle>
          ) : (
            <span className="sr-only">{said(step.order)}</span>
          )}
          <div className="vf-step-body vf-reading">
            {/* A prayer opened in a titled step sits one level under its title. */}
            <StepBody
              body={step.body}
              prayers={prayers}
              headingLevel={step.title ? nextLevel(titleLevel) : titleLevel}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * How-to text from a single stored field: the lead-in, its steps when it holds a
 * sequence, and what follows them. Text with no sequence is simply paragraphs.
 * Lectio Divina's four movements and every other practice and devotion read this
 * way, in the same steps as a guide.
 */
export function InstructionText({
  text,
  prayers,
  titleLevel = 3,
  t,
}: {
  text: string;
  prayers?: LinkedPrayers;
  /** Heading level of a step's title: 2 when the text has no heading of its own. */
  titleLevel?: StepTitleLevel;
  t?: Translator;
}) {
  const sequence = parseSequence(text);
  if (!sequence) return <ReadingText text={text} prayers={prayers} />;
  return (
    <>
      {sequence.lead ? <ReadingText text={sequence.lead} prayers={prayers} /> : null}
      <GuideSteps
        steps={sequence.steps}
        prayers={prayers}
        titleLevel={titleLevel}
        itemName={sequence.parts ? "Part" : "Step"}
        t={t}
      />
      {sequence.trailing ? <ReadingText text={sequence.trailing} prayers={prayers} /> : null}
    </>
  );
}

/**
 * A list in an article's running text, which is not a how-to: the six holy days of
 * obligation, the three forms of Palm Sunday's entrance. Nobody does those in turn, so
 * they have no numbers and no "Step 1", only the list, which a screen reader counts for
 * itself. Words in quotation marks stay in the item's sentence.
 */
export function ListedText({ text }: { text: string }) {
  const sequence = parseSequence(text);
  if (!sequence) return <ReadingText text={text} />;
  return (
    <>
      {sequence.lead ? <ReadingText text={sequence.lead} /> : null}
      {/* VoiceOver stops calling a list a list once its markers are gone. */}
      <ul role="list">
        {sequence.steps.map((item) => (
          <li key={item.order}>{item.body}</li>
        ))}
      </ul>
      {sequence.trailing ? <ReadingText text={sequence.trailing} /> : null}
    </>
  );
}

/**
 * A stored field that holds prose, as a `PublishedDetail` field renderer: pass
 * this where a page names the field.
 */
export function readingField(prayers?: LinkedPrayers, headingLevel: PanelLevel = 3) {
  return function renderReadingField(value: unknown): ReactNode {
    return typeof value === "string" ? (
      <ReadingText text={value} prayers={prayers} headingLevel={headingLevel} />
    ) : null;
  };
}

/** A stored field that holds how-to text, as a `PublishedDetail` field renderer. */
export function instructionField(
  prayers?: LinkedPrayers,
  titleLevel: StepTitleLevel = 3,
  t?: Translator,
) {
  return function renderInstructionField(value: unknown): ReactNode {
    return typeof value === "string" ? (
      <InstructionText text={value} prayers={prayers} titleLevel={titleLevel} t={t} />
    ) : null;
  };
}

/** A stored field that holds an article with a list in it, as a `PublishedDetail` field renderer. */
export function listedField(value: unknown): ReactNode {
  return typeof value === "string" ? <ListedText text={value} /> : null;
}

/** The field the prayer list rides in (`withPrayerList`). */
export const PRAYER_LIST_FIELD = "prayerList";

/**
 * `PublishedDetail` shows payload fields in the order a page names them, so the
 * prayers of a novena or devotion join them as a field of their own: the practical
 * material stays together, the history follows it, and the sources stay at the
 * foot of the page. The reader's translation goes with the item.
 */
export function withPrayerList<T extends { payload: Record<string, unknown> }>(
  item: T,
  prayers: ReadonlyArray<unknown>,
): T {
  if (prayers.length === 0) return item;
  const next = { ...item, payload: { ...item.payload, [PRAYER_LIST_FIELD]: true } };
  const overlay = displayOverlay(item);
  return overlay ? attachDisplay(next, overlay) : next;
}

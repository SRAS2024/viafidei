"use client";

import { useEffect, useRef } from "react";
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX, formatJournalCount } from "./limits";

export type JournalSaveLabels = {
  /** Templates: `{count}` is the field's length and `{max}` its limit. */
  titleTooLong: string;
  bodyTooLong: string;
  signedOut: string;
  logInNewTab: string;
  rateLimited: string;
  /** No answer came back, so the reader's connection is where to look. */
  saveFailed: string;
  /** The server answered that it could not save, so their connection is not the trouble. */
  serverFailed: string;
  /** Said where a form opens again with writing that was left unsaved. */
  draftBack: string;
  /** Asked when a link would take the reader away from unsaved writing. */
  leaveWarning: string;
  /** The page's language, which a count must follow: the browser's may be another. */
  locale: string;
};

export type JournalSaveFailure = "signed_out" | "rate_limited" | "server_error" | "no_answer";

export type JournalSendResult =
  | { failure: JournalSaveFailure; response?: undefined }
  | { failure: null; response: Response };

/**
 * Save by fetch, so that whatever goes wrong the reader's words are still in the form in
 * front of them. Answers with what went wrong, or the response; it never throws.
 */
export async function sendJournalEntry(
  url: string,
  method: "POST" | "PATCH",
  entry: { title: string; body: string; goalId?: string },
): Promise<JournalSendResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (response.ok) return { failure: null, response };
    if (response.status === 401) return { failure: "signed_out" };
    if (response.status === 429) return { failure: "rate_limited" };
    return { failure: "server_error" };
  } catch {
    return { failure: "no_answer" };
  }
}

export type JournalFieldProblems = { title: string | null; body: string | null };

/**
 * Checked at Save rather than enforced with maxLength: a browser cuts pasted text at
 * maxLength and ignores further typing without a word, which to a reader who cannot see
 * the field is writing simply going missing.
 */
export function journalFieldProblems(
  title: string,
  body: string,
  labels: Pick<JournalSaveLabels, "titleTooLong" | "bodyTooLong" | "locale">,
): JournalFieldProblems {
  const describe = (template: string, length: number, max: number) =>
    template
      .replace("{count}", formatJournalCount(length, labels.locale))
      .replace("{max}", formatJournalCount(max, labels.locale));
  return {
    title:
      title.length > JOURNAL_TITLE_MAX
        ? describe(labels.titleTooLong, title.length, JOURNAL_TITLE_MAX)
        : null,
    body:
      body.length > JOURNAL_BODY_MAX
        ? describe(labels.bodyTooLong, body.length, JOURNAL_BODY_MAX)
        : null,
  };
}

/** Why a save failed. Inserted when it happens, so a screen reader speaks it. */
export function JournalSaveAlert({
  failure,
  labels,
  logInNext = "/profile/journal",
}: {
  failure: JournalSaveFailure | null;
  labels: JournalSaveLabels;
  /** The page to come back to after logging in from the signed-out message. */
  logInNext?: string;
}) {
  if (!failure) return null;
  if (failure === "signed_out") {
    // A new tab, so that signing in does not take the reader away from their words.
    return (
      <p role="alert" className="vf-notice vf-notice-error">
        {labels.signedOut}{" "}
        <a
          href={`/login?next=${logInNext}`}
          target="_blank"
          rel="noopener noreferrer"
          className="vf-link"
        >
          {labels.logInNewTab}
        </a>
      </p>
    );
  }
  const messages: Record<Exclude<JournalSaveFailure, "signed_out">, string> = {
    rate_limited: labels.rateLimited,
    server_error: labels.serverFailed,
    no_answer: labels.saveFailed,
  };
  return (
    <p role="alert" className="vf-notice vf-notice-error">
      {messages[failure]}
    </p>
  );
}

/**
 * How long a page's arrival gets to itself. Next's route announcer speaks the new page's
 * title as it arrives and, being assertive, could talk over anything said in that moment.
 */
const NOTICE_FOCUS_DELAY_MS = 500;

/**
 * Says a form has opened again with the reader's unsaved words. Focus goes to it, since a
 * screen reader always speaks that, where a live region can be talked over and a field's
 * description is spoken only with hints on. The next stop from here is the form's first
 * field. A reader who has moved on in that moment is left where they went.
 */
export function JournalDraftNotice({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const focusOnArrival = document.activeElement;
    const timer = window.setTimeout(() => {
      if (document.activeElement === focusOnArrival) ref.current?.focus();
    }, NOTICE_FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <p ref={ref} tabIndex={-1} className="vf-notice">
      {text}
    </p>
  );
}

export type JournalDraft = { title: string; body: string };

const DRAFT_STORAGE_PREFIX = "vf-journal-draft:";

/**
 * Unsaved writing, by form, for as long as it stays unsaved.
 *
 * A move within the site unmounts the form with no warning from the browser and no way to
 * stop it: Back, a search, a sign-out. So the words are kept outside the form, and it gets
 * them back when its page returns. This map carries them across such a move. sessionStorage
 * also carries them across a reload, and across the failed navigation that turns into one,
 * and on iOS, where the browser's own question is never asked, that is all that stands
 * between a reader and losing them. It belongs to this one tab: nothing here is sent
 * anywhere, and closing the tab ends it.
 */
const drafts = new Map<string, JournalDraft>();

/**
 * Until when the browser's own question would only repeat the one a reader has just
 * answered for a link, if that link loads a whole new page. Their answer was about the
 * words as they stood, so any change to those ends it too.
 */
let leaveAgreedUntil = 0;

function syncUnloadWarning() {
  // Adding the same listener twice adds it once.
  if (drafts.size > 0) {
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("submit", noteFormPost, true);
  } else {
    window.removeEventListener("beforeunload", warnBeforeUnload);
    document.removeEventListener("submit", noteFormPost, true);
  }
}

function storedDraft(key: string): JournalDraft | null {
  // Storage can be blocked, and what it holds is only as good as whoever wrote it.
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as Partial<JournalDraft> | null) : null;
    return typeof parsed?.title === "string" && typeof parsed.body === "string"
      ? { title: parsed.title, body: parsed.body }
      : null;
  } catch {
    return null;
  }
}

/** What a form left unsaved, if anything. Read after mount: the server has no such thing. */
export function readJournalDraft(key: string): JournalDraft | null {
  const draft = drafts.get(key) ?? storedDraft(key);
  if (!draft) return null;
  drafts.set(key, draft);
  syncUnloadWarning();
  return draft;
}

/** Forgotten once saved or cancelled: nothing typed outlives its purpose. */
export function forgetJournalDraft(key: string): void {
  drafts.delete(key);
  leaveAgreedUntil = 0;
  syncUnloadWarning();
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_PREFIX + key);
  } catch {
    // Storage is blocked, so nothing was put there.
  }
}

/** Called on every change. Blank fields are nothing to lose, so they are no draft. */
export function keepJournalDraft(key: string, draft: JournalDraft): void {
  if (!draft.title.trim() && !draft.body.trim()) {
    forgetJournalDraft(key);
    return;
  }
  drafts.set(key, draft);
  leaveAgreedUntil = 0;
  syncUnloadWarning();
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_PREFIX + key, JSON.stringify(draft));
  } catch {
    // Full or blocked. The map still holds it, and an older copy must not come back later.
    try {
      window.sessionStorage.removeItem(DRAFT_STORAGE_PREFIX + key);
    } catch {
      // Blocked, so there is no older copy either.
    }
  }
}

/**
 * The browser's "leave this page?", for a reload or a closed tab, on whatever page: the
 * form may be gone, and the words only live as long as the tab.
 */
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (drafts.size === 0 || Date.now() < leaveAgreedUntil) return;
  event.preventDefault();
  // Safari and older browsers only ask when this is set too.
  event.returnValue = "";
}

/**
 * A post within the site stays in this tab, so the words are still here after it. A reader
 * logging in again must not be asked whether to leave them.
 */
function noteFormPost(event: Event) {
  const action = event.target instanceof Element ? event.target.getAttribute("action") : null;
  if (action && new URL(action, window.location.href).origin === window.location.origin) {
    leaveAgreedUntil = Date.now() + 1000;
  }
}

/** The forms on the page now, each with the question its unsaved words raise. */
const guardedForms = new Map<string, string>();

function pressLeavesThisPage(event: MouseEvent): boolean {
  // These open a new tab or window, or download, and this page and its words stay.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download")) return false;
  if (link.target && link.target !== "_self") return false;
  // A link to another site unloads this page, and the browser asks about that itself. One
  // to this page, such as the journal's favorites filter, keeps the form as it is.
  return link.origin === window.location.origin && link.pathname !== window.location.pathname;
}

/**
 * Next has no way to stop a navigation, and a press on one of its links gives the browser
 * nothing to ask about. Listening on the way down, this hears the press before the link
 * does, and the link never hears a press the reader takes back. One listener for all the
 * forms on a page, so that one press is one question.
 */
function askBeforeFollowingLink(event: MouseEvent) {
  const writing = [...guardedForms].find(([key]) => drafts.has(key));
  if (!writing || !pressLeavesThisPage(event)) return;
  if (window.confirm(writing[1])) {
    leaveAgreedUntil = Date.now() + 1000;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

/** While this form is on the page, a link that leaves it asks about the form's draft. */
export function useJournalLeaveGuard(key: string, question: string): void {
  useEffect(() => {
    guardedForms.set(key, question);
    document.addEventListener("click", askBeforeFollowingLink, true);
    return () => {
      guardedForms.delete(key);
      if (guardedForms.size === 0) {
        document.removeEventListener("click", askBeforeFollowingLink, true);
      }
    };
  }, [key, question]);
}

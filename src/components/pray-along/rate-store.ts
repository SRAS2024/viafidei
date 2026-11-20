/**
 * The pray-along speed: 1x, 1.25x or 1.5x, stepped through by the speed button beside
 * Stop. This browser remembers the last speed (localStorage); a signed-in member's is
 * also saved to their account, so it follows them to every browser they sign in on.
 * When a press's playlist arrives it carries the member's saved speed, which wins over
 * this browser's, unless the reader changed the speed while the playlist was on its way.
 *
 * Browser only (every storage call is guarded, so a private window still plays).
 */

import { DEFAULT_RATE, isRate, nextRate, type Rate } from "@/lib/pray-along/rate";

export const RATE_STORAGE_KEY = "vf-pray-along-rate";

/** A member's clicks are saved together, a moment after the last one. */
export const ACCOUNT_SAVE_DELAY_MS = 1_500;

let rate: Rate | null = null;
let member = false;
/** How many times the reader has changed the speed (see `adoptAccountRate`). */
let changes = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(rate: Rate) => void>();

function readBrowser(): Rate {
  try {
    const saved = window.localStorage.getItem(RATE_STORAGE_KEY);
    const value = saved === null ? NaN : Number(saved);
    return isRate(value) ? value : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}

function writeBrowser(value: Rate): void {
  try {
    window.localStorage.setItem(RATE_STORAGE_KEY, String(value));
  } catch {
    // Storage blocked: the speed holds for this page.
  }
}

function emit(): void {
  const current = getRate();
  for (const listener of listeners) listener(current);
}

/** The speed now: this browser's last choice until a member's playlist says otherwise. */
export function getRate(): Rate {
  if (typeof window === "undefined") return DEFAULT_RATE;
  if (rate === null) rate = readBrowser();
  return rate;
}

export function subscribeRate(listener: (rate: Rate) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Counts the reader's changes, so a playlist can tell whether one came while it loaded. */
export function rateChanges(): number {
  return changes;
}

function scheduleAccountSave(): void {
  if (!member) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioRate: getRate() }),
      // Saved even when the reader leaves the page right after choosing.
      keepalive: true,
    }).catch(() => undefined);
  }, ACCOUNT_SAVE_DELAY_MS);
}

/** The speed button: 1x → 1.25x → 1.5x → 1x, remembered here and in a member's account. */
export function cycleRate(): Rate {
  rate = nextRate(getRate());
  changes += 1;
  writeBrowser(rate);
  scheduleAccountSave();
  emit();
  return rate;
}

/**
 * What a press's playlist says about the listener: whether they are signed in, and the
 * speed their account keeps. The account's speed is taken (and this browser remembers
 * it too) unless the reader changed the speed since `changesAtRequest`; then their new
 * choice is the one saved to the account.
 */
export function adoptAccountRate(
  account: { member: boolean; rate: unknown },
  changesAtRequest: number,
): void {
  member = account.member;
  if (changes !== changesAtRequest) {
    scheduleAccountSave();
    return;
  }
  if (!member || !isRate(account.rate) || account.rate === getRate()) return;
  rate = account.rate;
  writeBrowser(rate);
  emit();
}

/** For tests: forget everything (the next read goes back to this browser's storage). */
export function resetRateForTests(): void {
  rate = null;
  member = false;
  changes = 0;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  listeners.clear();
}

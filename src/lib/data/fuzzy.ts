/**
 * Lightweight fuzzy matching helpers used by the search/suggest endpoints.
 *
 * These are written so they can run on the application server without any
 * external search infrastructure — they trade absolute precision for the
 * ability to handle typos, missing letters, and word reorderings against a
 * small candidate list (typically the prefix-match results returned by
 * Postgres `contains`).
 *
 * Algorithms used:
 *   - normalize(): casefold + Unicode-strip diacritics so "Thérèse" and
 *     "Therese" match.
 *   - levenshtein(): bounded edit distance, with early termination when the
 *     distance exceeds `cap`. O(n*m) with tiny constants.
 *   - similarity(): symmetric similarity in [0,1] derived from the
 *     normalized edit distance.
 *   - bestTokenScore(): for multi-word queries (e.g. "saint francis assissi"
 *     misspelled), we score the query against every candidate label both as
 *     a whole and per-token, returning the highest similarity.
 */

export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  if (!a.length) return Math.min(b.length, cap);
  if (!b.length) return Math.min(a.length, cap);
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  // Use one-row DP for memory efficiency.
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const dist = levenshtein(a, b);
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - dist / longest;
}

/**
 * Score a query against a candidate label. Considers:
 *   - whole-string similarity
 *   - max single-token similarity (e.g. matching "asissi" against "assisi"
 *     within "Saint Francis of Assisi")
 *   - prefix bonus (the candidate starts with the query)
 *   - substring bonus (the candidate contains the query as substring)
 *
 * The returned score is in [0,1]; values around 0.55 are typically
 * meaningful matches and 0.7+ are confident matches.
 */
export function bestTokenScore(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (l === q) return 1;

  const whole = similarity(q, l);

  let bestToken = 0;
  for (const tok of l.split(" ")) {
    if (!tok) continue;
    const s = similarity(q, tok);
    if (s > bestToken) bestToken = s;
  }

  // Multi-token query: score each query token against the closest label
  // token and average. Helpful when the user types two misspelled words.
  const queryTokens = q.split(" ").filter(Boolean);
  const labelTokens = l.split(" ").filter(Boolean);
  let multiToken = 0;
  if (queryTokens.length > 1) {
    let sum = 0;
    for (const qt of queryTokens) {
      let best = 0;
      for (const lt of labelTokens) {
        const s = similarity(qt, lt);
        if (s > best) best = s;
      }
      sum += best;
    }
    multiToken = sum / queryTokens.length;
  }

  let bonus = 0;
  if (l.startsWith(q)) bonus = Math.max(bonus, 0.18);
  else if (l.includes(q)) bonus = Math.max(bonus, 0.1);

  return Math.min(1, Math.max(whole, bestToken, multiToken) + bonus);
}

export type Scored<T> = { item: T; score: number };

/**
 * Rank candidates by fuzzy similarity to the query. Items with score below
 * `threshold` are dropped. Callers should pass in a small candidate list —
 * this is intended to be applied after a coarse `contains` pass at the
 * database layer.
 */
export function rankFuzzy<T>(
  query: string,
  candidates: T[],
  getLabel: (item: T) => string,
  options?: { threshold?: number; limit?: number },
): Scored<T>[] {
  const threshold = options?.threshold ?? 0.45;
  const limit = options?.limit ?? candidates.length;
  const scored: Scored<T>[] = [];
  for (const c of candidates) {
    const label = getLabel(c);
    const score = bestTokenScore(query, label);
    if (score >= threshold) scored.push({ item: c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

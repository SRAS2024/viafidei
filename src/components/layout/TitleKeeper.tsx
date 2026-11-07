"use client";

import { useEffect } from "react";

/**
 * Keeps the document's title from ever going blank.
 *
 * Going Back to a page the router no longer holds (the page before a reload, say) takes
 * the title down while the page is fetched again. Next's route announcer runs in that
 * moment, finds no title, and reads out the <h1>, and then reads the title when it comes:
 * two messages for one move, the first of them not the page's title. So a second <title>
 * waits behind the real one, holding the last title there was. `document.title` reads
 * whichever comes first, React always puts its own first, and an itemprop tells React to
 * leave this one alone. In that moment the announcer finds the title it already spoke, and
 * says nothing until the page arrives.
 */
export function TitleKeeper() {
  useEffect(() => {
    const kept = document.createElement("title");
    kept.setAttribute("itemprop", "name");
    document.head.append(kept);
    const keep = () => {
      const shown = document.head.querySelector("title:not([itemprop])")?.textContent;
      if (shown && kept.textContent !== shown) kept.textContent = shown;
    };
    keep();
    const observer = new MutationObserver(keep);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      kept.remove();
    };
  }, []);
  return null;
}

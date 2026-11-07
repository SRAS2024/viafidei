import { expect, test, type Page } from "@playwright/test";

// In the WebKit that Safari uses on macOS 27, a line of plain text that begins with text
// hidden from assistive technology loses the rest of that line for VoiceOver, and text in
// .sr-only inside a line comes out of it as a stop of its own. /history lost every era's
// count that way, and had a lone comma for every row. The accessibility tree cannot be
// read from here, but the shapes that cause both can, and jsdom knows nothing of what is
// a line. A link, a button or a heading keeps its name, so those are left out.

const PAGES = [
  "/",
  "/history",
  "/history?era=persecution",
  "/history?event=first-council-of-nicaea",
  "/liturgy/readings?date=2026-11-07",
  "/liturgical-calendar",
  "/guides/how-to-pray-the-rosary",
  "/novenas/divine-mercy-novena",
  "/saints/saint-joseph",
  "/prayers/our-father",
  "/search?q=rosary",
  "/saints/today",
];

/** The lines on the page that hold both words for a voice and words it would lose or stop on. */
async function badLines(page: Page) {
  return page.evaluate(() => {
    const inFlow = (element: Element) => {
      const style = getComputedStyle(element);
      return (
        style.display === "inline" && style.position !== "absolute" && style.position !== "fixed"
      );
    };
    const named = "a,button,summary,label,h1,h2,h3,h4,h5,h6,[role=button],[role=link],select";
    const hidden = '[aria-hidden="true"]';
    const lines = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || !walker.currentNode.nodeValue?.trim()) continue;
      if (parent.closest("script,style,noscript,template,nextjs-portal")) continue;
      let line: Element | null = parent;
      while (line && inFlow(line)) line = line.parentElement;
      if (line && !line.closest(hidden) && !line.closest(named)) lines.add(line);
    }
    const bad: string[] = [];
    for (const line of lines) {
      const words: { text: string; hidden: boolean; apart: boolean }[] = [];
      const read = (element: Element) => {
        for (const child of element.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim()) {
            words.push({
              text: child.nodeValue.trim(),
              hidden: !!child.parentElement?.closest(hidden),
              apart: !!child.parentElement?.closest(".sr-only"),
            });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const inner = child as Element;
            // An element that is a stop of its own ends what the hidden text can take.
            if (inner.matches(named)) words.push({ text: "", hidden: false, apart: false });
            else if (inFlow(inner) || inner.matches(".sr-only")) read(inner);
          }
        }
      };
      read(line);
      const say = words.map((w) => (w.hidden ? `[${w.text}]` : w.text)).join(" ");
      // What is in .sr-only is out of the line, so it is not lost with the line's words.
      const inLine = words.filter((w) => !w.apart);
      const heard = inLine.some((w) => !w.hidden && w.text);
      if (inLine[0]?.hidden && heard) bad.push(`begins hidden: ${say}`);
      if (heard && words.some((w) => w.apart)) bad.push(`.sr-only in a line: ${say}`);
    }
    return bad;
  });
}

for (const path of PAGES) {
  test(`a voice loses nothing of any line on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // What opens is read too.
    await page.evaluate(() => {
      for (const details of document.querySelectorAll<HTMLDetailsElement>("main details")) {
        if (!details.hasAttribute("data-history-menu")) details.open = true;
      }
    });
    expect(await badLines(page)).toEqual([]);
  });
}

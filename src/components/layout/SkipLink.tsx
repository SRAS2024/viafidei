"use client";

/**
 * The first stop on every public page. Following the link moves focus to the main
 * content for the moment it is needed: <main> is focusable only until focus leaves
 * it, because a <main> that stays focusable takes focus on every click in it. In
 * Safari that closes an open menu before its link receives the click, and Tab
 * would restart from the top of the page. Without script the link still jumps there.
 *
 * With script it goes there without the jump's history entry. Next ignores a Back onto
 * an entry it did not make, so after one more page Back would change the address to
 * this page's #main-content and leave the other page on screen.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      className="vf-skip-link"
      onClick={(event) => {
        const main = document.getElementById("main-content");
        if (!main) return;
        event.preventDefault();
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
        // The page's scroll-padding keeps the top of <main> clear of the header.
        main.scrollIntoView({ block: "start" });
        main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
      }}
    >
      {label}
    </a>
  );
}

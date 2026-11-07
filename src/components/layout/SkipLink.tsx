"use client";

/**
 * The first stop on every public page. Following the link moves focus to the main
 * content for the moment it is needed: <main> is focusable only until focus leaves
 * it, because a <main> that stays focusable takes focus on every click in it. In
 * Safari that closes an open menu before its link receives the click, and Tab
 * would restart from the top of the page. Without script the link still jumps there.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      className="vf-skip-link"
      onClick={() => {
        const main = document.getElementById("main-content");
        if (!main) return;
        main.tabIndex = -1;
        main.focus();
        main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
      }}
    >
      {label}
    </a>
  );
}

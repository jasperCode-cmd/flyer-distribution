// What a public form does once it has an answer: bring the result into view
// below the sticky header and give it keyboard focus, so it is both seen and
// announced. Smooth, unless the visitor has asked for reduced motion, when
// it jumps straight there ("instant", as "auto" would follow the page's own
// smooth scrolling). Used by the quote form and the distributor application
// form.

function scrollBehaviour(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

// The success message, or the "Something went wrong" banner: its top just
// below the header (its own scroll-margin allows for the header's height).
export function showResult(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: scrollBehaviour(), block: "start" });
}

// The browser's own message for a field it won't accept: the first such
// field in each attempt is focused and centred, clear of the header, as its
// message shows. Without this the browser leaves a field it thinks is in
// view where it is, which can be under the header. It runs just after the
// browser's own focus and scroll, so it is the one that settles. Listened
// for on the form in the capture phase, as "invalid" doesn't bubble.
let revealing = false;
export function revealFirstInvalid(e: Event) {
  if (revealing) return;
  revealing = true;
  const field = e.target as HTMLElement;
  setTimeout(() => {
    revealing = false;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: scrollBehaviour(), block: "center" });
  }, 0);
}

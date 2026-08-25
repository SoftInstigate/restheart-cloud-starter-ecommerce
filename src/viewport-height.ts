/**
 * `--vh`: one percent of the viewport that is actually visible.
 *
 * `100vh` on a phone is the height of the window *without* the browser's own
 * chrome — the address bar that slides away and back as you scroll, and the
 * on-screen keyboard, neither of which `vh` knows about. A layout sized in
 * `vh` is therefore too tall on first paint and stays too tall while a keyboard
 * covers a third of the screen, which is how a login form ends up with its
 * button under the keyboard and no way to scroll to it.
 *
 * `visualViewport` reports what the user can see, keyboard included, so this
 * writes a hundredth of it to `--vh` and CSS uses
 * `calc(var(--vh, 1vh) * 100)`. The fallback matters: before this runs, and
 * during a prerender where there is no window, `1vh` is the old behaviour
 * rather than a collapsed page.
 *
 * https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
 *
 * `dvh` does most of this natively now, but not the keyboard: it tracks the
 * browser chrome and ignores the keyboard, which is the half that breaks forms.
 */

/** Debounced: a keyboard opening fires resize continuously for ~300ms. */
function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

/**
 * Starts measuring. Returns a function that stops.
 *
 * Called from the shell rather than at module load, so a test or a server
 * render that never mounts the app never touches `document`.
 */
export function trackViewportHeight(): () => void {
  if (typeof window === 'undefined') return () => {};

  const target: VisualViewport | Window = window.visualViewport ?? window;
  let last = '';

  const measure = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    const vh = (height * 0.01).toFixed(2);
    // Only when it changed: this runs on every resize event, and writing a
    // custom property on the root invalidates style for the whole document.
    if (vh === last) return;
    last = vh;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  measure();
  const onResize = debounce(measure, 100);
  target.addEventListener('resize', onResize);

  return () => target.removeEventListener('resize', onResize);
}

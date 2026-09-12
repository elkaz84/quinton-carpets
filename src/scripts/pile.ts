/**
 * The carpet-pile canvas behind the banner.
 *
 * A grid of short tufts on a 15px pitch, each leaning on its own
 * sine. Alpha ramps left to right so the headline sits on quiet
 * ground and the texture builds towards the edge; every 23rd tuft
 * is yellow, which is what stops it reading as noise.
 *
 * The look is the prototype's and is unchanged. What changed is the
 * cost of drawing it, which had made the site noticeably heavy on a
 * desktop while staying fine on a phone — the tuft count grows with
 * the area of the banner, so a 1920-wide window drew about 11,800
 * tufts and a 2560-wide one about 15,700, against roughly 2,100 on a
 * phone. Three things fix that, none of which move a pixel:
 *
 *   1. Tufts are grouped at build time by the alpha they will be
 *      drawn at, so a frame issues a few dozen stroke() calls
 *      instead of one per tuft. Alpha only depends on x, so the
 *      grouping is exact to within a 1/64th step nobody can see.
 *   2. The loop stops when the banner scrolls out of view. It used
 *      to keep running the whole way down the page.
 *   3. The sway is capped at about 30fps. It is a slow sine; drawing
 *      it twice as often did not make it look any smoother.
 */

const canvas = document.querySelector<HTMLCanvasElement>("#pile");

if (canvas) {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  type Tuft = { x: number; y: number; len: number; phase: number; speed: number };
  /** Tufts sharing one alpha step and one colour, drawn as a single path. */
  type Band = { alpha: number; yellow: boolean; tufts: Tuft[] };

  const ALPHA_STEPS = 64;
  const FRAME_MS = 1000 / 30;

  let bands: Band[] = [];
  let w = 0;
  let h = 0;
  let raf: number | null = null;
  let onScreen = true;
  let last = 0;

  const isDark = () => {
    const stamped = document.documentElement.getAttribute("data-theme");
    if (stamped === "dark") return true;
    if (stamped === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  const build = () => {
    if (!ctx || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // capped: 3× costs paint for nothing
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Keyed by alpha step and colour, so every tuft in a bucket can be
    // drawn in one path with one strokeStyle.
    const buckets = new Map<string, Band>();
    const gap = 15;
    let i = 0;

    for (let y = -10; y < h + 20; y += gap) {
      for (let x = -10; x < w + 20; x += gap) {
        const tuft: Tuft = {
          x: x + (Math.random() * 5 - 2.5),
          y: y + (Math.random() * 5 - 2.5),
          len: 4 + Math.random() * 5,
          phase: Math.random() * 6.28,
          speed: 0.35 + Math.random() * 0.5,
        };

        // Unchanged from the per-tuft version: alpha ramps with x only.
        const edge = Math.min(1, Math.max(0, tuft.x / (w * 0.62)));
        const ramp = 0.25 + edge * 0.95;
        const step = Math.round(ramp * ALPHA_STEPS) / ALPHA_STEPS;
        const yellow = i % 23 === 0;

        const key = `${step}|${yellow}`;
        let band = buckets.get(key);
        if (!band) {
          band = { alpha: step, yellow, tufts: [] };
          buckets.set(key, band);
        }
        band.tufts.push(tuft);
        i++;
      }
    }

    bands = [...buckets.values()];
  };

  const draw = (t: number) => {
    if (!ctx || !w) return;
    const dark = isDark();
    const base = dark ? 0.16 : 0.13;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    for (const band of bands) {
      const a = base * band.alpha;
      ctx.strokeStyle = band.yellow
        ? `rgba(255,198,26,${(a * 3.1).toFixed(3)})`
        : dark
          ? `rgba(247,243,234,${a.toFixed(3)})`
          : `rgba(21,18,12,${a.toFixed(3)})`;
      ctx.lineWidth = band.yellow ? 2 : 1.4;

      ctx.beginPath();
      for (let i = 0; i < band.tufts.length; i++) {
        const f = band.tufts[i]!;
        const sway = RM ? 0 : Math.sin(t * 0.00042 * f.speed + f.phase) * 2.4;
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + sway, f.y - f.len);
      }
      ctx.stroke();
    }
  };

  const loop = (t: number) => {
    if (t - last >= FRAME_MS) {
      last = t;
      draw(t);
    }
    raf = requestAnimationFrame(loop);
  };

  const run = () => {
    if (raf || RM || !onScreen) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  };

  const start = () => {
    build();
    stop();
    // Reduced motion gets one static frame — the texture, without the sway.
    if (RM) draw(0);
    else run();
  };

  let debounce: ReturnType<typeof setTimeout>;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(debounce);
      debounce = setTimeout(start, 180);
    },
    { passive: true },
  );

  // Don't burn a rAF on a tab nobody is looking at.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else run();
  });

  // Or on a banner that has scrolled away. This is the one that makes
  // the rest of the page feel light, because reading down it no longer
  // competes with a canvas nobody can see.
  if ("IntersectionObserver" in window && canvas.parentElement) {
    new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen) run();
        else stop();
      },
      { rootMargin: "120px" },
    ).observe(canvas.parentElement);
  }

  start();
}

/**
 * The carpet-pile canvas behind the banner.
 *
 * A grid of short tufts on a 15px pitch, each leaning on its own
 * sine. Alpha ramps left to right so the headline sits on quiet
 * ground and the texture builds towards the edge; every 23rd tuft
 * is yellow, which is what stops it reading as noise.
 */

const canvas = document.querySelector<HTMLCanvasElement>("#pile");

if (canvas) {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  type Tuft = { x: number; y: number; len: number; phase: number; speed: number };
  let tufts: Tuft[] = [];
  let w = 0;
  let h = 0;
  let raf: number | null = null;

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

    tufts = [];
    const gap = 15;
    for (let y = -10; y < h + 20; y += gap) {
      for (let x = -10; x < w + 20; x += gap) {
        tufts.push({
          x: x + (Math.random() * 5 - 2.5),
          y: y + (Math.random() * 5 - 2.5),
          len: 4 + Math.random() * 5,
          phase: Math.random() * 6.28,
          speed: 0.35 + Math.random() * 0.5,
        });
      }
    }
  };

  const draw = (t: number) => {
    if (!ctx || !w) return;
    const dark = isDark();
    const base = dark ? 0.16 : 0.13;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    for (let i = 0; i < tufts.length; i++) {
      const f = tufts[i]!;
      const edge = Math.min(1, Math.max(0, f.x / (w * 0.62)));
      const a = base * (0.25 + edge * 0.95);
      const sway = RM ? 0 : Math.sin(t * 0.00042 * f.speed + f.phase) * 2.4;
      const yellow = i % 23 === 0;

      ctx.strokeStyle = yellow
        ? `rgba(255,198,26,${(a * 3.1).toFixed(3)})`
        : dark
          ? `rgba(247,243,234,${a.toFixed(3)})`
          : `rgba(21,18,12,${a.toFixed(3)})`;
      ctx.lineWidth = yellow ? 2 : 1.4;

      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + sway, f.y - f.len);
      ctx.stroke();
    }
  };

  const loop = (t: number) => {
    draw(t);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    build();
    if (raf) cancelAnimationFrame(raf);
    // Reduced motion gets one static frame — the texture, without the sway.
    if (RM) draw(0);
    else raf = requestAnimationFrame(loop);
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
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf && !RM) {
      raf = requestAnimationFrame(loop);
    }
  });

  start();
}

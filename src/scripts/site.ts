/**
 * Everything that moves, in one place.
 *
 * There is exactly ONE scroll listener on the site. It is passive,
 * rAF-throttled, and it drives the sticky header, the progress bar
 * and the showcase tilt together. Handlers write to CSS custom
 * properties; nothing here animates a layout property.
 *
 * No animation library. All of this is hand-written.
 */

const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COARSE = window.matchMedia("(hover: none)").matches;

const $ = <T extends Element = Element>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = Element>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));

/* ---------------- mobile nav ---------------- */
(() => {
  const toggle = $<HTMLButtonElement>("#menutoggle");
  const nav = $<HTMLElement>("#mainnav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  // Escape closes it and puts focus back on the control that opened it.
  nav.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
})();

/* ---------------- headline: word-by-word reveal ----------------
   The splitter walks text nodes so the inline <em> survives — the
   yellow highlight and its sheen are one element, not three. */
(() => {
  const h = $<HTMLElement>("h1[data-words]");
  if (!h) return;
  let i = 0;
  const split = (node: Node) => {
    const swaps: Array<[Node, DocumentFragment]> = [];
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        (n.textContent ?? "").split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) {
            frag.appendChild(document.createTextNode(t));
            return;
          }
          const s = document.createElement("span");
          s.className = "w";
          s.style.setProperty("--i", String(i++));
          s.textContent = t;
          frag.appendChild(s);
        });
        swaps.push([n, frag]);
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        split(n);
      }
    });
    swaps.forEach(([oldNode, frag]) => node.replaceChild(frag, oldNode));
  };
  split(h);
  // Arrive on the next frame so the transition has a start state.
  requestAnimationFrame(() => $(".hero")?.classList.add("shown"));
})();

/* ---------------- the single scroll listener ---------------- */
(() => {
  const header = $<HTMLElement>("header.site");
  if (!header) return;

  const bar = document.createElement("div");
  bar.id = "progress";
  header.appendChild(bar);

  const showcaseEl = $<HTMLElement>("#showcase");
  const inner = showcaseEl ? $<HTMLElement>(".showcase-inner", showcaseEl) : null;
  const hint = showcaseEl ? $<HTMLElement>(".showhint", showcaseEl) : null;

  let queued = false;

  const update = () => {
    queued = false;
    const y = window.scrollY || 0;

    header.classList.toggle("stuck", y > 8);

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (scrollable > 0 ? Math.min(100, (y / scrollable) * 100) : 0) + "%";

    // The floor lays flat: p goes 0 → 1 as the panel rises through
    // the viewport, and the panel un-tilts and grows to meet it.
    if (inner && !RM) {
      const r = showcaseEl!.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const p = 1 - Math.min(1, Math.max(0, (r.top - vh * 0.18) / (vh * 0.62)));
      inner.style.setProperty("--rx", (20 * (1 - p)).toFixed(2) + "deg");
      inner.style.setProperty("--sc", (0.93 + 0.07 * p).toFixed(4));
      inner.style.setProperty("--sh", (50 - 34 * p).toFixed(0) + "px");
      hint?.style.setProperty("--hint", (1 - p).toFixed(2));
    }
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();

/* ---------------- section reveal ----------------
   Fires once. Anything already on screen is revealed immediately,
   so nothing meant to be read is ever parked at opacity:0. */
(() => {
  const nodes = $$<HTMLElement>(".rv");
  if (!nodes.length) return;

  // Stagger index for grids and step rows.
  $$<HTMLElement>(".grid.rv, .steps.rv").forEach((g) =>
    Array.from(g.children).forEach((c, i) =>
      (c as HTMLElement).style.setProperty("--i", String(i)),
    ),
  );

  if (RM || !("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px" },
  );

  nodes.forEach((n) => {
    if (n.getBoundingClientRect().top < window.innerHeight * 0.95) n.classList.add("in");
    else io.observe(n);
  });
})();

/* ---------------- hero spotlight ---------------- */
(() => {
  const hero = $<HTMLElement>(".hero");
  const spot = $<HTMLElement>("#spot");
  if (!hero || !spot || RM || COARSE) return;
  hero.addEventListener(
    "pointermove",
    (e) => {
      const r = hero.getBoundingClientRect();
      spot.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(2) + "%");
      spot.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(2) + "%");
    },
    { passive: true },
  );
})();

/* ---------------- magnetic buttons ----------------
   Max pull is about 6px. Enough to feel, not enough to miss. */
(() => {
  if (RM || COARSE) return;
  $$<HTMLElement>(".magnet").forEach((b) => {
    b.addEventListener(
      "pointermove",
      (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.16;
        const dy = (e.clientY - r.top - r.height / 2) * 0.22;
        b.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      },
      { passive: true },
    );
    b.addEventListener("pointerleave", () => {
      b.style.transform = "";
    });
  });
})();

/* ---------------- the hero's carpet pile ---------------- */
import "./pile.ts";
/* ---------------- the showcase floor rotation ---------------- */
import "./showcase.ts";

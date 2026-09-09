/**
 * The showcase floor swap.
 *
 * Two stacked layers: B takes the new texture and cross-fades in
 * over 0.55s, then A is updated underneath and B is reset. That way
 * there is never a frame where the room has no floor.
 *
 * The rotation itself comes from the content collection, serialised
 * into data-rotation, so the shop's ranges drive the banner.
 */

type Slide = { name: string; spec: string; price: string; grade: string; style: string };

const el = document.querySelector<HTMLElement>("#showcase");
const A = document.querySelector<HTMLElement>("#floorA");
const B = document.querySelector<HTMLElement>("#floorB");
const picker = document.querySelector<HTMLElement>("#scPicker");

if (el && A && B && picker) {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let slides: Slide[] = [];
  try {
    slides = JSON.parse(el.dataset.rotation ?? "[]") as Slide[];
  } catch {
    slides = [];
  }

  if (slides.length > 1) {
    const name = document.querySelector<HTMLElement>("#scName");
    const spec = document.querySelector<HTMLElement>("#scSpec");
    const price = document.querySelector<HTMLElement>("#scPrice");
    const grade = document.querySelector<HTMLElement>("#scGrade");
    const buttons = Array.from(picker.querySelectorAll<HTMLButtonElement>("button"));

    let current = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const paint = (i: number) => {
      const s = slides[i];
      if (!s) return;

      B.setAttribute("style", s.style);
      B.classList.add("on");
      window.setTimeout(() => {
        A.setAttribute("style", s.style);
        B.classList.remove("on");
      }, 560);

      if (name) name.textContent = s.name;
      if (spec) spec.textContent = s.spec;
      if (price) price.textContent = s.price;
      if (grade) grade.textContent = s.grade;
      buttons.forEach((b, j) => b.setAttribute("aria-pressed", j === i ? "true" : "false"));
      current = i;
    };

    const restart = () => {
      if (timer) clearInterval(timer);
      timer = null;
      // Reduced motion gets whichever range the viewer chose, and no cycle.
      if (!RM) timer = setInterval(() => paint((current + 1) % slides.length), 4200);
    };

    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        paint(Number(b.dataset.i));
        restart(); // the clock starts again from the viewer's click
      }),
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else {
        restart();
      }
    });

    restart();
  }
}

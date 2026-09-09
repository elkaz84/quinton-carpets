/**
 * The estimator island.
 *
 * All arithmetic is delegated to lib/pricing.ts, which is pure and
 * unit-tested. This file only builds inputs, renders the answer and
 * asks the server what a code is worth — it never decides that
 * itself.
 */

import {
  estimate,
  money,
  type DiscountVerdict,
  type EstimateInput,
  type RateCard,
  type RoomInput,
} from "../lib/pricing.ts";
import { mintEstimateCode } from "../lib/codes.ts";

type Floor = {
  id: string;
  name: string;
  material: string;
  price: number;
  widths: number[] | null;
  hard: boolean;
  swatch: string;
};
type Underlay = { id: string; name: string; spec: string; price: number; forHard: boolean };
type Config = { floors: Floor[]; underlays: Underlay[]; rates: RateCard };

const root = document.querySelector<HTMLElement>("#estimator");

if (root) {
  const cfg: Config = JSON.parse(root.dataset.config ?? "{}");
  const $ = <T extends Element = Element>(s: string) => document.querySelector<T>(s);
  const $$ = <T extends Element = Element>(s: string) =>
    Array.from(document.querySelectorAll<T>(s));

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s: string) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

  const byId = new Map(cfg.floors.map((f) => [f.id, f]));
  const ulById = new Map(cfg.underlays.map((u) => [u.id, u]));

  // A range link from /ranges/ pre-selects that floor.
  const wanted = new URLSearchParams(location.search).get("range");
  const defaultFloor =
    (wanted && byId.has(wanted) ? wanted : null) ?? cfg.floors[0]?.id ?? "";
  const defaultUnderlay =
    cfg.underlays.find((u) => !u.forHard)?.id ?? cfg.underlays[0]?.id ?? "none";

  const state = {
    floor: defaultFloor,
    underlay: defaultUnderlay,
    fit: "fitted" as "fitted" | "supply",
    extras: { uplift: true, gripper: true, doorbars: true, furniture: false },
    rooms: [
      { kind: "room", name: "Living room", width: 4.2, length: 4.6 },
      { kind: "stairs", name: "Stairs & landing", steps: 13 },
    ] as RoomInput[],
    discount: null as DiscountVerdict | null,
    code: mintEstimateCode(),
  };

  const currentFloor = () => byId.get(state.floor)!;

  /* ---------------- step 1: the floor ---------------- */
  function drawFloors() {
    const box = $("#estRanges");
    if (!box) return;
    box.innerHTML = cfg.floors
      .map(
        (r) => `
        <button class="rangecard${state.floor === r.id ? " picked" : ""}" type="button"
          data-floor="${r.id}" aria-pressed="${state.floor === r.id}"
          style="text-align:left;padding:0;cursor:pointer;background:var(--ground)">
          <span class="swatch" style="display:block;height:66px;${r.swatch}"></span>
          <span class="body" style="padding:11px 12px 13px;gap:3px">
            <b style="font-size:.9rem">${esc(r.name)}</b>
            <span class="meta" style="font-size:.76rem">${esc(r.material)} · ${money(r.price)}/m²</span>
          </span>
        </button>`,
      )
      .join("");
    $$<HTMLButtonElement>("#estRanges [data-floor]").forEach((b) =>
      b.addEventListener("click", () => {
        state.floor = b.dataset.floor!;
        drawFloors();
        drawUnderlay();
        drawFit();
        calc();
      }),
    );
  }

  /* ---------------- step 2: the rooms ---------------- */
  function drawRooms() {
    const box = $("#rooms");
    if (!box) return;
    box.innerHTML = state.rooms
      .map((r, i) => {
        if (r.kind === "stairs") {
          return `<div class="roomrow">
            <div class="field"><label for="rn${i}">Area</label>
              <input id="rn${i}" value="${esc(r.name)}" data-i="${i}" data-p="name"></div>
            <div class="field"><label for="rs${i}">Steps</label>
              <input id="rs${i}" class="mono" inputmode="numeric" value="${r.steps}" data-i="${i}" data-p="steps"></div>
            <div class="field" style="grid-column:span 2"><label for="rs${i}-note">&nbsp;</label>
              <p class="hint" id="rs${i}-note" style="padding:11px 0">Priced per step, including the landing return.</p></div>
            <button class="iconbtn" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">✕</button>
          </div>`;
        }
        return `<div class="roomrow">
          <div class="field"><label for="rn${i}">Room</label>
            <input id="rn${i}" value="${esc(r.name)}" data-i="${i}" data-p="name"></div>
          <div class="field"><label for="rw${i}">Width (m)</label>
            <input id="rw${i}" class="mono" inputmode="decimal" value="${r.width}" data-i="${i}" data-p="width"></div>
          <div class="field"><label for="rl${i}">Length (m)</label>
            <input id="rl${i}" class="mono" inputmode="decimal" value="${r.length}" data-i="${i}" data-p="length"></div>
          <div class="field"><span class="hint" style="font-weight:700;color:var(--ink);font-size:.85rem">Floor area</span>
            <p class="mono" style="padding:11px 0;font-size:.9rem">${(r.width * r.length).toFixed(1)} m²</p></div>
          <button class="iconbtn" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">✕</button>
        </div>`;
      })
      .join("");

    $$<HTMLInputElement>("#rooms input").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.i);
        const p = input.dataset.p!;
        const room = state.rooms[i];
        if (!room) return;
        if (p === "name") {
          room.name = input.value;
        } else {
          const v = parseFloat(input.value.replace(",", "."));
          // A blank box means zero, not NaN — the total keeps working while you type.
          (room as Record<string, unknown>)[p] = Number.isNaN(v) ? 0 : Math.max(0, v);
        }
        calc();
      });
      // Re-render on blur so the floor-area readout catches up.
      input.addEventListener("change", () => {
        drawRooms();
        calc();
      });
    });

    $$<HTMLButtonElement>("#rooms [data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        state.rooms.splice(Number(b.dataset.del), 1);
        drawRooms();
        calc();
      }),
    );
  }

  /* ---------------- step 3: underlay ---------------- */
  function drawUnderlay() {
    const box = $("#underlayOpts");
    if (!box) return;
    const hard = currentFloor()?.hard ?? false;
    const opts = [
      ...cfg.underlays,
      { id: "none", name: "No underlay", spec: "Re-using what's already down, or not needed", price: 0, forHard: false },
    ];
    box.innerHTML = opts
      .map((u) => {
        const suggested = u.id !== "none" && u.forHard === hard && isFirstOfKind(u, hard);
        return `<label class="opt${state.underlay === u.id ? " on" : ""}">
          <input type="radio" name="ul" value="${u.id}"${state.underlay === u.id ? " checked" : ""}>
          <span><span class="t">${esc(u.name)}${suggested ? ' <span style="color:var(--yellow-ink);font-size:.76rem">· we\'d suggest this</span>' : ""}</span>
          <span class="d" style="display:block">${esc(u.spec)}</span></span>
          <span class="p">${u.price ? money(u.price) + "/m²" : "—"}</span>
        </label>`;
      })
      .join("");
    $$<HTMLInputElement>("#underlayOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.underlay = i.value;
        drawUnderlay();
        calc();
      }),
    );
  }

  const isFirstOfKind = (u: Underlay, hard: boolean) =>
    cfg.underlays.find((x) => x.forHard === hard)?.id === u.id;

  /* ---------------- step 4: fitting and extras ---------------- */
  function drawFit() {
    const box = $("#fitOpts");
    if (!box) return;
    const hard = currentFloor()?.hard ?? false;
    const rate = hard ? cfg.rates.fitHard : cfg.rates.fitCarpet;
    box.innerHTML = `
      <label class="opt${state.fit === "fitted" ? " on" : ""}">
        <input type="radio" name="fit" value="fitted"${state.fit === "fitted" ? " checked" : ""}>
        <span><span class="t">Supply &amp; fit</span>
        <span class="d" style="display:block">Our own fitters. Gripper, door bars and a hoover round before we go.</span></span>
        <span class="p">${money(rate)}/m²</span>
      </label>
      <label class="opt${state.fit === "supply" ? " on" : ""}">
        <input type="radio" name="fit" value="supply"${state.fit === "supply" ? " checked" : ""}>
        <span><span class="t">Supply only</span>
        <span class="d" style="display:block">You collect from the shop and fit it yourself.</span></span>
        <span class="p">—</span>
      </label>`;
    $$<HTMLInputElement>("#fitOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.fit = i.value as "fitted" | "supply";
        drawFit();
        drawExtras();
        calc();
      }),
    );
  }

  function drawExtras() {
    const box = $("#extraOpts");
    if (!box) return;
    if (state.fit !== "fitted") {
      box.innerHTML =
        '<p class="notice info">Extras below are part of the fitting service — switch to supply &amp; fit to add them.</p>';
      return;
    }
    const E = [
      { k: "uplift", t: "Uplift & take the old floor away", d: "Lifted, rolled, loaded and disposed of properly.", p: `${money(cfg.rates.uplift)}/m²` },
      { k: "gripper", t: "New gripper rods", d: "Fresh gripper round the perimeter — worth it on anything over ten years old.", p: `${money(cfg.rates.gripper)}/lin m` },
      { k: "doorbars", t: "Door bars", d: "One per doorway, colour matched to the floor.", p: `${money(cfg.rates.doorbar)} each` },
      { k: "furniture", t: "Move the furniture", d: "We shift it out and put it back. Beds and wardrobes included.", p: `${money(cfg.rates.furniture)} flat` },
    ] as const;
    box.innerHTML = E.map(
      (x) => `<label class="opt${state.extras[x.k] ? " on" : ""}">
        <input type="checkbox" data-e="${x.k}"${state.extras[x.k] ? " checked" : ""}>
        <span><span class="t">${x.t}</span><span class="d" style="display:block">${x.d}</span></span>
        <span class="p">${x.p}</span></label>`,
    ).join("");
    $$<HTMLInputElement>("#extraOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.extras[i.dataset.e as keyof typeof state.extras] = i.checked;
        drawExtras();
        calc();
      }),
    );
  }

  /* ---------------- step 5: the code ----------------
     The client posts the code and recomputes from whatever the
     server says it is worth. It never holds the code table. */
  async function applyCode() {
    const input = $<HTMLInputElement>("#promo");
    const box = $("#promoMsg");
    if (!input || !box) return;
    const value = input.value.trim().toUpperCase();

    state.discount = null;
    if (!value) {
      box.innerHTML = "";
      calc();
      return;
    }

    box.innerHTML = '<p class="notice info">Checking that code…</p>';
    try {
      const res = await fetch("/api/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const verdict = (await res.json()) as DiscountVerdict;
      state.discount = verdict.valid ? verdict : null;
      box.innerHTML = `<p class="notice ${verdict.valid ? "ok" : "warn"}">${esc(verdict.message)}</p>`;
    } catch {
      box.innerHTML =
        '<p class="notice warn">We couldn\'t check that code just now. Bring it in with you and we\'ll apply it at the counter.</p>';
    }
    calc();
  }

  /* ---------------- the answer ---------------- */
  function calc() {
    const floor = currentFloor();
    if (!floor) return;
    const underlay = state.underlay === "none" ? null : ulById.get(state.underlay) ?? null;

    const input: EstimateInput = {
      floor: { name: floor.name, pricePerSqm: floor.price, widths: floor.widths, hard: floor.hard },
      underlay: underlay ? { name: underlay.name, pricePerSqm: underlay.price } : null,
      rooms: state.rooms,
      fit: state.fit,
      extras: state.extras,
      discount: state.discount,
      rates: cfg.rates,
    };

    const out = estimate(input);

    let html = out.lines
      .map((l) =>
        l.sub
          ? `<div class="l sub"><span>${esc(l.label)}</span><span></span></div>`
          : `<div class="l"><span>${esc(l.label)}</span><span>${money(l.amount)}</span></div>`,
      )
      .join("");

    if (out.discount > 0) {
      html += `<hr><div class="l disc"><span>${esc(out.discountLabel)}</span><span>−${money(out.discount)}</span></div>`;
    }
    html += `<hr><div class="l" style="font-weight:800"><span>Estimate incl. VAT</span><span>${money(out.total)}</span></div>`;
    if (out.total > 0) {
      html += `<div class="l sub"><span>Typical range once measured</span><span>£${Math.round(out.rangeLow).toLocaleString("en-GB")} – £${Math.round(out.rangeHigh).toLocaleString("en-GB")}</span></div>`;
    }

    const lines = $("#estLines");
    if (lines) lines.innerHTML = html || '<p class="muted">Add a room to see your estimate.</p>';

    const total = $("#estTotal");
    if (total) total.innerHTML = `${out.total > 0 ? money(out.total) : "£0"}<small> incl. VAT</small>`;

    const foot = $("#estFoot");
    if (foot) {
      foot.innerHTML = `
        <div class="notice info" style="margin-bottom:12px"><span>Your estimate code
        <b class="mono">${state.code}</b> — quote it when you book and we'll have it on the screen.</span></div>
        <a class="btn yellow" href="/book/?estimate=${encodeURIComponent(state.code)}" style="width:100%">Book a free measure</a>
        <p class="hint" style="margin-top:10px">Booking is free and there is no payment on this site.
        Guide prices only — the fitter confirms on the day.</p>`;
    }

    // Carried to the booking form so the customer doesn't retype it.
    try {
      sessionStorage.setItem(
        "qc.estimate",
        JSON.stringify({ code: state.code, total: out.total, floor: floor.name }),
      );
    } catch {
      /* private window, or storage blocked — the code is on screen anyway */
    }
  }

  $("#addRoom")?.addEventListener("click", () => {
    state.rooms.push({ kind: "room", name: `Room ${state.rooms.length + 1}`, width: 3.0, length: 3.5 });
    drawRooms();
    calc();
  });
  $("#addStairs")?.addEventListener("click", () => {
    state.rooms.push({ kind: "stairs", name: "Stairs & landing", steps: 13 });
    drawRooms();
    calc();
  });
  $("#applyPromo")?.addEventListener("click", applyCode);
  $("#promo")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void applyCode();
    }
  });

  void RM; // reduced motion is handled in CSS here; nothing to animate

  drawFloors();
  drawRooms();
  drawUnderlay();
  drawFit();
  drawExtras();
  calc();
}

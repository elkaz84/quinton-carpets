/**
 * The booking island.
 *
 * The page already works without this file: the calendar buttons
 * submit a GET form and the server re-renders. All this does is
 * make it feel like one screen — it takes over the day and slot
 * buttons so nobody loses what they have typed, validates on
 * submit, and swaps in the confirmation.
 *
 * The same date rules run here and on the server, out of
 * lib/dates.ts, so the two can't drift apart.
 */

import {
  HORIZON_DAYS,
  addDaysISO,
  isBookableDate,
  longDate,
  monthGrid,
  monthName,
  shortDate,
  slotLabel,
  slotsFor,
  toISO,
  todayISO,
} from "../lib/dates.ts";

const form = document.querySelector<HTMLFormElement>("#bookForm");
const cal = document.querySelector<HTMLElement>("#cal");

if (form && cal) {
  // Held in a local const so the render functions below keep the
  // narrowed type rather than re-checking for null on every call.
  const calRoot = cal;
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = <T extends Element = Element>(s: string) => document.querySelector<T>(s);
  const esc = (s: string) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

  const today = todayISO();
  const horizon = addDaysISO(today, HORIZON_DAYS);

  const dateInput = $<HTMLInputElement>("#bDate")!;
  const slotInput = $<HTMLInputElement>("#bSlot")!;

  let selected: string | null = dateInput.value || null;
  let selectedSlot: string | null = slotInput.value || null;
  let view = calRoot.dataset.view ?? today.slice(0, 7);

  /* ---------------- honeypot timing ----------------
     A person takes more than three seconds to fill this in. A bot
     posting instantly gets turned away without a CAPTCHA. */
  const started = $<HTMLInputElement>("#bStarted");
  if (started) started.value = String(Date.now());

  /* ---------------- the calendar ---------------- */
  function drawCal() {
    const [vy, vm] = view.split("-").map(Number) as [number, number];
    const { lead, days } = monthGrid(vy, vm);

    const prev = vm === 1 ? toISO(vy - 1, 12, 1).slice(0, 7) : toISO(vy, vm - 1, 1).slice(0, 7);
    const next = vm === 12 ? toISO(vy + 1, 1, 1).slice(0, 7) : toISO(vy, vm + 1, 1).slice(0, 7);
    const canBack = toISO(vy, vm, 1) > today;
    const canFwd = `${next}-01` <= horizon;

    const head = calRoot.querySelector(".calhead")!;
    head.innerHTML = `
      <button class="iconbtn" type="button" data-m="${prev}" aria-label="Previous month"${canBack ? "" : " disabled"}>‹</button>
      <b>${monthName(vm)} ${vy}</b>
      <button class="iconbtn" type="button" data-m="${next}" aria-label="Next month"${canFwd ? "" : " disabled"}>›</button>`;

    const grid = calRoot.querySelector(".days")!;
    grid.innerHTML =
      Array.from({ length: lead }).map(() => '<span class="blank"></span>').join("") +
      days
        .map(
          (d) =>
            `<button type="button" data-d="${d.iso}"${d.bookable ? "" : " disabled"}` +
            `${selected === d.iso ? ' class="on"' : ""} aria-pressed="${selected === d.iso}"` +
            ` aria-label="${esc(shortDate(d.iso))}">${d.day}</button>`,
        )
        .join("");

    head.querySelectorAll<HTMLButtonElement>("[data-m]").forEach((b) =>
      b.addEventListener("click", () => {
        view = b.dataset.m!;
        drawCal();
      }),
    );
    grid.querySelectorAll<HTMLButtonElement>("button:not([disabled])").forEach((b) =>
      b.addEventListener("click", () => {
        selected = b.dataset.d!;
        selectedSlot = null;
        dateInput.value = selected;
        slotInput.value = "";
        drawCal();
        drawSlots();
      }),
    );
  }

  function drawSlots() {
    const box = $("#slots")!;
    const hint = $("#slotHint")!;

    if (!selected || !isBookableDate(selected)) {
      box.innerHTML = slotsFor(today)
        .map((s) => `<button type="button" disabled>${s.title}<br><span class="hint">${s.when}</span></button>`)
        .join("");
      hint.textContent =
        "Choose a date first. We measure Monday to Saturday, and Sunday mornings.";
      return;
    }

    const slots = slotsFor(selected);
    box.innerHTML = slots
      .map(
        (s) =>
          `<button type="button" data-s="${s.key}"${s.available ? "" : " disabled"}` +
          `${selectedSlot === s.key ? ' class="on"' : ""} aria-pressed="${selectedSlot === s.key}">` +
          `${s.title}<br><span class="hint">${s.when}</span></button>`,
      )
      .join("");

    // Sunday says why, rather than just greying a box out.
    hint.textContent =
      shortDate(selected) +
      (slots.some((s) => !s.available)
        ? " — Sunday, so we finish at 4pm."
        : " — pick a window that suits you.");

    box.querySelectorAll<HTMLButtonElement>("button:not([disabled])").forEach((b) =>
      b.addEventListener("click", () => {
        selectedSlot = b.dataset.s!;
        slotInput.value = selectedSlot;
        drawSlots();
        const err = $<HTMLElement>("#dateErr");
        if (err) err.style.display = "none";
      }),
    );
  }

  drawCal();
  drawSlots();

  /* ---------------- validation ----------------
     On submit, not on keystroke. Nobody wants to be told their
     email is wrong while they are still typing it. */
  const mark = (id: string, bad: boolean) => {
    document.querySelector(`#${id}`)?.closest(".field")?.classList.toggle("bad", bad);
    return !bad;
  };

  function validate(): boolean {
    const val = (id: string) => ($<HTMLInputElement>(`#${id}`)?.value ?? "").trim();
    let ok = true;

    ok = mark("bName", !val("bName")) && ok;
    ok = mark("bPhone", val("bPhone").replace(/\D/g, "").length < 10) && ok;
    ok = mark("bEmail", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("bEmail"))) && ok;
    ok = mark("bPostcode", !val("bPostcode")) && ok;
    ok = mark("bAddress", !val("bAddress")) && ok;

    const ref = val("bRef").toUpperCase();
    ok = mark("bRef", !!ref && !/^QC-REF-[A-Z0-9]{4}$/.test(ref)) && ok;

    const dateOK = !!(selected && selectedSlot);
    const dateErr = $<HTMLElement>("#dateErr");
    if (dateErr) dateErr.style.display = dateOK ? "none" : "block";
    ok = dateOK && ok;

    const consentOK = !!$<HTMLInputElement>("#bConsent")?.checked;
    const consentErr = $<HTMLElement>("#consentErr");
    if (consentErr) consentErr.style.display = consentOK ? "none" : "block";
    ok = consentOK && ok;

    if (!ok) {
      // Put the first thing that needs fixing in the middle of the screen.
      const first =
        document.querySelector<HTMLElement>(".field.bad") ??
        (dateOK ? null : calRoot) ??
        $<HTMLElement>("#consentErr");
      first?.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" });
      first?.querySelector<HTMLElement>("input, button:not([disabled])")?.focus({ preventScroll: true });
    }
    return ok;
  }

  /* ---------------- submit ---------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = $<HTMLElement>("#bookError")!;
    errBox.style.display = "none";

    if (!validate()) return;

    const button = $<HTMLButtonElement>("#bookSubmit")!;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Booking…";

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ref?: string;
        referralCode?: string;
        error?: string;
        field?: string;
      };

      if (!res.ok || !data.ref) {
        if (data.field) mark(data.field, true);
        errBox.textContent =
          data.error ??
          "We couldn't get that booking through. Please ring the shop on 0121 423 3322 and we'll put you in the diary.";
        errBox.style.display = "flex";
        button.disabled = false;
        button.textContent = original;
        return;
      }

      showConfirmation(data.ref, data.referralCode ?? "", payload as Record<string, string>);
    } catch {
      errBox.textContent =
        "We couldn't reach the shop's system just now. Please ring 0121 423 3322 — we'll book you in over the phone.";
      errBox.style.display = "flex";
      button.disabled = false;
      button.textContent = original;
    }
  });

  /* ---------------- confirmation ---------------- */
  function showConfirmation(ref: string, referralCode: string, b: Record<string, string>) {
    const wrap = $<HTMLElement>("#bookWrap")!;
    const done = $<HTMLElement>("#bookDone")!;
    const address = `${b.address ?? ""}, ${(b.postcode ?? "").toUpperCase()}`;

    wrap.hidden = true;
    done.hidden = false;
    done.innerHTML = `
      <div class="confirm">
        <div class="top">
          <p style="font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase">Booked — nothing to pay</p>
          <p class="refbig">${esc(ref)}</p>
          <p style="font-size:.92rem;margin-top:8px;max-width:52ch">Quote this reference when you ring us, and we'll quote it back when we ring you.</p>
        </div>
        <div class="bd">
          <dl class="kv" style="margin-bottom:22px">
            <dt>Name</dt><dd>${esc(b.name ?? "")}</dd>
            <dt>Measuring</dt><dd>${esc(address)}</dd>
            <dt>When</dt><dd>${esc(longDate(b.date ?? ""))} · ${esc(slotLabel(b.slot ?? ""))}</dd>
            <dt>Phone</dt><dd class="mono">${esc(b.phone ?? "")}</dd>
            <dt>Email</dt><dd>${esc(b.email ?? "")}</dd>
            ${b.estimate ? `<dt>Estimate</dt><dd class="mono">${esc(b.estimate.toUpperCase())}</dd>` : ""}
            ${b.referral ? `<dt>Referral</dt><dd class="mono">${esc(b.referral.toUpperCase())} · 10% off fitting applied</dd>` : ""}
          </dl>

          <h2 style="font-size:clamp(1.15rem,1rem + .6vw,1.5rem);margin-bottom:10px">What happens next</h2>
          <div class="steps" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:24px">
            <div class="step"><span class="n">NEXT 01</span><h4>We ring you</h4><p>Within one working day, on ${esc(b.phone ?? "")}, to confirm the slot.</p></div>
            <div class="step"><span class="n">NEXT 02</span><h4>We measure</h4><p>Twenty minutes, no charge, no obligation. You get the exact figure in writing.</p></div>
            <div class="step"><span class="n">NEXT 03</span><h4>You choose in the shop</h4><p>Samples in your hand, final price agreed, payment taken at the counter — never online.</p></div>
          </div>

          ${
            referralCode
              ? `<div class="refcard">
                  <div style="flex:1;min-width:220px">
                    <h4 style="margin-bottom:6px">Your referral code</h4>
                    <p style="font-size:.9rem;color:var(--ink-2)">Give it to a friend: they get 10% off their fitting, you get 20% off your next one.</p>
                  </div>
                  <span class="refcode">${esc(referralCode)}</span>
                  <button class="btn sm" type="button" id="copyRef">Copy</button>
                </div>`
              : ""
          }

          <p style="margin-top:20px;font-size:.86rem;color:var(--muted)">
            Need to change it? Ring the shop on <a href="tel:01214233322">0121 423 3322</a> with your reference,
            or look it up at <a href="/booking/${encodeURIComponent(ref)}/">/booking/${esc(ref)}/</a>.
          </p>
        </div>
      </div>`;

    const copy = $<HTMLButtonElement>("#copyRef");
    copy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(referralCode);
        copy.textContent = "Copied";
      } catch {
        copy.textContent = referralCode;
      }
      window.setTimeout(() => (copy.textContent = "Copy"), 1800);
    });

    done.setAttribute("tabindex", "-1");
    done.focus();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* Carry the estimate code across from the estimator. */
  try {
    const stored = JSON.parse(sessionStorage.getItem("qc.estimate") ?? "null") as
      | { code?: string }
      | null;
    const est = $<HTMLInputElement>("#bEst");
    if (stored?.code && est && !est.value) est.value = stored.code;
  } catch {
    /* storage blocked — the customer can type the code in */
  }
}

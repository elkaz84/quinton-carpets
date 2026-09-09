/**
 * Two emails per booking: one to the shop with everything on one
 * screen, one to the customer with their reference and their code.
 *
 * If the mail provider is down the booking is still in D1 and the
 * customer still has their reference — a failed email must never
 * lose a booking.
 */

import type { Env } from "./env.ts";
import { longDate, slotLabel } from "../dates.ts";

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export interface BookingEmail {
  ref: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  date: string;
  slot: string;
  notes?: string;
  estimate?: string;
  referral?: string;
  referralCode: string;
}

async function send(env: Env, to: string, subject: string, html: string, replyTo?: string) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: "no API key configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM ?? "Quinton Carpets <bookings@quintoncarpets.co.uk>",
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  return { sent: res.ok, reason: res.ok ? "" : `${res.status} ${await res.text()}` };
}

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#F5F3EE;
  font-family:'Segoe UI',system-ui,sans-serif;color:#15120C;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#FFC61A;border:2px solid #15120C;border-radius:14px;padding:18px 22px;margin-bottom:18px">
      <strong style="font-size:1.1rem;letter-spacing:-.02em">QUINTON CARPETS</strong><br>
      <span style="font-size:.8rem">589–613 Hagley Road West, Birmingham B32 1BY · 0121 423 3322</span>
    </div>
    <div style="background:#FFFFFF;border:1px solid #DFDACE;border-radius:14px;padding:22px">${body}</div>
    <p style="font-size:.75rem;color:#7C7466;margin-top:16px">
      Guide prices are confirmed on the free measure. Payment is taken in the shop.
    </p>
  </div></body></html>`;

const row = (k: string, v: string) =>
  `<tr><td style="padding:5px 14px 5px 0;color:#7C7466;font-size:.85rem;vertical-align:top">${esc(k)}</td>
   <td style="padding:5px 0;font-weight:600">${esc(v)}</td></tr>`;

/** Everything the shop needs, without scrolling. Reference in the subject. */
export function shopEmail(env: Env, b: BookingEmail) {
  const html = shell(`
    <h2 style="margin:0 0 4px;font-size:1.15rem">New measure booked</h2>
    <p style="margin:0 0 16px;font-family:ui-monospace,monospace;font-size:1.3rem;letter-spacing:.04em">${esc(b.ref)}</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("When", `${longDate(b.date)} · ${slotLabel(b.slot)}`)}
      ${row("Name", b.name)}
      ${row("Phone", b.phone)}
      ${row("Email", b.email)}
      ${row("Address", `${b.address}, ${b.postcode}`)}
      ${b.estimate ? row("Estimate code", b.estimate) : ""}
      ${b.referral ? row("Referred by", `${b.referral} — 10% off their fitting`) : ""}
      ${row("Their new code", b.referralCode)}
      ${b.notes ? row("Notes", b.notes) : ""}
    </table>
    <p style="margin:18px 0 0;font-size:.9rem">Ring them back within one working day on
      <a href="tel:${esc(b.phone.replace(/\s/g, ""))}">${esc(b.phone)}</a>.</p>`);

  return send(
    env,
    env.SHOP_EMAIL ?? "quintoncarpets@gmail.com",
    `${b.ref} — measure booked, ${longDate(b.date)}, ${slotLabel(b.slot)}`,
    html,
    b.email,
  );
}

/** The customer's copy. Their reference, their slot, their code. */
export function customerEmail(env: Env, b: BookingEmail) {
  const html = shell(`
    <h2 style="margin:0 0 4px;font-size:1.15rem">Your free measure is booked, ${esc(b.name.split(" ")[0] ?? b.name)}</h2>
    <p style="margin:0 0 16px;font-family:ui-monospace,monospace;font-size:1.3rem;letter-spacing:.04em">${esc(b.ref)}</p>
    <p style="margin:0 0 16px">There is nothing to pay for the measure, and nothing to pay on the
      website at any point — you settle up in the shop once you've chosen.</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("When", `${longDate(b.date)} · ${slotLabel(b.slot)}`)}
      ${row("Where", `${b.address}, ${b.postcode}`)}
      ${row("We'll ring", b.phone)}
    </table>
    <p style="margin:18px 0 6px"><strong>What happens next.</strong> We ring you within one working
      day to confirm the slot. We measure up — twenty minutes, no obligation. Then you choose in
      the shop with the samples in your hand.</p>
    <div style="margin-top:18px;border:2px dashed #15120C;border-radius:12px;padding:16px;background:#F5F3EE">
      <p style="margin:0 0 6px;font-size:.85rem;color:#3E382D">Your referral code</p>
      <p style="margin:0;font-family:ui-monospace,monospace;font-size:1.4rem;letter-spacing:.08em">${esc(b.referralCode)}</p>
      <p style="margin:8px 0 0;font-size:.85rem;color:#3E382D">Give it to a friend: they get 10% off
        their fitting, and you get 20% off fitting on your next order once their job is paid.</p>
    </div>
    <p style="margin:18px 0 0;font-size:.85rem;color:#7C7466">Need to change it? Ring the shop on
      0121 423 3322 with your reference.</p>`);

  return send(env, b.email, `Your free measure — ${b.ref}`, html);
}

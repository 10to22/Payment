/* =========================================================================
   ORDER CONFIRMATION EMAIL — sent via Resend (https://resend.com)
   -------------------------------------------------------------------------
   Called from stripe-webhook.js (and replay-order.js) after a payment
   succeeds. Renders a Windows-XP-window-styled email in Tahoma — both
   email-safe fonts, so it looks right in Gmail/Outlook/Apple Mail without
   web fonts — listing the items, totals and the payment ref.

   Env vars:
     RESEND_API_KEY   from resend.com -> API Keys. If unset, sending is
                      skipped silently (the Stripe receipt still goes out).
     EMAIL_FROM       e.g. `10to2 <orders@10to2.net>`. Until you verify the
                      10to2.net domain in Resend (Domains -> Add -> add the
                      DNS records they show you), leave this unset and the
                      default resend.dev sender is used — note Resend only
                      delivers resend.dev mail to YOUR OWN account email,
                      so real customers need the domain verified.

   Email sending must never break fulfilment: callers should treat a
   failure here as log-and-continue.
   ========================================================================= */

const { CATALOG } = require("./_catalog");

const SUPPORT_EMAIL = "tt10to2tt@gmail.com";
const SITE = "https://10to2.net";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildOrderEmail(pi) {
  const m = pi.metadata || {};
  let items = [];
  try { items = JSON.parse(m.items || "[]"); } catch (e) { items = []; }

  const shipping = Number(m.shipping_cost || 0);
  const total = pi.amount != null ? pi.amount / 100 : Number(m.subtotal || 0) + shipping;

  const rows = items.map(it => {
    const entry = CATALOG[it.n];
    const line = entry ? "$" + entry.price * (it.q || 1) : "";
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #e3e8f2;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#1a1a1a;">' +
        esc(it.n) + (it.q > 1 ? " &times;" + it.q : "") + '</td>' +
      '<td align="right" style="padding:6px 10px;border-bottom:1px solid #e3e8f2;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#1a1a1a;">' + line + '</td>' +
    '</tr>';
  }).join("");

  const shipTo = [m.ship_name, m.ship_address,
    [m.ship_city, m.ship_state, m.ship_zip].filter(Boolean).join(", "), m.ship_country]
    .filter(Boolean).map(esc).join("<br>");

  const html =
'<div style="background:#3a6ea5;padding:24px 12px;">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;border:1px solid #0831d9;border-radius:8px 8px 3px 3px;background:#ece9d8;">' +
    /* XP titlebar */
    '<tr><td style="background:#245edb;border-radius:7px 7px 0 0;padding:7px 10px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-family:Tahoma,Verdana,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">10to2 &mdash; Order confirmed</td>' +
        '<td align="right" style="font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#bcd2f7;">_&nbsp;&nbsp;&#9633;&nbsp;&nbsp;&#10005;</td>' +
      '</tr></table>' +
    '</td></tr>' +
    /* body */
    '<tr><td style="padding:16px;">' +
      '<p style="margin:0 0 12px;font-family:Tahoma,Verdana,sans-serif;font-size:13px;color:#1a1a1a;"><b>Thanks &mdash; order placed.</b></p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid #c9d3e6;">' +
        rows +
        (shipping ? '<tr><td style="padding:6px 10px;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#4a5568;">Shipping</td>' +
          '<td align="right" style="padding:6px 10px;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#4a5568;">$' + shipping + '</td></tr>' : '') +
        '<tr><td style="padding:8px 10px;border-top:1px solid #c9d3e6;font-family:Tahoma,Verdana,sans-serif;font-size:13px;color:#1a1a1a;"><b>Total</b></td>' +
        '<td align="right" style="padding:8px 10px;border-top:1px solid #c9d3e6;font-family:Tahoma,Verdana,sans-serif;font-size:13px;color:#1a1a1a;"><b>$' + total + '</b></td></tr>' +
      '</table>' +
      (shipTo ? '<p style="margin:14px 0 0;font-family:Tahoma,Verdana,sans-serif;font-size:11.5px;color:#4a5568;"><b style="color:#1a1a1a;">Ships to</b><br>' + shipTo + '</p>' : '') +
      '<p style="margin:14px 0 0;font-family:Tahoma,Verdana,sans-serif;font-size:11.5px;color:#4a5568;">' +
        'Ref: <span style="font-family:\'Courier New\',Courier,monospace;color:#1a1a1a;">' + esc(pi.id) + '</span><br>' +
        'Keep the ref if anything goes sideways &mdash; replies and refund requests: ' +
        '<a href="mailto:' + SUPPORT_EMAIL + '" style="color:#1c46c9;">' + SUPPORT_EMAIL + '</a></p>' +
    '</td></tr>' +
    /* statusbar */
    '<tr><td style="border-top:1px solid #c9d3e6;padding:6px 10px;font-family:Tahoma,Verdana,sans-serif;font-size:10.5px;color:#6b7280;">' +
      'Sent by <a href="' + SITE + '" style="color:#1c46c9;">10to2.net</a> &mdash; a fully operational Windows XP desktop. Dig around.' +
    '</td></tr>' +
  '</table>' +
'</div>';

  const text =
    "10to2 — order confirmed\n\n" +
    items.map(it => {
      const entry = CATALOG[it.n];
      return "  " + it.n + (it.q > 1 ? " x" + it.q : "") + (entry ? " — $" + entry.price * (it.q || 1) : "");
    }).join("\n") +
    (shipping ? "\n  Shipping — $" + shipping : "") +
    "\n  Total: $" + total + "\n\n" +
    "Ref: " + pi.id + "\n" +
    "Questions or refunds: " + SUPPORT_EMAIL + "\n" + SITE + "\n";

  return { subject: "Order confirmed — 10to2", html, text };
}

async function sendOrderEmail(pi) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "RESEND_API_KEY not set" };
  const to = pi.receipt_email || (pi.metadata && pi.metadata.email);
  if (!to) return { skipped: "payment has no email" };

  const from = process.env.EMAIL_FROM || "10to2 <onboarding@resend.dev>";
  const { subject, html, text } = buildOrderEmail(pi);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error("Resend " + resp.status + ": " + JSON.stringify(data));
  return { sent: true, id: data.id, to };
}

/* ---- "Your order shipped" email (sent from api/printful-webhook.js) ---- */

function buildShippedEmail(order, shipment) {
  const name = (order.recipient && order.recipient.name) || "";
  const items = (order.items || []).map(i =>
    '<tr><td style="padding:6px 10px;border-bottom:1px solid #e3e8f2;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#1a1a1a;">' +
    esc(i.name) + (i.quantity > 1 ? " &times;" + i.quantity : "") + "</td></tr>").join("");
  const carrier = esc(shipment.carrier || "the carrier");
  const trackNo = esc(shipment.tracking_number || "");
  const trackUrl = shipment.tracking_url || "";

  const html =
'<div style="background:#3a6ea5;padding:24px 12px;">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;border:1px solid #0831d9;border-radius:8px 8px 3px 3px;background:#ece9d8;">' +
    '<tr><td style="background:#245edb;border-radius:7px 7px 0 0;padding:7px 10px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-family:Tahoma,Verdana,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">10to2 &mdash; Order shipped</td>' +
        '<td align="right" style="font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#bcd2f7;">_&nbsp;&nbsp;&#9633;&nbsp;&nbsp;&#10005;</td>' +
      '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:16px;">' +
      '<p style="margin:0 0 12px;font-family:Tahoma,Verdana,sans-serif;font-size:13px;color:#1a1a1a;"><b>' +
        (name ? esc(name) + " &mdash; y" : "Y") + 'our order is on the way.</b></p>' +
      (items ? '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid #c9d3e6;">' + items + '</table>' : '') +
      '<p style="margin:14px 0 0;font-family:Tahoma,Verdana,sans-serif;font-size:12px;color:#1a1a1a;">' +
        'Shipped via <b>' + carrier + '</b>' +
        (trackNo ? '<br>Tracking: <span style="font-family:\'Courier New\',Courier,monospace;">' + trackNo + '</span>' : '') +
        (trackUrl ? '<br><a href="' + trackUrl.replace(/"/g, "%22") + '" style="color:#1c46c9;">Track your package</a>' : '') + '</p>' +
      '<p style="margin:14px 0 0;font-family:Tahoma,Verdana,sans-serif;font-size:11.5px;color:#4a5568;">' +
        'Anything off when it arrives? <a href="mailto:' + SUPPORT_EMAIL + '" style="color:#1c46c9;">' + SUPPORT_EMAIL + '</a></p>' +
    '</td></tr>' +
    '<tr><td style="border-top:1px solid #c9d3e6;padding:6px 10px;font-family:Tahoma,Verdana,sans-serif;font-size:10.5px;color:#6b7280;">' +
      'Sent by <a href="' + SITE + '" style="color:#1c46c9;">10to2.net</a></td></tr>' +
  '</table>' +
'</div>';

  const text = "10to2 — order shipped\n\n" +
    (order.items || []).map(i => "  " + i.name + (i.quantity > 1 ? " x" + i.quantity : "")).join("\n") +
    "\n\nShipped via " + (shipment.carrier || "carrier") +
    (trackNo ? "\nTracking: " + shipment.tracking_number : "") +
    (trackUrl ? "\n" + trackUrl : "") +
    "\n\nQuestions: " + SUPPORT_EMAIL + "\n";

  return { subject: "Your 10to2 order shipped", html, text };
}

async function sendShippedEmail(order, shipment) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "RESEND_API_KEY not set" };
  const to = order.recipient && order.recipient.email;
  if (!to) return { skipped: "order has no email" };
  const from = process.env.EMAIL_FROM || "10to2 <onboarding@resend.dev>";
  const { subject, html, text } = buildShippedEmail(order, shipment);
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error("Resend " + resp.status + ": " + JSON.stringify(data));
  return { sent: true, id: data.id, to };
}

module.exports = { sendOrderEmail, buildOrderEmail, sendShippedEmail, buildShippedEmail };

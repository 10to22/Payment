/* =========================================================================
   POST /api/stripe-webhook
   -------------------------------------------------------------------------
   Stripe calls this after a payment. On `payment_intent.succeeded` we
   place the Printful order — this is the ONE source of truth that money
   actually changed hands, so the order is created here and nowhere else
   (never trust the browser to tell us a payment worked).

   Money flow reminder: the customer's card money lands in YOUR Stripe
   balance. Printful separately charges YOUR Printful payment method (card
   or Wallet — set one up at Printful → Billing) for the wholesale cost of
   each order this creates. Stripe and Printful never move money between
   each other; your margin is the difference.

   Env vars required:
     STRIPE_SECRET_KEY          sk_live_... (or sk_test_...)
     STRIPE_WEBHOOK_SECRET      whsec_...  (from the Stripe webhook you create)
     PRINTFUL_API_TOKEN         Bearer token from Printful → Settings → API
     PRINTFUL_STORE_ID          (only if your token spans multiple stores)
     PRINTFUL_CONFIRM_ORDERS    "true" to auto-submit for fulfilment,
                                anything else leaves each order as a draft
                                you approve by hand in Printful (safer while testing)

   IMPORTANT: this route must receive the RAW request body for Stripe's
   signature check, so it disables body parsing (see `config` at the end,
   Vercel/Next style). If your framework differs, feed the raw bytes to
   stripe.webhooks.constructEvent.
   ========================================================================= */

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { sendOrderEmail } = require("./_email");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function createPrintfulOrder(pi) {
  const m = pi.metadata || {};
  let fulfil;
  try { fulfil = JSON.parse(m.fulfil || "[]"); } catch { fulfil = []; }

  const items = fulfil
    .filter(l => l.v)                       // skip anything without a variant ID
    .map(l => ({
      /* Printful expects sync_variant_id as an integer; the catalog stores
         it as a string, so coerce numeric IDs (non-numeric pass through). */
      sync_variant_id: /^\d+$/.test(String(l.v)) ? Number(l.v) : l.v,
      quantity: l.q || 1,
    }));

  if (items.length === 0) {
    console.log("No Printful items in", pi.id, "- nothing to fulfil (e.g. CD-only order).");
    return;
  }

  const order = {
    external_id: pi.id,                     // makes the create idempotent-ish on Printful's side
    recipient: {
      name: m.ship_name,
      address1: m.ship_address,
      city: m.ship_city,
      state_code: m.ship_state || undefined,
      zip: m.ship_zip,
      country_code: m.ship_country,
      email: m.email,
    },
    items,
  };

  const base = "https://api.printful.com";
  const confirm = process.env.PRINTFUL_CONFIRM_ORDERS === "true";
  const url = base + "/orders" + (confirm ? "?confirm=1" : "");

  const headers = {
    "Authorization": "Bearer " + process.env.PRINTFUL_API_TOKEN,
    "Content-Type": "application/json",
  };
  if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(order) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("Printful order failed for", pi.id, resp.status, JSON.stringify(data));
    throw new Error("Printful " + resp.status);
  }
  console.log("Printful order created for", pi.id, "->", data.result && data.result.id);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature check failed:", err.message);
    return res.status(400).send("Bad signature");
  }

  if (event.type === "payment_intent.succeeded") {
    try {
      await createPrintfulOrder(event.data.object);
    } catch (err) {
      /* Return 500 so Stripe retries the webhook rather than dropping the
         order. Guard against duplicate orders via Printful's external_id. */
      console.error("Fulfilment error:", err.message);
      return res.status(500).send("Fulfilment failed, will retry");
    }
    /* Custom order-confirmation email. Only after fulfilment succeeded, so
       Stripe's retries can't mail the buyer twice for a failed order — and
       an email problem must never fail the webhook (fulfilment is done). */
    try {
      const r = await sendOrderEmail(event.data.object);
      console.log("Order email:", JSON.stringify(r));
    } catch (err) {
      console.error("Order email failed (fulfilment unaffected):", err.message);
    }
  }

  return res.status(200).json({ received: true });
};

/* Vercel / Next.js: keep the body raw for signature verification. */
module.exports.config = { api: { bodyParser: false } };

/* Shared with api/replay-order.js so a missed webhook can be replayed. */
module.exports.createPrintfulOrder = createPrintfulOrder;

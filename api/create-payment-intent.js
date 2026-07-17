/* =========================================================================
   POST /api/create-payment-intent
   -------------------------------------------------------------------------
   Called by the site's checkout. Re-prices the cart from the server-side
   catalog (never the browser's numbers), creates a Stripe PaymentIntent,
   and stashes everything the webhook needs to place the Printful order in
   the PaymentIntent's metadata. Returns { clientSecret } to the browser,
   which then confirms the card with Stripe.js.

   Env vars required:
     STRIPE_SECRET_KEY        sk_live_... (use sk_test_... while testing)
   ========================================================================= */

const Stripe = require("stripe");
const { priceOrder } = require("./_catalog");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* Lock this to your real site so random sites can't use your backend. */
const ALLOWED_ORIGIN = "https://10to2.net";

function setCors(res, origin) {
  const ok = origin === ALLOWED_ORIGIN || origin === "https://www.10to2.net";
  res.setHeader("Access-Control-Allow-Origin", ok ? origin : ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { items, email, shipping } = body;

    if (!email || !shipping || !shipping.name || !shipping.address) {
      return res.status(400).json({ error: "Missing email or shipping details" });
    }
    /* Printful needs a state code for these countries. */
    const country = (shipping.country || "").toUpperCase();
    if (["US", "CA", "AU"].includes(country) && !shipping.state) {
      return res.status(400).json({ error: "State/province required for " + country });
    }

    /* Trusted re-pricing. Throws on any item we don't sell. */
    const { lines, shipping: shipCost, subtotal, amountCents } = priceOrder(items, country);

    /* Compact payload for the webhook. Metadata values cap at 500 chars;
       a handful of lines fits fine. For very large carts, switch to a DB. */
    const fulfil = JSON.stringify(lines.map(l => ({ v: l.printfulVariantId, q: l.qty })));

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      metadata: {
        email,
        subtotal: String(subtotal),
        shipping_cost: String(shipCost),
        fulfil,                                   // [{v:variantId,q:qty}, ...]
        ship_name: shipping.name || "",
        ship_address: shipping.address || "",
        ship_city: shipping.city || "",
        ship_state: shipping.state || "",
        ship_zip: shipping.zip || "",
        ship_country: country,
      },
    });

    return res.status(200).json({ clientSecret: pi.client_secret });
  } catch (err) {
    console.error("create-payment-intent error:", err.message);
    /* Don't leak internals to the browser. */
    const msg = /Unknown item|Empty order|required/.test(err.message) ? err.message : "Could not start checkout";
    return res.status(400).json({ error: msg });
  }
};

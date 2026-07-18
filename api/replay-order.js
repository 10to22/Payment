/* =========================================================================
   GET /api/replay-order?pi=pi_...
   -------------------------------------------------------------------------
   Re-runs Printful fulfilment for a payment whose webhook never fired
   (e.g. the webhook endpoint didn't exist yet when the payment happened).
   Open it in a browser with the PaymentIntent id from Stripe:

     https://<this host>/api/replay-order?pi=pi_XXXXXXXXXXXX

   Safety:
   - The payment is fetched from Stripe server-side and must be
     `succeeded` — you can't fulfil an unpaid or failed intent.
   - Idempotent: if Printful already has an order with this payment's id
     (external_id), it reports that instead of creating a duplicate.
   - PaymentIntent ids are long random tokens, so only someone who
     already has the id (you, via the Stripe dashboard, or the buyer via
     their receipt) can trigger a replay — and all a replay can do is
     create the exact order that payment already paid for.
   ========================================================================= */

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { createPrintfulOrder } = require("./stripe-webhook.js");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  const q = req.query || {};
  const piId = (q.pi || "").trim();
  if (!/^pi_[A-Za-z0-9]+$/.test(piId)) {
    return res.status(400).json({ error: "Pass the PaymentIntent id as ?pi=pi_..." });
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ error: "Payment " + piId + " is '" + pi.status + "' — only succeeded payments can be fulfilled." });
    }

    let fulfil = [];
    try { fulfil = JSON.parse(pi.metadata.fulfil || "[]"); } catch (e) {}
    if (!fulfil.some(l => l.v)) {
      return res.status(200).json({ ok: true, nothing_to_fulfil: true,
        message: "This order has no Printful items (e.g. CD/poster only) — nothing to create." });
    }

    /* Already fulfilled? Printful lets us look an order up by external_id. */
    const headers = { Authorization: "Bearer " + process.env.PRINTFUL_API_TOKEN };
    if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
    const existing = await fetch("https://api.printful.com/orders/@" + piId, { headers });
    if (existing.ok) {
      const d = await existing.json().catch(() => ({}));
      return res.status(200).json({ already_fulfilled: true,
        printful_order_id: d.result && d.result.id,
        printful_status: d.result && d.result.status,
        message: "Printful already has this order — no duplicate created." });
    }

    await createPrintfulOrder(pi);
    return res.status(200).json({ ok: true,
      message: "Printful order created for " + piId + ". Check Printful -> Orders" +
        (process.env.PRINTFUL_CONFIRM_ORDERS === "true" ? "." : " — it's a draft; approve it there to ship.") });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

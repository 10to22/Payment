/* =========================================================================
   POST /api/printful-webhook — Printful calls this when things happen to
   your orders. On "package_shipped" we email the buyer their tracking
   info (XP-styled, via Resend — same pipeline as the order confirmation).

   ONE-TIME SETUP:
   1. Pick a long random secret, set it in Vercel as PRINTFUL_WEBHOOK_KEY
      (Printful doesn't sign webhooks, so the secret lives in the URL —
      only someone who knows it can hit this endpoint).
   2. Printful dashboard -> Settings -> (your store) -> Webhooks:
        URL:   https://payment-swart-psi.vercel.app/api/printful-webhook?key=THE_SECRET
        Event: tick "Package shipped".
      (Or via API: POST https://api.printful.com/webhooks with
       {"url":"...?key=THE_SECRET","types":["package_shipped"]}.)
   3. Ship something (or use Printful's sample-event button) and watch
      Vercel logs for "Shipped email:".

   Other event types are acknowledged and ignored, so it's safe to tick
   more events later without breaking anything.
   ========================================================================= */

const { sendShippedEmail } = require("./_email");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  /* Shared-secret check (skipped only if you never set the env var). */
  const expected = process.env.PRINTFUL_WEBHOOK_KEY;
  if (expected) {
    const url = new URL(req.url, "https://x");
    if (url.searchParams.get("key") !== expected) {
      console.error("printful-webhook: bad key");
      return res.status(401).json({ error: "bad key" });
    }
  }

  let event;
  try {
    const raw = await readRawBody(req);
    event = JSON.parse(raw.toString() || "{}");
  } catch (e) {
    return res.status(400).json({ error: "bad body" });
  }

  if (event.type === "package_shipped") {
    const order = (event.data && event.data.order) || {};
    const shipment = (event.data && event.data.shipment) || {};
    try {
      const r = await sendShippedEmail(order, shipment);
      console.log("Shipped email:", JSON.stringify(r), "order", order.external_id || order.id);
    } catch (err) {
      /* Log and still 200 — Printful retries on non-200 and we don't want
         repeat emails for a transient Resend hiccup on their schedule. */
      console.error("Shipped email failed:", err.message);
    }
  }

  return res.status(200).json({ received: true });
};

/* Raw body (no framework parsing) keeps this endpoint self-contained. */
module.exports.config = { api: { bodyParser: false } };

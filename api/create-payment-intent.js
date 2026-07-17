// Vercel serverless function.
// Deployed, this file automatically becomes:  https://<your-project>.vercel.app/api/create-payment-intent
//
// This is the ONE endpoint the site's checkout calls. It never sees your
// Stripe secret key directly on the client -- that key lives only here,
// on the server, as an environment variable.

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// IMPORTANT: prices here must match your real prices, in cents. Never
// trust a price sent from the browser -- someone could open devtools and
// send { price: 1 } for a $25 shirt. Always recompute the charge amount
// from your own known prices, keyed however makes sense for you (name is
// fine to start; a stable product id is better once you have one).
const PRICES_CENTS = {
  "Whoareyou? - CD single": 800,
  "10to2 - logo tee (black) (M)": 2500,
  "Ifwecrash - poster 18x24": 1200,
  "One2many - cassette": 1400,
  "sticker pack (4)": 500,
  "unreleased_demos.zip": 0
};

module.exports = async (req, res) => {
  // Allow the actual site to call this from a different domain.
  // Once you know your final domain, replace "*" with it, e.g.
  // res.setHeader("Access-Control-Allow-Origin", "https://10to2.net");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const { items, email, shipping } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "No items in order." });
      return;
    }

    // Recompute the total server-side from PRICES_CENTS, not from req body.
    let amount = 0;
    for (const item of items) {
      const cents = PRICES_CENTS[item.name];
      if (cents === undefined) {
        res.status(400).json({ error: "Unknown item: " + item.name });
        return;
      }
      amount += cents;
    }

    if (amount <= 0) {
      res.status(400).json({ error: "Order total must be greater than zero." });
      return;
    }

    // Stash everything the fulfillment webhook will need later. Metadata
    // values must be strings, so the item list is JSON-stringified.
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      receipt_email: email,
      metadata: {
        email: email || "",
        shipping_name: shipping?.name || "",
        shipping_address: shipping?.address || "",
        shipping_city: shipping?.city || "",
        shipping_zip: shipping?.zip || "",
        shipping_country: shipping?.country || "",
        items: JSON.stringify(items.map(i => ({ name: i.name, printfulVariantId: i.printfulVariantId })))
      }
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating the payment." });
  }
};

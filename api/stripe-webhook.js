// Vercel serverless function.
// Deployed, this becomes:  https://<your-project>.vercel.app/api/stripe-webhook
//
// This is the piece that actually places the Printful order. It only runs
// after Stripe confirms a payment really succeeded (verified via signature,
// not just trusted because a browser said so) -- that's why this lives in
// a webhook instead of being called directly from the checkout page.

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe signs the raw request body -- if Vercel parses it into JSON first,
// the signature won't match anymore. This turns parsing off so we can read
// the untouched raw bytes ourselves below.
function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = await buffer(req);
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature didn't match -- this request either isn't really from
    // Stripe, or the webhook secret below is wrong. Reject it either way.
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ error: "Invalid signature: " + err.message });
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const meta = intent.metadata || {};

    let items = [];
    try { items = JSON.parse(meta.items || "[]"); } catch (e) { /* leave items empty */ }

    // Only items that actually have a Printful variant ID get fulfilled
    // this way -- e.g. "unreleased_demos.zip" has no physical product, so
    // it's correctly skipped here.
    const printfulItems = items
      .filter((i) => i.printfulVariantId)
      .map((i) => ({ sync_variant_id: Number(i.printfulVariantId), quantity: 1 }));

    if (printfulItems.length > 0) {
      try {
        const printfulRes = await fetch("https://api.printful.com/orders", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + process.env.PRINTFUL_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            recipient: {
              name: meta.shipping_name,
              address1: meta.shipping_address,
              city: meta.shipping_city,
              zip: meta.shipping_zip,
              country_code: meta.shipping_country,
              email: meta.email
            },
            items: printfulItems
          })
        });

        const printfulData = await printfulRes.json();
        if (!printfulRes.ok) {
          // Order creation failed on Printful's end -- logged here so you
          // can see it in Vercel's function logs and fulfill manually if
          // needed. Nothing more to do automatically; Stripe already has
          // the customer's money and the order details are safely in this
          // event's metadata regardless.
          console.error("Printful order failed:", printfulData);
        } else {
          console.log("Printful order created:", printfulData.result && printfulData.result.id);
        }
      } catch (err) {
        console.error("Error creating Printful order:", err);
      }
    }
  }

  // Always acknowledge receipt to Stripe quickly, whether or not the
  // Printful call above succeeded -- Stripe just needs to know the event
  // arrived, and retries deliveries that don't get a 200 back.
  res.status(200).json({ received: true });
}

// This is the Vercel/Next.js convention for turning off automatic body
// parsing on this one function -- see the comment on `buffer()` above.
handler.config = {
  api: { bodyParser: false }
};

module.exports = handler;

/* =========================================================================
   GET /api/health — configuration self-check (safe to leave deployed)
   -------------------------------------------------------------------------
   Open https://payment-swart-psi.vercel.app/api/health in a browser after
   deploying. It reports WHICH pieces are configured — never the values —
   so you can see at a glance why an order didn't reach Printful:

     stripe_secret_key      false -> checkout can't create charges at all
     stripe_webhook_secret  false -> the webhook rejects every Stripe call,
                                     so paid orders never reach Printful
     printful_api_token     false -> the webhook can't create Printful orders
     printful_reachable     false -> token set but Printful rejected it
                                     (bad token, or no payment method on file)

   If everything here is true and orders still don't appear, the missing
   piece is on the Stripe side: Dashboard -> Developers -> Webhooks needs
   an endpoint for https://<this host>/api/stripe-webhook with the
   payment_intent.succeeded event — check its "Recent deliveries" there.
   ========================================================================= */

module.exports = async (req, res) => {
  const out = {
    stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
    stripe_secret_key_mode: process.env.STRIPE_SECRET_KEY
      ? (process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live"
        : process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") ? "test" : "unrecognized")
      : null,
    stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
    printful_api_token: !!process.env.PRINTFUL_API_TOKEN,
    printful_store_id_set: !!process.env.PRINTFUL_STORE_ID,
    printful_confirm_orders: process.env.PRINTFUL_CONFIRM_ORDERS === "true",
    printful_reachable: null,
    /* Custom order-confirmation email (optional — Stripe receipts are
       separate). false = the XP-styled email is skipped, nothing breaks. */
    resend_api_key: !!process.env.RESEND_API_KEY,
    email_from_set: !!process.env.EMAIL_FROM,
  };

  /* Live check: can the token actually talk to Printful? Read-only call. */
  if (out.printful_api_token) {
    try {
      const headers = { Authorization: "Bearer " + process.env.PRINTFUL_API_TOKEN };
      if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
      const r = await fetch("https://api.printful.com/store/products?limit=1", { headers });
      out.printful_reachable = r.ok;
      if (!r.ok) out.printful_error = "Printful answered HTTP " + r.status;
    } catch (e) {
      out.printful_reachable = false;
      out.printful_error = e.message;
    }
  }

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(out);
};

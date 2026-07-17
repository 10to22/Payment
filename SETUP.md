# 10to2 payment backend — setup

Drop these into your `10to22/Payment` repo (keep the `api/` folder — Vercel
serves each file there as a serverless function at `/api/<name>`). The site
already calls `POST /api/create-payment-intent`; you're adding the missing
half — the webhook that actually places the Printful order.

```
api/
  _catalog.js               server-side prices + Printful variant IDs (source of truth)
  create-payment-intent.js  re-prices the cart, makes the Stripe PaymentIntent
  stripe-webhook.js         on payment success, creates the Printful order
.env.example
package.json
```

## One-time setup

1. **Install deps / deploy.** `npm install`, push to the repo Vercel builds
   (`payment-swart-psi.vercel.app`). Set the env vars from `.env.example` in
   Vercel → Settings → Environment Variables (Production).

2. **Printful billing.** Printful → Billing → add a card or top up the Wallet.
   Without this, orders can't be charged to you and won't ship.

3. **Printful API token.** Printful → Settings → Stores → API (or Developers).
   Put it in `PRINTFUL_API_TOKEN`. Leave `PRINTFUL_CONFIRM_ORDERS` unset at
   first so orders arrive as drafts you approve by hand.

4. **Stripe webhook.** Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://payment-swart-psi.vercel.app/api/stripe-webhook`
   - Event: `payment_intent.succeeded`
   - Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

5. **Confirm the Printful ID format** (the one thing I couldn't verify blind).
   The IDs in `_catalog.js` are the dashboard hash IDs. Place one real test
   order (step below). If Printful returns a 422 on the variant, fetch numeric
   `sync_variant_id`s via `GET https://api.printful.com/store/products/{id}`
   and paste those into `_catalog.js`. Everything else stays the same.

## Test it before going live

- Set Stripe keys to **test mode** (`sk_test_`, and a test-mode webhook `whsec_`).
- On 10to2.net, buy the tee with card `4242 4242 4242 4242`, any future expiry/CVC.
- Check: Stripe shows a succeeded test PaymentIntent → the webhook logs
  "Printful order created" (Vercel → Logs) → a draft order appears in Printful
  with the right size and address.
- Then flip all keys to live and (optionally) set `PRINTFUL_CONFIRM_ORDERS=true`.

## Why prices are re-computed server-side

`create-payment-intent.js` ignores the prices the browser sends and rebuilds
the amount from `_catalog.js`. Otherwise anyone could edit the price in dev
tools and check out for a penny. Keep `_catalog.js` prices and the shipping
rates in sync with `MERCH` / `BACKEND_CONFIG.shipping` in the site's index.html.

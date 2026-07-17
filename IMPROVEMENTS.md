# 10to2.net — site & store improvements

One document for everything: what's been fixed, what you still have to plug in,
and what's worth doing next. Compiled July 2026.

---

## 1. Fixed and live in this repo

### Merch / Printful / checkout
- **Product-page links work.** Set `url` on any `MERCH` item (a Printful
  "buy now" or Shopify product URL) and the CD Wizard's Write button sends the
  buyer there — Printful/Shopify then handle sizes, shipping and payment on
  their hosted page. One linked item opens directly; several show a dialog of
  links. Items without a `url` use the built-in Stripe checkout.
- **Sizes are real.** The tee uses `variants` — one Printful `sync_variant_id`
  per size (S–XL). Buyers pick a size in the CD Wizard; the chosen size's
  variant ID is what the backend receives. The Administrator panel has one ID
  field per size.
- **Quantities.** x1–x5 per item; copies consume disc space so the 700MB gag
  doubles as a quantity cap. Sent to the backend as `qty` with line totals.
- **Shipping is charged.** `BACKEND_CONFIG.shipping` (flat: $5 US / $12
  international — tune these). Shown in the summary, follows the country
  dropdown live, and is appended as a "Shipping" line item.
- **Proper shipping address.** State field (required for US/CA/AU — Printful
  needs `state_code`), country is an ISO-code dropdown instead of free text.
- **$0 orders blocked.** The free demos zip can't reach checkout; it points
  fans at the mailing list instead.
- **Order receipt.** Successful payment shows an XP dialog with line items,
  total, the PaymentIntent ref and the buyer's email; the form and card field
  reset. A refund/contact line sits under the Pay button.
- **Admin panel honesty.** It now says edits are per-tab previews; permanent
  values go in the `MERCH` array in index.html.

### Mailing list
- **Signups actually send.** Messenger and the mobile Join button POST to
  `MAILING_LIST_CONFIG.endpoint` (top of the "everything you'd actually edit"
  section). Works with Formspree, Buttondown, Mailchimp, Google Forms, or any
  endpoint accepting a form POST with an `email` field.
- **No more fake success.** While the endpoint is `""`, Messenger says the
  list is down and gives your contact email; mobile opens a prefilled email.

### Performance / polish
- **Page went from 12.9MB to ~1.2MB.** The six embedded songs are now real
  files in `assets/audio/` loaded on demand. Player, downloads, recycle-bin
  demos and the vault track all verified working.
- **Social preview image 556KB → 89KB** (`preview.jpg`; the old PNG is kept so
  previously shared links don't break).
- **`404.html`** — wrong URLs get a themed blue-screen that bounces to the
  desktop. **`.nojekyll`** — GitHub Pages serves `assets/` without a Jekyll
  build. **`theme-color`** meta for mobile browser chrome.
- **Chatroom hardened.** Nicknames/messages are HTML-escaped before rendering.
  Same-device BroadcastChannel makes this low-stakes today, but it becomes a
  stored-XSS hole the day the chat gets a real backend — now it's safe either
  way. External profile links open with `noopener`.
- **Reduced motion respected** — the flying-covers screensaver stays off for
  users whose OS asks for less motion.

---

## 2. Your setup checklist (nothing works without these)

1. **Mailing list (~2 min).** Create a free form at formspree.io → paste its
   URL into `MAILING_LIST_CONFIG.endpoint`. Done. (Or Buttondown if you want
   to send actual newsletters: `https://buttondown.com/api/emails/embed-subscribe/YOU`.)
2. **Printful IDs / product links.** For each `MERCH` item either paste a
   Printful/Shopify product URL into `url` (easiest — their checkout handles
   everything), or fill `printfulVariantId` (per size for the tee) for the
   built-in checkout. IDs are in the Printful dashboard under each product's
   variant, or `GET /store/products` on their API.
3. **Shipping rates.** Check `BACKEND_CONFIG.shipping` ($5/$12 defaults)
   against Printful's real postage for your catalog so orders don't cost you.
4. **One rehearsal order.** Swap `stripePublishableKey` to your `pk_test_...`,
   buy the tee with card `4242 4242 4242 4242`, confirm the Printful draft
   order and the receipt email arrive, then put the live key back. The live
   key is in the file today — real cards get charged until you do this.

## 3. Backend to-dos (payment-swart-psi.vercel.app — separate repo)

- **Never trust prices from the browser.** The request body's `price` values
  are display-only; keep a server-side price table keyed by name/variant ID
  and build the PaymentIntent amount from it. Right now dev-tools can buy a
  tee for $0.01 if the server sums the client's numbers.
- **Create the Printful order from the `payment_intent.succeeded` webhook**,
  using `printfulVariantId`, `qty`, and the address (incl. `state`) that the
  page now sends — not from the browser's say-so.
- **Mirror the shipping flat rates** so the charged total always matches the
  summary the buyer saw.
- **Send a confirmation email** (the receipt dialog promises one).

## 4. Worth doing next (roughly in order of payoff)

- **Real cross-device chatroom.** The transport is cleanly isolated — swap
  BroadcastChannel for Supabase Realtime (free tier) or Firebase and the
  #10to2-fans room becomes real. Rendering is already XSS-safe.
- **Analytics.** One script tag (GoatCounter or Plausible, both free/cheap,
  no cookie banner needed) tells you whether people open the CD Wizard,
  Messenger, or bounce at the boot screen.
- **Apple Pay / Google Pay** via Stripe's Payment Request Button — one extra
  element in the checkout window, big conversion win on phones.
- **Webhook-driven "order shipped" emails** from Printful's webhooks.
- **Limited-edition counters** — the cassette says "Limited to 100"; a tiny
  backend counter could show "23 left" and enforce it.
- **Accessibility pass** — window titlebars/buttons as real `<button>`s with
  aria-labels, focus trapping in dialogs, keyboard window switching.
- **Album art extraction** — the remaining ~1MB of inline images could move to
  `assets/art/` like the audio did, if first paint ever feels slow.

## 5. Known quirks (deliberate, documented so nobody "fixes" them)

- Admin password (`letmein`) and the vault passphrase are visible in source —
  they gate easter eggs, not security.
- Admin-panel merch edits are per-tab previews by design; the file is the
  source of truth.
- The locked vault track is a plain file in `assets/audio/` — the lock is a
  game, not DRM.

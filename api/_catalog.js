/* =========================================================================
   SERVER-SIDE SOURCE OF TRUTH
   -------------------------------------------------------------------------
   The browser sends prices in its request, but you must NEVER trust them —
   anyone can edit them in dev tools and buy a $25 shirt for $0.01. This
   file is the only place prices come from. The frontend's numbers are
   display-only; the server re-derives every amount from here.

   Each key is the EXACT item name the frontend sends. For the tee, the
   frontend appends the size in parentheses (e.g. "10to2 - logo tee
   (black) (M)"), so every size is its own line here.

   `printfulVariantId` is what gets sent to Printful to fulfil the line.

   ⚠️  ID FORMAT — CONFIRM THIS BEFORE GOING LIVE:
   The IDs below are the hash-style IDs from your Printful dashboard
   (e.g. 6a587ae3aa45a7). Printful's classic Orders API
   (POST https://api.printful.com/orders) expects a NUMERIC
   `sync_variant_id` (e.g. 4487693012). Two possibilities:
     • If these hashes are v2 IDs, use the v2 endpoint (see stripe-webhook.js).
     • Otherwise fetch the numeric sync_variant_id for each size once via
       GET https://api.printful.com/store/products/{id} and paste those
       numbers in below. Everything else works unchanged either way.
   ========================================================================= */

const CATALOG = {
  "Whoareyou? - CD single":          { price: 8,  printfulVariantId: "" },

  "10to2 - logo tee (black) (S)":    { price: 25, printfulVariantId: "6a587ae3aa4569" },
  "10to2 - logo tee (black) (M)":    { price: 25, printfulVariantId: "6a587ae3aa45a7" },
  "10to2 - logo tee (black) (L)":    { price: 25, printfulVariantId: "6a587ae3aa45c5" },
  "10to2 - logo tee (black) (XL)":   { price: 25, printfulVariantId: "6a587ae3aa45d5" },
  "10to2 - logo tee (black) (2XL)":  { price: 25, printfulVariantId: "6a587ae3aa45f8" },
  "10to2 - logo tee (black) (3XL)":  { price: 25, printfulVariantId: "6a587ae3aa4608" },
  "10to2 - logo tee (black) (4XL)":  { price: 25, printfulVariantId: "6a587ae3aa4625" },
  "10to2 - logo tee (black) (5XL)":  { price: 25, printfulVariantId: "6a587ae3aa4648" },

  "Ifwecrash - poster 18x24":        { price: 12, printfulVariantId: "" },
  "One2many - cassette":             { price: 14, printfulVariantId: "" },
  "sticker pack (4)":                { price: 5,  printfulVariantId: "" },
  "10to2 - wall flag":               { price: 26, printfulVariantId: "6a587b3c453ab3" },
};

/* Must match BACKEND_CONFIG.shipping in the site's index.html. */
const SHIPPING = { us: 5, international: 12 };

function shippingFor(country) {
  return (country || "").toUpperCase() === "US" ? SHIPPING.us : SHIPPING.international;
}

/* Rebuild the order from trusted data. Returns { lines, amountCents } or
   throws if the client sent an item we don't sell. `clientItems` is the
   array the browser posted (name/qty per line); we ignore its prices. */
function priceOrder(clientItems, country) {
  const lines = [];
  let subtotal = 0;
  for (const it of clientItems || []) {
    if (it.name === "Shipping") continue;               // added server-side below
    const entry = CATALOG[it.name];
    if (!entry) throw new Error("Unknown item: " + it.name);
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    subtotal += entry.price * qty;
    lines.push({ name: it.name, qty, printfulVariantId: entry.printfulVariantId });
  }
  if (lines.length === 0) throw new Error("Empty order");
  const shipping = shippingFor(country);
  const amountCents = Math.round((subtotal + shipping) * 100);
  return { lines, shipping, subtotal, amountCents };
}

module.exports = { CATALOG, SHIPPING, shippingFor, priceOrder };

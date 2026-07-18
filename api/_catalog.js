/* =========================================================================
   SERVER-SIDE SOURCE OF TRUTH
   -------------------------------------------------------------------------
   The browser sends prices in its request, but you must NEVER trust them —
   anyone can edit them in dev tools and buy a $25 shirt for $0.01. This
   file is the only place prices come from. The frontend's numbers are
   display-only; the server re-derives every amount from here.

   Each key is the EXACT item name the frontend sends. For sized items,
   the frontend appends the size in parentheses (e.g. "10to2 - logo tee
   (white) (M)"), so every size is its own line here.

   `printfulVariantId` is what gets sent to Printful to fulfil the line.

   ID FORMAT: the values below are the NUMERIC Printful `sync_variant_id`s
   (e.g. 5396150185) that the classic Orders API
   (POST https://api.printful.com/orders) expects — pulled straight from
   GET /store/products/{id} (the `id` field of each sync_variant). If you
   add products later, use api/printful-variants.js to read the new numeric
   IDs; do NOT paste the dashboard hash IDs (those are the `external_id`).
   ========================================================================= */

const CATALOG = {
  "Whoareyou? - CD single":          { price: 8,  printfulVariantId: "" },

  "10to2 - logo tee (white) (S)":    { price: 25, printfulVariantId: "5396150185" },
  "10to2 - logo tee (white) (M)":    { price: 25, printfulVariantId: "5396150186" },
  "10to2 - logo tee (white) (L)":    { price: 25, printfulVariantId: "5396150187" },
  "10to2 - logo tee (white) (XL)":   { price: 25, printfulVariantId: "5396150188" },
  "10to2 - logo tee (white) (2XL)":  { price: 25, printfulVariantId: "5396150189" },
  "10to2 - logo tee (white) (3XL)":  { price: 25, printfulVariantId: "5396150190" },
  "10to2 - logo tee (white) (4XL)":  { price: 25, printfulVariantId: "5396150191" },
  "10to2 - logo tee (white) (5XL)":  { price: 25, printfulVariantId: "5396150192" },

  "10to2 - zip hoodie (S)":          { price: 40, printfulVariantId: "5396152424" },
  "10to2 - zip hoodie (M)":          { price: 40, printfulVariantId: "5396152425" },
  "10to2 - zip hoodie (L)":          { price: 40, printfulVariantId: "5396152426" },
  "10to2 - zip hoodie (XL)":         { price: 40, printfulVariantId: "5396152427" },
  "10to2 - zip hoodie (2XL)":        { price: 40, printfulVariantId: "5396152428" },
  "10to2 - zip hoodie (3XL)":        { price: 40, printfulVariantId: "5396152429" },

  /* Jersey scales with size — must match the per-variant prices in
     index.html's MERCH array. */
  "10to2 - jersey (2XS)":            { price: 40, printfulVariantId: "5396150016" },
  "10to2 - jersey (XS)":             { price: 40, printfulVariantId: "5396150017" },
  "10to2 - jersey (S)":              { price: 40, printfulVariantId: "5396150018" },
  "10to2 - jersey (M)":              { price: 40, printfulVariantId: "5396150019" },
  "10to2 - jersey (L)":              { price: 40, printfulVariantId: "5396150020" },
  "10to2 - jersey (XL)":             { price: 40, printfulVariantId: "5396150021" },
  "10to2 - jersey (2XL)":            { price: 42, printfulVariantId: "5396150022" },
  "10to2 - jersey (3XL)":            { price: 44, printfulVariantId: "5396150023" },
  "10to2 - jersey (4XL)":            { price: 46, printfulVariantId: "5396150024" },
  "10to2 - jersey (5XL)":            { price: 46, printfulVariantId: "5396150025" },
  "10to2 - jersey (6XL)":            { price: 46, printfulVariantId: "5396150026" },

  "Ifwecrash - poster 18x24":        { price: 12, printfulVariantId: "" },
  "One2many - cassette":             { price: 14, printfulVariantId: "" },
  "sticker pack (4)":                { price: 5,  printfulVariantId: "" },
  "10to2 - wall flag":               { price: 26, printfulVariantId: "5396151473" },
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

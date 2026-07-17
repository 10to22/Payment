/* =========================================================================
   GET /api/printful-variants   (optional helper — delete after you've used it)
   -------------------------------------------------------------------------
   Lists every product in your Printful store with its variants, so you can
   confirm which ID belongs in _catalog.js WITHOUT curl or jq. Open
   https://payment-swart-psi.vercel.app/api/printful-variants in a browser.

   For each variant it shows:
     id          <- the NUMERIC sync_variant_id the Orders API wants
     external_id <- the hash-style ID from the dashboard (e.g. 6a587ae3aa45a7)
     size        <- which size this is (S/M/L/...)
   If your _catalog.js hashes appear under `external_id`, put the matching
   numeric `id` into _catalog.js instead.

   This calls the Printful API with your secret token (kept server-side —
   only IDs are returned to the browser, never the token). It's read-only,
   but delete the file once you've grabbed the IDs so it isn't left open.

   Env: PRINTFUL_API_TOKEN (and PRINTFUL_STORE_ID if your token spans stores)
   ========================================================================= */

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) return res.status(500).json({ error: "PRINTFUL_API_TOKEN is not set in Vercel env vars" });

  const headers = { "Authorization": "Bearer " + token };
  if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;

  try {
    const list = await fetch("https://api.printful.com/store/products", { headers }).then(r => r.json());
    if (list.error) return res.status(502).json({ error: "Printful: " + JSON.stringify(list.error) });

    const out = [];
    for (const p of (list.result || [])) {
      const detail = await fetch("https://api.printful.com/store/products/" + p.id, { headers }).then(r => r.json());
      out.push({
        product: p.name,
        product_id: p.id,
        variants: (detail.result && detail.result.sync_variants || []).map(v => ({
          id: v.id,                 // numeric sync_variant_id  ->  goes in _catalog.js
          size: v.size,
          name: v.name,
          external_id: v.external_id, // hash-style dashboard id
          catalog_variant_id: v.variant_id,
        })),
      });
    }
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

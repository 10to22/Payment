/* =========================================================================
   GET /api/printful-setup-webhook?key=<PRINTFUL_WEBHOOK_KEY>
   -------------------------------------------------------------------------
   One-visit setup for the "package shipped" tracking emails — because
   Printful's dashboard often has no webhook UI (it's API-only for many
   accounts). This registers the webhook for you using the server-side
   PRINTFUL_API_TOKEN, pointing Printful at /api/printful-webhook with
   your secret baked into the URL.

   Usage (in a browser):
     ...?key=SECRET            show current config, then register/refresh
     ...?key=SECRET&action=show     just show what's registered
     ...?key=SECRET&action=disable  remove the webhook

   Requires PRINTFUL_WEBHOOK_KEY to be set — the same secret both guards
   this endpoint and ends up inside the registered webhook URL. Safe to
   leave deployed; without the secret it only ever answers 401.
   ========================================================================= */

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  const secret = process.env.PRINTFUL_WEBHOOK_KEY;
  if (!secret) {
    return res.status(500).json({ error: "Set PRINTFUL_WEBHOOK_KEY in Vercel env vars first, then redeploy." });
  }
  const url = new URL(req.url, "https://x");
  if (url.searchParams.get("key") !== secret) {
    return res.status(401).json({ error: "bad key" });
  }
  if (!process.env.PRINTFUL_API_TOKEN) {
    return res.status(500).json({ error: "PRINTFUL_API_TOKEN is not set." });
  }

  const headers = {
    "Authorization": "Bearer " + process.env.PRINTFUL_API_TOKEN,
    "Content-Type": "application/json",
  };
  if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;

  const action = url.searchParams.get("action") || "register";

  try {
    const current = await fetch("https://api.printful.com/webhooks", { headers }).then(r => r.json());

    if (action === "show") {
      return res.status(200).json({ current: current.result || current });
    }
    if (action === "disable") {
      const del = await fetch("https://api.printful.com/webhooks", { method: "DELETE", headers }).then(r => r.json());
      return res.status(200).json({ disabled: true, printful_said: del.result || del });
    }

    /* Register (or refresh) the shipped-package webhook. */
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const hookUrl = "https://" + host + "/api/printful-webhook?key=" + secret;
    const set = await fetch("https://api.printful.com/webhooks", {
      method: "POST",
      headers,
      body: JSON.stringify({ url: hookUrl, types: ["package_shipped"] }),
    });
    const data = await set.json().catch(() => ({}));
    if (!set.ok) {
      return res.status(502).json({ error: "Printful refused: HTTP " + set.status, printful_said: data });
    }
    return res.status(200).json({
      ok: true,
      message: "Webhook registered — buyers now get a tracking email when Printful ships their package.",
      was: current.result || null,
      now: data.result || data,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

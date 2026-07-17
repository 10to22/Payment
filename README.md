# 10to2 backend — getting a real apiBaseUrl

This is the smallest possible backend: one file, one job (create a Stripe
PaymentIntent). Deploying it on Vercel gives you a real URL in about
10 minutes, no server to manage.

## 1. Get a Stripe secret key

Stripe dashboard → Developers → API keys → reveal the **secret** key
(starts with `sk_test_...` for now, matching your test publishable key).
This is different from the `pk_test_...` key already in the site — the
secret one must NEVER go in the site's HTML, in a public GitHub repo, or
anywhere a browser can see it. It only goes in Vercel's environment
variables (step 4).

## 2. Put this project in its own GitHub repo

Separate from your site's repo is simplest. In this folder:

```
git init
git add .
git commit -m "backend starter"
```

Then create a new (can be private) repo on GitHub and push to it.

## 3. Deploy on Vercel

- Sign up at vercel.com with your GitHub account.
- "Add New Project" → pick this repo → Deploy.
- Vercel detects the `api/` folder automatically; no build config needed.

## 4. Add your secret key as an environment variable

In the Vercel project → Settings → Environment Variables:

```
STRIPE_SECRET_KEY = sk_test_...your real secret key...
```

Redeploy after adding it (Vercel will prompt you, or Deployments → ⋯ → Redeploy).

## 5. Get your URL

Vercel gives you something like:

```
https://10to2-backend.vercel.app
```

Your endpoint is now live at:

```
https://10to2-backend.vercel.app/api/create-payment-intent
```

In the site's `BACKEND_CONFIG`, set:

```js
apiBaseUrl: "https://10to2-backend.vercel.app/api"
```

(Note: `apiBaseUrl` + `/create-payment-intent` is what the site calls, so
apiBaseUrl should end in `/api`, matching the folder name here.)

## 6. (Optional) Point api.10to2.net at it instead

Vercel project → Settings → Domains → add `api.10to2.net` → it gives you
a DNS record (usually a CNAME) to add at your domain registrar. Once that
propagates, use `https://api.10to2.net/api` as `apiBaseUrl` instead.

## 7. Test it

Stripe's test cards work immediately with your test key — no real money
moves. Try `4242 4242 4242 4242`, any future expiry, any 3-digit CVC.

## Before going live for real

- Swap `sk_test_...` for `sk_live_...` in Vercel's environment variable,
  and the site's `pk_test_...` for `pk_live_...`.
- Set up the `payment_intent.succeeded` webhook (Stripe dashboard →
  Developers → Webhooks) pointing at a new endpoint here that actually
  places the Printful order — that's the next piece to build once this
  is confirmed working end to end.

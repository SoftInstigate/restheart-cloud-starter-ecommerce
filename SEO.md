# SEO — Ecommerce starter

How this shop gets a title, a price and a picture under a search result or a pasted link, given
that it is a single-page app.

## What sets the metadata

`src/seo.ts` has two functions:

- `applySeo()` — title, description, canonical and Open Graph tags for a page. Every page calls it.
- `productJsonLd()` — schema.org `Product` structured data for a product page. This is what puts a
  price and a stock status under a Google result.

Both write into the live document, which is enough for Google — it runs JavaScript — and not
enough for anything else. Read on.

## The problem a SPA has

The HTML the server sends is an empty shell. Everything real happens afterwards, in the browser.

Google renders JavaScript and sees the finished page. **Link preview crawlers do not** — Slack,
WhatsApp, X, LinkedIn, iMessage read the HTML as delivered and stop. A product link pasted into a
chat shows whatever `index.html` says, which is the shop's generic title, for every product.

## The answer: one file per product

`scripts/prerender.mjs` runs after `vite build`. It reads the catalogue from the service and
writes `dist/product/<id>/index.html` for every product: the same app, with that product's title,
description, image and structured data already in the `<head>`. It also writes `sitemap.xml` and
`robots.txt`, since by then it has the list of URLs anyway.

```bash
SHOP_API_URL=https://xxxxxx.eu-central-1-free-1.restheart.com \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
npm run build
```

Without those two variables the script **skips itself and says so** — building without a service
has to keep working.

### Everyone gets the same file

This is worth being precise about, because it sounds like two different sites and is not.

`GET /product/mug-enamel` returns `dist/product/mug-enamel/index.html` to whoever asked.

- A **crawler** reads the `<head>`, finds that product's metadata, and for link previews stops there.
- A **browser** loads the same file, the JS starts, the router sees `/product/mug-enamel`, and the
  page fetches live data — price, stock, variants. The body is replaced.

Same bytes, prefilled `<head>`, body taken over by the app. Serving crawlers something different
from users is cloaking and is against Google's rules; this is not that.

The sitemap delivers nothing. It is a list telling crawlers which URLs exist.

### They are shells, not rendered pages

Rendering the React tree at build time would need a DOM and a second rendering path to maintain.
Substituting the `<head>` needs neither. The crawler gets the metadata it came for, and the
browser runs the app exactly as before.

## Keeping them fresh

The prerendered `<head>` is a snapshot. A price that changes after the build stays wrong in the
crawler's copy until the next one.

**Nobody's customer sees that.** A human gets the SPA, which asks the service and shows the price
current to the second. The stale copy is only ever read by a crawler.

So the bar is not "correct now", it is "not months old" — and a crawler revisits a small shop
daily or weekly. **Once a day covers it**, plus a manual run after a price change worth
announcing.

### Refreshing without a rebuild

The script reads one thing out of `dist`: `index.html`. That file changes when the *app* changes,
not when a price does. So `SHOP_SHELL=remote` takes it from the deployed site instead, and a
scheduled refresh needs no `npm install` and no `vite build`:

```bash
SHOP_SHELL=remote \
SHOP_API_URL=https://xxxxxx.eu-central-1-free-1.restheart.com \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
node scripts/prerender.mjs
```

A few seconds, then upload `dist/product/` and `sitemap.xml`.

On a host with scheduled builds (Netlify, Vercel) a cron on the build hook does it. On S3 or
similar, a cron job that runs the above and syncs the two paths.

## A worked example: S3 and CloudFront

Netlify and Vercel need no explanation — a build hook on a cron, and they already serve a real
file before falling back. S3 is the one where every piece has to be put there deliberately, so
here it is end to end.

### Serving the pages

The prerender writes `product/<id>/index.html`, but the canonical URL it puts in the page and in
the sitemap is `/product/<id>` — no trailing slash. Those have to be the same URL, so the request
for the extensionless path must serve that file **without redirecting**.

The plain S3 website endpoint will not do it: it answers `/product/mug-enamel` with a 302 to
`/product/mug-enamel/`, and now the address that gets crawled is not the address the page declares
as canonical. Use CloudFront with a private bucket (OAC) and a **CloudFront Function** on
viewer-request:

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // "/product/mug-enamel" -> the file that was generated for it.
  if (uri.charAt(uri.length - 1) === '/') request.uri = uri + 'index.html';
  else if (uri.lastIndexOf('.') <= uri.lastIndexOf('/')) request.uri = uri + '/index.html';

  return request;
}
```

Then add the SPA fallback as **custom error responses**: 403 and 404 → `/index.html`, response
code 200. Order matters and comes out right on its own — the function rewrites first, so a real
generated file is found and served, and the fallback only fires for paths that genuinely have no
file, which is exactly what client-side routing needs.

Get this backwards — no function, just the error-response fallback — and every product URL 404s at
the origin and comes back as the generic shell. **The shop keeps working**, so nothing tells you.
That is the case the `curl` below is for.

### Publishing

Two passes, because the two kinds of file want opposite caching:

```bash
BUCKET=my-shop
DISTRIBUTION=E1234567890ABC

# Hashed asset filenames: cache forever.
aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*.html" --exclude "sitemap.xml" --exclude "robots.txt" \
  --cache-control "public,max-age=31536000,immutable"

# The pages: short, or a refresh is invisible until the TTL expires.
aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*" --include "*.html" --include "sitemap.xml" --include "robots.txt" \
  --cache-control "public,max-age=300"
```

### The daily refresh

This is the standalone run — no build, so `dist/` holds **only** the prerender's output:

```bash
#!/bin/sh
set -e

export SHOP_SHELL=remote
export SHOP_API_URL=https://xxxxxx.eu-central-1-free-1.restheart.com
export SHOP_PUBLIC_URL=https://ilmionegozio.com

node scripts/prerender.mjs

aws s3 sync dist/product/ s3://$BUCKET/product/ --delete \
  --cache-control "public,max-age=300"
aws s3 cp dist/sitemap.xml s3://$BUCKET/sitemap.xml --cache-control "public,max-age=300"

aws cloudfront create-invalidation --distribution-id $DISTRIBUTION \
  --paths "/product/*" "/sitemap.xml"
```

Two things in there are load-bearing:

**`--delete` is scoped to `product/`.** Pointing it at the bucket root from this `dist` would
delete the entire application — the JavaScript, the CSS, `index.html` — because a run without a
build never wrote them. The publishing script above and this one are not interchangeable.

**The invalidation.** Without it CloudFront keeps serving the copy it cached, and the refresh
reaches nobody until the TTL runs out. `/product/*` counts as one path, and the first 1,000 a
month are free.

Put it on a schedule that suits the catalogue — daily is plenty, for the reasons above.

## Check it actually reaches the browser

Most SPA hosts have a catch-all rewrite — *anything → /index.html* — so client-side routing works
on a refresh. **If that rule wins, the generated files are never served**, and nothing looks
broken: users see the same working shop, and only the previews stay generic.

Netlify and Vercel try the real file before the fallback, so they are fine. A hand-rolled S3 or
nginx configuration may not be.

```bash
curl -s https://ilmionegozio.com/product/mug-enamel | grep '<title>'
```

The product's name means it works. The shop's generic title means the rewrite is eating the pages.

## The limit that remains

For a catalogue that changes hourly, snapshots are the wrong tool and the answer is server-side
rendering. The Angular starter has it through Angular's SSR router. This one is Vite, and does not.

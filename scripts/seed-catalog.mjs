#!/usr/bin/env node
/**
 * Seeds the catalog collection with a few demo products.
 *
 * The shop pages are only as testable as the catalog behind them, and a fresh
 * service starts empty. Run this once against a service that has the `stripe`
 * plugin enabled:
 *
 *   RH_API_URL=https://xxx.restheart.com \
 *   RH_ADMIN_PASSWORD=secret \
 *   node scripts/seed-catalog.mjs
 *
 * Re-running is safe: each product is PUT at a known `_id`, so the second run
 * overwrites rather than duplicating.
 *
 * ── Field names are the server's, not the kit's ──────────────────────────────
 * `CatalogReader` validates the stored document in **snake_case**
 * (`unit_amount`, `image_url`), and rejects the item outright if a required one
 * is missing or the wrong type. The order request body is the other way round —
 * `items: [{ productId, quantity }]` in camelCase. That asymmetry is real; do
 * not "fix" it here.
 *
 * `unit_amount` is written as `$numberInt` on purpose: `CatalogReader` refuses
 * a non-integer amount ("refusing to sell it"), and a bare JSON number is not
 * guaranteed to land as an Int32.
 */

const API_URL = process.env.RH_API_URL;
const ADMIN_USER = process.env.RH_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.RH_ADMIN_PASSWORD;
const COLLECTION = process.env.RH_CATALOG_COLLECTION ?? 'catalog';

if (!API_URL || !ADMIN_PASSWORD) {
  console.error(
    'Missing configuration.\n\n' +
      '  RH_API_URL=https://xxx.restheart.com \\\n' +
      '  RH_ADMIN_PASSWORD=secret \\\n' +
      '  node scripts/seed-catalog.mjs\n\n' +
      'Optional: RH_ADMIN_USER (default "admin"), RH_CATALOG_COLLECTION (default "catalog").'
  );
  process.exit(1);
}

/** Amounts are in the currency's minor unit — 1990 is €19.90. */
const money = (minorUnits) => ({ $numberInt: String(minorUnits) });

const PRODUCTS = [
  {
    _id: 'tee-classic',
    type: 'physical',
    name: 'Classic T-shirt',
    description: 'Heavyweight cotton, unisex fit.',
    image_url: 'https://placehold.co/600x600/1f2937/ffffff?text=T-shirt',
    unit_amount: money(2500),
    currency: 'eur',
    purchasable: true,
  },
  {
    _id: 'mug-enamel',
    type: 'physical',
    name: 'Enamel mug',
    description: 'Holds 350ml of anything hot.',
    image_url: 'https://placehold.co/600x600/0f766e/ffffff?text=Mug',
    unit_amount: money(1450),
    currency: 'eur',
    purchasable: true,
  },
  {
    _id: 'stickers-pack',
    type: 'physical',
    name: 'Sticker pack',
    description: 'Twelve die-cut vinyl stickers.',
    image_url: 'https://placehold.co/600x600/7c3aed/ffffff?text=Stickers',
    unit_amount: money(600),
    currency: 'eur',
    purchasable: true,
  },
  {
    _id: 'guide-pdf',
    type: 'digital',
    name: 'The RESTHeart guide (PDF)',
    description: 'Downloadable, 180 pages.',
    image_url: 'https://placehold.co/600x600/b45309/ffffff?text=Guide',
    unit_amount: money(1990),
    currency: 'eur',
    purchasable: true,
  },
  {
    // Deliberately not for sale: proves the shop filters on `purchasable`
    // instead of showing everything the collection happens to hold.
    _id: 'hoodie-soldout',
    type: 'physical',
    name: 'Hoodie (sold out)',
    description: 'Out of stock — listed but not purchasable.',
    image_url: 'https://placehold.co/600x600/475569/ffffff?text=Hoodie',
    unit_amount: money(5900),
    currency: 'eur',
    purchasable: false,
  },
];

const auth = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`).toString('base64');
const base = API_URL.replace(/\/$/, '');

async function request(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: auth,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function main() {
  console.log(`Seeding "${COLLECTION}" on ${base}\n`);

  // PUT on the collection is idempotent: it creates it, or leaves it alone.
  const created = await request('PUT', `/${COLLECTION}`, {});
  if (!created.ok && created.status !== 409) {
    console.error(`Could not create collection "${COLLECTION}" (${created.status})`);
    console.error(created.text);
    console.error(
      '\nIf this is a 401/403, the admin credentials are wrong. If it is a 404, check RH_API_URL.'
    );
    process.exit(1);
  }

  let failed = 0;
  for (const product of PRODUCTS) {
    const { _id, ...doc } = product;
    const res = await request('PUT', `/${COLLECTION}/${encodeURIComponent(_id)}`, doc);
    if (res.ok) {
      const amount = Number(product.unit_amount.$numberInt) / 100;
      const flag = product.purchasable ? '' : '  (not purchasable)';
      console.log(`  ✓ ${_id.padEnd(18)} €${amount.toFixed(2)}${flag}`);
    } else {
      failed++;
      console.error(`  ✗ ${_id} — ${res.status} ${res.text}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} product(s) failed.`);
    process.exit(1);
  }

  console.log(
    `\nDone — ${PRODUCTS.length} products, ${PRODUCTS.filter(p => p.purchasable).length} purchasable.`
  );
  console.log(
    'The shop reads this collection anonymously, so the service ACL must allow a\n' +
      `GET on /${COLLECTION} for unauthenticated users — otherwise the shop page is empty.`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

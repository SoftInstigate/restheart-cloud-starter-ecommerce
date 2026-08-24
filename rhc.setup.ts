/**
 * What this shop needs from its RESTHeart Cloud service.
 *
 * The Open points section of the README used to be a checklist: three settings
 * that "have to line up or the flow breaks in ways that are not obvious from
 * the client". A checklist is performed by hand, once, and nothing checks it
 * afterwards. This is the same knowledge as code — runnable, re-runnable, and
 * diffable when it changes.
 *
 *   npx @restheart-cloud/cli setup --srv <srvId>
 *   npx @restheart-cloud/cli setup --srv <srvId> --dry-run
 *
 * Every step is a `check` and an `apply`: run it against a configured service
 * and it writes nothing and reports each step satisfied. `--dry-run` runs the
 * checks only, which is the honest answer to "what is this service missing".
 *
 * Secrets are named, not held. `fromEnv` resolves at apply time and only when
 * the value is not already stored, so a re-run against a configured service
 * needs no secrets in the environment at all.
 */
import { defineSetup, step, fromEnv, isRedacted } from '@restheart-cloud/cli';
import type { PluginConfig } from '@restheart-cloud/cli';

/** Where this shop is served from, no trailing slash. */
const APP_ORIGIN = process.env.SHOP_ORIGIN ?? 'http://localhost:5173';

/** Must match `catalogCollection` / `ordersCollection` in src/environments. */
const CATALOG = 'catalog';
const ORDERS = 'orders';

const origin = APP_ORIGIN.replace(/\/$/, '');

// Stripe substitutes only {CHECKOUT_SESSION_ID}; RESTHeart's plugin also
// interpolates {ORDER_ID} and {ORDER_SECRET}. They go in the **fragment** so the
// secret never reaches a server log or a Referer header — OrderReturn.tsx reads
// it with readOrderRef() and strips it from the address bar at once.
const SUCCESS_URL = `${origin}/shop/order#order={ORDER_ID}&secret={ORDER_SECRET}`;
const CANCEL_URL = `${origin}/shop/cart`;

/** A stored secret reads back as bullets; one that was never set reads back blank. */
const configured = (value: unknown) =>
  isRedacted(value) || (typeof value === 'string' && value.length > 0);

const products = (config: PluginConfig): PluginConfig =>
  (config['products'] as PluginConfig | undefined) ?? {};

/**
 * A few demo products, so the shop has something to show.
 *
 * Lifted from `scripts/seed-catalog.mjs`, which this step replaces. That script
 * needed `RH_API_URL` and the service's **root password**; a setup step needs
 * neither, because `service` arrives already authenticated with the JWT `rhc`
 * mints for itself. One manual step fewer, and one password fewer.
 *
 * ── Field names are the server's, not the kit's ──────────────────────────────
 * `CatalogReader` validates the stored document in **snake_case**
 * (`unit_amount`, `image_url`) and rejects the item outright if a required one
 * is missing or the wrong type. The order request body is the other way round —
 * `items: [{ productId, quantity }]` in camelCase. That asymmetry is real; do
 * not "fix" it here.
 *
 * `unit_amount` is written as `$numberInt` on purpose: `CatalogReader` refuses a
 * non-integer amount, and a bare JSON number is not guaranteed to land as an
 * Int32.
 */
const money = (minorUnits: number) => ({ $numberInt: String(minorUnits) });

const DEMO_PRODUCTS = [
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

export default defineSetup('Ecommerce', [
  step('stripe plugin installed', {
    check: ({ admin, srvId }) => admin.isPluginInstalled(srvId, 'stripe'),
    apply: ({ admin, srvId }) => admin.installPlugin(srvId, 'stripe'),
  }),

  step('stripe products mode configured', {
    async check({ admin, srvId }) {
      const config = await admin.getPluginConfig(srvId, 'stripe');
      const p = products(config);
      return (
        p['enabled'] === true &&
        p['success-url'] === SUCCESS_URL &&
        p['cancel-url'] === CANCEL_URL &&
        p['catalog-collection'] === CATALOG &&
        p['orders-collection'] === ORDERS &&
        configured(config['secret-key']) &&
        configured(config['webhook-secret'])
      );
    },
    async apply({ admin, srvId }) {
      const current = await admin.getPluginConfig(srvId, 'stripe');
      // Read-modify-write with the redaction placeholders passed straight back:
      // the server replaces the whole document and restores the stored value for
      // any field still holding one. Diffing or stripping "empty-looking" fields
      // here would write bullets over the real Stripe key.
      // No `enabled` here: it is not a field of the plugin's config schema, and
      // enabling lives on the plugin document rather than inside its config —
      // `installPlugin` already set it. Writing one here stored a key that did
      // nothing and read, to anyone opening the config, as the switch.
      await admin.updatePluginConfig(srvId, 'stripe', {
        ...current,
        'secret-key': configured(current['secret-key'])
          ? current['secret-key']
          : fromEnv('STRIPE_SECRET_KEY'),
        'webhook-secret': configured(current['webhook-secret'])
          ? current['webhook-secret']
          : fromEnv('STRIPE_WEBHOOK_SECRET'),
        products: {
          ...products(current),
          enabled: true,
          'catalog-collection': CATALOG,
          'orders-collection': ORDERS,
          'default-currency': 'eur',
          'success-url': SUCCESS_URL,
          'cancel-url': CANCEL_URL,
        },
      });
    },
  }),

  step('stripe collections and indexes initialised', {
    // The initializer creates catalog, orders, transactions, their indexes and
    // the order schema, and never overwrites what is already there. Asking
    // whether the collections exist is the honest check for "did it run".
    check: async ({ service }) =>
      (await service.collectionExists(ORDERS)) &&
      (await service.collectionExists('transactions')),
    apply: ({ admin, srvId }) => admin.initPlugin(srvId, 'stripe', 'products'),
  }),

  step('guests may read the catalog', {
    // Missing, this shows up as an empty shop with no error — which is why the
    // README had to warn about it in the first place.
    check: ({ service }) => service.permissionExists('catalog-read-anon'),
    apply: ({ service }) =>
      service.putPermission('catalog-read-anon', {
        predicate: `(path(/${CATALOG}) or path-template('/${CATALOG}/{docid}')) and method(GET)`,
        roles: ['$unauthenticated'],
        priority: 100,
        // Only what is for sale. A catalog document is public the moment this
        // rule exists, so a draft product must not be readable by omission.
        mongo: { readFilter: { purchasable: true } },
      }),
  }),

  step('guests may place an order', {
    check: ({ service }) => service.permissionExists('orders-create-anon'),
    apply: ({ service }) =>
      service.putPermission('orders-create-anon', {
        // POST only, deliberately: with PATCH a buyer could set their own order
        // to `status: "paid"`.
        predicate: `path(/${ORDERS}) and method(POST)`,
        roles: ['$unauthenticated'],
        priority: 100,
      }),
  }),

  step('guests may read back the order they placed', {
    // The setting the README's table of three does not list. Without it the
    // buyer pays, lands on /shop/order, and is answered 401 by the page whose
    // whole job is to reassure them the money went somewhere.
    check: ({ service }) => service.permissionExists('orders-read-anon'),
    apply: ({ service }) =>
      service.putPermission('orders-read-anon', {
        predicate: `path-template('/${ORDERS}/{id}') and method(GET)`,
        roles: ['$unauthenticated'],
        priority: 100,
        // The secret createOrder returned is what proves ownership — a guest
        // has no session for the server to recognise them by.
        mongo: { readFilter: { secret: "@qparams['secret']" } },
      }),
  }),

  step('sample catalog, if the shop is empty', {
    /**
     * The only step here that writes **content** rather than configuration, and
     * the check says so: it asks whether the catalog holds anything at all, not
     * whether these five products are present as written.
     *
     * That difference is the whole design. Checking for the exact products would
     * mean a demo price you edited is overwritten on the next run, and a
     * pipeline re-running the setup on every merge would reset a real shop to
     * fake data for ever. Checking for emptiness seeds once and then never
     * touches the collection again.
     *
     * Delete this step when the shop becomes yours. Configuration you want
     * reapplied every time; content you do not.
     */
    async check({ service }) {
      if (!(await service.collectionExists(CATALOG))) return false;
      const res = await service.fetch(`/${CATALOG}?pagesize=1`);
      return ((await res.json()) as unknown[]).length > 0;
    },
    async apply({ service }) {
      if (!(await service.collectionExists(CATALOG))) {
        await service.createCollection(CATALOG);
      }
      for (const product of DEMO_PRODUCTS) {
        const { _id, ...doc } = product;
        // wm=upsert so a half-finished seed can simply be run again.
        await service.fetch(`/${CATALOG}/${encodeURIComponent(_id)}?wm=upsert`, {
          method: 'PUT',
          body: JSON.stringify(doc),
        });
      }
    },
  }),
]);

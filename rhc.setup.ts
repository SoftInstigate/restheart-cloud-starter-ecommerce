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
      await admin.updatePluginConfig(srvId, 'stripe', {
        ...current,
        enabled: true,
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
]);

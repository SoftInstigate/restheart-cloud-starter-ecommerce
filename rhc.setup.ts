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
const SUCCESS_URL = `${origin}/order#order={ORDER_ID}&secret={ORDER_SECRET}`;
const CANCEL_URL = `${origin}/cart`;

/** A stored secret reads back as bullets; one that was never set reads back blank. */
const configured = (value: unknown) =>
  isRedacted(value) || (typeof value === 'string' && value.length > 0);

/**
 * The value to write for a secret: the environment variable when it is set,
 * otherwise whatever the service already holds.
 *
 * **The variable wins, and that is the point.** Keeping the stored value blindly
 * makes a secret impossible to *change* from here: any non-empty string counts
 * as configured, including a stale placeholder, so exporting the right key and
 * re-running does nothing and reports the step satisfied. Which is exactly how
 * `sk_test_dummy_for_karate`, left by a test, survived a setup run.
 *
 * Not exporting it stays safe, which is what the guard was for: a re-run against
 * a configured service still needs no secrets in the environment.
 *
 * Reading `process.env` directly rather than through `fromEnv` because this has
 * to *ask whether* the variable is set, and `fromEnv` answers that by throwing.
 * The marker is still what gets returned, so the value itself is resolved as
 * late as ever — on the way to the wire, and nowhere else.
 */
/**
 * Secrets this run has already pushed from the environment.
 *
 * Needed because "the variable wins" is an instruction, and a `check` asks about
 * a *state*. The state it would want — "the stored secret equals the one in the
 * environment" — cannot be read: the server returns bullets. So the check asks
 * the closest true question instead: has the value the environment names already
 * been written, in this run?
 *
 * Without it the check stays false for as long as the variable is exported, the
 * re-check after the apply fails too, and every CI run — where the variables are
 * always set — ends in a red step that actually succeeded.
 */
const pushed = new Set<string>();

const wantsReplacing = (name: string) => {
  const v = process.env[name];
  return v !== undefined && v !== '' && !pushed.has(name);
};

const secret = (name: string, stored: unknown) => {
  const fromEnvironment = process.env[name];
  if (fromEnvironment !== undefined && fromEnvironment !== '') {
    pushed.add(name);
    return fromEnv(name);
  }
  if (configured(stored)) return stored;
  return fromEnv(name);
};

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

/**
 * Bump these when you publish new documents, and re-run the setup. Every user
 * meets the form again on their next request; the acceptance they already gave
 * stays in the `consents` history.
 */
const TOS_VERSION = '2026-07-01';
const PP_VERSION = '2026-07-01';

const SCHEMA_ID = 'userConsentsSchema';
const RULE_ID = 'consentsGate';
const PERMISSION_ID = 'userCanPatchOwnConsents';

/** Both versions, as the permission stamps them and the rule compares them. */
const accepted = { tos: TOS_VERSION, pp: PP_VERSION, acceptedAt: '@now' };

/**
 * The user document's shape, with the two consent fields.
 *
 * Note `_$date` with the underscore: `acceptedAt` is a BSON date, and the type
 * keys are escaped inside a *schema* document so the parser does not read them
 * as values while the schema is being stored. Declared as a plain string,
 * every acceptance is rejected.
 *
 * Note also what is **not** required. The document is validated as it is
 * inserted, before the initial team is attached, so a schema demanding
 * `latestConsents`, `consents` or the team fields rejects every registration.
 *
 * One consequence to know before it surprises you: `_id` **is** required, and on
 * a `PUT /users/{id}` it arrives in the path rather than the body, so a direct
 * write is refused with `required key [_id] not found`. Registration through
 * `/auth/register` sends a whole document and passes. It means `createUser` from
 * a setup file, and hand-made users generally, need the id in the body too.
 */
const USER_SCHEMA = {
  title: 'User with consents',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['_id', 'password', 'roles', 'profile'],
  properties: {
    _id: { type: 'string' },
    _etag: { type: 'object' },
    password: { type: 'string' },
    roles: { type: 'array', items: { type: 'string' } },
    profile: {
      type: 'object',
      required: ['name', 'surname'],
      properties: {
        name: { type: 'string' },
        surname: { type: 'string' },
        avatarUrl: { type: 'string' },
      },
    },
    latestConsents: {
      type: 'object',
      properties: {
        tos: { type: 'string' },
        pp: { type: 'string' },
        acceptedAt: { type: 'object', properties: { _$date: { type: 'number' } } },
      },
      required: ['tos', 'pp'],
    },
    consents: { type: 'array' },
    socialAuths: { type: 'array' },
    teams: { type: 'array' },
    team: { type: 'object' },
  },
};

/**
 * Blocked when *either* acceptance is missing — `not (A and B)`, never
 * `not A and not B`, which would block only the users who accepted neither.
 *
 * The two path exclusions are not decoration: without them a blocked user
 * cannot get a token or sign in, and that includes you. The third exemption is
 * the acceptance itself, which is made *while still blocked*.
 *
 * `/users/me` is deliberately **not** excluded. Blocking it is what makes the
 * gate work with no probing on the client's side: reading the user document is
 * the first thing any app does.
 *
 * Anonymous callers are excluded with `@roles`, not by naming every public path.
 * The list version had to be kept complete by hand and was invisible until it
 * was wrong — twice, on one service.
 */
const CONDITION = [
  // Nobody signed in, nothing to guard. This one line replaces a list of every
  // public path, which had to be remembered and was invisible until it was
  // wrong — it missed a shop's catalogue, so anonymous visitors were shown a
  // consents form they could not complete, and then /stripe/webhook, so
  // customers paid and their orders never moved.
  //
  // `@roles` is a RESTHeart 9.8 built-in and carries `$unauthenticated` when
  // there is no account, the same name the ACL uses.
  "not in(value='$unauthenticated', array=@roles)",

  // Still needed, and not about anonymity: signing in and fetching a token are
  // authenticated requests made by someone who has not accepted yet. Guard
  // those and a blocked user cannot get back in — you included.
  "not path-prefix('/auth')",
  "not path-prefix('/token')",

  // The acceptance itself, made while still blocked.
  "not (method(PATCH) and path-template('/users/{userId}') and bson-request-whitelist(consents))",

  `not (equals(@user.latestConsents.tos, '${TOS_VERSION}') and equals(@user.latestConsents.pp, '${PP_VERSION}'))`,
].join(' and ');

const CLAIMS = ['latestConsents/tos', 'latestConsents/pp'];

const rules = (config: PluginConfig): unknown[] =>
  (config['rules'] as unknown[] | undefined) ?? [];

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
        configured(config['webhook-secret']) &&
        // A secret named in the environment is one you are asking to be written,
        // so the step is not satisfied until it has been. Without this the apply
        // above would never run: the check would pass on the old value.
        !wantsReplacing('STRIPE_SECRET_KEY') &&
        !wantsReplacing('STRIPE_WEBHOOK_SECRET')
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
        'secret-key': secret('STRIPE_SECRET_KEY', current['secret-key']),
        'webhook-secret': secret('STRIPE_WEBHOOK_SECRET', current['webhook-secret']),
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
    // buyer pays, lands on /order, and is answered 401 by the page whose
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

  step('user schema stored', {
    check: ({ service }) => service.schemaExists(SCHEMA_ID),
    apply: ({ service }) => service.putSchema(SCHEMA_ID, USER_SCHEMA),
  }),

  step('users collection validated by it', {
    async check({ service }) {
      // `/users` lists the documents; the collection's own properties are at
      // `/users/_meta`. Reading the first and looking for `jsonSchema` finds
      // nothing, for ever, however many times the apply succeeds.
      const res = await service.fetch('/users/_meta');
      const meta = (await res.json()) as { jsonSchema?: { schemaId?: string } };
      return meta.jsonSchema?.schemaId === SCHEMA_ID;
    },
    apply: ({ service }) =>
      service.fetch('/users', {
        method: 'PATCH',
        body: JSON.stringify({ jsonSchema: { schemaId: SCHEMA_ID } }),
      }),
  }),

  step('the acceptance is permitted, and nothing else is', {
    // Without this the acceptance is a 403 and the user is locked out for good:
    // nothing authorises PATCH /users/{userId} out of the box, and a guard
    // never gets a say on a request the ACL already refused.
    check: ({ service }) => service.permissionExists(PERMISSION_ID),
    apply: ({ service }) =>
      service.putPermission(PERMISSION_ID, {
        predicate:
          "path-template('/users/{userId}') and method(PATCH) and " +
          '(equals(@user._id, ${userId}) or equals(@user.sub, ${userId})) and ' +
          'bson-request-whitelist(consents)',
        roles: ['user'],
        priority: 1,
        mongo: {
          // The server decides what is accepted. The client sends
          // `{"consents": []}` and states nothing — otherwise it could accept
          // terms it was never shown, or backdate the acceptance.
          //
          // `latestConsents` is a nested object, never dotted keys: a request
          // that sets both a field and a path inside it is refused by MongoDB
          // with `ConflictingUpdateOperators`.
          mergeRequest: {
            latestConsents: accepted,
            // `$push` escaped, and unescaped before the merge. It grows the
            // history instead of overwriting it.
            _$push: { consents: accepted },
          },
        },
      }),
  }),

  step('the two claims travel in the token', {
    // The guard reads the token, not the database. A missing claim compares
    // false for every token-authenticated user for ever — including the ones
    // who just accepted — and blocks them permanently while the condition looks
    // perfectly reasonable.
    //
    // Only these two. A JWT payload is base64, not encrypted, so everything in
    // it is readable by anyone holding the token; the `consents` history in
    // particular grows at every acceptance and no decision reads it.
    async check({ admin, srvId }) {
      const res = await admin.fetch(`/auth-config/${encodeURIComponent(srvId)}`);
      const config = (await res.json()) as { 'account-properties-claims'?: string[] };
      const current = config['account-properties-claims'] ?? [];
      return CLAIMS.every(c => current.includes(c));
    },
    async apply({ admin, srvId }) {
      const res = await admin.fetch(`/auth-config/${encodeURIComponent(srvId)}`);
      const config = (await res.json()) as { 'account-properties-claims'?: string[] };
      const current = config['account-properties-claims'] ?? [];
      await admin.fetch(`/auth-config/${encodeURIComponent(srvId)}`, {
        method: 'PATCH',
        // Added, not replaced: a service may carry claims of its own.
        body: JSON.stringify({
          'account-properties-claims': [...new Set([...current, ...CLAIMS])],
        }),
      });
    },
  }),

  step('guards plugin installed', {
    check: ({ admin, srvId }) => admin.isPluginInstalled(srvId, 'guards'),
    apply: ({ admin, srvId }) => admin.installPlugin(srvId, 'guards'),
  }),

  step('the gate blocks users who have not accepted', {
    async check({ admin, srvId }) {
      // Asked first, because reading the config of a plugin that is not
      // installed is a 404 — and a check must answer the question, not throw.
      if (!(await admin.isPluginInstalled(srvId, 'guards'))) return false;
      const config = await admin.getPluginConfig(srvId, 'guards');
      const rule = rules(config).find(r => (r as { id?: string }).id === RULE_ID) as
        | { condition?: string; status_code?: number }
        | undefined;
      // The condition is compared, not merely the rule's presence: bumping a
      // version has to show up as work outstanding, not as satisfied.
      return rule?.condition === CONDITION && rule.status_code === 451;
    },
    async apply({ admin, srvId }) {
      const config = await admin.getPluginConfig(srvId, 'guards');
      const others = rules(config).filter(r => (r as { id?: string }).id !== RULE_ID);
      await admin.updatePluginConfig(srvId, 'guards', {
        ...config,
        rules: [
          ...others,
          {
            id: RULE_ID,
            name: 'Block users who have not accepted the current ToS and Privacy Policy',
            condition: CONDITION,
            action: 'block',
            // 451 Unavailable For Legal Reasons happens to mean exactly this,
            // and is what src/consents-signal.ts keys on.
            status_code: 451,
            message: 'You must accept the current Terms of Service and Privacy Policy',
            // A rule that cannot be evaluated must not lock everyone out.
            on_error: 'allow',
          },
        ],
      });
    },
  }),
]);

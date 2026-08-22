# RESTHeart Cloud Starter — Ecommerce (React)

An ecommerce example built on [`@restheart-cloud/kit-react`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit-react), seeded from the auth starter. It exercises the kit's **products mode** end to end: catalog, order creation, Stripe Checkout redirect, and the order return page that has to outlive the webhook race.

Everything the auth starter does — signup, login, OAuth, invitations, team switcher — still works here; the shop is layered on top.

> **Status: unpublished kit.** This app consumes `@restheart-cloud/kit` and
> `@restheart-cloud/kit-react` through `npm link`, not from npm. See
> [Local kit development](#local-kit-development) before running it.

## What's included

**The shop** — public, no account required:

- Catalog from the service's own collection, with `purchasable: false` items shown but not sellable
- Cart in `localStorage`
- Checkout **two ways**: signed in (the token identifies the buyer) or as a guest (email only)
- Order return page that polls with `waitForOrder`, because the redirect back from Stripe races the webhook
- Amounts formatted with `formatPrice` — never `amount / 100`

**From the auth starter**, all still working:

- Signup, login, logout — email/password and Google/GitHub OAuth
- Email verification, password reset
- Consents gate — registered users must accept the Terms and Privacy Policy before the app serves them anything
- Team invitations, team switcher
- Lazy-loaded routes with code splitting

## Prerequisites

1. **A RESTHeart Cloud service with the `stripe` plugin enabled** — the shop pages call `/orders` and the catalog collection. A service without the plugin answers `404` on those paths. [Create one at cloud.restheart.com](https://cloud.restheart.com).
2. Node.js 18+

## Local kit development

The kit packages are not published yet, so this app links them from the sibling
`restheart-cloud-kit` checkout. Run this once:

```bash
# 1. Register both kit packages globally
cd ../restheart-cloud-kit/packages/kit       && npm link
cd ../kit-react                              && npm link

# 2. Point this app at them
cd ../../../restheart-cloud-starter-ecommerce
npm install
npm link @restheart-cloud/kit @restheart-cloud/kit-react
```

**After every change to the kit, rebuild it** — this app consumes `dist/`, not the
TypeScript sources:

```bash
cd ../restheart-cloud-kit && npm run build
```

Vite picks the rebuild up without a restart, because the linked packages are excluded
from dependency pre-bundling in `vite.config.ts`.

### Why `vite.config.ts` has extra settings

A linked package resolves *its own* imports from its real path, so `react` would come from
the kit monorepo (19.x) instead of this app (18.x). Two Reacts in one tree throw
"Invalid hook call" on the first hook the kit runs. `resolve.dedupe` forces a single copy.
`optimizeDeps.exclude` and `server.fs.allow` are the other two things linking needs.

**All of this comes out once the kit is published:** drop the three settings from
`vite.config.ts`, run `npm unlink @restheart-cloud/kit @restheart-cloud/kit-react`, and
`npm install @restheart-cloud/kit-react@<version>`.

## Setup

### 1. Fork and clone

```bash
git clone https://github.com/your-org/restheart-cloud-starter-react.git
cd restheart-cloud-starter-react
npm install
```

### 2. Point to your RESTHeart Cloud service

After cloning, tell git to ignore local changes to the environment file:

```bash
git update-index --assume-unchanged src/environments/environment.ts
```

Then edit `src/environments/environment.ts` and set `apiUrl` to your RESTHeart Cloud service URL. Your changes will not show up in `git status`.

### 3. Start

```bash
npm run dev
```

## Structure

```
src/
  styles.css              ← design tokens + the DISPOSABLE default skin
  environments/
    environment.ts        ← apiUrl + feature flags
  routes.tsx              ← route map, feature-flag gating, lazy loading
  App.tsx                 ← fragment token capture + config screen + consents gate
  main.tsx                ← RhAuthProvider + RhPaymentsProvider + CartProvider
  consents-signal.ts      ← raises a flag on any 451
  ConsentsGate.tsx        ← acceptance overlay, above the router
  theme hook              ← light/dark toggle, persisted (in Shell.tsx)
  ui/alert/               ← the one shared feedback component
  shop/
    cart.tsx              ← cart state, persisted; the app's job, not the kit's
    pending-order.ts      ← carries order id + secret across the Stripe redirect
  pages/
    shop/                 ← catalog, cart, checkout, order return
    shell/                ← authenticated frame: header, nav, user menu
    home/                 ← PLACEHOLDER showcase — replace with your content
    auth/                 ← login, signup, verify, forgot/reset password
    invitations/accept/   ← one page, three flows (see below)
    teams/                ← list, detail (members/invites/settings), new
    account/              ← profile + change password
public/
  terms.html              ← PLACEHOLDER — replace with your own
  privacy.html            ← PLACEHOLDER — replace with your own
scripts/
  seed-catalog.mjs        ← fills an empty catalog with demo products
```

### Route map

| Path | Guard | Shown when |
|---|---|---|
| `/auth/login` | `PublicGuard` | always |
| `/auth/signup` | `PublicGuard` | `emailRegistration \|\| oauthLogin` |
| `/auth/verify` | `PublicGuard` | `emailRegistration` |
| `/auth/forgot-password`, `/auth/reset-password` | `PublicGuard` | `passwordReset` |
| `/invitations/accept` | **none** — works signed-in or out | `teamInvitations` |
| `/shop`, `/shop/cart`, `/shop/checkout`, `/shop/order` | **none** — a guest must be able to buy | always |
| `/home`, `/teams`, `/teams/new`, `/teams/:id`, `/account` | `AuthGuard` | always |

The shop routes sit outside `AuthGuard` on purpose: the whole point of guest checkout is that
it works without an account. `/shop/order` must match the service's configured
`success-url` — see [Open points](#open-points).

Feature flags live in `src/environments/environment.ts` and must match your service's
**Sign-up Mgmt → Features** toggles. A flag that's off removes the route *and* the UI that
links to it.

## Customization

### The default skin is meant to be thrown away

`src/styles.css` holds two things: **design tokens** (section 1) and a **disposable
default skin** (sections 3–5). The look is deliberately a *mockup* — cohesive and
intentional, but obviously a scaffold. `@restheart-cloud/kit-react` ships no UI at all, so
the components and this one stylesheet are the only places styling lives.

Two ways forward. Pick one:

**A. Tweak the skin** — fastest, roughly an hour to something that looks like yours:

1. Change the tokens in `styles.css` section 1 — colours, type scale, spacing, radii. Every
   component reads them, so this re-themes the whole app including dark mode.
2. Adjust the skin classes in section 3 if you want different shapes.
3. Replace the shell layout in `pages/shell/`.
4. Replace `pages/home/` with your own landing content.

**B. Adopt a UI framework** — Material, shadcn/ui, Tailwind, your own:

1. Delete sections 3–5 of `styles.css` (they are marked). Keep section 1 if you want the
   tokens; drop it too if your framework brings its own.
2. Reskin the components using the swap map below.

### Swap map

Components reference a small, stable vocabulary of semantic class hooks. Restyle them, or
replace each element with your framework's component:

| Class hook | Used for | Tailwind (example) | Material (example) |
|---|---|---|---|
| `.card` / `.card-header` | Section container + its title row | `rounded border p-6 mb-6` | `<Card>` |
| `.btn-primary` | The one accented action per form | `px-6 py-2 rounded bg-amber-400 font-semibold` | `<Button variant="contained">` |
| `.btn-secondary` | Quiet bordered action | `px-3 py-2 rounded border text-xs uppercase` | `<Button variant="outlined">` |
| `.btn-danger` / `.btn-danger-text` | Destructive action / inline variant | `… text-red-700 border-red-700` | `<Button variant="outlined" color="error">` |
| `.form-field` / `.form-field-sm` / `.form-row` | Label+control stack; `-sm` is narrow; `-row` lays fields side by side | `flex flex-col gap-1` / `flex gap-3` | `<TextField>` |
| `.password-field` / `.btn-toggle-password` | Password input with a Show/Hide toggle | `relative` / `absolute right-2` | `<TextField>` + end adornment |
| `.form-error` / `.field-error` | Form-level / per-field error | `rounded border border-red-300 bg-red-50 p-3` | `<FormHelperText error>` |
| `.success-msg` | Success feedback | `rounded border border-emerald-300 bg-emerald-50 p-3` | — (usually a snackbar) |
| `.muted` | Secondary/caption text | `text-sm text-gray-500` | `className="body2"` |
| `.badge` | Small status pill | `rounded-full px-2 text-xs uppercase` | `<Chip size="small">` |
| `.back-link` / `.eyebrow` | Back navigation / label above a title | `text-xs uppercase tracking-wide` | — |
| `.placeholder` / `.skeleton` | Empty-slot outline / loading block | `border border-dashed p-6` / `animate-pulse bg-gray-200` | `<LinearProgress>` |
| `.auth-page` / `.auth-card` / `.auth-links` / `.divider` | Centred auth layout | `min-h-screen grid place-items-center` / `w-90 rounded border p-8` | `<Card>` |
| `.config-page` / `.config-card` / `.config-status` / `.config-steps` | "Connect your service" screen | — | — |

Feedback is rendered through one component — `src/ui/alert/Alert.tsx` — which carries no
styles of its own, only the `.success-msg` / `.form-error` hooks plus the correct ARIA
roles. Swap that one component and every success/error message in the app follows.

Page-specific layout (`.team-row`, `.member-row`, `.feature-grid`, …) stays in the
component's own `.css` file and is not part of this contract.

## Reading your own data

Everything the starter does talks to `/auth/*`, `/token` and `/users/me` — the kit handles
those. For your application's own collections, use `auth.api`: it applies the session on the
way out, so you never attach the bearer token by hand.

```tsx
import { useAuth } from '@restheart-cloud/kit-react';
import type { ApiError } from '@restheart-cloud/kit-react';

function Notes() {
  const auth = useAuth();
  const [notes, setNotes] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.api('/notes?pagesize=10')
      .then(res => res.json())
      .then(setNotes)
      .catch((err: ApiError) => setError(err.message));
  }, [auth.api]);

  // …
}
```

Pass a path, not a URL. Any non-2xx rejects with an `ApiError` (`{ status, message }`), so a
`403` from an ACL or a `451` from a Guards rule is something you branch on rather than parse.

A plain `fetch` to the same URL is unauthenticated, and the service answers `401` — which
reads as "logged out" rather than "you forgot the header". That is the one mistake worth
knowing about in advance.

### Gating on consents

Registered users must accept the current Terms of Service and Privacy Policy before the app
serves them anything. This is on by default here (it came from the starter's
`feat/consents-gate` branch), with the server-side setup in
[the tutorial](https://cloud.restheart.com/blog).

How it works, in three pieces:

| File | Role |
|---|---|
| `src/consents-signal.ts` | `config.onError` watches for a `451` and raises a flag |
| `src/ConsentsGate.tsx` | Sits above the router; swaps the whole app for the acceptance form while the flag is up |
| `public/terms.html`, `public/privacy.html` | Placeholder documents — replace with your own |

The `451` comes from the Guards rule on the service, and `/users/me` is one of the requests it
refuses — so restoring the session is what trips the gate. There is nothing to probe.

The gate sits **above** the router deliberately: a blocked user cannot get past `AuthGuard`
either, so a gate placed inside the app would be unreachable.

The overlay is user experience, not enforcement. Remove it with the dev tools and every
request still comes back `451`; the rule lives on the server.

**Guests are a separate matter.** The gate stamps the *user document*, and a guest has none —
so a guest buying without an account never meets it. The checkout page collects their
acceptance with its own checkbox instead. See [Open points](#open-points) for what that does
and does not guarantee.

## Open points

Things this example does not settle. Read before copying it into a real shop.

### The service must be configured to match

Three settings have to line up or the flow breaks in ways that are not obvious from the client:

| Setting | Must be | Symptom when wrong |
|---|---|---|
| `stripeConfig.products.success-url` | path `/shop/order`, ideally with the `{ORDER_ID}`/`{ORDER_SECRET}` fragment (below) | the buyer lands on a 404 after paying |
| ACL: `GET /catalog` | readable anonymously | the shop is empty, no error |
| ACL: `POST /orders` | allowed anonymously with an email | guest checkout answers `401` |

The collection names are configurable server-side (`products.catalog-collection`,
`products.orders-collection`); if yours are renamed, set them in
`src/environments/environment.ts` — the kit takes them as parameters, it does not assume.

### Configure the success URL to carry the order reference

Stripe substitutes only `{CHECKOUT_SESSION_ID}` in the success URL, so on its own the return
page does not know *which* order it is showing — and a guest has no session for the server to
recognise them by.

RESTHeart's `stripe` plugin interpolates `{ORDER_ID}` and `{ORDER_SECRET}` if you put them
there. **Configure it in the fragment**, so the secret never reaches a server log or a
`Referer` header:

```
/stripeConfig/products/success-url ->
  "https://your-app.example.com/shop/order#order={ORDER_ID}&secret={ORDER_SECRET}"
```

`OrderReturn.tsx` reads it with `readOrderRef()` and strips it from the address bar with
`clearOrderRef()` right away.

**If you skip this**, the app falls back to `src/shop/pending-order.ts`, which stashes the
reference in `localStorage` before redirecting. That covers the common case and fails in
three: `localStorage` blocked or full, a private window closed and reopened, and a payment
finished in a different browser from the one that started it. The fallback stays in the code
on purpose — the placeholders are opt-in, and a service configured before they existed still
works.

### Guest consent is a checkbox, not a record

A registered user's acceptance is enforced by a Guards rule and stamped on their user
document. A guest's is neither. The checkbox on the checkout page gates the button and nothing
else, and **the order carries no record that it was ticked** — the checkout interceptor rejects
any body key other than `items` and `email`, so there is nowhere to put it.

For a real shop this is not enough. Options, none implemented here: widen the interceptor to
accept and store a consent stamp, record it against the email in a separate collection, or
require an account to buy at all.

### Amounts assume one currency per cart

`formatPrice` is per-line and correct, but the cart subtotal adds line amounts together and
labels them with the first line's currency. A catalog that mixes currencies would show a
meaningless total. Stripe would reject the session anyway, so the failure is loud — but the
cart should refuse the mix earlier.

### Not covered

- **Inventory** — the plugin has an inventory collection; this example ignores stock entirely.
- **Shipping and tax** — left to Stripe's Checkout configuration.
- **Order history** — a signed-in buyer's past orders are readable via the orders collection, but there is no page for them.
- **Refunds** — `amount_refunded` is on the `Order` type and unused here.

## Packages used

- [`@restheart-cloud/kit`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit) — TypeScript auth logic (framework-agnostic)
- [`@restheart-cloud/kit-react`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit-react) — React context, hooks, and guards

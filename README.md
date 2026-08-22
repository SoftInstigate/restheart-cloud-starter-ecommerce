# RESTHeart Cloud Starter — Ecommerce (React)

An ecommerce example built on [`@restheart-cloud/kit-react`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit-react), seeded from the auth starter. It exercises the kit's **products mode** end to end: catalog, order creation, Stripe Checkout redirect, and the order return page that has to outlive the webhook race.

Everything the auth starter does — signup, login, OAuth, invitations, team switcher — still works here; the shop is layered on top.

> **Status: unpublished kit.** This app consumes `@restheart-cloud/kit` and
> `@restheart-cloud/kit-react` through `npm link`, not from npm. See
> [Local kit development](#local-kit-development) before running it.

## What's included

- Signup, login, logout — email/password and Google/GitHub OAuth
- Email verification, password reset
- Team invitations — one page (`/invitations/accept`) branching into a new-user "set password" form (calls `PATCH /auth/activate`) or an existing-user "log in and accept" form
- Team switcher — shown only when the user belongs to more than one team
- Authenticated shell with placeholder for your app content
- Lazy-loaded routes with code splitting

![RESTHeart Cloud Starter Home Page](./starter-home-page.png)

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
  App.tsx                 ← fragment token capture + config screen
  main.tsx                ← RhAuthProvider + BrowserRouter
  theme hook              ← light/dark toggle, persisted (in Shell.tsx)
  ui/alert/               ← the one shared feedback component
  pages/
    shell/                ← authenticated frame: header, nav, user menu
    home/                 ← PLACEHOLDER showcase — replace with your content
    auth/                 ← login, signup, verify, forgot/reset password
    invitations/accept/   ← one page, three flows (see below)
    teams/                ← list, detail (members/invites/settings), new
    account/              ← profile + change password
```

### Route map

| Path | Guard | Shown when |
|---|---|---|
| `/auth/login` | `PublicGuard` | always |
| `/auth/signup` | `PublicGuard` | `emailRegistration \|\| oauthLogin` |
| `/auth/verify` | `PublicGuard` | `emailRegistration` |
| `/auth/forgot-password`, `/auth/reset-password` | `PublicGuard` | `passwordReset` |
| `/invitations/accept` | **none** — works signed-in or out | `teamInvitations` |
| `/home`, `/teams`, `/teams/new`, `/teams/:id`, `/account` | `AuthGuard` | always |

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

A worked example of the above — every user must accept the current Terms of Service and
Privacy Policy before the app serves them anything — lives on the **`feat/consents-gate`**
branch, with the server-side setup in
[the tutorial](https://cloud.restheart.com/blog).

```bash
git checkout feat/consents-gate
```

It is a branch and not the default on purpose: which consents you collect, and when you
re-ask, are product decisions.

## Packages used

- [`@restheart-cloud/kit`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit) — TypeScript auth logic (framework-agnostic)
- [`@restheart-cloud/kit-react`](https://github.com/SoftInstigate/restheart-cloud-kit/tree/main/packages/kit-react) — React context, hooks, and guards

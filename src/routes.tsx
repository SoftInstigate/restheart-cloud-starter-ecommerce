import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard, PublicGuard } from '@restheart-cloud/kit-react';
import { environment } from './environments/environment';

const Login = lazy(() => import('./pages/auth/login/Login'));
const Signup = lazy(() => import('./pages/auth/signup/Signup'));
const Verify = lazy(() => import('./pages/auth/verify/Verify'));
const ForgotPassword = lazy(() => import('./pages/auth/forgot-password/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/reset-password/ResetPassword'));
const Accept = lazy(() => import('./pages/invitations/accept/Accept'));
const Shell = lazy(() => import('./pages/shell/Shell'));
const Home = lazy(() => import('./pages/home/Home'));
const Teams = lazy(() => import('./pages/teams/Teams'));
const NewTeam = lazy(() => import('./pages/teams/new/NewTeam'));
const TeamDetail = lazy(() => import('./pages/teams/detail/TeamDetail'));
const Account = lazy(() => import('./pages/account/Account'));
const Shop = lazy(() => import('./pages/shop/Shop'));
const Cart = lazy(() => import('./pages/shop/Cart'));
const Checkout = lazy(() => import('./pages/shop/Checkout'));
const OrderReturn = lazy(() => import('./pages/shop/OrderReturn'));

const { emailRegistration, passwordReset, oauthLogin, teamInvitations } = environment.features;

/**
 * Every route is lazy, so there is a gap between navigating and the chunk
 * arriving. `fallback={null}` filled it with nothing — a blank page for as long
 * as the download takes, then the content.
 *
 * That reads worst exactly where it matters most. Coming back from Stripe, the
 * buyer has just paid and is looking for confirmation; a blank screen is the
 * moment they wonder whether it worked, and the page that says "Confirming your
 * payment…" only appears once it is too late to reassure them.
 *
 * Deliberately quiet: a word, not a spinner. On a fast connection this is one
 * frame, and something that flashes is worse than something that waits.
 */
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="route-loading muted">Loading…</p>}>{children}</Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    path: 'auth/login',
    element: (
      <SuspenseWrapper>
        <PublicGuard>
          <Login />
        </PublicGuard>
      </SuspenseWrapper>
    ),
  },
  ...(emailRegistration || oauthLogin
    ? [
        {
          path: 'auth/signup',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <Signup />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(emailRegistration
    ? [
        {
          path: 'auth/verify',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <Verify />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(passwordReset
    ? [
        {
          path: 'auth/forgot-password',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <ForgotPassword />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
        {
          path: 'auth/reset-password',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <ResetPassword />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(teamInvitations
    ? [
        {
          path: 'invitations/accept',
          element: (
            <SuspenseWrapper>
              <Accept />
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  // The shop is the front door, and it is outside AuthGuard: a guest must be
  // able to browse, pay, and see their receipt without ever creating an
  // account. Whether the service actually permits an anonymous `POST /orders`
  // is its ACL's call — Checkout surfaces the 401 if it does not.
  //
  // It sits at `/` rather than under a prefix because that is where people
  // arrive. A shop reachable only by typing a path nobody links to is a shop
  // with no visitors, and the signed-out landing was the login page.
  {
    path: '/',
    element: (
      <SuspenseWrapper>
        <Shop />
      </SuspenseWrapper>
    ),
  },
  {
    path: 'cart',
    element: (
      <SuspenseWrapper>
        <Cart />
      </SuspenseWrapper>
    ),
  },
  {
    path: 'checkout',
    element: (
      <SuspenseWrapper>
        <Checkout />
      </SuspenseWrapper>
    ),
  },
  {
    // Stripe returns the buyer here. The path must match
    // `stripeConfig.products.success-url` on the service.
    path: 'order',
    element: (
      <SuspenseWrapper>
        <OrderReturn />
      </SuspenseWrapper>
    ),
  },
  // Everything that needs an account lives under `/app`. It used to be at `/`,
  // which is why a signed-out visitor was bounced to the login page before
  // seeing anything at all.
  {
    path: '/app',
    element: (
      <SuspenseWrapper>
        <AuthGuard>
          <Shell />
        </AuthGuard>
      </SuspenseWrapper>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'teams', element: <Teams /> },
      { path: 'teams/new', element: <NewTeam /> },
      { path: 'teams/:id', element: <TeamDetail /> },
      { path: 'account', element: <Account /> },
    ],
  },
  // An unknown path used to render the authenticated home with no guard around
  // it, so a typo showed a signed-out visitor a page `/` itself refused them.
  { path: '*', element: <Navigate to="/" replace /> },
];

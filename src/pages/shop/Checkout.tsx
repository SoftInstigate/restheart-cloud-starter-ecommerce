import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, usePayments, formatPrice } from '@restheart-cloud/kit-react';
import { environment } from '../../environments/environment';
import { useCart } from '../../shop/cart';
import { rememberPendingOrder } from '../../shop/pending-order';
import './Shop.css';

/**
 * Checkout works signed in *or* signed out — the two paths differ by one
 * argument.
 *
 * - **Signed in:** `createOrder(items)`. The bearer token identifies the buyer,
 *   and the order is attached to their team.
 * - **Guest:** `createOrder(items, email)`. No session at all; the email is
 *   required, and the `secret` that comes back is the only way to read the
 *   order afterwards.
 *
 * Whether the guest path is allowed is the service's decision, not the kit's:
 * an ACL that requires authentication on `POST /orders` answers `401` here.
 */
export default function Checkout() {
  const auth = useAuth();
  const payments = usePayments();
  const cart = useCart();

  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = !auth.isAuthenticated;

  if (cart.lines.length === 0) {
    return (
      <div className="shop-page shop-narrow">
        <h1>Checkout</h1>
        <p className="muted">Your cart is empty.</p>
        <Link to="/" className="btn-primary">Browse the shop</Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const items = cart.lines.map(l => ({ productId: l.productId, quantity: l.quantity }));

    try {
      const order = await payments.createOrder(
        items,
        isGuest ? email : undefined,
        environment.catalogOrdersCollection
      );

      // Write the secret down BEFORE leaving for Stripe. The success URL is
      // configured server-side and cannot carry it, so this is the only way the
      // return page will be able to read the order back — especially for a
      // guest, who has no session to identify them.
      rememberPendingOrder(order._id.$oid, order.secret);

      cart.clear();
      window.location.href = order.checkout_url;
    } catch (err) {
      const e = err as { status?: number; message?: string };
      setError(
        e.status === 401
          ? 'This service requires an account to order. Please sign in.'
          : e.status === 400
            ? 'The server rejected the order — a product may no longer be purchasable.'
            : (e.message ?? 'Could not start checkout.')
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="shop-page shop-narrow">
      <h1>Checkout</h1>

      <ul className="cart-lines cart-lines-compact">
        {cart.lines.map(line => (
          <li key={line.productId} className="cart-line">
            <span className="cart-line-main">
              {line.quantity} × {line.name}
            </span>
            <span className="cart-line-total">
              {formatPrice(line.unitAmount * line.quantity, line.currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <span>Total</span>
        <strong>{formatPrice(cart.subtotal, cart.currency)}</strong>
      </div>

      <form onSubmit={handleSubmit} className="checkout-form">
        {isGuest ? (
          <>
            {/*
              An offer, never a gate. Guest checkout is the point of this page,
              so the account option sits above the form without blocking it, and
              the cart is in localStorage either way.

              The two are not the same kind of detour. Logging in comes straight
              back here — that is what `?next` does. Signing up cannot: the
              account has to be verified by email first, so it means leaving the
              purchase. Say so, rather than letting someone find out after they
              have typed their details.
            */}
            <div className="checkout-account">
              <p>
                <strong>Have an account?</strong>{' '}
                <Link to="/auth/login?next=/checkout">Log in</Link> and come straight back — your
                cart is kept.
              </p>
              <p className="muted">
                Or <Link to="/auth/signup">create one</Link>, which needs an email confirmation
                first. You do not need an account to buy.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <p className="muted">We'll send the receipt here.</p>
            </div>

            {/*
              A guest never meets the consents gate: that gate works by stamping
              the *user document*, and a guest has none. So the acceptance has
              to be collected here instead.

              Be clear about what this is: a client-side checkbox. Unlike the
              gate — which is backed by a Guards rule answering 451 — nothing on
              the server enforces this, and the order carries no record of it,
              because the checkout interceptor rejects any body key other than
              `items` and `email`. See the README's open points.
            */}
            <label className="checkout-consents">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
              />
              <span>
                I have read and accept the{' '}
                <a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> and the{' '}
                <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>
              </span>
            </label>
          </>
        ) : (
          <p className="muted">
            Ordering as <strong>{auth.user?._id}</strong>. You accepted the{' '}
            <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> and{' '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a> when you
            signed up.
          </p>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="form-row">
          <Link to="/cart" className="btn-secondary">Back to cart</Link>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || (isGuest && !acceptedTerms)}
          >
            {submitting ? 'Starting checkout…' : 'Pay with Stripe'}
          </button>
        </div>
      </form>

      <p className="muted checkout-note">
        You'll be redirected to Stripe's hosted Checkout. No card details ever reach this app.
      </p>
    </div>
  );
}

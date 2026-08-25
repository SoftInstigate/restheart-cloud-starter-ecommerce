import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAuth,
  usePayments,
  formatPrice,
  readOrderRef,
  clearOrderRef,
  type Order,
} from '@restheart-cloud/kit-react';
import { environment } from '../../environments/environment';
import { clearPendingOrder, readPendingOrder } from '../../shop/pending-order';
import './Shop.css';

/**
 * Orders — the history, and the page Stripe returns the buyer to.
 *
 * One page rather than two because they were two views of the same thing: a
 * customer coming back from Stripe wants to see the order they just placed,
 * and a customer opening their history wants the same list with that order at
 * the top of it. Split apart, the return page could only ever show one order
 * and had nothing to say to someone arriving without a reference — "No order
 * to show", on a page called Orders.
 *
 * The awkward part is real though, and it is why the polling stays. Stripe
 * redirects as soon as the payment is authorised, but the order only moves off
 * `pending_payment` when Stripe's *webhook* arrives — a separate connection,
 * usually seconds later, with no ordering guarantee against the redirect. A
 * single read would routinely tell someone who just paid that they had not.
 */

type Confirming = 'none' | 'waiting' | 'settled' | 'late' | 'error';

export default function Orders() {
  const auth = useAuth();
  const payments = usePayments();

  // The order just paid for, tracked separately from the list: it is the one
  // that may still be moving, and the list is a snapshot.
  const [confirming, setConfirming] = useState<Confirming>('none');
  const [justPaid, setJustPaid] = useState<Order | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // ── The order coming back from Stripe ──────────────────────────────────
  useEffect(() => {
    // Two ways the reference arrives, in order of preference: interpolated into
    // the success URL by the service and carried back by Stripe — which
    // survives a cleared localStorage and a different browser — or what we
    // stashed before redirecting.
    const fromUrl = readOrderRef();
    if (fromUrl) {
      // Out of the address bar immediately: the secret is a credential, and a
      // URL gets screenshotted, shared and bookmarked.
      clearOrderRef();
    }

    const stashed = readPendingOrder();
    const ref = fromUrl ?? (stashed ? { id: stashed.id, secret: stashed.secret } : null);
    if (!ref) return;

    setConfirming('waiting');
    const controller = new AbortController();

    payments
      .waitForOrder(ref.id, ref.secret, {
        collection: environment.catalogOrdersCollection,
        timeoutMs: 30_000,
        intervalMs: 1_000,
        signal: controller.signal,
      })
      .then(result => {
        setJustPaid(result);
        setConfirming('settled');
        clearPendingOrder();
      })
      .catch((err: { name?: string; status?: number; message?: string }) => {
        if (controller.signal.aborted) return;
        if (err.name === 'WaitTimeoutError') {
          // Not a failure: the webhook is late and Stripe has the money either
          // way. Keep the secret so a reload picks up where this left off.
          setConfirming('late');
          return;
        }
        setConfirming('error');
        setConfirmError(
          err.status === 404
            ? 'That order could not be found. The secret may have expired.'
            : (err.message ?? 'Could not read the order.')
        );
      });

    return () => controller.abort();
  }, [payments]);

  // ── The history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    // Newest first. The ACL decides which documents come back — the permission
    // carries a readFilter on the billing account, so this asks for "all
    // orders" and is answered with the caller's.
    auth
      .api(`/${environment.catalogOrdersCollection}?sort=-_id&pagesize=25`)
      .then(res => res.json())
      .then((docs: Order[]) => {
        if (!cancelled) setOrders(docs);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        setOrders([]);
        setListError(
          err.status === 403
            ? 'The service ACL does not allow reading your orders. Re-run `rhc setup`.'
            : (err.message ?? 'Could not load your orders.')
        );
      });

    return () => {
      cancelled = true;
    };
  }, [auth, auth.isAuthenticated]);

  const line = (order: Order) => (
    <li key={order._id.$oid} className="order-row">
      <div className="order-row-main">
        <span className="order-row-id">{order._id.$oid}</span>
        <span className={`badge order-status order-status-${order.status}`}>{order.status}</span>
      </div>
      <ul className="cart-lines cart-lines-compact">
        {order.line_items.map(l => (
          <li key={l.product_id} className="cart-line">
            <span className="cart-line-main">{l.quantity} × {l.name}</span>
            <span className="cart-line-total">{formatPrice(l.subtotal, order.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="cart-summary">
        <span>Total</span>
        <strong>{formatPrice(order.amount_total, order.currency)}</strong>
      </div>
    </li>
  );

  return (
    <div className="shop-page shop-narrow">
      <h1>Your orders</h1>

      {confirming === 'waiting' && (
        <section className="card">
          <h2>Confirming your payment…</h2>
          <p className="muted">
            This can take a few seconds — we're waiting for Stripe to tell our server the
            payment went through.
          </p>
          <div className="skeleton" style={{ height: '4rem' }} />
        </section>
      )}

      {confirming === 'settled' && justPaid && (
        <section className="card">
          <h2>{justPaid.status === 'paid' ? 'Thank you — order confirmed' : 'Order not completed'}</h2>
          {justPaid.status !== 'paid' && (
            <div className="form-error" role="alert">
              This order is <strong>{justPaid.status}</strong>. Nothing was charged.
            </div>
          )}
          <ul className="order-list">{line(justPaid)}</ul>
        </section>
      )}

      {confirming === 'late' && (
        <section className="card">
          <h2>Payment received — still confirming</h2>
          <div className="success-msg" role="status">
            Your payment went through. Our server hasn't finished recording it yet, which is
            normal and usually takes a few more seconds.
          </div>
          <p className="muted">You have not been charged twice.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Check again
          </button>
        </section>
      )}

      {confirming === 'error' && (
        <div className="form-error" role="alert">{confirmError}</div>
      )}

      {listError && <div className="form-error" role="alert">{listError}</div>}

      {!auth.isAuthenticated && (
        <div className="shop-empty">
          <p className="muted">
            Orders are kept against a billing account. Sign in to see everything charged to
            yours — a guest checkout has no account to list, and the receipt email carries
            that order's details.
          </p>
          <Link to="/auth/login" className="btn-primary">Log in</Link>
        </div>
      )}

      {auth.isAuthenticated && orders === null && <p className="muted">Loading…</p>}

      {auth.isAuthenticated && orders?.length === 0 && !listError && (
        <div className="shop-empty">
          <p className="muted">Nothing charged to this billing account yet.</p>
          <Link to="/" className="btn-primary">Browse the shop</Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="order-list">{orders.map(line)}</ul>
      )}
    </div>
  );
}

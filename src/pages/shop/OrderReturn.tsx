import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
 * Where the buyer lands after Stripe.
 *
 * The interesting part is what this page must NOT do: read the order once and
 * report what it says. Stripe redirects the browser back here as soon as the
 * payment is authorised, but the order in MongoDB only moves off
 * `pending_payment` when Stripe's *webhook* arrives — a separate connection,
 * usually seconds later, with no ordering guarantee against this redirect. A
 * single read would routinely tell someone who just paid that they haven't.
 *
 * So it polls, with `waitForOrder`. And it treats a timeout as "not yet"
 * rather than "failed", because a `WaitTimeoutError` means the webhook is late
 * — Stripe has the money either way.
 */

type Status = 'loading' | 'paid' | 'unpaid' | 'pending' | 'missing' | 'error';

export default function OrderReturn() {
  const payments = usePayments();

  const [status, setStatus] = useState<Status>('loading');
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Two ways the reference can arrive, in order of preference.
    //
    // 1. The service interpolated `{ORDER_ID}`/`{ORDER_SECRET}` into its
    //    configured success URL, and Stripe brought them back. This survives a
    //    cleared localStorage and a different browser.
    // 2. Otherwise, what we stashed before redirecting.
    //
    // The fallback stays because the placeholders are opt-in: a service
    // configured before they existed still works, it just loses case 1.
    const fromUrl = readOrderRef();
    if (fromUrl) {
      // Out of the address bar immediately — the secret is a credential, and a
      // URL gets screenshotted, shared and bookmarked.
      clearOrderRef();
    }

    const stashed = readPendingOrder();
    const ref = fromUrl ?? (stashed ? { id: stashed.id, secret: stashed.secret } : null);

    if (!ref) {
      setStatus('missing');
      return;
    }

    const controller = new AbortController();

    payments
      .waitForOrder(ref.id, ref.secret, {
        collection: environment.catalogOrdersCollection,
        timeoutMs: 30_000,
        intervalMs: 1_000,
        signal: controller.signal,
      })
      .then(result => {
        setOrder(result);
        if (result.status === 'paid') {
          setStatus('paid');
          // Final state reached — stop holding the secret.
          clearPendingOrder();
        } else {
          setStatus('unpaid');
          clearPendingOrder();
        }
      })
      .catch((err: { name?: string; status?: number; message?: string }) => {
        if (controller.signal.aborted) return;

        if (err.name === 'WaitTimeoutError') {
          // Not a failure. Keep the secret so a reload can pick up where this
          // left off once the webhook lands.
          setStatus('pending');
          return;
        }
        setStatus('error');
        setMessage(
          err.status === 404
            ? 'That order could not be found. The secret may have expired.'
            : (err.message ?? 'Could not read the order.')
        );
      });

    return () => controller.abort();
  }, [payments]);

  return (
    <div className="shop-page shop-narrow order-return">
      {status === 'loading' && (
        <>
          <h1>Confirming your payment…</h1>
          <p className="muted">
            This can take a few seconds — we're waiting for Stripe to tell our server the
            payment went through.
          </p>
          <div className="skeleton" style={{ height: '6rem' }} />
        </>
      )}

      {status === 'paid' && order && (
        <>
          <h1>Thank you — order confirmed</h1>
          <p className="muted">Order {order._id.$oid}</p>

          <ul className="cart-lines cart-lines-compact">
            {order.line_items.map(line => (
              <li key={line.product_id} className="cart-line">
                <span className="cart-line-main">
                  {line.quantity} × {line.name}
                </span>
                <span className="cart-line-total">
                  {formatPrice(line.subtotal, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <span>Paid</span>
            <strong>{formatPrice(order.amount_total, order.currency)}</strong>
          </div>

          <Link to="/shop" className="btn-primary">Continue shopping</Link>
        </>
      )}

      {status === 'pending' && (
        <>
          <h1>Payment received — still confirming</h1>
          <div className="success-msg" role="status">
            Your payment went through. Our server hasn't finished recording it yet, which is
            normal and usually takes a few more seconds.
          </div>
          <p className="muted">
            Nothing is wrong and you have not been charged twice. Reload this page in a moment.
          </p>
          <div className="form-row">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Check again
            </button>
            <Link to="/shop" className="btn-secondary">Back to the shop</Link>
          </div>
        </>
      )}

      {status === 'unpaid' && order && (
        <>
          <h1>Order not completed</h1>
          <div className="form-error" role="alert">
            This order is <strong>{order.status}</strong>.
          </div>
          <p className="muted">
            Nothing was charged. You can try again from the shop.
          </p>
          <Link to="/shop" className="btn-primary">Back to the shop</Link>
        </>
      )}

      {status === 'missing' && (
        <>
          <h1>No order to show</h1>
          <p className="muted">
            We have no record of a recent order in this browser. If you just paid, the receipt
            email has your order details.
          </p>
          <Link to="/shop" className="btn-primary">Back to the shop</Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1>Could not confirm the order</h1>
          <div className="form-error" role="alert">{message}</div>
          <Link to="/shop" className="btn-secondary">Back to the shop</Link>
        </>
      )}
    </div>
  );
}

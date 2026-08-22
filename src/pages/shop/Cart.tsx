import { Link } from 'react-router-dom';
import { formatPrice } from '@restheart-cloud/kit-react';
import { useCart } from '../../shop/cart';
import './Shop.css';

export default function Cart() {
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="shop-page shop-narrow">
        <h1>Your cart</h1>
        <p className="muted">Nothing in it yet.</p>
        <Link to="/shop" className="btn-primary">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div className="shop-page shop-narrow">
      <h1>Your cart</h1>

      <ul className="cart-lines">
        {cart.lines.map(line => (
          <li key={line.productId} className="cart-line">
            <div className="cart-line-main">
              <span className="cart-line-name">{line.name}</span>
              <span className="muted">{formatPrice(line.unitAmount, line.currency)} each</span>
            </div>

            <div className="cart-line-qty">
              <label className="sr-only" htmlFor={`qty-${line.productId}`}>
                Quantity for {line.name}
              </label>
              <input
                id={`qty-${line.productId}`}
                type="number"
                min={1}
                value={line.quantity}
                onChange={e => cart.setQuantity(line.productId, Number(e.target.value))}
              />
            </div>

            <span className="cart-line-total">
              {formatPrice(line.unitAmount * line.quantity, line.currency)}
            </span>

            <button
              type="button"
              className="btn-danger-text"
              onClick={() => cart.remove(line.productId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <span>Subtotal</span>
        <strong>{formatPrice(cart.subtotal, cart.currency)}</strong>
      </div>
      <p className="muted cart-note">
        Tax and shipping, if any, are calculated by Stripe at checkout. The server prices the
        order from its own catalog — these amounts are for display.
      </p>

      <div className="form-row">
        <Link to="/shop" className="btn-secondary">Keep shopping</Link>
        <Link to="/shop/checkout" className="btn-primary">Checkout</Link>
      </div>
    </div>
  );
}

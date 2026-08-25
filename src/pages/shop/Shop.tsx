import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, usePayments, formatPrice, type CatalogItem } from '@restheart-cloud/kit-react';
import { environment } from '../../environments/environment';
import { useCart } from '../../shop/cart';
import './Shop.css';

export default function Shop() {
  const payments = usePayments();
  const cart = useCart();
  const auth = useAuth();

  // Which item was just added, so the button can say so. Cleared on a timer —
  // and the timer is held in a ref so adding a second item restarts it rather
  // than letting the first one's timeout clear the second one's message.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  const addToCart = (item: CatalogItem) => {
    cart.add(item);
    setJustAdded(item._id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(null), 2500);
  };

  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    payments
      .getCatalog({ collection: environment.catalogCollection })
      .then(catalog => {
        if (cancelled) return;
        setItems(catalog);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        // A 404 here almost always means the service has no `stripe` plugin, or
        // the catalog collection is named something else — not that the shop is
        // empty. Saying so beats an empty grid.
        setError(
          err.status === 404
            ? `No collection "${environment.catalogCollection}" on the service. Check the stripe plugin is enabled and the collection name matches.`
            : err.status === 403
              ? 'The service ACL does not allow reading the catalog. Re-run `rhc setup` — the permission has to cover signed-in customers as well as guests.'
              : (err.message ?? 'Could not load the catalog.')
        );
      });

    return () => {
      cancelled = true;
    };
  }, [payments]);

  if (error) {
    return (
      <div className="shop-page">
        <div className="form-error" role="alert">{error}</div>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="shop-page">
        <div className="shop-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '19rem' }} />
          ))}
        </div>
      </div>
    );
  }

  // `purchasable: false` items stay visible but cannot be bought — the server
  // would refuse them at checkout anyway, so hiding the button is the honest
  // version of the same rule.
  const purchasable = items.filter(i => i.purchasable);

  return (
    <div className="shop-page">
      <header className="shop-header">
        <div>
          <p className="eyebrow">Shop</p>
          <h1>Everything we make</h1>
        </div>
        <div className="shop-header-actions">
          {/* The shop is the front door now, so this is the only way in to the
              account area — there is no other page a visitor passes through. */}
          {auth.isAuthenticated
            ? <Link to="/app" className="btn-secondary">My account</Link>
            : <Link to="/auth/login" className="btn-secondary">Log in</Link>}
          <Link to="/cart" className="btn-secondary">
            Cart{cart.totalItems > 0 ? ` (${cart.totalItems})` : ''}
          </Link>
        </div>
      </header>

      {purchasable.length === 0 && (
        <p className="muted">
          The catalog has no purchasable products yet. Run <code>rhc setup --srv &lt;srvId&gt;</code>.
        </p>
      )}

      <div className="shop-grid">
        {items.map(item => (
          <article key={item._id} className="card shop-item">
            {item.image_url && <img src={item.image_url} alt="" className="shop-item-image" />}
            <div className="shop-item-body">
              <h2 className="shop-item-name">{item.name}</h2>
              {item.description && <p className="muted shop-item-desc">{item.description}</p>}
              <div className="shop-item-footer">
                <span className="shop-item-price">
                  {formatPrice(item.unit_amount, item.currency ?? 'eur')}
                </span>
                {item.purchasable ? (
                  <button
                    type="button"
                    className={`btn-primary${justAdded === item._id ? ' is-added' : ''}`}
                    onClick={() => addToCart(item)}>
                    {justAdded === item._id ? 'Added \u2713' : 'Add to cart'}
                  </button>
                ) : (
                  <span className="badge">Sold out</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Announced to screen readers as well as shown: the cart count in the
          header changes too, but a number quietly going from 1 to 2 is easy to
          miss and impossible to hear. */}
      <div className="shop-toast-area" role="status" aria-live="polite">
        {justAdded && (
          <div className="shop-toast">
            <span>{items.find(i => i._id === justAdded)?.name} added to your cart</span>
            <Link to="/cart" className="shop-toast-link">View cart</Link>
          </div>
        )}
      </div>
    </div>
  );
}

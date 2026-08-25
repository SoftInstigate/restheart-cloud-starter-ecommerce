import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, formatPrice } from '@restheart-cloud/kit-react';
import type { ShopItem } from '../../shop/types';
import { environment } from '../../environments/environment';
import { useCart } from '../../shop/cart';
import './Shop.css';

/**
 * One product.
 *
 * Fetched by id rather than picked out of the grid's state, because the grid
 * may never have been loaded: this is a URL people bookmark, paste to each
 * other and arrive at from a search engine, and it has to work on its own.
 *
 * The ACL already allows it — the catalog permission's predicate covers
 * `path-template('/catalog/{docid}')` as well as the collection — and it
 * carries the same readFilter, so an unsellable product is a 404 here rather
 * than a page with no button.
 */
export default function Product() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const cart = useCart();

  const [item, setItem] = useState<ShopItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setError(null);

    auth
      .api(`/${environment.catalogCollection}/${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then((doc: ShopItem) => {
        if (!cancelled) setItem(doc);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        setError(
          err.status === 404
            ? 'That product is not in the catalog. It may have been withdrawn.'
            : (err.message ?? 'Could not load the product.')
        );
      });

    return () => {
      cancelled = true;
    };
  }, [auth, id]);

  const add = () => {
    if (!item) return;
    cart.add(item);
    setAdded(true);
  };

  return (
    <div className="shop-page">
      <Link to="/" className="back-link">&larr; Back to the shop</Link>

      {error && <div className="form-error" role="alert">{error}</div>}

      {!error && !item && (
        <div className="product-layout">
          <div className="card skeleton" style={{ height: '22rem' }} />
          <div className="card skeleton" style={{ height: '12rem' }} />
        </div>
      )}

      {item && (
        <article className="product-layout">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="product-image" />
          ) : (
            <div className="product-image placeholder" aria-hidden="true" />
          )}

          <div className="product-detail">
            {item.category && <p className="eyebrow">{String(item.category)}</p>}
            <h1>{item.name}</h1>

            <p className="product-price">
              {formatPrice(item.unit_amount, item.currency ?? 'eur')}
            </p>

            {item.description && <p>{item.description}</p>}

            <dl className="product-facts">
              <dt>Delivery</dt>
              <dd>{item.type === 'digital' ? 'Downloadable — nothing to ship' : 'Shipped in a box'}</dd>
              <dt>Reference</dt>
              <dd><code>{item._id}</code></dd>
            </dl>

            {item.purchasable ? (
              <div className="product-actions">
                <button type="button" className="btn-primary" onClick={add}>
                  {added ? 'Added ✓' : 'Add to cart'}
                </button>
                {added && <Link to="/cart" className="btn-secondary">View cart</Link>}
              </div>
            ) : (
              <p className="muted">
                <span className="badge">Sold out</span> This one cannot be bought right now.
              </p>
            )}
          </div>
        </article>
      )}
    </div>
  );
}

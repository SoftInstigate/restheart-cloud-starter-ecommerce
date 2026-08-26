import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, formatPrice } from '@restheart-cloud/kit-react';
import { pick, type ShopItem, type Variant } from '../../shop/types';
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

  /** The option chosen for each metadata key: `{ colour: 'yellow', size: 'L' }`. */
  const [chosen, setChosen] = useState<Record<string, string>>({});

  // A new choice is a new product: "Added ✓" left standing would be claiming the last one.
  useEffect(() => setAdded(false), [chosen]);

  /**
   * The questions and their answers, read off the variants themselves.
   *
   * Nothing declares which options a product has: the distinct metadata keys are the questions
   * and their distinct values are the answers, so adding a colour to the catalog adds it to the
   * page with nothing to update here.
   */
  const options = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const variant of item?.variants ?? []) {
      for (const [key, value] of Object.entries(variant.metadata ?? {})) {
        // `etichetta` is one product's own convention for what the email prints. It is not a
        // choice anybody makes, so it is not a selector — which is the price of free-form
        // metadata, and cheaper than a schema saying which keys are options.
        if (key === 'etichetta') continue;
        const seen = out.get(key) ?? [];
        if (!seen.includes(value)) out.set(key, [...seen, value]);
      }
    }
    return out;
  }, [item]);

  /** The variant matching every chosen option, once they are all chosen. */
  const variant: Variant | undefined = useMemo(() => {
    if (!item?.variants?.length) return undefined;
    if (options.size === 0) return undefined;
    return item.variants.find(v =>
      [...options.keys()].every(key => v.metadata?.[key] === chosen[key])
    );
  }, [item, options, chosen]);

  // Start on the first variant that can actually be bought, so the page opens on something
  // rather than on an empty form.
  useEffect(() => {
    const first = item?.variants?.find(v => v.purchasable !== false) ?? item?.variants?.[0];
    if (first?.metadata) {
      const { etichetta: _unused, ...rest } = first.metadata;
      setChosen(rest);
    }
  }, [item]);

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

  /**
   * A product with variants has no price of its own, and should not: the price belongs to what is
   * bought. So until a variant is resolved there is nothing to show and nothing to buy — which is
   * true for one render before the effect below picks a default, and stays true for as long as a
   * catalog offers a combination that does not exist.
   */
  const chooseFirst = Boolean(item?.variants?.length) && !variant;

  const add = () => {
    if (!item || chooseFirst) return;
    const chosenItem = pick(item, variant);
    // The cart holds what is bought, not the family it belongs to: the composite id is what the
    // server prices and what the order line records.
    cart.add({ ...item, _id: chosenItem.id, unit_amount: chosenItem.unitAmount }, 1, chosen);
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
          {pick(item, variant).images[0] ? (
            <img src={pick(item, variant).images[0]} alt="" className="product-image" />
          ) : (
            <div className="product-image placeholder" aria-hidden="true" />
          )}

          <div className="product-detail">
            {item.category && <p className="eyebrow">{String(item.category)}</p>}
            <h1>{item.name}</h1>

            <p className="product-price">
              {chooseFirst
                ? <span className="muted">Select an option</span>
                : formatPrice(pick(item, variant).unitAmount, pick(item, variant).currency)}
            </p>

            {item.description && <p>{item.description}</p>}

            {[...options.entries()].map(([key, values]) => (
              <div key={key} className="product-option">
                <span className="product-option-label">{key}</span>
                <div className="product-option-values" role="group" aria-label={key}>
                  {values.map(value => {
                    // Shown and disabled rather than hidden: options that appear and vanish while
                    // you choose are harder to use than a greyed-out size.
                    const sellable = item.variants?.some(
                      v => v.metadata?.[key] === value && v.purchasable !== false
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`chip${chosen[key] === value ? ' chip-active' : ''}`}
                        aria-pressed={chosen[key] === value}
                        disabled={!sellable}
                        onClick={() => setChosen(c => ({ ...c, [key]: value }))}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <dl className="product-facts">
              <dt>Delivery</dt>
              <dd>{item.type === 'digital' ? 'Downloadable — nothing to ship' : 'Shipped in a box'}</dd>
              <dt>Reference</dt>
              <dd><code>{pick(item, variant).id}</code></dd>
            </dl>

            {chooseFirst ? (
              <p className="muted">
                That combination is not available. Try another one.
              </p>
            ) : pick(item, variant).purchasable ? (
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

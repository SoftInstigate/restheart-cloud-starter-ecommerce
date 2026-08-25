import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, formatPrice, type CatalogItem } from '@restheart-cloud/kit-react';
import { environment } from '../../environments/environment';
import { useCart } from '../../shop/cart';
import { CATEGORIES } from '../../catalog.seed';
import './Shop.css';

/** How many products a page holds. Also how the end of the catalog is spotted. */
const PAGE_SIZE = 24;

/** So a customer typing "3.5" does not hand Mongo a regex of their own. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function Shop() {
  const auth = useAuth();
  const cart = useCart();

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
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  // Typing is not a query. Waiting a moment turns a word into one request
  // instead of one per keystroke, and the catalog is on the other side of a
  // network.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // A new question starts at the first page. Without this, switching category
  // while three pages deep asks the server for page four of a list that has
  // one page.
  useEffect(() => {
    setPage(1);
    setDone(false);
    setItems(null);
  }, [category, search]);

  /**
   * The catalog, filtered and a page at a time.
   *
   * Through `auth.api` rather than `payments.getCatalog`, which takes a page
   * and a size but no filter — and filtering in the browser would search only
   * what happens to be loaded, which for a paged list is a search that quietly
   * lies. `api` attaches the session when there is one and nothing when there
   * is not, so this is the same call for a guest and a customer.
   *
   * What comes back is still the ACL's decision: the permission carries a
   * readFilter on `purchasable`, so unsellable products never reach the client
   * whatever this asks for.
   */
  useEffect(() => {
    let cancelled = false;
    if (page > 1) setLoadingMore(true);

    const conditions: Record<string, unknown>[] = [];
    if (category) conditions.push({ category });
    // Anchored on neither end: "mug" should find "Enamel mug". `$options: 'i'`
    // rather than lower-casing the field, which would need an index we do not
    // control from here.
    if (search) conditions.push({ name: { $regex: escapeRegex(search), $options: 'i' } });

    const params = new URLSearchParams({ page: String(page), pagesize: String(PAGE_SIZE) });
    if (conditions.length === 1) params.set('filter', JSON.stringify(conditions[0]));
    if (conditions.length > 1) params.set('filter', JSON.stringify({ $and: conditions }));

    auth
      .api(`/${environment.catalogCollection}?${params}`)
      .then(res => res.json())
      .then((catalog: CatalogItem[]) => {
        if (cancelled) return;
        setItems(prev => (page === 1 ? catalog : [...(prev ?? []), ...catalog]));
        if (catalog.length < PAGE_SIZE) setDone(true);
        setLoadingMore(false);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        setLoadingMore(false);
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
  }, [auth, page, category, search]);

  // The sentinel sits under the grid; when it comes into view there is another
  // page to ask for. `rootMargin` starts the request a screen early, so the
  // next products are usually there before the reader arrives at the gap.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || items === null) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !loadingMore) setPage(p => p + 1);
      },
      { rootMargin: '600px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, items, loadingMore]);

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
  return (
    <div className="shop-page">
      {/* Cart and account moved to the site header, which every page has now.
          This row was the shop improvising one because it had none. */}
      <header className="shop-header">
        <div>
          <p className="eyebrow">Shop</p>
          <h1>Everything we make</h1>
        </div>
      </header>

      <div className="shop-filters">
        <input
          type="search"
          className="shop-search"
          placeholder="Search products"
          aria-label="Search products"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="shop-categories" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`chip${category === null ? ' chip-active' : ''}`}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`chip${category === c ? ' chip-active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (category || search) && (
        <p className="muted">Nothing matches that. Try another category, or clear the search.</p>
      )}

      {items.length === 0 && !category && !search && (
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
      {/* The observer watches this, not the last card: a card can be removed
          from the DOM by a filter change while the observer still holds it. */}
      {!done && <div ref={sentinel} className="shop-sentinel" aria-hidden="true" />}

      {loadingMore && <p className="muted shop-more">Loading more…</p>}

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

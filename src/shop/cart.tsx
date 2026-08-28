import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CatalogItem } from '@restheart-cloud/kit-react';

/**
 * The cart is the application's business, not the kit's — the kit takes a list
 * of `{ productId, quantity }` and creates an order from it. So this is plain
 * local state, persisted to localStorage so a reload does not empty it.
 *
 * Note what is *not* stored: the price. The server reads `unit_amount` from the
 * catalog when it builds the Checkout session, so a tampered client price
 * changes nothing. The amounts kept here are for display only.
 */

const STORAGE_KEY = 'rh-cart';

export interface CartLine {
  /** `tee-classic` for a plain product, `tee-classic/yellow-l` for a variant. */
  productId: string;
  quantity: number;
  /** Display only — the server prices the order from its own catalog. */
  name: string;
  /**
   * What was chosen, for a variant: `{ colour: 'yellow', size: 'L' }`.
   *
   * The name is the product's and stays the product's, because two variants of one thing are
   * called the same thing. Without this a cart holding a yellow L and a blue M shows two
   * identical lines — which is a cart nobody can check before paying.
   */
  options?: Record<string, string>;
  /** So the cart shows what is in it. A list of names is a receipt, not a cart. */
  image?: string;
  unitAmount: number;
  currency: string;
}

interface Cart {
  lines: CartLine[];
  totalItems: number;
  /** Display only. Minor units, and only meaningful if every line shares a currency. */
  subtotal: number;
  currency: string;
  /**
   * The cart as `createOrder` wants it.
   *
   * The chosen options travel as the line's `metadata`: they are the one thing
   * here the service cannot work out for itself. A reference like
   * `tee-classic/yellow-l` says which row of the catalog was bought, but the
   * seller reading the order wants "yellow, L" in fields rather than decoded
   * out of an id — and without this the order, the Stripe dashboard and the
   * confirmation email all say "Classic T-shirt" and never say which one.
   *
   * Same shape as `toOrderItems` in `@restheart-cloud/kit`, which is where this
   * whole file goes once that release is out.
   */
  orderItems: { productId: string; quantity: number; metadata?: Record<string, string> }[];
  add(item: CatalogItem, quantity?: number, options?: Record<string, string>, images?: string[]): void;
  setQuantity(productId: string, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
}

const CartContext = createContext<Cart | null>(null);

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function save(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // A full or blocked localStorage is not worth failing a checkout over.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);

  const update = useCallback((next: CartLine[]) => {
    setLines(next);
    save(next);
  }, []);

  const add = useCallback(
    (item: CatalogItem, quantity = 1, options?: Record<string, string>, images?: string[]) => {
      setLines(prev => {
        const existing = prev.find(l => l.productId === item._id);
        const next = existing
          ? prev.map(l => (l.productId === item._id ? { ...l, quantity: l.quantity + quantity } : l))
          : [
              ...prev,
              {
                productId: item._id,
                quantity,
                name: item.name,
                ...(options && Object.keys(options).length > 0 ? { options } : {}),
                ...(images?.[0] ? { image: images[0] } : {}),
                unitAmount: item.unit_amount,
                currency: item.currency ?? 'eur',
              },
            ];
        save(next);
        return next;
      });
    },
    []
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      setLines(prev => {
        const next =
          quantity <= 0
            ? prev.filter(l => l.productId !== productId)
            : prev.map(l => (l.productId === productId ? { ...l, quantity } : l));
        save(next);
        return next;
      });
    },
    []
  );

  const remove = useCallback((productId: string) => setQuantity(productId, 0), [setQuantity]);
  const clear = useCallback(() => update([]), [update]);

  const value = useMemo<Cart>(
    () => ({
      lines,
      totalItems: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.unitAmount * l.quantity, 0),
      currency: lines[0]?.currency ?? 'eur',
      orderItems: lines.map(({ productId, quantity, options }) => ({
        productId,
        quantity,
        ...(options && Object.keys(options).length > 0 ? { metadata: options } : {}),
      })),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}

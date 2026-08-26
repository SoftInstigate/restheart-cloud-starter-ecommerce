import type { CatalogItem, Order } from '@restheart-cloud/kit-react';

/**
 * A variant: one buyable combination of a product.
 *
 * Referenced as `<product-id>/<id>` — the id is unique inside its document and nowhere else, so
 * nothing has to keep variant ids apart across the whole catalog.
 *
 * Everything a variant does not declare it inherits from its product. That is the server's rule,
 * applied when an order is priced; the shop applies the same rule when it renders, which is why
 * `pick()` below exists rather than each component remembering to fall back.
 */
export type Variant = {
  id: string;
  unit_amount?: number;
  currency?: string;
  purchasable?: boolean;
  images?: string[];
  metadata?: Record<string, string>;
};

/**
 * The shop's own fields on top of the plugin's.
 *
 * `category` and `variants` are not things `restheart-stripe` defines: a catalog is a Mongo
 * collection like any other and the plugin ignores what it does not read. `variants` it does read
 * — but the shape the app needs to *render* them is its own.
 */
export type ShopItem = Omit<CatalogItem, 'image_url'> & {
  category?: string;
  images?: string[];
  metadata?: Record<string, string>;
  variants?: Variant[];
};

/** What a chosen variant costs, is called and looks like — its own values, else the product's. */
export function pick(item: ShopItem, variant?: Variant) {
  return {
    id: variant ? `${item._id}/${variant.id}` : item._id,
    unitAmount: variant?.unit_amount ?? item.unit_amount,
    currency: variant?.currency ?? item.currency ?? 'eur',
    purchasable: variant?.purchasable ?? item.purchasable,
    // Replaced, not merged: a gallery mixing every colour is worse than either.
    images: (variant?.images?.length ? variant.images : item.images) ?? [],
    metadata: variant?.metadata ?? item.metadata ?? {},
  };
}

/** The lowest price in a product, for the window: "from €25.00". */
export function fromPrice(item: ShopItem): number {
  if (!item.variants?.length) return item.unit_amount;
  return Math.min(...item.variants.map(v => v.unit_amount ?? item.unit_amount));
}

/**
 * The recipient's name on a delivery address.
 *
 * The kit's `Order` already declares `shipping_address` with the street fields. `name` arrived
 * later, when the webhook started recording what Stripe collects. Widened here so the app builds
 * against the published kit; drop this once a release carries it.
 */
export type ShopOrder = Order & {
  shipping_address?: (NonNullable<Order['shipping_address']> & { name?: string }) | null;
};

import type { CatalogItem, Order } from '@restheart-cloud/kit-react';

/**
 * The shop's own fields, on top of the plugin's.
 *
 * `category` is not something `restheart-stripe` defines: a catalog is a Mongo
 * collection like any other and the plugin ignores what it does not read, so
 * the field is this application's, and belongs in this application's type
 * rather than in the kit's. The kit describes the plugin; the shop describes
 * the shop.
 */
export type ShopItem = CatalogItem & {
  category?: string;
};

/**
 * The recipient's name on a delivery address.
 *
 * The kit's `Order` already declares `shipping_address` with the street fields.
 * `name` arrived later, when the webhook started recording what Stripe
 * collects — a parcel needs somebody to hand it to. Widened here so the app
 * builds against the published kit; drop this once a release carries it.
 */
export type ShopOrder = Order & {
  shipping_address?: (NonNullable<Order['shipping_address']> & { name?: string }) | null;
};

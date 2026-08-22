/**
 * Remembers the order across the trip to Stripe and back.
 *
 * This exists because of a constraint that is easy to discover the hard way:
 * **the success URL is configured on the service, not by the client.** It is
 * `stripeConfig.products.success-url`, and the only placeholder Stripe fills in
 * is `{CHECKOUT_SESSION_ID}` — not our order `_id`, and certainly not the
 * `secret`. So there is no way to have the buyer come back holding them.
 *
 * A guest has no session either, so nothing server-side can identify their
 * order on return. The `secret` is the only thing that can, which means the
 * client has to keep it. We write it down *before* redirecting.
 *
 * `localStorage` rather than `sessionStorage`: the buyer may well complete the
 * payment in a different tab, and sessionStorage would not follow them there.
 *
 * Treat the secret like a password — this is why it is cleared as soon as the
 * order reaches a final state.
 */

const KEY = 'rh-pending-order';

export interface PendingOrder {
  id: string;
  secret: string;
  /** Epoch ms — used to drop entries nobody ever came back for. */
  createdAt: number;
}

/** Pending orders older than this are assumed abandoned. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function rememberPendingOrder(id: string, secret: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, secret, createdAt: Date.now() }));
  } catch {
    // Nothing to do: the return page will fall back to asking for the order id.
  }
}

export function readPendingOrder(): PendingOrder | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrder;
    if (!parsed?.id || !parsed?.secret) return null;
    if (Date.now() - (parsed.createdAt ?? 0) > MAX_AGE_MS) {
      clearPendingOrder();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingOrder(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

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
 * **A list, not one entry.** It held a single order, so a second checkout
 * overwrote the first one's ticket and finishing either one cleared it for
 * both — two tabs open on the same shop, which is not an exotic thing to do,
 * and the buyer came back from the second payment to an empty orders page.
 * Each order is now cleared by its own id.
 *
 * Treat the secret like a password — this is why an entry is dropped as soon as
 * its order reaches a final state.
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

/** More than this and the oldest go: nobody has twelve live checkouts. */
const MAX_ENTRIES = 10;

/** Everything still worth keeping, newest first. */
function load(): PendingOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    // An entry written by the previous single-order version reads as an object.
    // Migrated rather than discarded: it may be the ticket to an order somebody
    // is paying for in the other tab right now.
    const list = Array.isArray(parsed) ? parsed : [parsed];

    const now = Date.now();
    return (list as PendingOrder[])
      .filter(e => e?.id && e?.secret && now - (e.createdAt ?? 0) <= MAX_AGE_MS)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
}

function save(entries: PendingOrder[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Nothing to do: the return page will fall back to asking for the order id.
  }
}

export function rememberPendingOrder(id: string, secret: string): void {
  save([{ id, secret, createdAt: Date.now() }, ...load().filter(e => e.id !== id)]);
}

/** The most recent one still outstanding, which is the one a buyer just left for. */
export function readPendingOrder(): PendingOrder | null {
  return load()[0] ?? null;
}

/** All of them, newest first. */
export function readPendingOrders(): PendingOrder[] {
  return load();
}

/**
 * Forgets one order, or every order when called with nothing.
 *
 * Pass the id. Clearing the lot because one order settled is what lost the
 * other tab's ticket.
 */
export function clearPendingOrder(id?: string): void {
  try {
    if (id === undefined) {
      localStorage.removeItem(KEY);
      return;
    }
    const left = load().filter(e => e.id !== id);
    if (left.length === 0) localStorage.removeItem(KEY);
    else save(left);
  } catch {
    // ignore
  }
}

/**
 * Where to go after signing in, when a page asked to be returned to.
 *
 * Only a path within this app is ever accepted. A `next` that carries a scheme
 * or a host — `https://elsewhere.example`, or the `//host` form a browser reads
 * as protocol-relative — is discarded and the caller lands on the default.
 *
 * That check is the whole reason this is a function rather than
 * `navigate(params.get('next'))`. A login page that forwards to whatever a
 * query string names is an open redirect: an attacker sends a link to your real
 * login page, the victim signs in for real, and is handed to a copy of your
 * site that asks them to do it again.
 */
export function safeNext(params: URLSearchParams, fallback = '/'): string {
  const next = params.get('next');
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

import { useEffect, useMemo } from 'react';
import { useRoutes } from 'react-router-dom';
import { isValidApiBaseUrl, setToken, scheduleRefresh } from '@restheart-cloud/kit-react';
import { environment } from './environments/environment';
import { setJustSignedUp } from './just-signed-up';
import { routes } from './routes';
import { ConfigPage } from './ConfigPage';
import { ConsentsGate } from './ConsentsGate';
import { Footer } from './ui/Footer';

function consumeFragmentToken(): void {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    if (accessToken) {
      setToken(accessToken);
      scheduleRefresh({ apiBaseUrl: environment.apiUrl });
    }
  }

  const search = new URLSearchParams(window.location.search);
  const isSignup = search.get('flow') === 'signup';
  if (isSignup) {
    setJustSignedUp(true);
    search.delete('flow');
  }

  if (!hash && !isSignup) return;

  const query = search.toString();
  history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
}

const apiConfigured = isValidApiBaseUrl(environment.apiUrl);

export function App() {
  useEffect(() => {
    if (!apiConfigured) {
      console.error(
        `[app] apiUrl must point to a RESTHeart Cloud service (*.restheart.com), got "${environment.apiUrl}". ` +
          'Set it in src/environments/environment.ts.'
      );
      return;
    }
    consumeFragmentToken();
  }, []);

  const activeRoutes = useMemo(() => (apiConfigured ? routes : []), []);
  const element = useRoutes(activeRoutes);

  if (!apiConfigured) {
    return <ConfigPage apiUrl={environment.apiUrl} />;
  }

  // Above the router on purpose: a blocked user cannot pass AuthGuard, because
  // the session check is one of the requests the rule refuses.
  //
  // The gate only ever fires for a signed-in user — a guest holds no token, so
  // `checkSession` short-circuits without a request and never sees a `451`.
  // The shop stays browsable and buyable for them, which is the point of
  // having it outside AuthGuard.
  // The footer is inside the gate, so a blocked user sees the acceptance form
  // and nothing else — including no seller details, which would be odd on a
  // screen that is not the shop. The Terms and Privacy links they need are on
  // the form itself.
  return (
    <ConsentsGate>
      {element}
      <Footer />
    </ConsentsGate>
  );
}

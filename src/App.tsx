import { useEffect, useMemo } from 'react';
import { useRoutes } from 'react-router-dom';
import { isValidApiBaseUrl, setToken, scheduleRefresh } from '@restheart-cloud/kit-react';
import { environment } from './environments/environment';
import { setJustSignedUp } from './just-signed-up';
import { routes } from './routes';
import { ConfigPage } from './ConfigPage';

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

  return element;
}

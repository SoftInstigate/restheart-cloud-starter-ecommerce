import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RhAuthProvider, RhPaymentsProvider } from '@restheart-cloud/kit-react';
import { App } from './App';
import { CartProvider } from './shop/cart';
import { environment } from './environments/environment';
import './styles.css';

// One config object for both providers. `payments: true` is what lets the
// adapter touch `/stripe/*` at all — products mode (catalog and orders) would
// work without it, but the flag also keeps subscription state available on a
// service that has both modes on.
const config = {
  apiBaseUrl: environment.apiUrl,
  payments: true,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RhAuthProvider config={config}>
        {/* Must sit inside RhAuthProvider — it reads the user from it. */}
        <RhPaymentsProvider config={config}>
          <CartProvider>
            <App />
          </CartProvider>
        </RhPaymentsProvider>
      </RhAuthProvider>
    </BrowserRouter>
  </StrictMode>
);

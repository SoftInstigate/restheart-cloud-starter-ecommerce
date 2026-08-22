import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RhAuthProvider } from '@restheart-cloud/kit-react';
import { App } from './App';
import { environment } from './environments/environment';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RhAuthProvider config={{ apiBaseUrl: environment.apiUrl }}>
        <App />
      </RhAuthProvider>
    </BrowserRouter>
  </StrictMode>
);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import App from './App';
import './styles.css';

registerSW({
  immediate: true,
  // look for a new version hourly while the app stays open
  onRegisteredSW: (_url, reg) => reg && setInterval(() => void reg.update(), 3600_000),
});

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

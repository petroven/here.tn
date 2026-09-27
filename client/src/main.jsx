import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './dark.css';
import { initTheme } from './utils/theme.js';

// Static hosts with no SPA fallback (e.g. the Claude Artifact preview) can't
// serve deep links, so the static build routes through the URL hash instead.
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

// Applique le thème avant le premier rendu pour éviter un flash clair.
initTheme();

const render = () => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);

// The static build has no API server: answer API calls from the bundled demo
// catalog snapshot. Loaded lazily so regular builds don't ship the snapshot.
if (import.meta.env.VITE_DEMO_API === 'true') {
  import('./demo/demoApi.js').then(({ installDemoApi }) => {
    installDemoApi();
    render();
  });
} else {
  render();
}

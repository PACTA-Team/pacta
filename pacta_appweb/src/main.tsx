import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider storageKey="pacta-theme">
        <Toaster position="top-right" richColors expand={false} />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

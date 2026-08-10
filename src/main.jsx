import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="bottom-right"
        visibleToasts={3}
        toastOptions={{
          classNames: {
            toast:
              'bg-ink-raised border border-ink-line-strong text-bone rounded-[3px] font-sans text-[0.82rem]',
            title: 'font-display uppercase tracking-[0.08em] text-[0.8rem]',
            description: 'text-bone-muted',
          },
        }}
      />
    </HashRouter>
  </StrictMode>,
);

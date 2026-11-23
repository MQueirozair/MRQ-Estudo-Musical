import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './ui/toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

// Evita o menu de contexto padrão do navegador no desktop (menos "cara de site")
if (typeof window !== 'undefined' && window.mrq?.isDesktop) {
  window.addEventListener('contextmenu', (e) => {
    const el = e.target as HTMLElement;
    if (!el.closest('input, textarea')) e.preventDefault();
  });
}

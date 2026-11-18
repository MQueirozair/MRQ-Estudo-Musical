import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { recordDiagnostic } from './settings';

window.addEventListener('error', (event) => recordDiagnostic('erro', event.message || 'Erro desconhecido'));
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  recordDiagnostic('promessa', reason instanceof Error ? reason.message : String(reason));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Ajustes finos para o app rodando no Android (WebView local).
 * - desativa o zoom por duplo toque (mais "cara de app")
 * - botão físico "voltar" não fecha o app de qualquer tela
 */
export function initAndroid() {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('native-app');

  // Impede o zoom por duplo toque
  let lastTouch = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );

  // Botão voltar: fecha só quando já está na tela principal
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void CapApp.minimizeApp();
    }
  });
}

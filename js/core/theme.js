// Modo oscuro (ver css/variables.css para la paleta). 'system' = no fijar data-theme en el
// <html> y dejar que decida @media (prefers-color-scheme) en CSS; 'light'/'dark' fijan el
// atributo explícito, ganando siempre sobre la preferencia del sistema. Persistido en
// settings.theme (sin migración: campo nuevo con fallback en código, igual que otros ajustes).

import State from './state.js';

function applyAttribute(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function getTheme() {
  return State.getSettings().theme || 'system';
}

export function setTheme(theme) {
  State.setSettings({ theme });
  applyAttribute(theme);
}

// Para el bootstrap inicial: aplica el valor ya guardado sin volver a escribirlo.
export function applyTheme() {
  applyAttribute(getTheme());
}

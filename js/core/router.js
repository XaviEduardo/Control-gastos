// Router hash-based simple, sin dependencias externas.

import { emit } from './events.js';

const routes = new Map();
let notFoundHandler = (container) => {
  container.innerHTML = '<p class="text-muted">Página no encontrada.</p>';
};
let container = null;
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

export function initRouter(rootEl, defaultPath = '/dashboard') {
  container = rootEl;
  window.addEventListener('hashchange', renderRoute);
  if (!window.location.hash) {
    window.location.hash = `#${defaultPath}`;
  }
  renderRoute();
}

export function navigateTo(path) {
  window.location.hash = `#${path}`;
}

function currentPath() {
  const hash = window.location.hash || '#/dashboard';
  return hash.slice(1).split('?')[0] || '/dashboard';
}

function renderRoute() {
  if (!container) return;
  if (typeof currentCleanup === 'function') currentCleanup();
  currentCleanup = null;

  const path = currentPath();
  const handler = routes.get(path) || notFoundHandler;
  container.innerHTML = '';
  // Un handler puede devolver una función de limpieza (ej. destruir gráficas Chart.js,
  // cancelar listeners) que se ejecuta antes de renderizar la siguiente ruta.
  const result = handler(container);
  if (typeof result === 'function') currentCleanup = result;
  emit('route:change', path);
}

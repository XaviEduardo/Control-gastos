import StorageService from './core/storage.js';
import State from './core/state.js';
import { on } from './core/events.js';
import { registerRoute, initRouter } from './core/router.js';
import { formatDateShort } from './core/dates.js';
import { renderEmptyState } from './components/empty-state.js';
import { iconMarkup } from './components/icons.js';
import { buildSeed } from './data/seed.js';
import { renderIncomeModule } from './modules/income/income.module.js';
import { renderExpenseModule } from './modules/expenses/expense.module.js';
import { renderMovementsModule } from './modules/movements/movements.module.js';
import { renderWeeklyModule } from './modules/weekly/weekly.module.js';
import { renderMonthlyModule } from './modules/monthly/monthly.module.js';
import { renderDashboardModule } from './modules/dashboard/dashboard.module.js';
import { renderCalendarModule } from './modules/calendar/calendar.module.js';
import { renderGroceryListModule } from './modules/grocery/grocery-list.module.js';
import { renderGroceryProductsModule } from './modules/grocery/products.module.js';
import { renderGroceryCategoriesModule } from './modules/grocery/categories.module.js';
import { renderStoresModule } from './modules/stores/stores.module.js';
import { renderPriceHistoryModule } from './modules/prices/price-history.module.js';
import { renderComparisonModule } from './modules/price-comparison/comparison.module.js';
import { renderBudgetModule } from './modules/budget/budget.module.js';
import { renderReportsModule } from './modules/reports/reports.module.js';
import { renderSettingsModule } from './modules/settings/settings.module.js';
import { setCurrency } from './core/currency.js';

// Fuente única de verdad para título+icono de cada ruta (V2-8: antes existía también un
// <nav> hardcodeado en index.html que se podía desincronizar de esto). El sidebar real se
// genera abajo con buildSidebarNav() a partir de ROUTE_META + NAV_GROUPS.
const ROUTE_META = {
  '/dashboard': { title: 'Dashboard', icon: 'grid' },
  '/movimientos': { title: 'Movimientos', icon: 'receipt' },
  '/ingresos': { title: 'Ingresos', icon: 'trending-up' },
  '/gastos': { title: 'Gastos', icon: 'trending-down' },
  '/semana': { title: 'Semana', icon: 'calendar' },
  '/mes': { title: 'Mes', icon: 'calendar' },
  '/presupuesto': { title: 'Presupuesto', icon: 'target' },
  '/mandado/lista': { title: 'Mi lista', icon: 'cart' },
  '/mandado/productos': { title: 'Productos', icon: 'box' },
  '/mandado/categorias': { title: 'Categorías', icon: 'tag' },
  '/mandado/tiendas': { title: 'Tiendas', icon: 'store' },
  '/mandado/comparar': { title: 'Comparar precios', icon: 'scale' },
  '/mandado/historial': { title: 'Historial de precios', icon: 'history' },
  '/calendario': { title: 'Calendario', icon: 'calendar' },
  '/reportes': { title: 'Reportes', icon: 'bar-chart' },
  '/configuracion': { title: 'Configuración', icon: 'settings' },
};

// Estructura del sidebar (V2-8 — simplificación de navegación). Ingresos/Gastos ya no son
// entradas directas: Movimientos los reemplaza en el sidebar y sigue enlazando a ambos para
// gestión avanzada (dueDay, método de pago) — ver movements.module.js#renderManageLinks.
// En Mandado, `links` son las tareas frecuentes (priorizadas primero) y `secondaryLinks` las
// menos frecuentes (Categorías/Tiendas/Historial), visualmente de-enfatizadas pero sin
// eliminarse del sidebar — todo sigue accesible en 1 interacción.
const NAV_GROUPS = [
  { links: ['/dashboard'] },
  { title: 'Finanzas', links: ['/movimientos', '/semana', '/mes', '/presupuesto'] },
  {
    title: 'Mandado',
    links: ['/mandado/lista', '/mandado/productos', '/mandado/comparar'],
    secondaryLinks: ['/mandado/categorias', '/mandado/tiendas', '/mandado/historial'],
  },
  { title: 'General', links: ['/calendario', '/reportes', '/configuracion'] },
];

function renderPlaceholder(meta) {
  return (container) => {
    container.appendChild(renderEmptyState({
      icon: '📋',
      title: meta.title,
      message: meta.description,
    }));
  };
}

function registerRoutes() {
  registerRoute('/dashboard', renderDashboardModule);
  registerRoute('/movimientos', renderMovementsModule);
  registerRoute('/ingresos', renderIncomeModule);
  registerRoute('/gastos', renderExpenseModule);
  registerRoute('/semana', renderWeeklyModule);
  registerRoute('/mes', renderMonthlyModule);
  registerRoute('/calendario', renderCalendarModule);
  registerRoute('/mandado/lista', renderGroceryListModule);
  registerRoute('/mandado/productos', renderGroceryProductsModule);
  registerRoute('/mandado/categorias', renderGroceryCategoriesModule);
  registerRoute('/mandado/tiendas', renderStoresModule);
  registerRoute('/mandado/historial', renderPriceHistoryModule);
  registerRoute('/mandado/comparar', renderComparisonModule);
  registerRoute('/presupuesto', renderBudgetModule);
  registerRoute('/reportes', renderReportsModule);
  registerRoute('/configuracion', renderSettingsModule);

  const implemented = new Set([
    '/dashboard', '/movimientos', '/ingresos', '/gastos', '/semana', '/mes', '/calendario', '/presupuesto', '/reportes', '/configuracion',
    '/mandado/lista', '/mandado/productos', '/mandado/categorias',
    '/mandado/tiendas', '/mandado/historial', '/mandado/comparar',
  ]);
  Object.entries(ROUTE_META).forEach(([path, meta]) => {
    if (implemented.has(path)) return;
    registerRoute(path, renderPlaceholder(meta));
  });
}

function buildNavLink(path, { secondary = false } = {}) {
  const meta = ROUTE_META[path];
  if (!meta) return null;
  const link = document.createElement('a');
  link.className = `sidebar__link${secondary ? ' sidebar__link--secondary' : ''}`;
  link.href = `#${path}`;
  link.dataset.route = path;
  const icon = document.createElement('span');
  icon.className = 'sidebar__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconMarkup(meta.icon, { size: 20 });
  link.append(icon, ` ${meta.title}`);
  return link;
}

// Genera el <nav> del sidebar a partir de NAV_GROUPS + ROUTE_META en vez de HTML hardcodeado
// en index.html (V2-8 — elimina la segunda fuente de verdad que podía desincronizarse).
function buildSidebarNav() {
  const nav = document.querySelector('.sidebar__nav');
  if (!nav) return;
  nav.innerHTML = '';

  NAV_GROUPS.forEach((group) => {
    if (group.title) {
      const title = document.createElement('p');
      title.className = 'sidebar__group-title';
      title.textContent = group.title;
      nav.appendChild(title);
    }
    group.links.forEach((path) => {
      const link = buildNavLink(path);
      if (link) nav.appendChild(link);
    });
    (group.secondaryLinks || []).forEach((path) => {
      const link = buildNavLink(path, { secondary: true });
      if (link) nav.appendChild(link);
    });
  });
}

function updatePageHeader(path) {
  const meta = ROUTE_META[path] || { title: 'Control de Gastos' };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = meta.title;

  document.querySelectorAll('.sidebar__link').forEach((link) => {
    link.classList.toggle('sidebar__link--active', link.dataset.route === path);
  });

  document.body.classList.remove('sidebar-open');
  const toggle = document.getElementById('sidebarToggle');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Abrir menú');
}

function updateLastSavedLabel() {
  const label = document.getElementById('lastSavedLabel');
  if (!label) return;
  const lastUpdated = StorageService.getLastUpdated();
  label.textContent = lastUpdated ? `Guardado ${formatDateShort(lastUpdated)}` : '';
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  // Mismo umbral que el drawer en css/responsive.css (mobile < 640px).
  const desktopQuery = window.matchMedia('(min-width: 640px)');

  function setOpen(open) {
    document.body.classList.toggle('sidebar-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  toggle?.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('sidebar-open'));
  });
  overlay?.addEventListener('click', () => setOpen(false));

  // Si el viewport crece a tablet/desktop mientras el drawer estaba abierto, se cierra.
  // El CSS del drawer ya está scopeado a <640px (deja de tener efecto visual solo), pero
  // sin esto la clase seguiría en el body y el drawer reaparecería "ya abierto" si el
  // usuario volviera a angostar la ventana sin tocar antes el botón de menú.
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

function bootstrap() {
  State.init(buildSeed);
  setCurrency(State.getSettings().currency || 'MXN');

  on('route:change', updatePageHeader);
  on('change', updateLastSavedLabel);

  buildSidebarNav();
  registerRoutes();
  setupSidebarToggle();
  initRouter(document.getElementById('appContent'), '/dashboard');

  updateLastSavedLabel();
}

document.addEventListener('DOMContentLoaded', bootstrap);

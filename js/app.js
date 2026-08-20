import StorageService from './core/storage.js';
import State from './core/state.js';
import { on } from './core/events.js';
import { registerRoute, initRouter } from './core/router.js';
import { formatDateShort } from './core/dates.js';
import { renderEmptyState } from './components/empty-state.js';
import { buildSeed } from './data/seed.js';
import { renderIncomeModule } from './modules/income/income.module.js';
import { renderExpenseModule } from './modules/expenses/expense.module.js';
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

const ROUTE_META = {
  '/dashboard': { title: 'Dashboard', icon: '📊' },
  '/ingresos': { title: 'Ingresos', icon: '💵' },
  '/gastos': { title: 'Gastos', icon: '🧾' },
  '/semana': { title: 'Semana', icon: '📅' },
  '/mes': { title: 'Mes', icon: '🗓️' },
  '/presupuesto': { title: 'Presupuesto', icon: '🎯' },
  '/mandado/lista': { title: 'Mi lista', icon: '🛒' },
  '/mandado/productos': { title: 'Productos', icon: '🥕' },
  '/mandado/categorias': { title: 'Categorías', icon: '🏷️' },
  '/mandado/tiendas': { title: 'Tiendas', icon: '🏬' },
  '/mandado/comparar': { title: 'Comparar precios', icon: '⚖️' },
  '/mandado/historial': { title: 'Historial de precios', icon: '📈' },
  '/calendario': { title: 'Calendario', icon: '📆' },
  '/reportes': { title: 'Reportes', icon: '📑' },
  '/configuracion': { title: 'Configuración', icon: '⚙️' },
};

function renderPlaceholder(meta) {
  return (container) => {
    container.appendChild(renderEmptyState({
      icon: meta.icon,
      title: meta.title,
      message: meta.description,
    }));
  };
}

function registerRoutes() {
  registerRoute('/dashboard', renderDashboardModule);
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
    '/dashboard', '/ingresos', '/gastos', '/semana', '/mes', '/calendario', '/presupuesto', '/reportes', '/configuracion',
    '/mandado/lista', '/mandado/productos', '/mandado/categorias',
    '/mandado/tiendas', '/mandado/historial', '/mandado/comparar',
  ]);
  Object.entries(ROUTE_META).forEach(([path, meta]) => {
    if (implemented.has(path)) return;
    registerRoute(path, renderPlaceholder(meta));
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

  function setOpen(open) {
    document.body.classList.toggle('sidebar-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  toggle?.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('sidebar-open'));
  });
  overlay?.addEventListener('click', () => setOpen(false));
}

function bootstrap() {
  State.init(buildSeed);
  setCurrency(State.getSettings().currency || 'MXN');

  on('route:change', updatePageHeader);
  on('change', updateLastSavedLabel);

  registerRoutes();
  setupSidebarToggle();
  initRouter(document.getElementById('appContent'), '/dashboard');

  updateLastSavedLabel();
}

document.addEventListener('DOMContentLoaded', bootstrap);

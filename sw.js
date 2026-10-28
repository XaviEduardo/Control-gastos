// Service worker del "app shell" (PWA básica). Cache-first SOLO para assets same-origin
// precacheados aquí abajo. Las peticiones cross-origin (Supabase, Chart.js/supabase-js por CDN)
// se dejan pasar intactas sin pasar por 'respondWith' en absoluto — esta app sincroniza datos
// reales en vivo con Supabase, así que esas peticiones NUNCA deben servirse desde caché.

const CACHE_NAME = 'control-gastos-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './css/responsive.css',
  './js/app.js',
  './js/core/dates.js',
  './js/core/events.js',
  './js/core/id.js',
  './js/core/router.js',
  './js/core/validators.js',
  './js/core/currency.js',
  './js/core/state.js',
  './js/core/storage.js',
  './js/core/auth.js',
  './js/core/auth-gate.js',
  './js/core/supabaseClient.js',
  './js/data/seed.js',
  './js/components/action-menu.js',
  './js/components/confirm-dialog.js',
  './js/components/empty-state.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/components/category-manager.js',
  './js/components/month-year-nav.js',
  './js/components/progress-card.js',
  './js/components/stat-card.js',
  './js/components/table.js',
  './js/components/icons.js',
  './js/modules/budget/budget.repository.js',
  './js/modules/budget/budget.module.js',
  './js/modules/dashboard/dashboard.module.js',
  './js/modules/calendar/calendar.module.js',
  './js/modules/monthly/monthly.module.js',
  './js/modules/weekly/weekly.module.js',
  './js/modules/movements/movements.module.js',
  './js/modules/income/income.repository.js',
  './js/modules/income/income.module.js',
  './js/modules/expenses/expense.repository.js',
  './js/modules/expenses/expense.module.js',
  './js/modules/expenses/expense-payment.repository.js',
  './js/modules/shared/category-repository.js',
  './js/modules/shared/movement-form.js',
  './js/modules/shared/movement-template.repository.js',
  './js/modules/settings/settings.module.js',
  './js/modules/settings/movement-templates-section.js',
  './js/modules/grocery/product.repository.js',
  './js/modules/grocery/units.js',
  './js/modules/grocery/categories.module.js',
  './js/modules/grocery/grocery-branch-section.js',
  './js/modules/grocery/grocery-item-groups.js',
  './js/modules/grocery/grocery-item-row.js',
  './js/modules/grocery/grocery-list-item-form.js',
  './js/modules/grocery/grocery-list-item.repository.js',
  './js/modules/grocery/grocery-list.module.js',
  './js/modules/grocery/grocery-list.repository.js',
  './js/modules/grocery/product-variant.repository.js',
  './js/modules/grocery/products.module.js',
  './js/modules/grocery/variant-format.js',
  './js/modules/price-comparison/comparison-level-one.js',
  './js/modules/price-comparison/comparison-level-two.js',
  './js/modules/price-comparison/comparison.module.js',
  './js/modules/prices/price-form.js',
  './js/modules/prices/price-history.module.js',
  './js/modules/prices/price.repository.js',
  './js/modules/reports/reports-charts.js',
  './js/modules/reports/reports-grocery-insights.js',
  './js/modules/reports/reports.module.js',
  './js/modules/stores/store-branch.repository.js',
  './js/modules/stores/store-chain.repository.js',
  './js/modules/stores/store.repository.js',
  './js/modules/stores/stores.module.js',
  './js/services/comparisonService.js',
  './js/services/groceryService.js',
  './js/services/movementTemplateService.js',
  './js/services/priceService.js',
  './js/services/purchaseObservationService.js',
  './js/services/budgetService.js',
  './js/services/financeService.js',
  './js/services/recurrenceService.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  // Regla innegociable: cualquier petición que no sea de este mismo origen (Supabase, CDNs de
  // Chart.js/supabase-js) se deja pasar sin tocar — nunca se cachea ni se sirve desde caché.
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});

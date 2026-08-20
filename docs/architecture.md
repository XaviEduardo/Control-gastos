# Arquitectura — Control de Gastos (App Web Local)

## Principios
- Vanilla JS ES6+ (módulos nativos `type="module"`), HTML5, CSS3. Sin build step.
- Ejecutable abriendo `index.html` o con Live Server.
- Capas separadas: **Storage → State → Services (lógica financiera) → Modules (UI) → Components (UI reutilizable)**.
- La UI nunca calcula finanzas ni accede a `localStorage` directamente.
- Toda entidad se relaciona por `id`, nunca por nombre.

## Estructura de carpetas

```
/
├── index.html
├── CLAUDE.md
├── docs/
│   ├── excel-analysis.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── roadmap.md
│   └── decisions.md
├── css/
│   ├── variables.css      (tokens: color, espaciado, tipografía, radios)
│   ├── base.css           (reset, tipografía base)
│   ├── layout.css         (sidebar, grid principal, header)
│   ├── components.css     (cards, tablas, modales, badges, progress bars)
│   ├── utilities.css      (helpers: flex, spacing, text)
│   └── responsive.css     (breakpoints)
├── js/
│   ├── app.js                     # bootstrap: init storage → state → router → render
│   ├── core/
│   │   ├── router.js               # hash-router simple (#/dashboard, #/gastos, ...)
│   │   ├── storage.js              # StorageService (fachada; hoy = localStorage)
│   │   ├── state.js                # store en memoria + pub/sub (getState/setState/subscribe)
│   │   ├── events.js               # EventBus mínimo (emit/on) para desacoplar módulos
│   │   ├── dates.js                # semana ISO, mes, año, rangos, recurrencias
│   │   ├── currency.js             # formatMoney(), config de moneda (MXN inicial)
│   │   ├── validators.js           # validaciones reutilizables de formularios
│   │   └── id.js                   # generación de IDs (uuid-like)
│   ├── services/                   # LÓGICA DE NEGOCIO (única fuente de verdad de cálculos)
│   │   ├── financeService.js       # totalIncome, totalExpenses, balance, budgetRemaining
│   │   ├── periodService.js        # agregaciones por semana/mes/año
│   │   ├── recurrenceService.js    # expansión de gastos/ingresos recurrentes a ocurrencias
│   │   ├── groceryService.js       # totales de mandado, subtotales por categoría
│   │   └── priceService.js         # comparación de precios, normalización por unidad, ahorro
│   ├── modules/                     # una carpeta por vista de negocio (UI + wiring, sin cálculos propios)
│   │   ├── dashboard/
│   │   ├── income/
│   │   ├── expenses/
│   │   ├── weekly/
│   │   ├── monthly/
│   │   ├── budget/
│   │   ├── grocery/            # productos, categorías, lista/mandado
│   │   ├── stores/
│   │   ├── price-comparison/
│   │   ├── calendar/
│   │   ├── reports/
│   │   └── settings/           # datos: export/import/reset, moneda, preferencias
│   ├── components/
│   │   ├── modal.js
│   │   ├── toast.js
│   │   ├── table.js
│   │   ├── filters.js
│   │   ├── confirm-dialog.js
│   │   └── empty-state.js
│   └── data/
│       └── seed.js             # datos iniciales derivados del Excel (solo 1ª ejecución)
└── assets/
```

Cada módulo de `modules/<x>/` sigue el mismo patrón interno:
```
<x>/
  <x>.view.js      # construye el DOM de la vista
  <x>.controller.js # maneja eventos de UI, llama a services y storage, re-renderiza
  <x>.repository.js # (si aplica) CRUD de la entidad sobre StorageService
```
No todos los módulos necesitan las 3 piezas — módulos simples pueden fusionar view+controller. Evitar archivos > ~300 líneas; si crece, dividir por sub-responsabilidad.

## Flujo de datos (patrón obligatorio)
```
Acción de usuario (UI)
   → Controller del módulo
   → valida entrada (core/validators.js)
   → Repository (CRUD) → StorageService.save()
   → State.setState(...) (actualiza estado en memoria + notifica vía events.js)
   → Módulos suscritos re-renderizan (dashboard, reportes, etc.)
```

## StorageService (capa de persistencia desacoplada)
Interfaz estable, independiente del motor real:
```js
StorageService.get(collection)              // -> array/obj
StorageService.set(collection, data)         // persiste inmediatamente
StorageService.save()                        // flush explícito si se requiere
StorageService.load()                        // hidrata todo el estado al iniciar
StorageService.remove(collection)
StorageService.clear()                       // borra TODO (requiere confirmación en UI)
StorageService.exportData()                  // -> objeto/JSON serializable completo
StorageService.importData(json)              // valida versión + estructura, reemplaza datos
```
Implementación v1: adaptador `localStorageAdapter` (una sola clave raíz en localStorage con el documento completo versionado — evita 15 claves sueltas y facilita export/import). Migrar a IndexedDB/API más adelante solo requiere un nuevo adaptador que cumpla la misma interfaz; nada fuera de `core/storage.js` cambia.

## State
Store simple en memoria (objeto + `subscribe(topic, callback)` + `emit(topic, payload)`), poblado por `StorageService.load()` al bootstrap. Los módulos leen del State, nunca leen `localStorage` directamente ni vuelven a pedir todo el storage en cada render.

## Router
Hash-based (`#/dashboard`, `#/gastos`, `#/mandado/lista`, etc.) con un mapa de rutas → función `render(container)` de cada módulo. Sin dependencias externas.

## Cálculos financieros centralizados
Todo cálculo vive en `services/*.js`. Ejemplos de contrato:
```
financeService.totalIncome(periodo)
financeService.totalExpenses(periodo)
financeService.balance(periodo)
financeService.categoryExpenses(periodo)
financeService.budgetRemaining(categoryId, periodo)
groceryService.groceryTotal(listId)
priceService.bestPrice(productId)
priceService.optimizedCart(listId)
priceService.potentialSavings(listId)
```
`periodo` = `{ type: 'week'|'month'|'year', date }`, resuelto por `core/dates.js`. Ningún módulo de UI reimplementa una suma o un balance.

## Gráficas
Chart.js vía CDN, solo en `dashboard`, `reports` y `price-comparison` (evolución de precio). No se agregan librerías de calendario externas en v1: un calendario mensual simple se construye a mano (grid de días) — suficientemente simple para no justificar una dependencia.

## Recurrencias
`recurrenceService.js` expande un `Expense`/`Income` con `frequency` (único, semanal, quincenal, mensual, anual, personalizado) en ocurrencias concretas dentro de un rango de fechas, para alimentar calendario, vista semanal/mensual y dashboard sin duplicar lógica de fechas en cada módulo.

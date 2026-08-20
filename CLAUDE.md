# Control de Gastos — App de finanzas personales + mandado

## Propósito
Reemplazar `Control_de_Gastos.xlsx` con una app web local para ingresos, gastos, presupuesto, vista semanal/mensual, mandado/canasta básica, tiendas, precios/comparador y reportes.

## Stack (v1)
HTML5 + CSS3 + JS Vanilla ES6 (módulos nativos). Sin build, sin frameworks, sin backend. Chart.js por CDN. Persistencia: `localStorage` detrás de `StorageService` (ver `docs/architecture.md`). Se abre con `index.html` o Live Server.

## Reglas fundamentales
- Toda persistencia pasa por `js/core/storage.js` (`StorageService`). Nunca `localStorage` directo desde módulos.
- Toda entidad se relaciona por `id`, nunca por nombre (`categoryId`, `storeId`, `productId`...).
- Toda lógica financiera/mandado vive en `js/services/*.js`. La UI (`js/modules/*`) solo consume, nunca calcula.
- El seed (`js/data/seed.js`) solo se carga si NO hay datos guardados, o en "Restablecer datos" explícito. Nunca sobrescribe datos reales del usuario.
- Cada mutación válida se persiste inmediatamente (auto-save), sin botón "Guardar".
- Nada de categorías/tiendas/tipos hardcodeados en la UI — todo debe ser CRUD por el usuario, con seed inicial editable.
- No sobre-arquitecturar: módulos pequeños, sin abstracciones para casos hipotéticos.

## Dónde consultar
- `docs/excel-analysis.md` — referencia funcional original (hojas, fórmulas, datos reales del Excel).
- `docs/architecture.md` — estructura de carpetas, capas, StorageService, patrón de módulos.
- `docs/data-model.md` — entidades y su forma exacta.
- `docs/roadmap.md` — fases, estado de cada una, backlog priorizado, criterios de aceptación.
- `docs/decisions.md` — decisiones ya tomadas (no reabrir sin motivo nuevo).

## Delegación (Tech Lead orquesta, agentes con alcance acotado)
- **Excel Analyst**: ya ejecutado, no se re-invoca salvo dato faltante puntual.
- **Architecture**: cambios a `core/`, `services/`, estructura de carpetas.
- **UI/UX**: `css/*`, `components/*`, layout de `modules/*` — nunca lógica financiera.
- **Finance**: `services/financeService.js`, `recurrenceService.js`, módulos income/expenses/weekly/monthly/budget.
- **Grocery**: módulos grocery/stores/price-comparison + `groceryService.js`/`priceService.js`.
- **QA/Reviewer**: se invoca al cerrar cada fase del roadmap; revisa sin reescribir archivos completos.
Un solo agente escribe cada archivo por tarea (evitar ediciones simultáneas al mismo archivo).

## Flujo de trabajo
Al continuar una fase: leer `roadmap.md` (estado) + doc específico de esa fase → implementar solo esa fase → validar criterios de aceptación de `roadmap.md` → actualizar estado en `roadmap.md` → reportar en formato compacto. No releer el Excel ni toda la arquitectura salvo necesidad concreta.

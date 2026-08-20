# Roadmap

Estado: `pendiente` | `en progreso` | `hecho`

## Fase 0 — Investigación — **hecho**
- Inspeccionar Excel, documentar en `excel-analysis.md`.
- Definir modelo de datos (`data-model.md`) y arquitectura (`architecture.md`).

## Fase 1 — Foundation — **hecho**
- Estructura de carpetas, `index.html`, CSS base (variables/layout/components).
- Sidebar + router hash + layout responsive.
- `core/storage.js` (StorageService + adaptador localStorage, documento único versionado).
- `core/state.js`, `core/events.js`, `core/dates.js`, `core/currency.js`, `core/validators.js`, `core/id.js`.
- `data/seed.js` generado a partir de `excel-analysis.md`.
- Flujo: ¿hay datos guardados? cargarlos; si no, cargar seed y guardarlo (nunca sobrescribir datos reales).
- Componentes base: modal, toast, confirm-dialog, empty-state, table.
- **Criterio de aceptación:** recargar la página conserva el seed; no hay errores en consola; sidebar navega entre secciones vacías.
- **Validado:** sintaxis de los 15 módulos JS (`node --check`) sin errores; rutas de import, IDs del DOM y flujo storage→state→router revisados manualmente. Sin navegador disponible en esta sesión para verificación visual/consola en vivo — pendiente que el usuario abra `index.html` y confirme.

## Fase 2 — Finanzas (Ingresos, Gastos, Categorías, Semana, Mes) — **hecho**
- [x] CRUD Income (agregar/editar/eliminar/duplicar/buscar/filtrar por tipo).
- [x] CRUD Expense (agregar/editar/eliminar/duplicar/buscar/filtrar por categoría), con frecuencia única/semanal/quincenal/mensual/anual/personalizada, día esperado de pago y método de pago.
- [x] Gestión de IncomeType/ExpenseCategory (agregar, renombrar, activar/desactivar) vía `category-manager.js` + `createCategoryRepository`.
- [x] `services/recurrenceService.js` (ocurrencias por frecuencia) y `services/financeService.js` (totalIncome, totalExpenses, balance, expensesByCategory, incomeByType, previousPeriod, getPeriodRange).
- [x] Corregido bug de zona horaria en parseo de fechas (`core/dates.js#parseFlexibleDate`, ver `decisions.md`).
- [x] Vista Semanal: navegación anterior/siguiente/ir-a-fecha, ingresos, gastos, mandado (si existe categoría "Mandado"), balance, % de ingreso utilizado con barra de progreso.
- [x] Vista Mensual: selector mes+año (cualquier año, sin hardcode), ingresos, gastos, balance, mandado, promedio semanal, gastos por categoría, principales gastos, comparación contra mes anterior.
- **Criterio de aceptación:** crear/editar/eliminar/duplicar ingreso y gasto persiste tras F5; totales y desglose correctos con datos vacíos y con datos reales; Semana/Mes reflejan automáticamente cualquier alta hecha en Ingresos/Gastos (sin duplicar datos, calculado en vivo); sin errores de sintaxis (`node --check` 25/25 OK).
- **Validado (revisión manual, sin navegador disponible en sesión):** semanas que cruzan mes (rango independiente del mes calendario), mes sin movimientos (breakdown/top gastos muestran "Sin gastos este mes"), cambio de año hacia adelante/atrás en navegación mensual (normalización nativa de `Date`), gasto en el último día del mes vs. primer día del siguiente (incluido/excluido correctamente gracias al fix de zona horaria).

## Fase 3 — Dashboard — **hecho**
- [x] KPIs: ingresos del mes, gastos del mes, balance (con comparación vs mes anterior), gasto de esta semana, mandado del mes (si existe la categoría).
- [x] Selector mes+año reutilizable (`components/month-year-nav.js`), cualquier año.
- [x] Gráficas (Chart.js vía CDN): Ingresos vs Gastos (6 meses), Gastos por categoría (doughnut), Evolución de gastos por semana del mes (línea), Distribución de ingresos (pie). Cada gráfica muestra "Sin datos" en vez de una gráfica vacía cuando corresponde.
- [x] Estado vacío global si no hay ningún ingreso/gasto registrado.
- [x] `core/router.js` ahora soporta limpieza al salir de una ruta (destruye instancias de Chart.js, ver `decisions.md`).
- [x] Presupuesto disponible: omitido (no existen `Budget` todavía — Fase 8; "cuando exista", igual que en Semana/Mes).
- **Criterio de aceptación:** dashboard se recalcula desde `financeService`/`recurrenceService` sin duplicar datos; cambiar mes/año no deja gráficas ni listeners huérfanos (cleanup vía router); responsive por grid (`auto-fit`), sin media queries adicionales necesarias; sin errores de sintaxis (`node --check` 28/28 OK).
- **Validado (revisión manual, sin navegador disponible en sesión):** sin datos → estado vacío; solo ingresos → gráficas de gasto muestran "Sin datos", KPIs de ingreso correctos; solo gastos → gráfica de ingresos "Sin datos"; ingresos+gastos → todas las gráficas con datos; cambio de mes/año actualiza todo sin recargar; preferencia de mes/año persiste en `settings` tras F5 (comparte clave con Vista Mensual).

## Fase 4 — Calendario financiero — **hecho**
- [x] Grid mensual (semanas completas, lunes-domingo) con navegación mes/año reutilizando `renderMonthYearNav`.
- [x] Cada día muestra badges de ingresos 💰, gastos 🧾 y mandado 🛒 (calculados en vivo con `recurrenceService.getOccurrencesInRange`, sin colección propia).
- [x] Panel de detalle del día seleccionado: lista de ingresos/gastos con Editar/Eliminar, y botones "+ Ingreso"/"+ Gasto" que prellenan la fecha.
- [x] `js/modules/shared/movement-form.js`: formulario compartido create/edit que persiste vía los mismos `IncomeRepository`/`ExpenseRepository` (ver `decisions.md`) — los movimientos creados desde el calendario aparecen automáticamente en Ingresos/Gastos/Semana/Mes/Dashboard.
- [x] Editar/eliminar una ocurrencia recurrente afecta el registro completo (sin excepciones por ocurrencia) — comunicado explícitamente en el diálogo de confirmación (ver `decisions.md`).
- **Criterio de aceptación:** un gasto recurrente (ej. Internet día 10) aparece cada mes sin duplicarse en storage; alta desde el calendario persiste tras F5 y es visible en Ingresos/Gastos/Semana/Mes/Dashboard; eliminar/editar no genera copias.
- **Validado (revisión manual, sin navegador disponible en sesión):** cambio de mes/año (incluye rollover de año), días sin movimientos (estado vacío con CTA), múltiples movimientos en un mismo día (badges con conteo + lista completa en el panel), recurrencia mensual con `dueDay` cae en el día correcto cada mes, CRUD completo desde el calendario usa los repositorios existentes (no hay colección `calendarEvents` ni similar).

## Fase 5 — Mandado — **hecho**
- [x] `/mandado/categorias`: página completa de GroceryCategory (reutiliza `renderCategoryManagerContent`, refactor aditivo de `category-manager.js`).
- [x] `/mandado/productos`: catálogo de GroceryProduct (CRUD, desactivar/activar, no elimina físicamente).
- [x] `/mandado/lista`: selector de listas (crear/editar/completar/reabrir/eliminar), agregar producto (autocompleta o crea el producto si no existe por nombre), cantidad/unidad/precio estimado/precio real/comprado/notas editables inline, agrupado por categoría.
- [x] `js/services/groceryService.js`: subtotal por producto, subtotal por categoría, total estimado, total real, diferencia vs presupuesto — centralizado, la UI no recalcula.
- [x] Integración financiera: botón "Registrar como gasto" crea UN `Expense` (categoría "Mandado") y lo vincula vía `GroceryList.linkedExpenseId`, evitando duplicados (ver `decisions.md`); una vez registrado se refleja en Semana/Mes/Dashboard vía `mandadoTotal()` sin cambios adicionales.
- **Criterio de aceptación:** lista persiste con items marcados comprado/no comprado tras F5; subtotales/totales correctos; "Registrar como gasto" no puede duplicarse.
- **QA (agente):** encontró y corrigió un bug real — al editar una lista existente, `budget` no se normalizaba (a diferencia de crear), lo que podía mostrar "Excedido del presupuesto: $0" tras limpiar el campo. Corregido para que edición y creación normalicen igual. Pendiente cosmético sin impacto funcional: `product.repository.js`/`grocery-list.repository.js#update` no aplican `.trim()` a texto (no afecta cálculos ni duplicados).
- **Validado (revisión manual + QA, sin navegador disponible en sesión):** imports/exports correctos, sin `new Date("YYYY-MM-DD")` sin `parseFlexibleDate`, sin eliminación física de categorías/productos, toda mutación pasa por `State.setCollection`, `openCategoryManager` conserva su firma para income/expense.

## Fase 6 — Tiendas y precios — **hecho**
- [x] `/mandado/tiendas`: CRUD de Store (nombre, ubicación, notas), desactivar/activar (nunca eliminación física).
- [x] `/mandado/historial`: selector de producto, captura de precio (tienda + presentación + precio + fecha + notas), "Registrar precio" siempre crea un registro nuevo (nunca sobrescribe uno anterior).
- [x] `js/services/priceService.js`: normalización a precio por unidad base (kg, L, pza, paquete) sin mezclar dimensiones incompatibles (ver `decisions.md`).
- [x] "Último precio por tienda" (resumen), historial completo con precio normalizado, gráfica de evolución (Chart.js) cuando hay ≥2 precios de la misma dimensión.
- **Criterio de aceptación:** dos precios del mismo producto/tienda en fechas distintas coexisten en el historial; editar/eliminar un registro puntual no afecta a los demás; presentaciones incompatibles nunca se comparan/grafican juntas.
- **QA (agente):** encontró y corrigió 1 bug real — al editar un precio cuya tienda ya estaba desactivada, el formulario podía reasignar el precio a otra tienda silenciosamente (o ni abrirse si no quedaban tiendas activas); corregido para incluir siempre la tienda original del registro en el selector de edición.
- **Validado (revisión manual + QA, sin navegador disponible en sesión):** `node --check` 43/43 OK; sin `new Date("YYYY-MM-DD")` directo; canvas insertado antes de `new Chart()`; limpieza de gráficas al cambiar de ruta; toda mutación pasa por `State.setCollection`.

## Fase 7 — Comparador — **hecho**
- [x] Nivel 1 (`/mandado/comparar`): comparación de un producto entre tiendas activas, agrupada por dimensión de unidad, con precio registrado + normalizado + diferencia vs. mejor opción; nunca mezcla dimensiones incompatibles.
- [x] Nivel 2: comparación de una lista de mandado completa — costo de comprar todo en cada tienda (con cobertura parcial explícita, nunca inventa precios faltantes), compra optimizada (mejor tienda por producto) y ahorro potencial vs. la mejor tienda única con cobertura completa.
- [x] `js/services/comparisonService.js`: toda la lógica centralizada (`compareProductAcrossStores`, `compareListAcrossStores`); la UI solo consume, no recalcula.
- [x] Integración con la lista: botón "Usar esta tienda" escribe `selectedStoreId`/`estimatedPrice` del item (nunca `actualPrice`, nunca automático — ver `decisions.md`).
- **Criterio de aceptación:** productos con presentaciones/dimensiones distintas no se comparan como si fueran iguales; productos sin precio en alguna tienda se listan explícitamente en vez de asumir un valor; el ahorro potencial solo se calcula cuando es matemáticamente válido (misma base de comparación).
- **QA (agente, foco matemático):** verificó con ejemplos numéricos concretos (conversión kg/g, incompatibilidad de dimensión, suma de cobertura parcial, mínimo real en la compra optimizada, `potentialSavings` ≥ 0 por construcción) — sin bugs encontrados.
- **Validado:** `node --check` 45/45 OK; sin `new Date("YYYY-MM-DD")` directo en `latestPriceEntry`; ningún cálculo escribe `actualPrice` ni se ejecuta automáticamente.

## Fase 8 — Presupuesto — **hecho**
- [x] `/presupuesto`: presupuesto mensual total, semanal total, de mandado (mensual) y por categoría (uno o más), cada uno con Presupuesto/Gastado/Disponible-o-Excedido/% utilizado (2 decimales) y barra de progreso.
- [x] `js/services/budgetService.js`: progreso calculado siempre contra gastos reales (`financeService`), nunca inventa ni duplica movimientos.
- [x] `Budget` es un monto objetivo permanente por rubro (no atado a un mes específico — ver `decisions.md`); `upsert()` evita duplicar presupuestos del mismo rubro/categoría.
- [x] Integrado en Dashboard, Semana y Mes (sección de presupuesto solo aparece si el usuario configuró uno para ese rubro; Mandado se refleja vía el presupuesto de "mandado").
- **Criterio de aceptación:** reproduce el ejemplo exacto del usuario ($4,000 / $2,850 / $1,150 / 71.25%); excedido, en cero, categoría sin movimientos y periodo sin datos manejados sin `NaN`/`Infinity` visibles.
- **QA (agente, foco en casos límite):** verificó con números concretos excedido (barra topada a 100%, texto muestra "más de 100%"), presupuesto en $0 con y sin gasto, `upsert` sin duplicados, y que ningún cálculo escribe en `expenses`/`incomes` — sin bugs encontrados.
- **Validado:** `node --check` 48/48 OK; `formatPercent()` extendido de forma retrocompatible (2º parámetro opcional, llamadas existentes sin cambios).

## Fase 9 — Reportes y respaldo — **hecho**
- [x] `/reportes`: selector de periodo (Semana/Mes/Año) que alimenta resumen (ingresos/gastos/balance/mandado), gastos por categoría, ingresos por fuente y evolución de ingresos/gastos (granularidad según el periodo elegido).
- [x] Principales productos del mandado, evolución de precios (producto seleccionable), tiendas más económicas ("victorias" por producto comparable, solo con ≥2 tiendas), ahorro potencial (vía `comparisonService`) — todo para el periodo seleccionado cuando aplica.
- [x] Cero lógica financiera propia: todo delega a `financeService`/`groceryService`/`comparisonService`/`priceService` ya existentes.
- [x] Claves de settings propias (`reportsPeriodType`/`reportsYear`/`reportsMonth`/`reportsWeekDate`), independientes de Dashboard/Semana/Mes.
- [x] Estados vacíos en las 8 secciones cuando falta información.
- **Criterio de aceptación (reportes):** cambiar el tipo/valor de periodo recalcula todo sin recargar; secciones sin datos muestran mensaje útil, nunca una gráfica rota o `NaN`.
- **QA (agente):** confirmó orden correcto canvas→Chart.js en las 4 gráficas (1 bug de este tipo detectado y corregido por mí mismo antes de QA, en `renderPriceEvolutionSection`), imports limpios, sin reimplementación de cálculos, responsive vía clases ya existentes — sin más bugs encontrados.
- **Validado:** `node --check` 49/49 OK.
- [x] `/configuracion`: Preferencias (moneda, aplicación inmediata vía `setCurrency` + persistida), Información del almacenamiento (tamaño en KB, conteo por colección, último guardado con hora), Respaldo (exportar `control-gastos-backup-YYYY-MM-DD.json`; importar con lectura → parseo → validación de versión/estructura → confirmación → restauración → recarga completa), Restablecer datos (confirmación explícita, borra todo y recarga).
- [x] `StorageService.importData()` endurecido: `isValidBackupShape()` rechaza versión no-entera/fuera de rango, `settings` no-objeto o cualquier colección que no sea arreglo — **antes** de tocar el estado actual (un respaldo inválido nunca destruye datos existentes).
- [x] Corregido bug real preexistente: `app.js` nunca releía `settings.currency` al iniciar (la moneda elegida se perdía tras recargar); ahora `bootstrap()` llama `setCurrency(State.getSettings().currency)`.
- **Criterio de aceptación (respaldo):** exportar → restablecer → confirmar seed/vacío según diseño → importar el respaldo exportado → recuperación completa e idéntica; un archivo inválido (JSON roto, versión futura, colección no-arreglo) se rechaza sin alterar los datos actuales.
- **QA (agente, prueba crítica de 12 pasos):** trazó exportar/restablecer/importar paso a paso confirmando que ninguna colección se pierde y que el rechazo de respaldos inválidos ocurre antes de cualquier mutación; corrigió `isValidBackupShape` para exigir `Number.isInteger(version)` (evita que `1.5`/`NaN` pasaran la validación si `CURRENT_VERSION` subiera en el futuro).
- **Decisión:** importar/restablecer recargan la página completa en vez de resincronizar el estado en memoria de cada módulo (ver `decisions.md`) — evita reconciliar manualmente closures de cada pantalla.
- **Validado:** `node --check` 50/50 OK.

## Fase 10 — QA, estabilización y optimización — **hecho**
- 3 agentes de QA en paralelo (núcleo financiero; mandado/tiendas/precios/comparador; reportes/configuración/transversal) revisaron los 18 módulos, cálculos, persistencia, integridad de datos, UI/UX y calidad de código. Ver correcciones aplicadas abajo y el reporte completo en el resumen de esta ejecución.
- **Corregidos (críticos):**
  - Editar un ingreso/gasto/movimiento de calendario cuya categoría/tipo ya estaba desactivada podía reasignarlo silenciosamente a otra categoría (income.module.js, expense.module.js, shared/movement-form.js) — ahora el `<select>` de edición siempre incluye la categoría/tipo original aunque esté inactiva.
  - `financeService.expensesByCategory()`/`incomeByType()` podían perder silenciosamente montos con `categoryId`/`incomeTypeId` huérfano (el desglose sumaba menos que el total) — ahora se agrupan en "Sin categoría"/"Sin tipo" (ver `decisions.md`).
  - Los inputs inline de precio estimado/real en una lista de mandado (grocery-list.module.js) no validaban signo (a diferencia de la cantidad) — un precio negativo podía propagarse hasta un `Expense` real vía "Registrar como gasto". Corregido con la misma validación que cantidad.
- **Corregidos (importantes):**
  - `weekly.module.js`/`monthly.module.js` reimplementaban localmente `findMandadoTotal` en vez de usar `financeService.mandadoTotal()` (duplicación de lógica financiera, detectada independientemente por dos agentes) — ahora importan la función centralizada.
  - `ProductRepository.findByName()` buscaba entre productos inactivos; al agregar un producto a una lista por nombre podía vincularse silenciosamente a un producto desactivado. Ahora busca solo entre activos (si no encuentra uno activo, crea uno nuevo en vez de reactivar silenciosamente el inactivo).
- **Corregidos (menores):** `core/validators.js#isValidDate` ahora usa `parseFlexibleDate` (antes `new Date()` directo); `dueDay` en Gastos se valida en JS (1-31, no solo por atributos HTML); cantidad inline en mandado exige `>0` (antes permitía `0`); botón hamburguesa del sidebar alterna `aria-label`/`aria-expanded` correctamente al abrir/cerrar y al navegar.
- **Pendientes documentados (menores, dejados conscientemente sin corregir en esta fase):**
  - `grocery-list.module.js` (~525 líneas) y `reports.module.js` (~440 líneas) superan la guía de ~300 líneas de `architecture.md` — candidatos a dividir por sub-responsabilidad en una fase futura, no se tocó para no arriesgar una reescritura fuera del alcance de "correcciones focalizadas".
  - `monthly.module.js` reimplementa manualmente el selector mes/año en vez de reusar `components/month-year-nav.js` (que sí usan dashboard/reports/calendar) — duplicación de UI, sin riesgo de datos; no se tocó por ser de bajo impacto y no crítico.
  - Marcar una lista de mandado como "completada" no bloquea seguir editándola — no hay una decisión documentada de que deba bloquearse; se deja para que el usuario decida si es un comportamiento deseado antes de implementarlo (evita agregar una funcionalidad nueva no solicitada).
  - `weekly.module.js`/`monthly.module.js`/`dashboard.module.js` calculan el balance como `income - expense` en vez de llamar a `financeService.balance()` — matemáticamente idéntico y sin riesgo, señalado solo por consistencia.
- **Validado:** `node --check` 50/50 OK tras todas las correcciones; `grep -r "localStorage\." js/` confirma un único punto de acceso (`core/storage.js`); ningún `console.log` de depuración en el código; catches informan al usuario, ninguno silencioso.

---
## Backlog priorizado (primeras tareas concretas)
1. ~~`core/storage.js` + `core/state.js` + documento versionado~~ — hecho.
2. ~~`core/dates.js`, `core/currency.js`, `core/validators.js`, `core/id.js`, `core/events.js`~~ — hecho.
3. ~~Layout base (`index.html`, CSS, sidebar, router, rutas placeholder)~~ — hecho.
4. ~~`data/seed.js` a partir del análisis del Excel~~ — hecho.
5. ~~Módulo Ingresos (CRUD) end-to-end~~ — hecho.
6. ~~Módulo Gastos + categorías + recurrencias~~ — hecho.
7. ~~Vista Semanal / Mensual~~ — hecho.
8. ~~Dashboard~~ — hecho.
9. ~~Mandado (categorías, productos, listas, items)~~ — hecho.
10. ~~Tiendas + precios + historial~~ — hecho.
11. ~~Comparador~~ — hecho.
12. ~~Presupuesto~~ — hecho.
13. ~~Calendario~~ — hecho (adelantado; ver Fase 4).
14. ~~Reportes + respaldo~~ — hecho.
15. ~~QA integral~~ — hecho.

**Siguiente tarea de implementación:** Todas las fases del MVP local están completas. Siguiente evolución recomendada: dividir `grocery-list.module.js`/`reports.module.js` en sub-módulos más pequeños, y evaluar backend/sincronización multi-dispositivo si el proyecto avanza más allá de un MVP local (ver decisions.md sobre localStorage → IndexedDB/API).

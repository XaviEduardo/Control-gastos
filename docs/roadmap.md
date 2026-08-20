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

## Fases UI (rama `Feat-UX-UI`) — modernización visual/responsive

Basadas en `docs/ui-ux-audit.md` (diagnóstico) y `docs/responsive-plan.md` (guía táctica).
No reemplazan ni reabren las Fases 0-10 (MVP funcional ya completo) — son una capa de
modernización visual/responsive sobre la misma base funcional.

### UI-1 — Foundation visual — **hecho**
- [x] `css/variables.css`: tokens de marca (`--color-primary-hover`, `--color-primary-soft`),
  superficies (`--color-surface-secondary`), texto (`--color-text-secondary`), pares
  sólido/suave para success/warning/danger/info (`--color-*-soft`), spacing (`--space-2xl`),
  tipografía (`--font-size-xs`/`--font-size-2xl`, `--font-weight-medium`/`-bold`,
  `--line-height-*`). Paleta y demás tokens existentes sin cambios de valor (salvo el
  renombre de `--color-primary-dark` → `--color-primary-hover`, mismo valor, único
  consumidor actualizado en `base.css`).
- [x] `css/base.css`: botones con `padding` ligeramente mayor (más cerca de 40-44px táctil),
  estado `:disabled` en botones e inputs (antes inexistente), hook `.input--error` para
  validación inline futura, patrón `.btn--icon` (40×40px, sin aplicar aún en ningún módulo).
- [x] `css/components.css`: `.card--compact`, `.section-title`/`.card-title` (nuevas, sin
  consumidores todavía), sistema `.badge`/`.badge--*` (estado) y `.tag` (metadato) formalizado
  y separado, `.toolbar` ahora auto-contenido (`display:flex` propio, ya no depende de que
  cada módulo apile las utilidades `.flex .justify-between .items-center .gap-sm` — retrocompatible),
  `.summary-card__label` con tratamiento "eyebrow" (uppercase + letter-spacing, ver nota de
  decisión abajo), `.summary-card__value` usa el nuevo `--font-size-2xl` (más presencia de
  las cifras KPI frente al título de página), un `rgba(...)` hardcodeado en
  `.comparison-product-item--best` sustituido por `--color-success-soft`.
- [x] `css/utilities.css`: `.text-secondary`, `.text-xs` (nuevas, aditivas).
- **No se tocó:** `css/layout.css`, `css/responsive.css`, ningún archivo `.js`, ningún `.html`
  (confirmado por `git diff --stat`: solo 4 archivos CSS modificados).
- **Nota de decisión (no estaba en el plan original tal cual):** `.summary-card__label` se
  usa hoy tanto para etiquetas cortas de KPI ("Ingresos") como para encabezados de sección
  más largos ("Presupuestos por categoría (mensual)"). Se aplicó el tratamiento eyebrow a
  **todas** sus instancias por igual (sin retocar JS/markup en esta fase) — es una decisión
  deliberadamente uniforme, no una inconsistencia. Si al revisar visualmente algún encabezado
  largo se ve demasiado denso en mayúsculas, la corrección natural es introducir un
  modificador (ej. `.summary-card__label--title`) en una fase posterior que toque esos
  módulos, no revertir el token base.
- **Validado:** balance de llaves y `var()` de cada token verificado manualmente línea por
  línea (no hay linter de CSS en el proyecto); confirmado que ningún archivo `.js` referencia
  variables CSS directamente (grep sin resultados) — cero riesgo de romper JS. Sin navegador
  disponible en esta sesión para captura visual — pendiente que el usuario confirme viendo
  Dashboard/Ingresos/Gastos/Mandado/Productos/Calendario/Configuración.

### UI-2 — Sidebar, drawer y navegación móvil — **hecho**
- [x] `css/layout.css`: `.sidebar` con `min-height:100vh; height:100dvh` (piso seguro +
  ajuste al viewport visual real), padding con `env(safe-area-inset-*)` en sidebar/header/
  toggle, `-webkit-overflow-scrolling:touch`.
- [x] `css/responsive.css`: breakpoint del drawer movido a `max-width:639px` (estrategia
  documentada: móvil <640/tablet 640-1023/desktop ≥1024), `body.sidebar-open{overflow:hidden}`
  como scroll-lock, ambos scopeados dentro del mismo media query (se autoanulan al cruzar a
  tablet/desktop sin necesitar limpieza por JS).
- [x] `index.html`: `viewport-fit=cover` agregado al meta viewport (requisito previo para que
  `env(safe-area-inset-*)` resuelva a algo distinto de 0).
- [x] `js/app.js`: `setupSidebarToggle()` revisado — un solo listener por control (sin
  duplicados), overlay cierra el drawer, navegación ya cerraba el drawer (`updatePageHeader`),
  se agregó un listener `matchMedia('(min-width:640px)')` que fuerza el cierre si el viewport
  crece mientras el drawer está abierto.
- **No se tocó:** Mandado/Productos/servicios/repositorios/cálculos/lógica de Calendario.
- **Bug corregido:** el bug reproducible de scroll del sidebar (abrir → navegar → Calendario →
  scroll roto) se resolvió con `100dvh` + scroll-lock; causa raíz confirmada en
  `docs/ui-ux-audit.md` sección C.

### UI-3 — Mandado Mobile — **hecho**
- [x] `js/modules/grocery/grocery-list.module.js`: `renderItemRow()` reescrito sobre un único
  DOM compartido por escritorio y móvil (CSS Grid con `grid-template-areas`, sin duplicar
  elementos ni listeners). Se añadió un menú `⋮` (`buildActionMenu()`) que agrupa "Notas" y
  "Quitar de la lista" (antes dos botones sueltos); un único listener de `click` en
  `document` por vista cierra cualquier menú abierto al hacer click fuera (no uno por fila),
  removido al salir del módulo vía el valor de retorno de `renderGroceryListModule` (el router
  ya soporta cleanup opcional por ruta). Etiquetas "Est./{unidad}" y "Real/{unidad}" (dinámicas
  según `item.unit`) y "Subtotal" agregadas al markup, ocultas por CSS en escritorio (se sigue
  usando el `placeholder` del input) y visibles en móvil.
- [x] `css/components.css`: `.grocery-item-row` ahora es `display:grid` (antes `flex-wrap`)
  con una plantilla de una sola fila para escritorio; nuevo componente `.action-menu`
  (`__toggle`/`__panel`/`__item`, con variante `--danger`).
- [x] `css/responsive.css`: dentro del mismo bloque `@media (max-width:639px)` de UI-2, override
  de `grid-template-areas` de `.grocery-item-row` a una tarjeta apilada (checkbox+nombre+menú /
  cantidad / estimado·real / subtotal) y se muestran las etiquetas antes ocultas.
- **No se tocó:** `groceryService.js`, ningún repositorio, ninguna regla de cálculo KG/UNIT
  (la presentación sigue sin participar en el subtotal UNIT).
- **Simplificaciones deliberadas frente al mockup ilustrativo:** no se repite el nombre de la
  categoría dentro de cada tarjeta (ya aparece una vez en el encabezado de `renderCategoryGroup`,
  evita redundancia); no se fabricó un segundo dato de "presentación" (ej. "1.5 L") junto a la
  cantidad porque el modelo de datos actual solo tiene `quantity`+`unit`, y agregarlo requeriría
  tocar el modelo/servicios (fuera de alcance de esta fase).
- **Sin navegador disponible en esta sesión** para medir visualmente los viewports de la matriz
  de prueba — pendiente que el usuario confirme en `http://localhost:5501/#/mandado/lista`
  (320×568 a 1440×900) y la matriz de persistencia (cantidad/estimado/real/comprado/eliminar →
  F5 → verificar).

### UI-4 — Tablas/listados responsive — **hecho**
- [x] `js/components/table.js`: `renderTable()` recibe un parámetro opcional `renderCard(row, actionsNode)`.
  Cuando se pasa, además de `<table>` construye una `.responsive-card-list` a partir de las
  mismas `rows` (sin estado ni fuente de datos duplicada) — CSS decide cuál de las dos vistas
  se muestra según el breakpoint. `rowActions(row)` se invoca una vez por representación (tabla
  y tarjeta), cada una con su propio nodo/listeners independientes — no hay nodo compartido ni
  listener huérfano.
- [x] `js/components/action-menu.js` (nuevo): `createActionMenu(label, actions)` +
  `ensureActionMenuOutsideClick()` — patrón `⋮` generalizado a partir del que ya existía en
  Mandado (UI-3), reutilizado por los 5 módulos de esta fase. El cierre-al-click-afuera es un
  único listener global (idempotente, se registra una sola vez por carga de página) que
  consulta el DOM en vivo — no requiere limpieza al navegar entre módulos.
- [x] `css/components.css`: `.responsive-card-list` (+ `__item`/`__header`/`__title`/`__amount`/
  `__subtitle`/`__body`), toque de espaciado en `.category-manager-item` (`flex-wrap`).
- [x] `css/responsive.css`: dentro del mismo bloque `<640px`, `.table-wrapper .data-table{display:none}`
  + `.responsive-card-list{display:flex}` (alterna vista sin JS, así que cruzar el breakpoint en
  resize no puede duplicar nodos/listeners — no hay nada que ejecutar en el cruce); padding
  ampliado de `.category-manager-item` en móvil.
- [x] Módulos migrados (tabla sin cambios de datos/cálculos, `buildRowActions` ahora devuelve
  `createActionMenu(...)`, más `render*Card()` nuevo): `products.module.js`, `stores.module.js`,
  `price-history.module.js` (tarjeta: fecha+tienda / producto·presentación / precio / normalizado),
  `income.module.js` y `expense.module.js` (tarjeta: concepto+monto arriba, categoría·fecha abajo,
  menú `⋮` al pie — jerarquía visual: el monto usa `--font-size-xl`/700).
- **No se tocó** ningún repositorio ni servicio de cálculo (`financeService.js`, `priceService.js`,
  `groceryService.js`).
- **Corrección posterior (mismo día):** el menú `⋮` usaba `position:absolute`, lo que lo dejaba
  atrapado por ancestros con `overflow` (ej. `.data-table{overflow:hidden}`, `.table-wrapper` con
  scroll) o simplemente se salía del viewport sin recolocarse — bug reportado por el usuario
  ("la tarjeta sale para abajo y no se visualiza"). Se cambió a `position:fixed` con coordenadas
  calculadas en JS (`getBoundingClientRect` + límites de viewport + flip hacia arriba si no cabe
  abajo), inmune a `overflow`/scroll de cualquier ancestro y consistente en desktop, iOS Safari y
  Android Chrome. Al mismo tiempo se migró `js/modules/grocery/grocery-list.module.js` (Mandado,
  UI-3) a este mismo componente compartido (antes tenía su propia copia local con el mismo bug de
  posicionamiento) — ya no hace falta su `document.addEventListener` propio ni el cleanup por
  ruta, así que `renderGroceryListModule` dejó de retornar una función de limpieza.
- **Categorías:** solo se ajustó espaciado/touch de `.category-manager-item` (`flex-wrap` +
  padding en móvil); sigue siendo una lista, sin cambio estructural, como se indicó.
- **Simplificación deliberada:** la tarjeta de Productos no inventa una cantidad de presentación
  (ej. "1.5 L") — el modelo de `Product` solo tiene `preferredUnit` (sin cantidad numérica), así
  que la tarjeta muestra "Unidad preferida: {unidad}" en vez de fabricar un dato inexistente.
- **Sin navegador disponible en esta sesión** para verificar visualmente el resize desktop↔mobile
  ni medir overflow horizontal — pendiente que el usuario confirme en
  `http://localhost:5501/#/mandado/productos` (y tiendas/historial/ingresos/gastos) con DevTools,
  además de la matriz de persistencia (crear/editar/duplicar/eliminar/activar-desactivar → F5).

### UI-5 — Dashboard, Calendario y Reportes responsive — **hecho**
- [x] `css/components.css`: `.stats-grid` (`minmax(160px,…)` → `minmax(min(220px, 100%), 1fr)`)
  y `.charts-grid` (`minmax(320px,…)` → `minmax(min(280px, 100%), 1fr)`) — el bug diagnosticado
  (`320px` de mínimo puede exceder el ancho real en viewports 320-360px) se corrige con la
  técnica `min(N, 100%)`: si el contenedor es más angosto que el mínimo, éste cae a `100%` y
  `auto-fit` no tiene otra opción que 1 columna — nunca puede exceder el espacio disponible, sin
  media queries adicionales. Se subió el mínimo de `.stats-grid` de 160→220px porque con 160px
  un valor monetario grande (`--font-size-2xl`) en 2 columnas quedaba visualmente apretado en
  375-428px. `.chart-card` ganó `min-width:0` (un hijo de grid con contenido ancho —el canvas—
  puede forzar el ancho de su columna aunque el `minmax` diga lo contrario, si no se resetea el
  `min-width` implícito). `.top-expenses-list li` ganó `flex-wrap:wrap` (usado también por
  Calendario/Mensual/Comparador — cambio defensivo, no altera nada cuando ya cabe en una línea).
- [x] `css/responsive.css` (dentro del mismo bloque `<640px`): `.chart-wrapper` baja de 280px a
  220px de alto (menos scroll vertical en móvil; Chart.js con `responsive:true` ya redibuja solo
  al cruzar el breakpoint, sin instancias nuevas — ver "CHARTS" abajo). Calendario: los badges de
  conteo (💰🧾🛒) se simplifican a puntos de color sólido de 7×7px (antes texto a 0.55rem, ya en
  el límite de legibilidad y con riesgo real de desbordar la celda con 3 badges en 320-360px); el
  número del día NO se reduce (se quitó el `font-size:0.7rem` que tenía antes) — el detalle
  completo (montos, categorías, recurrencia) sigue disponible en el panel del día seleccionado.
- [x] `js/modules/calendar/calendar.module.js`: el texto de cada badge (emoji+conteo) se envolvió
  en un `<span class="calendar-badge__label">` para poder ocultarlo por CSS en móvil sin tocar
  ningún dato ni lógica de fechas — mismo `occurrenceMap`/`getOccurrencesInRange` de siempre.
- [x] `js/modules/reports/reports.module.js`: el selector Semana/Mes/Año ganó `flex-wrap` (nueva
  utilidad `.flex-wrap` en `css/utilities.css`) — defensivo, sin cambio visual cuando ya cabe.
- **No se tocó** ninguna lógica financiera/de cálculo (`financeService.js`, `budgetService.js`,
  `comparisonService.js`, `priceService.js`, `recurrenceService.js`) ni la librería/lógica de
  fechas de Calendario (`core/dates.js`, `getOccurrencesInRange`) — todo el trabajo fue CSS +
  una envoltura de markup puramente presentacional.
- **CHARTS (Chart.js):** dashboard/reportes/historial de precios ya destruyen todas sus
  instancias (`destroyCharts()`) al inicio de cada `render()` y las recrean solo cuando el
  usuario cambia mes/año/periodo/producto — un resize de ventana NUNCA llama a `render()`, así
  que no puede duplicar ni acumular instancias; Chart.js redimensiona el canvas EXISTENTE vía su
  propio `responsive:true`/ResizeObserver. Confirmado leyendo el código, no hay navegador en esta
  sesión para verificarlo visualmente.
- **Sin navegador disponible en esta sesión** — pendiente que el usuario confirme en
  `http://localhost:5501/#/dashboard` (vacío, con datos, cambio mes/año), `#/calendario`
  (anterior/siguiente/seleccionar día/320px) y `#/reportes` (filtros/gráficos/resize) contra la
  matriz de viewports pedida (320×568 a 1440×900).

### UI-6 — Formularios, modales y touch UX — **hecho**
- [x] `css/base.css`: `input/select/textarea` a `font-size:16px` explícito (antes 15px vía
  `--font-size-md`) — por debajo de 16px, Safari iOS hace zoom automático al enfocar un
  campo; `.btn` sube de `10px`→`12px` de padding vertical (más cerca de los ~44px táctiles,
  relevante sobre todo en footers de modal).
- [x] `css/components.css` — **modal reestructurado** (`.modal-overlay`/`.modal`/`.modal-header`/
  `.modal-body`/`.modal-footer`):
  - `.modal-overlay`: `min-height:100vh; height:100dvh` (mismo patrón que `.sidebar` de UI-2).
  - `.modal`: pasa a `display:flex; flex-direction:column` — header y footer quedan fijos,
    solo `.modal-body` (`flex:1 1 auto; min-height:0; overflow-y:auto`) scrollea. Antes
    `overflow-y:auto` vivía en `.modal` completo: en un formulario largo el footer
    (Guardar/Cancelar) podía desplazarse fuera de vista junto con el resto — el bug que
    pedía evitar "footer inaccesible".
  - `.modal-close`: 44×44px (antes solo `font-size:1.5rem`, sin `width`/`height`).
  - `.modal-footer`: `padding-bottom: max(var(--space-md), env(safe-area-inset-bottom))`.
  - Nueva variante `.modal--compact` (max-width 420px, sin override en móvil) vs. la variante
    por defecto `.modal--form` (override <640px → casi pantalla completa, ver abajo).
  - Nuevo `.form-row` (2 columnas en desktop, `flex:1 1 0` + `min-width:0` por hijo) para
    pares de campos cortos donde aporta — NO es el layout por defecto de `.form-grid`.
- [x] `js/components/modal.js`: `openModal({..., variant='form'})` — agrega `.modal--${variant}`
  a la clase del `.modal`. `role="dialog"`, `aria-modal="true"`, `aria-label`, el `aria-label`
  del botón cerrar y `:focus-visible` (global, sin tocar) se conservan sin cambios.
- [x] `js/components/confirm-dialog.js`: pasa `variant:'compact'` — un "¿Eliminar producto?"
  sigue siendo pequeño y centrado en cualquier viewport, nunca se convierte en full-screen.
- [x] `css/responsive.css` (mismo bloque `<640px`): `.modal--form{width:100%;max-width:none;
  height:100%;max-height:100%}` (dentro del margen que ya deja `.modal-overlay`, por eso es
  "casi" pantalla completa, no borde a borde) — `.modal--compact` no tiene entrada aquí, a
  propósito. `.form-row{flex-direction:column}` para volver a apilar en móvil.
- [x] Pares `.form-row` aplicados donde el ejemplo del pedido aporta claramente (Cantidad+Unidad,
  Precio+Fecha) — NO aplicado globalmente: `grocery-list.module.js` (Cantidad+Unidad),
  `price-history.module.js` (Cantidad+Unidad y Precio+Fecha), `income.module.js`,
  `expense.module.js` y `shared/movement-form.js` (Cantidad+Fecha — mismo par que
  "Precio+Fecha" del ejemplo; estos formularios llaman a su campo de monto "Cantidad", no
  "Precio"). `products.module.js`/`stores.module.js`/`budget.module.js` no tienen un par
  equivalente y se dejaron sin cambios.
- **TECLADO VIRTUAL:** no se agregó JS de detección (`visualViewport`, etc.) — con
  `100dvh` + body scrolleable + footer fijo dentro del flex-column, el footer permanece
  visible por encima del teclado sin lógica adicional; es el patrón estándar suficiente
  para este alcance.
- **No se tocó** ninguna validación (`isRequired`/`isPositiveNumber`/`isValidDate`) ni el envío
  de datos (`FormData`) — los pares `.form-row` son solo un `<div>` contenedor adicional;
  todos los campos siguen teniendo su `name`/`id` propio, así que `FormData(form)` y
  `form.querySelector('#id')` no cambian de comportamiento.
- **Sin navegador disponible en esta sesión** — pendiente que el usuario confirme abrir cada
  formulario (ingreso, gasto, producto, precio, mandado, presupuesto) y la confirmación de
  eliminar en `http://localhost:5501`, incluyendo abrir/cerrar repetidamente y un formulario
  largo (ej. Gasto, con regla personalizada visible) contra la matriz de viewports.

### UI-7 — QA responsive integral y estabilización — **hecho**
Sin agregar funcionalidad ni rediseñar: se validó el trabajo de UI-1..UI-6 y se corrigió lo
encontrado. Verificación en 3 frentes (sin navegador disponible en esta sesión — ver nota final):
`git diff --stat` contra `Development` para confirmar exactamente qué se tocó; un agente de
lectura para el barrido mecánico (rutas, compatibilidad GitHub Pages, `localStorage` fuera de
`StorageService`, restos de debug, `!important`, clases CSS duplicadas); un segundo agente para
trazar 6 secuencias de interacción específicas (sidebar repetido, menú ⋮ singleton, resize
tabla↔tarjeta, ciclo de vida de Chart.js, modal abrir/cerrar repetido, ciclo de vida de un ítem
de Mandado); y una revisión propia línea por línea de los 6 archivos CSS completos.

- [x] **Regresión crítica encontrada y corregida:** `.grocery-item-row` (Mandado > Mi lista)
  usaba en escritorio un grid de 7 columnas con varias pistas de ancho fijo (44+100+100+44px)
  más los mínimos de contenido de `qty-wrap` (~130px) — una suma mínima de ~600px+. Con el
  sidebar de tablet (220px, `<1024px`) más el padding de `.app-content`/`.card`, el espacio
  real cae por debajo de eso entre ~640-1023px (incluye 768×1024, viewport de alta prioridad de
  esta fase) — overflow horizontal real que **no existía antes de UI-3** (la fila anterior usaba
  `flex-wrap`, que envolvía en vez de desbordar). Corregido en `css/responsive.css`: la tarjeta
  apilada (idéntica a la de móvil) ahora se extiende hasta `1024px`; el layout denso de escritorio
  queda solo para viewports realmente anchos (`>1024px`, sidebar de 260px), donde sí hay espacio.
  Este es el único cambio de código de esta fase — todo lo demás fue verificación.
- [x] **Todo lo demás: PASS**, sin cambios necesarios —
  - Rutas: las 16 rutas están registradas e implementadas en `js/app.js` (nada cae a
    `renderPlaceholder`).
  - GitHub Pages: `core/router.js` sigue siendo 100% hash-based (`#/...`), sin History
    API/pushState; sin `fetch`/backend en todo `js/`; sin rutas ni assets con `/` absoluto; el
    único recurso externo es el `<script>` de Chart.js por CDN en `index.html` (esperado).
  - `localStorage` solo se usa dentro de `core/storage.js` — ningún módulo lo tocó directo.
  - Sin `console.log`/`debugger`/restos de debug en `js/`.
  - `!important`: una sola ocurrencia (`.hidden` en `utilities.css`), preexistente y esperada.
  - Ninguna clase CSS (`.modal`, `.charts-grid`, `.stats-grid`, `.calendar-badge`,
    `.action-menu__panel`, `.form-row`, etc.) está duplicada/redefinida en dos archivos con
    valores contradictorios.
  - Sidebar: un solo listener por control (`setupSidebarToggle()` se llama una sola vez desde
    `bootstrap()`), `body.sidebar-open` se limpia en cada cambio de ruta sin excepción — no hay
    forma de que el scroll quede bloqueado tras cerrar el drawer.
  - Menú ⋮: `ensureActionMenuOutsideClick()` con guarda `boundOnce` — un solo listener real sin
    importar cuántos de los 6 módulos lo invoquen; sin referencias a nodos de una vista ya
    desmontada.
  - Tabla↔tarjeta: cruzar los 640px es CSS puro (`display` alternado en `responsive.css`), cero
    JS en el cruce — no puede duplicar DOM ni listeners.
  - Chart.js: `destroyCharts()` es lo primero en cada `render()` de Dashboard/Reportes/Historial,
    y las 3 rutas retornan `() => destroyCharts()` para el cleanup del router.
  - Modal: `openModal()` cierra cualquier modal previo al abrir uno nuevo; el listener de
    `keydown` se agrega/quita simétricamente en cada ciclo.
  - Mandado: `render()` reconstruye `root.innerHTML` por completo en cada mutación — sin
    posibilidad de filas obsoletas acumuladas con listas grandes/mixtas.
- **Pendiente menor documentado (cosmético, no se toca):** `.btn--icon` (definida en UI-1) sigue
  sin usarse en ningún módulo — no es una regresión, es un patrón dejado listo a propósito para
  una fase futura; los botones-ícono ya construidos (checkbox de Mandado, `⋮`, cerrar de modal)
  usan sus propias clases dedicadas.
- **No se tocó ningún archivo de `services/`, `repositories/` ni `core/storage.js`/`core/state.js`**
  en ninguna fase UI (confirmado con `git diff --stat Development...HEAD`) — CRUD, cálculos,
  recurrencias, reglas KG/UNIT, presupuestos, precios, comparador y backup/restore corren sobre
  el mismo código que antes de UI-1, sin cambios.
- **Sin navegador disponible en esta sesión**: todo lo anterior se verificó por lectura de
  código/CSS y trazado lógico, no por prueba visual real. Pendiente que el usuario confirme en
  `http://localhost:5501` contra la matriz de viewports completa (320×568, 360×800, 375×812,
  390×844, 412×915, 428×926, 768×1024, 1366×768, 1440×900, 1920×1080), con especial atención a
  768×1024 (el rango recién corregido) y al smoke test de persistencia (crear/F5/editar/F5/
  eliminar/F5 para ingreso, gasto, producto, ítem de mandado y precio).

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

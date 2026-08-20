# Decisiones arquitectónicas

---
Fecha: 2026-08-20
Decisión: Toda persistencia pasa por `StorageService` (js/core/storage.js); ningún módulo llama `localStorage` directamente.
Motivo: Permitir reemplazar localStorage por IndexedDB/API/DB remota sin reescribir la lógica de negocio ni la UI.
Consecuencia: Los módulos y servicios solo conocen `StorageService.get/set/save/load/remove/clear/exportData/importData`.

---
Fecha: 2026-08-20
Decisión: Un único documento raíz versionado en localStorage (`{version, lastUpdated, settings, incomes, expenses, ...}`) en vez de una clave por colección.
Motivo: Simplifica export/import de respaldo completo y migraciones de versión; evita desincronización entre claves sueltas.
Consecuencia: `StorageService` serializa/deserializa el documento completo en cada `load()`; escrituras usan el documento en memoria y persisten inmediatamente tras cada mutación.

---
Fecha: 2026-08-20
Decisión: Toda entidad se relaciona por `id` (no por nombre); nombres son solo displayName editable.
Motivo: Nombres de categorías/tiendas/productos son editables por el usuario y no deben romper relaciones históricas (ej. historial de precios).
Consecuencia: Todas las entidades relacionadas usan `*Id` (categoryId, storeId, productId, groceryListId).

---
Fecha: 2026-08-20
Decisión: Los cálculos financieros y de mandado viven exclusivamente en `js/services/*.js`; los módulos de UI solo los consumen.
Motivo: Evitar lógica de sumas/balances duplicada e inconsistente entre dashboard, semanal, mensual y reportes.
Consecuencia: Cualquier cambio en una fórmula (ej. cómo se calcula el balance) se hace en un solo lugar.

---
Fecha: 2026-08-20
Decisión: El seed basado en el Excel se carga solo si no existe un documento guardado (o si el usuario ejecuta "Restablecer datos" explícitamente).
Motivo: Evitar sobrescribir datos reales del usuario en cada recarga (requisito crítico de persistencia).
Consecuencia: `app.js` verifica `StorageService.load()`; si es null/vacío, importa `data/seed.js` y lo persiste una sola vez.

---
Fecha: 2026-08-20
Decisión: La app calculará automáticamente los agregados de semana→mes→año (vía `periodService.js`), en vez de replicar la captura manual duplicada que tiene el Excel entre `Semanal` y `Mensual`.
Motivo: El Excel analizado (`docs/excel-analysis.md`) no tiene ninguna fórmula que conecte Semanal→Mensual; el usuario reintroducía a mano cada gasto y el mandado en la hoja Mensual, causando la brecha de automatización más importante del archivo original.
Consecuencia: No existen entidades separadas "gasto semanal" y "gasto mensual"; ambas vistas son proyecciones calculadas de la misma colección `expenses`/`incomes`/`groceryLists` filtrada por rango de fechas.

---
Fecha: 2026-08-20
Decisión: Las categorías de mandado (8) y sus productos NO tendrán límite fijo de slots (el Excel limitaba a 3 productos/categoría/semana por diseño de fórmula); serán listas dinámicas sin límite.
Motivo: Requisito explícito del usuario (categorías/productos no hardcodeados, CRUD libre) y limitación identificada como puramente técnica del Excel (rango fijo en `SUMA()`), no una regla de negocio real.
Consecuencia: `GroceryCategory`/`GroceryProduct` son colecciones abiertas; el seed inicial replica las 8 categorías y 8 productos de ejemplo del Excel, editables/eliminables desde el primer uso.

---
Fecha: 2026-08-20
Decisión: Ninguna fecha almacenada como texto "YYYY-MM-DD" (income.date, expense.date) debe parsearse con `new Date(string)`; siempre usar `core/dates.js#parseFlexibleDate`.
Motivo: `new Date("YYYY-MM-DD")` interpreta la cadena en UTC; en zonas horarias negativas (ej. México, UTC-6) esto corría la fecha un día hacia atrás al mostrarla o compararla (bug detectado y corregido en Fase 2, en `formatDateShort/Long`, `isDateInRange` y `recurrenceService`).
Consecuencia: Cualquier código nuevo que reciba una fecha de un `<input type="date">` o de una entidad guardada debe pasar por `parseFlexibleDate` (acepta Date, string "YYYY-MM-DD", o timestamp ISO completo) en vez de `new Date(valor)` directo.

---
Fecha: 2026-08-20
Decisión: Las categorías (`IncomeType`, `ExpenseCategory`, y en el futuro `GroceryCategory`/`Store`) solo se desactivan (`status: 'inactive'`), nunca se eliminan físicamente desde la UI.
Motivo: Preservar integridad referencial — ingresos/gastos históricos siguen apuntando a esa categoría por `id`; borrarla rompería reportes y el historial.
Consecuencia: `createCategoryRepository` (js/modules/shared/category-repository.js) expone `setStatus`, no `remove`; las categorías inactivas se excluyen de los selects de alta pero siguen visibles/reactivables desde "Gestionar categorías".

---
Fecha: 2026-08-20
Decisión: `core/router.js` permite que un handler de ruta devuelva una función de limpieza; el router la ejecuta automáticamente antes de renderizar la siguiente ruta.
Motivo: El Dashboard crea instancias de Chart.js (con listeners internos de resize) que deben destruirse al salir de la vista para no acumular memoria/listeners al navegar repetidamente.
Consecuencia: Cualquier módulo futuro que registre listeners, timers o instancias de terceros (calendario, comparador de precios) debe devolver una función de limpieza desde su `render*Module(container)`; los módulos que no la necesitan simplemente no devuelven nada (sin cambios de comportamiento).

---
Fecha: 2026-08-20
Decisión: El KPI/gráfica "Mandado" en Semana/Mes/Dashboard se calcula buscando una `ExpenseCategory` cuyo nombre sea exactamente "Mandado" (case-insensitive), no a partir de `GroceryList`.
Motivo: El módulo de Mandado real (listas/productos/tiendas) es la Fase 5; mientras no exista, la única señal disponible de "gasto de mandado" son los `Expense` categorizados así (heredado del seed del Excel). Se documenta explícitamente porque es un puente temporal.
Consecuencia: Cuando se implemente Fase 5, `financeService.mandadoTotal()` deberá revisarse para decidir si suma `GroceryList.actualPrice`/totales reales en vez de (o además de) esta categoría de gasto, evitando doble conteo.

---
Fecha: 2026-08-20
Decisión: El calendario no soporta "excepciones" por ocurrencia individual de un movimiento recurrente: editar o eliminar una ocurrencia desde el calendario edita/elimina el registro `Income`/`Expense` completo (afecta todas sus ocurrencias pasadas y futuras), igual que hacerlo desde Ingresos/Gastos.
Motivo: El modelo de datos no contempla fechas de excepción ni "instancias modificadas" de una recurrencia (habría requerido una nueva estructura de datos, fuera de alcance de esta fase). La UI lo comunica explícitamente en el diálogo de confirmación al eliminar un movimiento recurrente.
Consecuencia: No hay riesgo de duplicados: nunca se crea una copia por ocurrencia. Si en el futuro se necesita "modificar solo esta ocurrencia", se deberá diseñar un campo de excepciones (ej. `skipDates[]` u "overrides") como extensión explícita del modelo.

---
Fecha: 2026-08-20
Decisión: Se creó `js/modules/shared/movement-form.js` como formulario simplificado y reutilizable para crear/editar Income/Expense desde el Calendario, en vez de exportar los formularios internos de `income.module.js`/`expense.module.js`.
Motivo: Esos formularios están anidados como cierres dentro de `renderIncomeModule`/`renderExpenseModule` y dependen de su propio `render()` local; exponerlos habría requerido refactorizar módulos financieros ya aprobados (fuera de alcance según instrucción explícita de no reconstruirlos).
Consecuencia: Existe una pequeña duplicación de UI (el markup del formulario) pero CERO duplicación de datos/lógica de negocio: `movement-form.js` persiste a través de los mismos `IncomeRepository`/`ExpenseRepository`. Al editar un gasto desde el calendario se preservan `dueDay`/`paymentMethod`/`notes` existentes aunque el formulario simplificado no los muestre.

---
Fecha: 2026-08-20
Decisión: El total real de una lista de mandado NO se convierte automáticamente en `Expense`. El usuario debe presionar explícitamente "Registrar como gasto"; el `Expense` creado se referencia desde `GroceryList.linkedExpenseId`, y el botón desaparece (muestra el gasto ya vinculado) una vez registrado.
Motivo: Evitar duplicar el gasto accidentalmente (requisito explícito) — sin esto, cada vez que se recalculara la lista podría crearse un gasto nuevo, o el usuario podría registrar el mismo total dos veces sin darse cuenta.
Consecuencia: `financeService.mandadoTotal()` (que suma `Expense` de la categoría "Mandado") automáticamente incluye este gasto una vez registrado, reflejándose en Semana/Mes/Dashboard sin lógica adicional. Si el usuario borra ese `Expense` desde Gastos, la lista vuelve a ofrecer "Registrar como gasto" (se valida que `linkedExpenseId` siga existiendo).

---
Fecha: 2026-08-20
Decisión: `GroceryProduct` se busca/reutiliza por nombre (case-insensitive) al agregar un producto a una lista: si el nombre ya existe en el catálogo se reutiliza ese producto (y su categoría real); si no existe, se crea uno nuevo automáticamente con la categoría elegida en el formulario.
Motivo: Requisito de experiencia "moderna y práctica" — el usuario debe poder escribir "Tomate" y continuar, sin tener que ir primero a /mandado/productos a crearlo.
Consecuencia: `GroceryListItem.categoryId` se denormaliza desde el producto encontrado/creado (no desde el selector del formulario), consistente con la nota de diseño ya documentada en `data-model.md`.

---
Fecha: 2026-08-20
Decisión: Las unidades de mandado/precio se agrupan en "dimensiones" (`priceService.js#getUnitDimension`): kg/g → mass, l/ml → volume, pza → pza, paquete → paquete (dimensión propia, distinta de pza). Solo unidades de la misma dimensión se consideran comparables/normalizables entre sí.
Motivo: Requisito explícito "no compares presentaciones incompatibles incorrectamente" — un paquete no tiene tamaño fijo, así que no es matemáticamente comparable a una pieza ni a otro paquete de contenido distinto.
Consecuencia: `normalizePrice()`/la gráfica de evolución/el futuro comparador (Fase 7) deben filtrar por dimensión dominante antes de graficar o comparar; nunca mezclar kg con L, ni pza con paquete, en un mismo cálculo.

---
Fecha: 2026-08-20
Decisión: El Comparador solo escribe datos por acción explícita del usuario ("Usar esta tienda"), y únicamente en `GroceryListItem.selectedStoreId`/`estimatedPrice` — nunca en `actualPrice` ni de forma automática al calcular.
Motivo: Requisito explícito "integra los resultados con la lista del mandado sin modificar automáticamente precios reales ya registrados" — `actualPrice` representa lo que el usuario pagó de verdad; el comparador solo produce una *estimación* basada en el historial, nunca un hecho consumado.
Consecuencia: `comparisonService.js` es puramente de lectura (no persiste nada); toda escritura vive en la UI (`comparison.module.js`), acotada a un único botón por producto de la compra optimizada.

---
Fecha: 2026-08-20
Decisión: `Budget` se simplificó respecto al diseño original de `data-model.md`: es un monto objetivo permanente por rubro (`{scope, categoryId?, amount}`), sin un sub-objeto `period` que lo ate a un mes/semana concreto.
Motivo: El ejemplo del usuario ("Mandado: Presupuesto $4,000") no menciona ningún mes — es un límite recurrente, no una asignación de un periodo específico. Atarlo a un periodo habría obligado a crear un `Budget` nuevo cada mes/semana, una carga de captura innecesaria.
Consecuencia: `budgetProgress(budget, period)` evalúa el mismo `Budget` contra CUALQUIER periodo que se le pase (semana actual, mes seleccionado en Dashboard/Mes); `budget.repository.js#upsert` garantiza un único registro por `scope` (y por `categoryId` en scope='category'), evitando presupuestos duplicados.

---
Fecha: 2026-08-20
Decisión: Tras "Importar respaldo" o "Restablecer datos" exitosos, la app hace `window.location.reload()` (con un breve `setTimeout` para que el toast sea visible) en vez de intentar resincronizar en caliente el estado en memoria de todos los módulos.
Motivo: `core/state.js` cachea el documento completo en memoria (`state`); `StorageService.importData()`/`clear()` solo actualizan su propio `doc` interno y `localStorage`, no ese caché. Reconciliar manualmente cada closure de cada módulo (selecciones de lista, gráficas de Chart.js, filtros locales, etc.) sería frágil y propenso a estados inconsistentes; una recarga completa garantiza "recalcular estado y actualizar todas las vistas" de forma simple y correcta.
Consecuencia: Ninguna otra fase debe asumir que `StorageService.importData()`/`clear()` actualizan `State` automáticamente — cualquier flujo que los use debe recargar la página (o, si en el futuro se requiere evitarlo, implementar explícitamente `State.reload()` y auditar cada módulo con estado local).

---
Fecha: 2026-08-20 (Fase 10 — QA)
Decisión: `financeService.expensesByCategory()`/`incomeByType()` agrupan cualquier `categoryId`/`incomeTypeId` huérfano (que no coincide con ninguna categoría/tipo existente) en una entrada sintética "Sin categoría"/"Sin tipo", en vez de descartar silenciosamente ese monto.
Motivo: QA detectó que un id huérfano (solo alcanzable por corrupción de datos o un respaldo importado con referencias inconsistentes, ya que la app nunca elimina categorías físicamente) hacía que el desglose por categoría sumara MENOS que `totalExpenses()`/`totalIncome()`, sin ninguna pista visual del porqué.
Consecuencia: El desglose por categoría/tipo siempre reconcilia con el total general, incluso ante datos corruptos o importados de forma imperfecta.

---
Fecha: 2026-08-20
Decisión: Sin frameworks ni build step (Vanilla JS ES6 + módulos nativos, Chart.js vía CDN como única dependencia inicial).
Motivo: Requisito explícito del usuario para v1 local, simple de ejecutar (abrir index.html o Live Server).
Consecuencia: Sin JSX/TS/bundlers; estructura modular manual en `js/modules`, `js/core`, `js/services`, `js/components`.

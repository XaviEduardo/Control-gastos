# V2 — Análisis del estado actual

> Documento de análisis únicamente. No implica cambios de código. Ver `v2-data-model.md`,
> `v2-roadmap.md` y `v2-migration-plan.md` para el detalle de modelo/fases/migración.

## 1. Estado actual (resumen técnico verificado)

- **Stack**: HTML5 + CSS3 + JS Vanilla ES6 (módulos nativos), sin build, sin framework, Chart.js
  por CDN, desplegado en GitHub Pages (rutas hash, imports relativos — confirmado en PASS 6).
- **Persistencia**: un único blob JSON en `localStorage['control-gastos:data']`
  (`js/core/storage.js`). El documento ya tiene `version` (actualmente `1`) y una función
  `migrate(raw)` (hoy un simple merge con el documento vacío) — **la app ya tiene el punto de
  extensión para versionado de esquema; no hay que construirlo desde cero.**
- **Capas**: UI (`js/modules/*.module.js`) → `services/*.js` (cálculo puro) →
  `*.repository.js` (CRUD sobre `State`) → `State` (caché en memoria + eventos) →
  `StorageService` (único punto de contacto con `localStorage`). Esta separación ya existe y es
  sólida — la evolución de modelo de V2 puede apoyarse en ella sin reestructurar capas.
- **Colecciones actuales** (`COLLECTION_KEYS` en `storage.js`): `incomes`, `incomeTypes`,
  `expenses`, `expenseCategories`, `groceryCategories`, `groceryProducts`, `stores`, `prices`,
  `groceryLists`, `groceryListItems`, `budgets`.
- **Entidades "categoría" genéricas** (`incomeTypes`, `expenseCategories`, `groceryCategories`)
  comparten una única fábrica `createCategoryRepository()` — patrón reutilizable ya probado.

## 2. Limitaciones reales identificadas

1. **Catálogo de productos plano**: `Product` no distingue marca/presentación
   (`{id, name, categoryId, preferredUnit, notes, status}`). Hoy la única forma de representar
   "Leche Lala 1.5L" vs "Leche Alpura 1L" es crear dos productos con nombres distintos escritos
   a mano — funciona para el cálculo (ver §3), pero no permite agrupar/comparar por concepto
   ("Leche") ni evita duplicados de catálogo con nombres inconsistentes.
2. **Tienda = un solo nivel**: `Store` no distingue cadena de sucursal. Hoy "Walmart Ejército
   Nacional" y "Walmart Satélite" solo pueden existir como dos `Store` sin relación explícita —
   el comparador ya los trataría como independientes (correcto para el cálculo), pero no hay
   forma de preguntar "¿cuál es la mejor cadena?" ni de agrupar reportes por cadena.
3. **Sin sesión de compra real**: `GroceryListItem` YA tiene `selectedStoreId`, `actualPrice` y
   `purchased` (confirmado leyendo el repositorio y su uso en `grocery-list.module.js`), pero
   `GroceryList` no sabe "en qué sucursal estoy comprando ahora" — cada producto podría llevar
   su propia sucursal, pero no hay un valor de sesión que evite volver a preguntar.
4. **Captura de precio real no genera historial**: cuando el usuario llena `actualPrice` en un
   item de la lista, ese dato se queda SOLO en `groceryListItems` — nunca crea un registro en
   `prices`. Hoy, comprar y registrar el precio en Historial son dos acciones manuales
   separadas y desconectadas. Este es el hueco más valioso a cerrar de todo el análisis.
5. **`Price` no distingue origen**: toda fila en `prices` es indistinguible entre "lo compré",
   "lo capturé manualmente viendo el precio" o (a futuro) "vino de una fuente externa".
6. **Sin "frescura" de precio**: el comparador usa siempre el precio más reciente por tienda sin
   comunicar qué tan reciente es — un precio de hace 8 meses compite en igualdad visual con uno
   de ayer.
7. **Repetir un mandado es 100% manual**: no hay "repetir último", "productos habituales" ni
   plantillas — cada lista se llena producto por producto.
8. **Navegación con 17 rutas planas**: Calendario/Reportes/Configuración y las 7 rutas de
   Mandado compiten en el mismo nivel de sidebar que las 5 de Finanzas. Categorías/Tiendas/
   Historial son tareas administrativas de baja frecuencia mezcladas con las de uso diario.
9. **Localización de campos "de referencia futura"**: ya existen indicios útiles para V2 sin
   necesidad de diseño nuevo — `preferredUnit` (dimensión ya resuelta por `priceService`),
   `notes` en `Product`/`Store` (candidato natural a `brand`/`location` estructurados),
   `GroceryListItem.selectedStoreId` (ya es, de facto, un `preferredBranchId` por item).
10. **Sidebar desincronizado de `ROUTE_META`**: el menú vive escrito a mano en `index.html`
    (cada `<a class="sidebar__link">` con su ícono), en paralelo a `js/app.js#ROUTE_META` (que
    sí alimenta `<title>`/header). No es un bug hoy (las 15 rutas coinciden), pero es una
    segunda fuente de verdad que puede desincronizarse si V2-8 agrega/reubica rutas sin tocar
    ambos lugares — relevante señalarlo antes de tocar navegación, no antes.
11. **`financeService.mandadoTotal()` depende de un nombre de categoría** (`"mandado"`,
    case-insensitive), no de un id fijo ni de `GroceryList` — puente documentado como temporal
    en `decisions.md`. Ninguna fase de V2-1 a V2-7 lo toca, pero cualquiera que relacione más
    de cerca Mandado con Gastos (ninguna está planeada en este análisis) debe revisarlo
    explícitamente para no duplicar el conteo del gasto de mandado.

## 3. Verificación del modelo WEIGHT/UNIT actual (crítico, no debe cambiar)

Analicé `js/services/groceryService.js` y `js/services/priceService.js` línea por línea:

- **Subtotal de un item de lista** (`itemEstimatedSubtotal`/`itemRealSubtotal`/
  `itemEffectiveSubtotal`, `groceryService.js:18-28`): siempre
  `(Number(item.quantity) || 0) * (Number(item.estimatedPrice|actualPrice) || 0)`. **Nunca**
  interviene una "presentación" o segunda unidad — confirma que:
  - Caso A (Tomate 2.5 kg × $28/kg): `2.5 × 28 = $70`. ✅
  - Caso B (Leche 2 pza × $32/pza, presentación 1.5L informativa): `2 × 32 = $64`, la
    presentación NUNCA se multiplica. ✅ (el bug hipotético `2×1.5×32` no existe en el código).
  - Caso C (bolsa de arroz 1kg vendida por pieza a $40 vs. arroz a granel a $30/kg): ya son dos
    `Product` distintos con `preferredUnit` distinto (`pza` vs `kg`) — el modelo actual ya
    representa esto correctamente sin ambigüedad, simplemente sin un campo `presentationAmount`
    estructurado que diga "esa pieza son 1kg".
- **Normalización para comparar** (`normalizePrice`, `priceService.js:29-37`): separada del
  subtotal — solo se usa para comparar precios entre presentaciones vía `pricePerBaseUnit`,
  nunca para calcular lo que el usuario paga. Las "dimensiones" (`mass`/`volume`/`pza`/
  `paquete`) ya son la base correcta para cualquier evolución de variantes.

**Conclusión: el modelo de cálculo WEIGHT/UNIT ya es correcto y completo tal cual está.** La
evolución de V2 (Product/Variant, Chain/Branch) es un problema de **catálogo y organización de
datos**, no de fórmulas — ningún cambio de V2 debe tocar `groceryService.js` ni
`priceService.js` en su lógica de cálculo (ver `v2-data-model.md` §"Qué NO cambia").

## 4. UX — oportunidades priorizadas por uso real durante el mandado

El momento de mayor friction real es **dentro del supermercado**: seleccionar tienda por
producto repetidamente, no saber si un precio es viejo, no tener manera rápida de repetir un
mandado recurrente. Estas tres son las de mayor beneficio/menor riesgo (ver §11-13 del roadmap):
sesión con sucursal fija, captura de precio real → historial automático, y "repetir último
mandado". La reorganización de navegación (§29-33 del prompt) es una mejora de coherencia de
producto, no de flujo crítico — prioridad más baja que las anteriores.

## 5. Modelo — resumen de la evolución propuesta (detalle completo en v2-data-model.md)

- `Product` (concepto) → gana una tabla hija `ProductVariant` (SKU real: marca+presentación+
  unidad de compra). Migración 1:1 automática y sin pérdida de datos.
- `Store` (plano) → se divide en `StoreChain` + `StoreBranch`. Migración 1:1 automática
  (cada Store existente se vuelve una Branch de una Chain nueva con su mismo nombre).
- `Price` → pasa a referenciar `productVariantId` + `branchId` (renombrado conceptual de
  `productId`/`storeId`), gana `source` (`purchase`/`manual`/`external`) y opcionalmente
  `groceryListItemId` (para deduplicar la captura automática).
- `GroceryList` → gana `activeBranchId` (sesión de compra). **No se crea una entidad
  `ShoppingSession` nueva** — el análisis concluye que `GroceryList` ya cumple ese rol.
- `GroceryListItem` → sin cambios estructurales (ya tiene `selectedStoreId`/`actualPrice`/
  `purchased`; solo se renombra conceptualmente `selectedStoreId` → `selectedBranchId`).

## 6. Almacenamiento — riesgo real a mediano plazo

- Tamaño actual: un blob único, `JSON.stringify` de todo el documento en cada `set()`. Con el
  volumen de datos típico de una app personal (cientos de movimientos, decenas de productos),
  esto es intrascendente hoy.
- Riesgo real: **miles de `PriceObservation`** (si se captura una por cada compra + manual) más
  historial de ingresos/gastos de varios años. `localStorage` tiene un límite práctico de
  ~5-10MB por origen y **toda lectura/escritura serializa el documento completo** — no hay
  lectura parcial. Esto es aceptable durante V2-1 a V2-9, pero es la razón técnica real (no
  moda) para evaluar IndexedDB antes de escalar mucho más el volumen de precios (ver §26).

## 7. Integraciones futuras (solo evaluación conceptual, sin implementar)

- **PROFECO / Quién es Quién en los Precios**: fuente pública/legal viable a nivel conceptual;
  requiere que el modelo ya tenga `ProductVariant` (marca+presentación) y `StoreChain`/
  `StoreBranch` con ubicación, para poder mapear sin ambigüedad (ver `v2-data-model.md` §9).
  No se implementa en V2 — solo se preparan los campos que la integración necesitaría encontrar
  ya existentes.
- **Nube/sincronización**: solo tiene sentido cuando exista una necesidad real multi-dispositivo
  confirmada por el uso (ver roadmap V2-11). Introducirla antes sería complejidad sin beneficio
  medible todavía.

## 8. Arquitectura — qué se mantiene, qué evoluciona

- Se **mantiene**: Vanilla JS, sin framework, arquitectura en capas actual, `StorageService`
  como único gateway, patrón repository/service, Chart.js.
- **No hay razón técnica real para migrar a React/Vue/Angular** detectada en este análisis — el
  volumen de estado y la complejidad de UI actuales no justifican el costo de esa migración; se
  documenta como posible reconsideración solo si, después de V2, la complejidad de sincronización
  de estado entre muchos componentes se vuelve inmanejable en Vanilla (no es el caso hoy).
- Se **evoluciona**: el modelo de datos (Product/Variant, Chain/Branch, `source`/sesión), y
  eventualmente (no en V2 inmediato) la capa de almacenamiento (`StorageService` →
  implementación IndexedDB, misma interfaz pública) y posiblemente una capa de sync (V2-11+).

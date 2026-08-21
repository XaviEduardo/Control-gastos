# V2 — Roadmap técnico/funcional

> Solo planificación. Ninguna fase de este documento está implementada. Orden basado en
> dependencias reales verificadas en el código actual (ver `v2-data-model.md`). Esfuerzo en
> Bajo/Medio/Alto (sin horas). Prioridad P0 (necesaria antes de continuar) / P1 (alta) / P2
> (mejora importante) / P3 (futuro).

## Grafo de dependencias (resumen)

```
V2-0 (migración/versionado)
  └─ V2-1 (Product/Variant) ─┐
  └─ V2-2 (Chain/Branch)     ─┤
                               ├─ V2-3 (sesión de compra)
                               │     └─ V2-4 (captura rápida + historial automático)
                               ├─ V2-6 (lista por sucursal + preferencias) [depende de V2-2, V2-3]
                               ├─ V2-7 (Comparador v2) [depende de V2-1, V2-2; se beneficia de V2-4]
                               └─ V2-12 (fuentes externas) [depende de V2-1, V2-2]
V2-5 (listas reutilizables) — SIN dependencia dura de V2-1/2/3/4; puede ejecutarse en paralelo
V2-8 (navegación) — sin dependencia de datos; secuenciado tarde por coherencia de producto
V2-9 (refactor focalizado) — continuo, mejor después de estabilizar el modelo nuevo
V2-10 (IndexedDB/PWA) — depende de que V2-4 exista (motivador real de volumen de datos)
V2-11 (Cloud) — depende de V2-10 (o al menos de que la interfaz StorageService siga estable)
```

---

## V2-0 — Arquitectura y migración

**Objetivo**: preparar el mecanismo genérico para poder migrar el esquema de `localStorage`
sin perder datos, reutilizando lo que ya existe.

**Cambios**: formalizar `js/core/storage.js#migrate(raw)` (hoy un merge trivial) como una
cadena de migraciones `v1→v2→v3...`, cada una una función pura `(doc) => doc`. Definir un
`CURRENT_VERSION` por fase de V2 que la toque. Ningún cambio visible para el usuario.

**Dependencias**: ninguna.
**Riesgo**: Bajo (es la app leyéndose a sí misma; se prueba con el respaldo real del usuario
antes de tocar código de producción).
**Esfuerzo**: Bajo.
**Archivos afectados**: `js/core/storage.js` únicamente.
**Criterios de aceptación**: un documento `version:1` real (exportado desde Configuración hoy)
se carga sin pérdida y queda en `version:1` (todavía sin fases que migren nada) — es
infraestructura pura, no cambia comportamiento observable.

---

## V2-1 — Modelo Product/Variant

**Objetivo**: introducir `ProductVariant` sin romper el catálogo actual.

**Cambios**: nueva colección `productVariants`. Migración (dentro de V2-0): cada `Product`
existente genera una `ProductVariant` 1:1 (mismo `preferredUnit` → `purchaseUnit`, `brand`/
`presentationAmount`/`presentationUnit` vacíos). `ProductRepository` se conserva para
Categorías/nombre; se agrega `ProductVariantRepository`. Todo lugar que hoy usa `productId`
para precio/lista pasa a resolver a través de la variante (ver migración detallada).

**Dependencias**: V2-0.
**Riesgo**: Medio — toca la relación más usada del catálogo (`productId` aparece en `prices` y
`groceryListItems`). Mitigación: migración aditiva (se agrega `productVariantId` sin borrar
`productId` hasta confirmar que todo lo lee correctamente; `productId` se retira en una fase
posterior, no en V2-1).
**Esfuerzo**: Medio.
**Archivos afectados**: nuevo `js/modules/grocery/product-variant.repository.js`;
`js/modules/grocery/products.module.js` (UI para variantes); `js/services/groceryService.js`
y `priceService.js` NO cambian su fórmula, solo qué id resuelven; `js/modules/prices/*`,
`js/modules/price-comparison/*`, `js/modules/grocery/grocery-list.module.js` (todos los que
hoy leen `productId`). **Incluye la extracción de V2-9** para `grocery-list.module.js` (el
formulario de item nace ya en un archivo auxiliar, no en el monolito) y
`price-history.module.js` (formulario de captura separado del render de tabla/gráfica) — ver
justificación de secuenciación en V2-9.
**Criterios de aceptación**: cada producto existente sigue funcionando exactamente igual
(mismo nombre visible, mismo `preferredUnit`/cálculo) sin que el usuario tenga que hacer nada;
crear una segunda variante de un producto existente es posible y no afecta a la primera.

---

## V2-2 — Cadena/Sucursal

**Objetivo**: separar `StoreChain` de `StoreBranch` sin perder ninguna tienda registrada.

**Cambios**: nueva colección `storeChains`. Migración: cada `Store` se convierte en
`StoreBranch` + una `StoreChain` nueva homónima (1:1). `StoreRepository` se divide en
`StoreChainRepository` + `StoreBranchRepository` (o se extiende in-place, a decidir en diseño
detallado — no es una decisión de datos, es de organización de archivo).

**Dependencias**: V2-0. (No depende de V2-1.)
**Riesgo**: Medio — mismo patrón de riesgo que V2-1 (relación muy usada, `storeId` en
`prices`/`groceryListItems`). Mitigación idéntica (aditivo, doble id transicional).
**Esfuerzo**: Medio.
**Archivos afectados**: nuevo `store-chain.repository.js`; `stores.module.js` (UI de
chain+branch); `comparisonService.js` (agregación opcional por chain, sin tocar el algoritmo
de comparación por branch); `price-history.module.js`, `grocery-list.module.js`.
**Criterios de aceptación**: cada tienda existente sigue apareciendo igual en Tiendas/
Historial/Comparador; agrupar dos branches bajo la misma chain es posible después, editando
`chainId`, sin migrar nada de nuevo.

---

## V2-3 — Mandado 2.0 / sesión de compra

**Objetivo**: permitir fijar "dónde estoy comprando" una vez por mandado.

**Cambios**: `GroceryList` gana `activeBranchId` (opcional). Nueva UX: al abrir/reanudar una
lista abierta, ofrecer seleccionar sucursal si no hay una fijada; `GroceryListItem` hereda
`activeBranchId` como sucursal por defecto salvo que el item tenga su propio
`selectedBranchId`. **No se crea `ShoppingSession`** (ver justificación en
`v2-data-model.md` §3.5).

**Dependencias**: V2-1, V2-2 (necesita `ProductVariant`/`StoreBranch` para que la sesión tenga
sentido; podría hacerse contra el modelo viejo, pero se descarta para no migrar dos veces).
**Riesgo**: Bajo — es aditivo puro sobre `GroceryList`, no cambia ningún cálculo.
**Esfuerzo**: Bajo-Medio.
**Archivos afectados**: `grocery-list.repository.js`, `grocery-list.module.js` (selector de
sucursal al abrir/reanudar).
**Criterios de aceptación**: elegir sucursal una vez al abrir una lista evita que se vuelva a
pedir por producto; un producto puede seguir sobreescribiendo su propia sucursal si el usuario
lo decide explícitamente.

---

## V2-4 — Captura rápida + historial automático de precios

**Objetivo (el de mayor valor de todo el roadmap)**: que registrar el precio real de un
producto durante la compra genere automáticamente una `PriceObservation`, sin captura
duplicada.

**Cambios**: al guardar `actualPrice` en un `GroceryListItem` con `purchased:true` y una
sucursal conocida (`selectedBranchId` o `activeBranchId` heredado), crear/actualizar una
`PriceObservation` con `source:'purchase'` y `groceryListItemId` (dedupe: si el item ya tiene
una observación vinculada, se actualiza esa misma en vez de crear otra). La captura manual
(Historial → "+ Registrar precio") sigue existiendo tal cual, con `source:'manual'`.

**Dependencias**: V2-1, V2-2, V2-3.
**Riesgo**: Medio — es el primer punto donde una acción de UI dispara una escritura en OTRA
colección de forma automática; debe quedar estrictamente aislado a un solo punto de código
(un helper en `groceryService.js` o un nuevo `purchaseObservationService.js`, nunca lógica
duplicada en el módulo de UI) para poder probarlo con un test claro y no arriesgar
`itemEstimatedSubtotal`/`itemRealSubtotal`, que NO cambian.
**Esfuerzo**: Medio.
**Archivos afectados**: `grocery-list-item.repository.js` (o un service nuevo que orqueste
ambos repos), `price.repository.js`, `grocery-list.module.js`.
**Criterios de aceptación**: comprar un producto y capturar su precio real crea exactamente
una observación en Historial (verificable ahí sin acción manual adicional); editar el precio
real de nuevo actualiza esa misma observación, no crea una segunda; el flujo manual desde
Historial sigue intacto.

---

## V2-5 — Listas reutilizables

**Objetivo**: reducir el trabajo de armar cada mandado nuevo.

**Cambios**: "Repetir último mandado" (clonar la lista `groceryLists` más reciente + sus items,
sin precios reales ni estado `purchased`) y "Productos habituales" (ver V2-16 más abajo, es la
misma pieza de análisis). Plantillas/favoritos se documentan como P3 si el uso real de
"repetir último" no es suficiente.

**Dependencias**: ninguna dura — puede implementarse sobre el modelo actual O el nuevo
(clonar una lista no depende de si los items usan `productId` o `productVariantId`). Se
recomienda secuenciarla después de V2-1 solo por comodidad de no tocar el mismo código dos
veces, no por dependencia real.
**Riesgo**: Bajo.
**Esfuerzo**: Bajo.
**Archivos afectados**: `grocery-list.repository.js` (clonar), `grocery-list.module.js` (UI
"Repetir último").
**Criterios de aceptación**: "Repetir último mandado" crea una lista nueva con los mismos
productos/cantidades/categoría, `purchased:false` y `actualPrice:null` en todos los items,
sin afectar la lista original.

---

## V2-6 — Productos habituales (detección) + Lista por sucursal + Fijar tienda

**Objetivo**: (a) marcar productos "frecuentes" con una regla simple sobre datos existentes;
(b) organizar visualmente una lista por sucursal; (c) permitir fijar sucursal preferida.

**Cambios**:
- **Frecuentes**: regla simple sin IA — contar en cuántas de las últimas N listas cerradas
  (`status:'closed'`) aparece cada `productVariantId`; si aparece en ≥ umbral (ej. 8 de 10,
  configurable), se marca `Frecuente` en la UI. Cálculo derivado, sin campo nuevo persistido.
- **Lista por sucursal**: modo de agrupación visual de `GroceryListItem` por
  `selectedBranchId` (o `activeBranchId` si el item no tiene el suyo) — solo presentación,
  cero cambio de modelo adicional al ya definido en V2-2/V2-3.
- **Fijar tienda**: `preferredBranchId` en `ProductVariant` (opcional) — el comparador lo
  usa como sugerencia por defecto, nunca como restricción; el usuario puede comprar en otra
  sucursal sin fricción. Dentro de una lista, "Fijar en Smart" escribe
  `item.selectedBranchId` (ya existente desde V2-2/V2-3, sin campo nuevo).

**Dependencias**: V2-1 (frecuentes por variante), V2-2/V2-3 (sucursal), V2-5 (útil para saber
qué es "recurrente" con más historial de listas repetidas).
**Riesgo**: Bajo (todo es derivado o aditivo/opcional).
**Esfuerzo**: Medio (junta 3 features pequeñas; se puede partir en sub-entregas).
**Archivos afectados**: `product-variant.repository.js` (`preferredBranchId`),
`grocery-list.module.js` (agrupación por sucursal, badge "Frecuente"),
`comparisonService.js` (sugerencia basada en `preferredBranchId`, no obligatoria).
**Criterios de aceptación**: la recomendación del comparador nunca bloquea elegir otra
sucursal; un producto sin historial suficiente simplemente no se marca "Frecuente" (sin
falsos positivos).

---

## V2-7 — Comparador v2

**Objetivo**: comparar Producto+Variante+Presentación+Sucursal+Precio+Fecha, mostrando mejor
precio actual, mejor cadena, mejor sucursal, mejor tienda única para la lista, compra
optimizada y ahorro potencial (ya existen casi todos estos conceptos hoy a nivel Store).

**Cambios**: `compareProductAcrossStores`/`compareListAcrossStores` (ya en
`comparisonService.js`) se **reutilizan cambiando qué id resuelven** (branch en vez de store,
variant en vez de product) — su algoritmo de agrupar por dimensión y elegir mínimo no se
reescribe. Se agrega una agregación nueva por `chainId` ("mejor cadena", promedio/mínimo entre
las branches de la misma chain) y un indicador de frescura por observación mostrada (ver
V2-4/§20 del prompt — puramente presentacional, sin campo nuevo, calculado desde `date`).

**Dependencias**: V2-1, V2-2. Se beneficia de V2-4 (más observaciones = comparaciones más
útiles) pero no depende técnicamente de que exista.
**Riesgo**: Medio — es lógica ya delicada (el propio PASS 6 confirmó que el comparador nunca
inventa precios); cualquier cambio debe verificarse contra los mismos casos ya probados
(cobertura parcial, unidades no comparables se excluyen).
**Esfuerzo**: Medio-Alto.
**Archivos afectados**: `comparisonService.js`, `comparison.module.js`.
**Criterios de aceptación**: los resultados de comparación con los MISMOS datos de hoy
(mismo precio, misma tienda) deben ser idénticos a los actuales — es una condición de
regresión explícita, no solo un criterio de "funciona".

---

## V2-8 — Simplificación de navegación

**Objetivo**: reducir carga cognitiva de 17 rutas planas sin perder acceso a nada.

**Cambios** (solo propuesta, no aplicar aún): agrupar Ingresos+Gastos en una vista
`Movimientos` con filtro (entidades siguen separadas internamente — `IncomeRepository`/
`ExpenseRepository` no se fusionan, es una vista); mover Categorías/Tiendas/Historial a
contextos (`Producto → Detalle → Historial`, `Configuración → Categorías/Tiendas`) con una
vista global de Historial solo si el uso real la sigue pidiendo tras el cambio.

**Dependencias**: ninguna de datos. Se recomienda secuenciar después de V2-1/V2-2/V2-7 porque
"Producto → Detalle → Historial" es más natural una vez que Producto ya tiene variantes reales
que mostrar en ese detalle.
**Riesgo**: Bajo funcionalmente, Medio en percepción de usuario (cambia hábitos de
navegación) — mitigar con un cambio incremental, no un rediseño total de golpe.
**Esfuerzo**: Medio.
**Archivos afectados**: `js/app.js` (rutas/`ROUTE_META`), sidebar, módulos que se mueven de
ruta principal a contextual (sin tocar su lógica interna).
**Criterios de aceptación**: cada funcionalidad hoy accesible sigue siendo alcanzable en ≤2
clics/taps; no se elimina ninguna capacidad, solo se reubica.

---

## V2-9 — Refactor focalizado

**Objetivo**: reducir el tamaño/responsabilidades de los módulos más grandes, sin reescritura
completa.

**Estado real medido** (líneas de código, referencia objetiva, no estimación):
`grocery-list.module.js` 614, `reports.module.js` 461, `price-history.module.js` 404,
`comparison.module.js` 302, `components.css` 583. Los tres primeros concentran render + lógica
de formulario + lógica de agregación de UI en un solo archivo.

**Cambios propuestos** (extracción gradual, sin romper la API pública de cada módulo):
- `grocery-list.module.js`: separar `renderItemsByCategory`/formularios de item en un archivo
  de UI auxiliar (ej. `grocery-list-item-form.js`), dejando el módulo principal solo con
  orquestación de render.
- `price-history.module.js`: separar el formulario de captura de precio del render de tabla/
  gráfica.
- `reports.module.js`: extraer las funciones de cada sección de chart (`renderTopProducts`,
  `renderPriceEvolutionSection`, etc.) a un archivo `reports-sections.js`.
- `components.css`: dividir por dominio si vuelve a crecer sustancialmente (hoy 583 líneas es
  manejable; no es urgente, se documenta como criterio de disparo, no como tarea inmediata).

**Secuenciación revisada (ajuste sobre la primera pasada de este análisis)**: NO conviene
esperar a que V2-1..V2-7 estén "estables" para tocar `grocery-list.module.js` ni
`price-history.module.js` — ambos son exactamente los archivos que V2-1 (selector de
variante) y V2-2 (selector de sucursal) ya van a modificar. Dejarlos para el final significa
que V2-1/V2-2/V2-3/V2-4 editan tres veces el mismo archivo de 614/404 líneas sin dividir, y
luego una fase aparte lo reorganiza — más fricción total, no menos. Se recomienda extraer la
lógica de formulario de **estos dos archivos como parte del propio V2-1** (el selector de
producto/variante nace ya en el archivo separado, en vez de nacer en el monolito y mudarse
después). `reports.module.js` sí puede esperar a después de V2-7: recibe cambios menores
(solo lee ids, no construye selectores de variante/sucursal), así que separarlo antes no ahorra
ningún re-trabajo real.

**Dependencias**: la extracción de `grocery-list.module.js`/`price-history.module.js` se
ejecuta dentro de V2-1 (ver arriba); `reports.module.js`/`components.css` quedan como P2/P3
independiente, después de que V2-1..V2-7 estén estables.
**Riesgo**: Bajo si se hace por extracción pura (mover funciones, no reescribirlas).
**Esfuerzo**: Medio.
**Archivos afectados**: los listados arriba, ninguno fuera de UI/presentación.
**Criterios de aceptación**: cada extracción se valida con el mismo checklist de regresión
usado en el rediseño "Minimal Finance" (comportamiento idéntico, solo estructura de archivo).

---

## V2-10 — IndexedDB / PWA

**Objetivo**: preparar el siguiente escalón de almacenamiento y experiencia offline, cuando el
volumen real de `PriceObservation` (post V2-4) lo justifique.

**IndexedDB — análisis**:
- Beneficio real: más capacidad, consultas indexadas (por `productVariantId`/`branchId`/
  `date`) en vez de filtrar arrays completos en memoria, y una base más natural para offline.
- Complejidad real: `StorageService` ya es la abstracción correcta para absorber este cambio
  sin tocar `services`/`repositories` — su interfaz pública (`get`/`set`/`getSettings`/
  `setSettings`/`exportData`/`importData`/`clear`) se puede reimplementar sobre IndexedDB sin
  cambiar un solo `import` en el resto de la app. Esto confirma que la arquitectura actual en
  capas ya "paga" esta migración futura.
- Cuándo migrar: cuando el tamaño exportado (visible hoy en Configuración → Datos) empiece a
  acercarse a unos pocos MB, o cuando la cantidad de `PriceObservation` sea suficiente para que
  filtrar arrays en memoria en cada render sea perceptiblemente lento (no antes).

**PWA — análisis**: instalación + ícono + pantalla completa + disponibilidad de la lista
activa sin buena conexión — de alto valor específicamente por el caso de uso "dentro del
supermercado" (sección 26 del prompt). No depende de IndexedDB para su primera versión
(service worker + manifest pueden cachear la app shell con `localStorage` tal cual); si se
introduce offline "real" de escritura, ahí sí conviene ya tener IndexedDB.

**Dependencias**: se vuelve prioritario después de V2-4 (motivador real de volumen).
**Riesgo**: Medio (cambio de motor de almacenamiento; mitigar con export/import de respaldo
antes y después como red de seguridad, reutilizando el mecanismo ya existente).
**Esfuerzo**: Alto.
**Archivos afectados**: `js/core/storage.js` (reimplementación interna), `manifest.json`
nuevo, service worker nuevo — cero cambios en `services`/`repositories`/`modules`.
**Criterios de aceptación**: exportar antes de migrar y volver a importar después reproduce
exactamente los mismos datos; ninguna pantalla cambia de comportamiento.

---

## V2-11 — Base de datos remota (Cloud)

**Objetivo**: evaluar cuándo tendría sentido sincronizar entre dispositivos.

**Análisis**: solo se justifica cuando exista una necesidad real confirmada de multi-
dispositivo (hoy no confirmada por el uso, es un "preparados para eventualmente" del prompt,
no un requerimiento activo). Opciones simples evaluadas conceptualmente:
- **Supabase/PostgreSQL**: razonable si se llega a este punto — Postgres relacional encaja
  naturalmente con el modelo de V2-1/V2-2 (tablas con relaciones por id, ya diseñado así desde
  el inicio de la app). Supabase añade auth y una capa realtime sin operar servidor propio.
- **Alternativas** (Firebase/Firestore, etc.): documentadas solo si aparece una razón concreta
  (ej. necesidad real de realtime multi-usuario) — no hay indicio de esa necesidad hoy.
- **No elegir por moda**: se documenta explícitamente que ninguna tecnología se recomienda sin
  una necesidad de sincronización ya confirmada por el uso real de la app.

**Offline-first**: si se introduce nube, la arquitectura en capas actual
(`UI → services → repositories → StorageService`) ya modela naturalmente dónde insertar una
`Sync Layer` (entre `StorageService` y la nube) sin tocar capas superiores — es la misma razón
por la que IndexedDB no rompe nada en V2-10.

**Dependencias**: V2-10 recomendado primero (mismo punto de abstracción, menor salto).
**Riesgo**: Alto (autenticación, conflictos de sincronización, offline real).
**Esfuerzo**: Alto.
**Archivos afectados**: nueva capa de sync bajo `core/`, sin cambios en `modules/`/`services`.
**Criterios de aceptación**: no aplica todavía — este documento es una evaluación, no un plan
de implementación.

---

## V2-12 — Fuentes externas de precios (preparación conceptual)

**Objetivo**: evaluar arquitectura para integrar eventualmente fuentes públicas/legales de
precios en México (PROFECO / Quién es Quién en los Precios), sin implementarlo.

**Qué debe existir ANTES de implementar la integración** (esto es lo que se pide analizar, no
construir): el modelo de V2-1 (`ProductVariant` con marca+presentación) y V2-2
(`StoreChain`/`StoreBranch` con ubicación) — sin estos dos, no hay forma de mapear sin
ambigüedad un registro externo (que típicamente trae marca, presentación, cadena y ubicación)
a una entidad interna. También conviene que `PriceObservation.source` (V2-4) ya exista, para
poder etiquetar esos registros como `source:'external'` desde el primer día de la integración,
sin otra migración.

**Explícitamente descartado como arquitectura central**: scraping frágil. Se prioriza
conceptualmente una fuente pública/legal estructurada (PROFECO) sobre cualquier alternativa no
oficial. Códigos de barras quedan fuera de este análisis por instrucción explícita.

**Dependencias**: V2-1, V2-2, V2-4 (para `source`).
**Riesgo**: Alto (depende de disponibilidad/formato real de una fuente externa, fuera de
control del proyecto) — por eso se mantiene P3, evaluación conceptual únicamente.
**Esfuerzo**: Alto (desconocido hasta evaluar la fuente real).
**Archivos afectados**: ninguno todavía — es evaluación pura.
**Criterios de aceptación**: no aplica en esta etapa.

---

## Clasificación de prioridad

**P0 — necesaria antes de continuar**
- V2-0 (migración/versionado) — sin esto ningún cambio de esquema es seguro.
- V2-1 (Product/Variant) — bloquea V2-3, V2-4, V2-6, V2-7, V2-12.
- V2-2 (Chain/Branch) — bloquea V2-3, V2-4, V2-6, V2-7, V2-12.

**P1 — alta prioridad**
- V2-3 (sesión de compra).
- V2-4 (captura rápida + historial automático) — mayor VALOR de todo el roadmap, aunque no es
  P0 estructural porque depende de V2-1/V2-2/V2-3.
- V2-7 (Comparador v2) — es la promesa central de la app ("ayúdame a comprar más barato").

**P2 — mejora importante**
- V2-5 (listas reutilizables).
- V2-6 (productos habituales, lista por sucursal, fijar tienda).
- V2-8 (navegación).
- V2-9 (refactor focalizado).

**P3 — futuro**
- V2-10 (IndexedDB/PWA).
- V2-11 (Cloud).
- V2-12 (fuentes externas / PROFECO).

## Orden de implementación recomendado

`V2-0 → V2-1 → V2-2 → V2-3 → V2-4 → V2-7 → V2-5/V2-6 (pueden ir en paralelo con lo anterior
desde V2-1) → V2-8 → V2-9 → V2-10 → V2-11 → V2-12`

Coincide con el orden sugerido en la instrucción original, con dos ajustes justificados por el
análisis: V2-7 (Comparador v2) se adelanta antes de V2-5/V2-6 porque es P1 (alta prioridad de
producto) mientras V2-5/V2-6 son P2; y se señala explícitamente que V2-5 no tiene dependencia
dura y podría empezar en paralelo desde que arranca V2-1 si hay capacidad para llevar dos
frentes.

---

## Riesgos de regresión transversales (dónde hay más riesgo real de romper algo)

| Área | Riesgo | Cómo se protege |
|---|---|---|
| WEIGHT/UNIT (`groceryService.js`/`priceService.js`) | Que una fase de modelo toque por error la fórmula de subtotal o normalización | Estas dos fórmulas **no se tocan en ninguna fase de V2-1 a V2-9** (confirmado en este análisis) — cualquier PR que las modifique debe rechazarse salvo bug real, no relacionado a V2. |
| Comparador (`comparisonService.js`) | Cambiar de `productId`/`storeId` a `productVariantId`/`branchId` sin preservar el algoritmo | Criterio de aceptación explícito en V2-7: mismos datos → mismo resultado, verificado antes/después. |
| Persistencia/datos actuales | Migración de esquema pierde o corrompe datos del usuario | Todas las migraciones son aditivas y 1:1 (ver `v2-migration-plan.md`); se usa `exportData()` como respaldo verificable antes de cada migración real. |
| Mandado (`grocery-list.module.js`) | Es el módulo más grande y más tocado por V2-1/V2-3/V2-4/V2-6 simultáneamente | Extracción de formularios dentro de V2-1 (ver V2-9 revisado) antes de que las fases siguientes sigan editándolo; un solo agente/PR por fase (mismo principio que CLAUDE.md ya establece), y verificación de solo lectura antes de cada cambio (mismo patrón usado durante el rediseño "Minimal Finance"). |
| Reportes/Dashboard | Dependen de `financeService.js`, fuera del alcance de V2-1 a V2-7 | Ningún cambio de V2 debe tocar `financeService.js`/`recurrenceService.js`/`budgetService.js` — se marca expresamente fuera de alcance. |
| `financeService.mandadoTotal()` | Acoplado por NOMBRE a una categoría de gasto literal "mandado" (case-insensitive), no por id ni por `GroceryList` (puente documentado como temporal en `decisions.md`) — ninguna fase V2-1 a V2-7 lo toca, pero si una fase futura relaciona más de cerca Mandado con Gastos, hay riesgo real de doble conteo o de romper este puente | Ninguna fase de este roadmap modifica `mandadoTotal()`; si en el futuro se propone una fase que sí lo haga, debe auditarse explícitamente contra Dashboard/Semana/Mes antes de aceptarla. |

## Pruebas esenciales por fase (casos concretos a verificar, no solo "probar que funciona")

- **WEIGHT** (todas las fases que toquen `Product`/`ProductVariant`): Tomate 2.5 kg × $28/kg
  → subtotal $70, sin cambios antes/después de V2-1.
- **UNIT**: Leche 2 piezas, presentación 1.5 L, $32/pieza → subtotal $64 (nunca
  `2×1.5×32`), antes y después de V2-1.
- **Sucursal** (V2-2, V2-4, V2-7): mismo producto/variante con `Smart A → $32` y
  `Smart B → $34` capturados el mismo día — ambas observaciones deben coexistir sin que una
  sobrescriba a la otra (repite el comportamiento ya garantizado hoy por
  `price.repository.js#create`, que siempre agrega).
- **Migración** (cada fase con cambio de esquema): exportar datos reales antes de migrar,
  migrar, exportar de nuevo, comparar que ningún ingreso/gasto/producto/tienda/precio/
  presupuesto/lista se perdió (solo se agregaron campos/relaciones nuevas).
- **Comparador v2** (V2-7): con los mismos precios de hoy, `compareProductAcrossStores`/
  `compareListAcrossStores` deben devolver la misma tienda ganadora y el mismo ahorro
  potencial que devuelven hoy antes del cambio.
- **Historial automático** (V2-4): comprar + capturar precio real una vez → exactamente una
  `PriceObservation`; volver a editar el precio real del mismo item → la misma observación se
  actualiza, el conteo de observaciones para ese producto/sucursal/fecha no aumenta.

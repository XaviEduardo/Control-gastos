# V2 — Plan de migración de datos

> Solo planificación. Ninguna migración de este documento está implementada. Regla
> transversal: **NO borrar `localStorage`, NO resetear datos, NO perder ninguna fila
> existente.** Toda migración es aditiva y se apoya en el `version`/`migrate()` que ya existe
> en `js/core/storage.js` (hoy `CURRENT_VERSION = 1`).

## Principio general de toda migración de este plan

1. Cada migración es una función pura `migrateVN(doc) => doc'` registrada en una cadena
   `v1→v2→v3...` dentro de `storage.js#migrate()` (ver V2-0 en el roadmap).
2. Cada migración **agrega** colecciones/campos nuevos y **conserva** los campos/colecciones
   viejos durante una fase de transición (mínimo una versión completa) antes de que cualquier
   código deje de leerlos — así, si algo sale mal, la migración es reversible sin pérdida.
3. Antes de aplicar una migración real (no en pruebas), el flujo recomendado es: el usuario
   exporta su respaldo actual (`Configuración → Exportar respaldo`, ya existente) → se aplica
   la migración → se puede volver a exportar y comparar recuento de filas por colección como
   verificación.
4. Ninguna migración de este plan requiere que el usuario tome una decisión antes de poder
   seguir usando la app — todas producen un resultado por defecto razonable (1:1) que el
   usuario puede refinar después (agrupar branches bajo una chain, agregar variantes reales).

## 1. `Product` → `Product` + `ProductVariant`

**Antes:**
```
groceryProducts: [{ id: p1, name: "Leche", categoryId: c1, preferredUnit: "l", notes, status }]
```

**Después:**
```
groceryProducts: [{ id: p1, name: "Leche", categoryId: c1, notes, status }]   // preferredUnit se retira de aquí
productVariants: [{ id: v1, productId: p1, brand: null, name: null,
                     presentationAmount: null, presentationUnit: null,
                     purchaseUnit: "l", notes: "", status: "active" }]
```

**Pasos**:
1. Por cada `Product` existente, crear exactamente una `ProductVariant` con
   `purchaseUnit = product.preferredUnit`.
2. **Fase de transición** (dentro de la misma versión de esquema): `Product.preferredUnit` se
   mantiene en el documento (no se borra el campo) aunque ya no sea la fuente de verdad, hasta
   que se confirme que ningún código lo lee directamente — se retira en una migración
   posterior, nunca en la misma que lo introduce.
3. `Price.productId` y `GroceryListItem.productId` ganan un campo hermano
   `productVariantId = <variante recién creada para ese producto>` (mapeo 1:1 directo, sin
   ambigüedad porque cada producto viejo tiene exactamente una variante nueva).
4. `productId` en `Price`/`GroceryListItem` se conserva como alias de solo lectura durante la
   transición (algunos módulos pueden migrarse en PRs distintos sin romperse entre sí).

**Compatibilidad**: 100% — cero decisiones del usuario, cero pérdida, reversible (basta con
ignorar `productVariants` y seguir leyendo `productId`/`preferredUnit` si hiciera falta
revertir).

## 2. `Store` → `StoreChain` + `StoreBranch`

**Antes:**
```
stores: [{ id: s1, name: "Walmart Ejército Nacional", location, notes, status }]
```

**Después:**
```
storeChains:  [{ id: ch1, name: "Walmart Ejército Nacional", notes: "", status: "active" }]
storeBranches: [{ id: s1, chainId: ch1, name: "Walmart Ejército Nacional", location, notes, status }]
```

**Pasos**:
1. Por cada `Store` existente, crear una `StoreChain` con el mismo `name`, y convertir el
   `Store` en `StoreBranch` (**mismo `id`** — así ninguna referencia externa `storeId` se
   rompe: `Price.storeId`/`GroceryListItem.selectedStoreId` sigue apuntando al mismo id, que
   ahora vive en `storeBranches` en vez de `stores`) con `chainId` apuntando a la chain nueva.
2. La colección vieja `stores` se conserva vacía o como alias durante la transición (o se
   renombra directamente a `storeBranches` reutilizando los mismos objetos — es la opción más
   simple: cambiar solo la KEY de colección en `storage.js`, no el `id` de cada registro).
3. El usuario puede después editar el `name` de la chain (ej. de "Walmart Ejército Nacional" a
   simplemente "Walmart") y crear una segunda `StoreBranch` con ese mismo `chainId` — sin volver
   a migrar nada.

**Compatibilidad**: 100% — al conservar el mismo `id` para la branch, **ninguna** fila de
`prices` ni `groceryListItems` necesita reescribirse; solo cambia dónde vive el objeto
"tienda" y qué campo nuevo (`chainId`) tiene.

## 3. `Price` → `PriceObservation` (evolución de forma, misma colección física `prices`)

**Antes:**
```
prices: [{ id, productId, storeId, price, unit, quantity, date, notes, createdAt }]
```

**Después:**
```
prices: [{ id, productId, productVariantId, storeId, branchId, price, unit, quantity, date,
            notes, createdAt, source: "manual", groceryListItemId: null }]
```

**Pasos**:
1. Cada fila existente gana `productVariantId` (resuelto vía el mapeo 1:1 de la migración #1),
   `branchId` (= mismo valor que `storeId`, ver migración #2 — mismo id, sin necesidad de
   tabla de mapeo), `source: "manual"` (toda captura histórica fue manual hasta hoy — es un
   hecho, no una suposición: no existe código que haya escrito `prices` automáticamente antes
   de V2-4), y `groceryListItemId: null`.
2. `productId`/`storeId` se conservan como alias durante la transición (mismo criterio que
   arriba).
3. **No se reescribe ningún precio** — el valor histórico (`price`, `date`, `quantity`,
   `unit`) permanece exactamente igual; solo se agregan metadatos.

**Compatibilidad**: 100%, cero pérdida, cero ambigüedad (los mapeos 1 y 2 ya resolvieron los
únicos ids que hacían falta).

## 4. `GroceryListItem`

**Antes:**
```
groceryListItems: [{ id, groceryListId, productId, categoryId, quantity, unit,
                      selectedStoreId, estimatedPrice, actualPrice, purchased, notes }]
```

**Después:**
```
groceryListItems: [{ id, groceryListId, productVariantId, categoryId, quantity, unit,
                      selectedBranchId, estimatedPrice, actualPrice, purchased, notes }]
```

**Pasos**: igual patrón — `productVariantId` resuelto vía mapeo #1, `selectedBranchId` es el
mismo valor que `selectedStoreId` (mismo id, ver migración #2, sin tabla de mapeo adicional).
`quantity`/`unit`/`estimatedPrice`/`actualPrice`/`purchased` **no cambian de forma ni de
significado** — siguen alimentando exactamente las mismas fórmulas de `groceryService.js`.

**Compatibilidad**: 100%, sin pérdida de listas activas ni de su progreso de compra
(`purchased`/`actualPrice` sobreviven intactos).

## 5. `GroceryList` (aditivo, sin migración de datos existentes necesaria)

Se agrega `activeBranchId: null` a cada `GroceryList` existente — valor por defecto seguro
(ninguna lista tenía sesión antes), no requiere resolver nada de datos históricos.

## 6. Orden de aplicación y checkpoints de verificación

```
1. Ejecutar migración #2 (Store → Chain/Branch) — no depende de nada más.
2. Ejecutar migración #1 (Product → Product/Variant) — no depende de #2.
3. Ejecutar migración #3 (Price → PriceObservation) — depende de #1 y #2 (necesita los
   mapeos productVariantId/branchId ya resueltos).
4. Ejecutar migración #4 (GroceryListItem) — depende de #1 y #2, igual que #3.
5. Ejecutar migración #5 (GroceryList.activeBranchId) — independiente, puede ir en cualquier
   punto.
```

Cada paso, al completarse, debe cumplir el mismo checkpoint: **recuento de filas por
colección antes == recuento de filas equivalente después** (ninguna migración de este plan
elimina una fila; en el peor caso agrega una fila hermana como en #1/#2).

## 7. Qué se conserva garantizado (lista explícita, respondiendo a la instrucción del prompt)

- **Ingresos** (`incomes`) y **Gastos** (`expenses`): fuera del alcance de todas las
  migraciones de V2-1 a V2-9 — no se tocan en ningún punto de este plan.
- **Productos**: se conservan como `Product` (concepto) + gana una `ProductVariant` (no se
  pierde ningún producto ni se fusiona con otro sin acción explícita del usuario).
- **Listas** (`groceryLists`) y sus **items**: se conservan con su `status`/`budget`/
  `purchased`/`actualPrice` intactos.
- **Tiendas**: se conservan como `StoreBranch` con el mismo `id` (cero re-mapeo de
  referencias).
- **Precios**: se conservan todos, en la misma colección física, solo con metadatos nuevos.
- **Presupuestos** (`budgets`): fuera del alcance — no se tocan.
- **Historial**: es la colección `prices` migrada (#3) — se conserva completa, con `source`
  retro-etiquetado como `"manual"` para todo lo capturado hasta hoy.

## 8. Rollback

Como cada migración es aditiva (conserva los campos/colecciones viejos durante la fase de
transición) y el propio `StorageService.importData()` ya valida la forma antes de tocar
cualquier dato existente (`isValidBackupShape`, código ya existente hoy), el rollback más
simple y ya disponible sin construir nada nuevo es: **restaurar el respaldo exportado antes de
migrar** desde `Configuración → Respaldo → Importar respaldo`.

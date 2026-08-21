# V2 — Modelo de datos

> Solo análisis/propuesta. Ningún esquema aquí está implementado todavía. Los ejemplos de forma
> de entidad usan notación `{campo: tipo}` — no son código.

## 1. Entidades actuales relevantes (verificadas leyendo el repositorio real)

```
Product        {id, name, categoryId, preferredUnit, notes, status}
Store          {id, name, location, notes, status}
Price          {id, productId, storeId, price, unit, quantity, date, notes, createdAt}
GroceryList     {id, name, startDate, weekNumber, status, budget, notes, linkedExpenseId,
                 createdAt, updatedAt}
GroceryListItem {id, groceryListId, productId, categoryId, quantity, unit, selectedStoreId,
                 estimatedPrice, actualPrice, purchased, notes}
GroceryCategory {id, name, icon, status}      (createCategoryRepository)
```

`GroceryListItem` ya tiene `selectedStoreId` (hoy solo lo escribe el Comparador vía "Usar esta
tienda"), `actualPrice` y `purchased` (ambos editables directamente en la fila del item) — son
la base real de "Mandado 2.0", no hace falta inventarlos.

## 2. Problemas concretos de este modelo (no hipotéticos — verificados en código)

| Problema | Evidencia |
|---|---|
| Un "producto" conflating concepto+SKU | `Product.name` es texto libre; "Leche Lala 1.5L" y "Leche Alpura 1L" son dos filas sin relación entre sí. |
| Tienda sin jerarquía | `Store` no tiene `chainId`; comparar "cadena" requiere agrupar por substring de `name`, frágil. |
| Precio sin origen | `Price` no distingue compra real vs. captura manual vs. fuente externa. |
| Captura de precio real no alimenta historial | `groceryListItems.actualPrice` y `prices` son colecciones completamente desconectadas — confirmado, no hay ningún código que copie uno al otro. |
| Sin frescura | Nada en el modelo comunica antigüedad; se calcula implícitamente comparando `date`, pero no se expone. |

## 3. Entidades propuestas para V2

### 3.1 `Product` (se mantiene, pasa a ser el nivel "concepto")

```
Product {
  id, name, categoryId, status        // igual que hoy
  notes                                 // igual que hoy
}
```

Sin cambios de forma — simplemente deja de cargar directamente `preferredUnit` (ese campo baja
a la variante, ver 3.2). `Product` sigue siendo la entidad que aparece en Categorías/reportes.

### 3.2 `ProductVariant` (nueva — el SKU real, lo que efectivamente se compra)

```
ProductVariant {
  id
  productId          // → Product
  brand               // opcional, string
  name                // opcional; si es null, se muestra "{Product.name} {brand} {presentación}"
  presentationAmount  // opcional, number (ej. 1.5)
  presentationUnit    // opcional, string (ej. 'l', 'g', 'pza') — solo informativo/comparación
  purchaseUnit         // igual semántica que el `preferredUnit` de hoy — ESTE participa en el cálculo
  notes
  status
}
```

**`saleType` (WEIGHT/UNIT) — decisión: NO agregar este campo.** Ya es derivable sin ambigüedad
con `priceService.getUnitDimension(purchaseUnit)` (existente, sin cambios). Guardarlo aparte
crearía una segunda fuente de verdad que podría desincronizarse del `purchaseUnit` real. Mismo
razonamiento aplicado a la pregunta de la sección 14 del prompt sobre campos que "quizá no
haga falta": aquí el campo realmente no hace falta.

**Por qué SÍ conviene el split (y no solo agregar `brand`/`presentation` a `Product`)**: el
ejemplo del prompt (`Leche` con 3 variantes) es un caso real de catálogo — permite que
Productos muestre "Leche" una sola vez con sus variantes plegadas, y que el comparador pueda
en el futuro ofrecer "cualquier variante de Leche" como vista agregada sin forzar al usuario a
fusionar productos duplicados a mano. Es la única pieza de este análisis que sí amplía la
arquitectura (un join más), justificada porque la migración es 100% mecánica y sin riesgo
(ver `v2-migration-plan.md`): cada `Product` de hoy se convierte en un `Product` + exactamente
una `ProductVariant` con el mismo `preferredUnit` — cero decisiones que el usuario deba tomar
de inmediato.

### 3.3 `StoreChain` (nueva) + `StoreBranch` (evolución de `Store`)

```
StoreChain  { id, name, notes, status }              // ej. "Walmart", "Smart"
StoreBranch { id, chainId, name, location, notes, status }   // ej. "Walmart Ejército Nacional"
```

Migración: cada `Store` existente se convierte en `StoreBranch` + una `StoreChain` nueva del
mismo nombre (relación 1:1 inicial) — el usuario puede después re-agrupar branches bajo una
misma chain editando `chainId`, sin que eso rompa nada retroactivamente. El comparador no
cambia su lógica de fondo (cada branch sigue siendo un origen de precio independiente); solo
gana una capa de agregación opcional por `chainId` para "mejor cadena".

### 3.4 `Price` → `PriceObservation` (evolución de forma, mismo repositorio/colección física)

```
PriceObservation {
  id, productVariantId, branchId, price, quantity, unit, date, notes, createdAt
  source              // 'purchase' | 'manual' | 'external'  (nuevo)
  groceryListItemId    // nuevo, opcional — solo presente si source='purchase'; permite que
                        // re-editar el precio real de un item ACTUALICE la misma observación
                        // en vez de crear una nueva cada vez (evita duplicados sin heurísticas
                        // de fecha/monto)
}
```

`source` sí se recomienda agregar (a diferencia de `saleType`): resuelve un problema real —
distinguir "esto lo compré" de "lo vi pero no lo compré" de (a futuro) "vino de PROFECO" — y no
tiene alternativa derivable de los datos existentes. Todas las filas migradas de hoy se marcan
`source: 'manual'` (comportamiento histórico real: siempre se capturaron a mano).

### 3.5 `GroceryList` (evolución — NO se crea `ShoppingSession`)

```
GroceryList {
  ...campos actuales sin cambio...
  activeBranchId    // nuevo, opcional — "dónde estoy comprando ahora"
}
```

Justificación de NO crear `ShoppingSession`: `GroceryList` ya tiene `status`
(`open`/`closed`, equivalente a "sesión abierta/cerrada"), ya contiene sus `GroceryListItem`
con `purchased`/`actualPrice`/`selectedStoreId`, y ya se linkea a un gasto (`linkedExpenseId`)
al cerrarse. Todo lo que pide la sección 10 del prompt (crear/abrir → elegir dónde comprar →
comprar → capturar precios → marcar comprado → finalizar) es una **secuencia de UI sobre datos
que ya existen**, más un solo campo nuevo (`activeBranchId`) para no repetir la pregunta de
sucursal por producto. Agregar una entidad aparte solo duplicaría estado y crearía una fuente
de verdad adicional para sincronizar con `GroceryList.status`.

### 3.6 `GroceryListItem` (renombrado conceptual únicamente)

```
GroceryListItem {
  ...igual...
  productVariantId    // renombra productId
  selectedBranchId     // renombra selectedStoreId
}
```

## 4. Relaciones (V2)

```
Product 1───N ProductVariant
StoreChain 1───N StoreBranch
ProductVariant 1───N PriceObservation ───N StoreBranch
GroceryList 1───N GroceryListItem ───1 ProductVariant
GroceryList ───1 StoreBranch (activeBranchId, opcional)
GroceryListItem ───1 StoreBranch (selectedBranchId, opcional — puede diferir de activeBranchId)
PriceObservation ───1 GroceryListItem (opcional, solo si source='purchase')
```

## 5. Ejemplos con el modelo nuevo

**Caso B (Leche) con variantes:**
```
Product        { id: p1, name: "Leche", categoryId: lacteos }
ProductVariant { id: v1, productId: p1, brand: "Lala", presentationAmount: 1.5,
                 presentationUnit: "l", purchaseUnit: "pza" }
ProductVariant { id: v2, productId: p1, brand: "Alpura", presentationAmount: 1,
                 presentationUnit: "l", purchaseUnit: "pza" }
```
Subtotal de compra de `v1` (2 pza a $32/pza): `2 × 32 = $64` — misma fórmula de siempre,
`itemEstimatedSubtotal`/`itemRealSubtotal` no cambian, solo leen `productVariantId` en vez de
`productId` para resolver el nombre a mostrar.

**Precio por sucursal (sección 9 del prompt):**
```
PriceObservation { productVariantId: v1, branchId: smartA, price: 32, date: 2026-08-20, source: purchase }
PriceObservation { productVariantId: v1, branchId: smartB, price: 34, date: 2026-08-20, source: purchase }
```
Ambos coexisten sin conflicto — es exactamente el modelo actual (`productId`+`storeId`+`price`+
`date`), solo con nombres de campo actualizados; **cero cambio de comportamiento**, el
repositorio de precios ya nunca sobrescribe (`create()` siempre agrega).

## 6. Qué NO cambia (ver también v2-analysis.md §3)

- `groceryService.js` (subtotales) — no lee variantes, solo `quantity`/`estimatedPrice`/
  `actualPrice`, que no cambian de forma.
- `priceService.js` (`normalizePrice`, dimensiones) — no cambia; sigue operando sobre
  `unit`/`quantity`/`price` de cada `PriceObservation`, sin importar si viene de compra o
  captura manual.
- `comparisonService.js` — su firma pública (`compareProductAcrossStores(productId)`,
  `compareListAcrossStores(listId)`) cambia de parámetro (`productVariantId`/`branchId`) pero
  su algoritmo de comparación (normalizar, agrupar por dimensión, elegir mínimo) no cambia una
  sola línea.
- `financeService.js`, `recurrenceService.js`, `budgetService.js` — completamente fuera del
  radio de impacto de este modelo (Income/Expense/Budget no se tocan en V2-1 a V2-7).

## 7. Compatibilidad / migración (resumen — detalle completo en v2-migration-plan.md)

Todas las migraciones propuestas son **mecánicas y 1:1** (no requieren decisión del usuario en
el momento de migrar): cada entidad vieja genera exactamente una entidad nueva equivalente, y
las relaciones existentes (`productId`, `storeId`) se conservan como puntero derivado durante
una fase de transición antes de eliminarse. En ningún punto se borra `localStorage` ni se
resetea `StorageService` — se usa el mecanismo de `version`/`migrate()` ya existente en
`storage.js`, incrementando `CURRENT_VERSION` por cada migración real.

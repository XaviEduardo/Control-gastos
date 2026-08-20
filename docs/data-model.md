# Modelo de datos

Documento raíz persistido (versionado) — ver `decisions.md`:

```js
{
  version: 1,
  lastUpdated: "ISO-8601",
  settings: Settings,
  incomes: Income[],
  incomeTypes: IncomeType[],
  expenses: Expense[],
  expenseCategories: ExpenseCategory[],
  groceryCategories: GroceryCategory[],
  groceryProducts: GroceryProduct[],
  stores: Store[],
  prices: ProductPrice[],
  groceryLists: GroceryList[],
  budgets: Budget[]
}
```

## Income
```
id, description, incomeTypeId (ref IncomeType), amount, date,
frequency: 'once'|'weekly'|'biweekly'|'monthly'|'yearly'|'custom',
notes?, createdAt, updatedAt
```
## IncomeType
```
id, name, status: 'active'|'inactive'
```
Seed inicial: Sueldo, Extra, Otros (editable/ampliable).

## ExpenseCategory
```
id, name, icon?, status: 'active'|'inactive'
```

## Expense
```
id, description, categoryId (ref ExpenseCategory), amount, date,
frequency: 'once'|'weekly'|'biweekly'|'monthly'|'yearly'|'custom',
customRule?,            // solo si frequency = 'custom' (ej. { intervalDays: 15 })
dueDay?,                // día del mes esperado de pago, para recurrentes mensuales (ej. Internet día 10)
paymentMethod?, notes?, createdAt, updatedAt
```

## GroceryCategory
```
id, name, icon?, status
```

## GroceryProduct
```
id, name, categoryId (ref GroceryCategory), preferredUnit: 'kg'|'g'|'l'|'ml'|'pza'|'paquete'|...,
notes?, status
```

## Store
```
id, name, location?, notes?, status
```

## ProductPrice
Historial inmutable — nunca se sobrescribe, se agrega un nuevo registro.
```
id, productId, storeId, price, unit, quantity, date, notes?, createdAt
```
`price` es el precio pagado por `quantity` unidades de `unit` (ej. price=50, quantity=2, unit='l' → $25/L). El precio normalizado (por unidad base) se calcula en `priceService.js`, nunca se guarda duplicado.

## GroceryList (mandado)
```
id, name, startDate, weekNumber?, status: 'open'|'closed',
budget?, notes?, items: GroceryListItem[] (o colección separada referenciando groceryListId),
linkedExpenseId?,   // id del Expense creado al "Registrar como gasto" (evita duplicar el gasto; ver decisions.md)
createdAt, updatedAt
```

## GroceryListItem
```
id, groceryListId, productId, categoryId (denormalizado desde product al momento de agregar, para snapshots históricos estables),
quantity, unit, selectedStoreId?, estimatedPrice?, actualPrice?, purchased: boolean, notes?
```

## Budget
```
id, scope: 'monthly'|'weekly'|'grocery'|'category',
categoryId?,           // solo si scope = 'category'
amount, createdAt, updatedAt
```
Es un monto objetivo permanente por rubro (no atado a un mes/semana específico — ver
`decisions.md`): se evalúa en vivo contra el periodo que se esté viendo (semana actual para
`weekly`, mes seleccionado para `monthly`/`grocery`/`category`). A lo sumo un `Budget` por
`scope` (excepto `category`, que admite uno por `categoryId`); `budget.repository.js#upsert`
garantiza esto.

## Settings
```
currency: 'MXN',        // preparado para otras monedas (ver core/currency.js)
selectedWeekDate,       // fecha ISO de referencia dentro de la semana seleccionada (no un número de semana,
                        // para no ser ambiguo entre años — ver Vista Semanal)
selectedMonth, selectedYear,
sidebarCollapsed?, uiFilters?: {...}
```

## Notas de diseño
- No existen entidades separadas para "Semana" o "Mes": se calculan vía `periodService.js` a partir de `incomes`/`expenses`/`groceryLists` filtrados por fecha. Evita duplicar datos y desincronización (a diferencia del Excel, donde Semanal dependía de fórmulas manuales por hoja).
- `GroceryListItem.categoryId` se denormaliza al crear el item (snapshot), para que reportes históricos no cambien si el usuario reclasifica el producto después.
- Las recurrencias de `Expense`/`Income` no generan registros duplicados por ocurrencia; `recurrenceService.js` las expande en memoria para calendario/reportes.
- Seed inicial (categorías/productos/tiendas/conceptos de gasto reales extraídos del Excel) documentado en `excel-analysis.md` y materializado en `js/data/seed.js` durante Fase 1.
- No existen entidades "gasto semanal"/"gasto mensual" separadas de `Expense`/`Income` (ver `decisions.md`): la vista semanal y mensual son agregaciones calculadas del mismo dato, no una re-captura manual como en el Excel.

## Seed inicial (derivado de `excel-analysis.md`)
- **GroceryCategory (8):** Frutas y Verduras, Carnes y Pescados, Lácteos y Huevo, Granos y Abarrotes, Pan y Tortillas, Productos de Limpieza, Higiene Personal, Otros Mandado.
- **GroceryProduct (8, uno por categoría, ejemplo editable):** Tomate, Pechuga de pollo, Leche, Arroz, Tortillas, Detergente, Shampoo, Bolsas.
- **ExpenseCategory (11, agrupando los conceptos fijos del Excel en categorías, no como gastos individuales):** ej. Deudas/Coppel, Diezmo, Vivienda/Renta, Fernando, Servicios/Internet, Mandado, Mascotas/Croquetas, Educación/Curso, Mochila, Transporte/DiDi, Otros. El usuario podrá renombrar/reorganizar libremente; los 11 conceptos originales se cargan como `Expense` recurrentes de ejemplo dentro de sus categorías.
- **IncomeType (3):** Sueldo, Extra, Otros (los placeholders "Ingreso 1/2/3" del Excel se traducen a estos 3 tipos editables).
- **Store:** sin seed inicial (el Excel no tenía tiendas); el usuario las crea en Fase 6. Ejemplos sugeridos en UI (no precargados): Walmart, Soriana, Smart, Costco, Sam's, Bodega Aurrera.

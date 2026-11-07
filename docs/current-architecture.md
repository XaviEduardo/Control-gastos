# Arquitectura actual — Control de Gastos

> Documento canónico de la arquitectura ejecutada en el repositorio. Actualizado el 2026-11-06.
> Si otro documento describe una versión distinta, este documento y el código actual tienen
> prioridad. Las propuestas históricas se conservan para contexto, pero no deben tratarse como
> tareas pendientes sin verificar primero el código.

## 1. Resumen

Control de Gastos es una aplicación web estática tipo SPA/PWA:

- Frontend: HTML5, CSS3 y JavaScript ES Modules nativo.
- UI: módulos de negocio en `js/modules/` y componentes reutilizables en `js/components/`.
- Estado: store en memoria en `js/core/state.js`.
- Negocio: servicios especializados en `js/services/`.
- CRUD: repositories por entidad o módulo.
- Persistencia: Supabase Auth + una fila JSONB por usuario, con caché local por usuario.
- Despliegue: GitHub Pages; no existe servidor propio ni proceso de build.
- Dependencias externas: `@supabase/supabase-js` y Chart.js por CDN.

La aplicación no tiene una API propia. El navegador consume directamente Supabase mediante el
cliente público (`anon key`); el aislamiento real depende de Row Level Security.

## 2. Flujo de arranque

```text
index.html
  → registra Service Worker y carga js/app.js
  → waitForSession() espera una sesión de Supabase
  → StorageService.setUserId(session.user.id)
  → State.init(buildSeed)
  → carga datos remotos o caché local del usuario
  → aplica migraciones pendientes
  → inicializa moneda y tema
  → construye navegación y registra rutas
  → monta la ruta hash actual (por defecto /dashboard)
```

Puntos de entrada:

- `index.html`: shell HTML, metadatos PWA y hojas de estilo.
- `js/app.js`: bootstrap, rutas, navegación global, drawer móvil y captura rápida.
- `js/core/auth-gate.js`: login, registro y recuperación de contraseña.
- `js/core/router.js`: router basado en hash (`#/dashboard`, etc.).

## 3. Capas y responsabilidades

```text
Módulos UI / componentes
        ↓
Repositories
        ↓
State + EventBus
        ↓
StorageService
        ↓
Supabase app_data / caché local por usuario
```

### `core/`

Infraestructura transversal:

- `auth.js`, `auth-gate.js`: sesión y autenticación.
- `storage.js`: documento persistido, migraciones, caché y sincronización.
- `state.js`: estado en memoria y eventos de cambio.
- `router.js`: navegación por hash.
- `dates.js`: fechas, periodos y recurrencias auxiliares.
- `currency.js`: moneda y formato monetario.
- `validators.js`: validaciones y escape de HTML.
- `theme.js`: preferencias de tema.
- `events.js`: EventBus mínimo.

### `services/`

Fuente única de lógica de negocio:

- Finanzas: ingresos, gastos, balances, categorías y periodos.
- Presupuesto: avance y límites.
- Recurrencias: expansión de ocurrencias.
- Mandado: subtotales, listas y productos.
- Precios: normalización por unidad y frescura.
- Comparador: mejor tienda, carrito optimizado y ahorro.
- Observaciones de compra: conexión entre compras reales e historial de precios.
- Recordatorios: gastos próximos no pagados.

Los servicios leen de `State` y no deben manipular el DOM ni acceder directamente a
`localStorage` o Supabase.

### `modules/`

Cada módulo representa una ruta o dominio de usuario. Puede contener UI, wiring de eventos y
repositories propios. Los módulos no deben duplicar cálculos financieros que ya existan en
`services/`.

### `components/`

UI reutilizable: modal, toast, tablas, tarjetas KPI, progreso, menús de acciones, estados vacíos,
confirmaciones e iconos.

## 4. Persistencia y sincronización

### Fuente remota

Supabase usa la tabla:

```sql
app_data (
  user_id uuid primary key,
  doc jsonb not null,
  updated_at timestamptz not null
)
```

Row Level Security permite a cada usuario leer, insertar, actualizar y eliminar únicamente su
propia fila. El esquema está en `supabase/schema.sql`.

### Documento local

`StorageService` mantiene un documento raíz versionado. La versión actual es **7**.

Colecciones actuales:

```text
incomes
incomeTypes
expenses
expenseCategories
expensePayments
movementTemplates
groceryCategories
groceryProducts
productVariants
stores                 legacy/compatibilidad
storeChains
storeBranches
prices
groceryLists
groceryListItems
budgets
```

La caché local usa:

```text
control-gastos:data:<userId>
```

La clave histórica `control-gastos:data` se migra una sola vez al primer usuario autenticado de
una instalación existente y después se elimina. No debe utilizarse como fallback compartido.

### Lectura

1. Intentar leer el documento remoto del usuario.
2. Si la red falla o no existe documento remoto, leer la caché de ese mismo usuario.
3. Si no existe ningún documento, crear el seed.
4. Ejecutar migraciones pendientes.
5. Persistir el resultado actualizado.

### Escritura

1. Actualizar el estado en memoria.
2. Escribir inmediatamente la caché local.
3. Encolar un `upsert` remoto del documento completo.
4. Emitir estado `syncing`, `synced` o `error`.

El borrado de datos también pasa por la misma cola y espera su finalización antes de que la UI
recargue la aplicación. Los errores remotos no bloquean la edición local, pero se notifican en la
interfaz.

### Límites conocidos

- Todavía no existe una cola offline persistente en IndexedDB.
- No hay resolución de conflictos entre dos pestañas o dispositivos.
- Cada mutación envía el documento completo, no un cambio parcial.
- La sincronización no tiene reintentos persistentes automáticos.
- El documento JSONB no permite consultas analíticas eficientes a gran escala.

Estos límites son aceptables para el alcance personal actual; no deben ocultarse si se habilita
uso multi-dispositivo intensivo.

## 5. Modelo actual y compatibilidad

Las migraciones se aplican secuencialmente en `js/core/storage.js`:

| Versión | Cambio |
|---|---|
| 1 → 2 | `ProductVariant` para separar producto y presentación/SKU. |
| 2 → 3 | `StoreChain` y `StoreBranch`; se conserva compatibilidad con `stores`. |
| 3 → 4 | `GroceryList.activeBranchId`. |
| 4 → 5 | `Price.source` y `Price.groceryListItemId`. |
| 5 → 6 | `ProductVariant.preferredBranchId`. |
| 6 → 7 | `expensePayments` para pagar ocurrencias recurrentes individualmente. |

Las migraciones son aditivas. Durante la compatibilidad se conservan campos legacy como
`productId`, `storeId` y `selectedStoreId`; no deben eliminarse en una fase visual.

## 6. Rutas implementadas

### Finanzas

- `/dashboard`
- `/movimientos`
- `/ingresos`
- `/gastos`
- `/semana`
- `/mes`
- `/presupuesto`

### Mandado

- `/mandado/lista`
- `/mandado/productos`
- `/mandado/categorias`
- `/mandado/tiendas`
- `/mandado/comparar`
- `/mandado/historial`

### General

- `/calendario`
- `/reportes`
- `/configuracion`

La navegación visible se genera desde `ROUTE_META` y `NAV_GROUPS` en `js/app.js`, por lo que no
debe duplicarse manualmente en `index.html`.

## 7. PWA y GitHub Pages

El Service Worker cachea únicamente archivos same-origin del app shell. Las peticiones a Supabase
y a los CDNs no se cachean. Todas las rutas de assets son relativas para permitir despliegues bajo
un subpath de GitHub Pages.

Al añadir archivos JavaScript o CSS al app shell, hay que agregarlos también a `sw.js`. Al cambiar
el contenido cacheado, se debe incrementar `CACHE_NAME` para evitar que los usuarios reciban una
versión antigua.

## 8. Invariantes de desarrollo

- Toda persistencia pasa por `StorageService`.
- Toda relación entre entidades usa IDs.
- Los cálculos viven en `services/`.
- Las mutaciones válidas se guardan automáticamente.
- El seed no sobrescribe datos existentes.
- Las migraciones nunca deben borrar datos del usuario.
- Los campos legacy se mantienen hasta que exista una migración explícita.
- Todo HTML interpolado con datos del usuario debe escapar texto con `escapeHtml`.
- La UI debe seguir funcionando con caché local aunque la sincronización remota falle.

## 9. Documentos relacionados

- `docs/decisions.md`: registro histórico y vigente de decisiones.
- `docs/phase-3-4.md`: decisiones y alcance implementado del rediseño visual responsive.
- `docs/phase-5.md`: consolidación visual, accesibilidad y QA técnico.
- `docs/roadmap.md`: estado de implementación y backlog.
- `docs/ui-ux-audit.md`: auditoría visual histórica.
- `docs/responsive-plan.md`: guía responsive y matriz de pruebas.
- `docs/excel-analysis.md`: referencia funcional original del Excel.
- `docs/architecture.md`: arquitectura v1 histórica.
- `docs/data-model.md`: modelo v1 histórico.
- `docs/v2-*.md`: análisis y planes históricos de la evolución V2; varias fases ya fueron
  implementadas y deben contrastarse con este documento y el código.

## 10. Verificación antes de cerrar una fase

Como mínimo:

1. Ejecutar `node --check` sobre `js/**/*.js`.
2. Ejecutar `git diff --check`.
3. Confirmar que todos los archivos del Service Worker existen.
4. Probar en navegador las rutas y la consola.
5. Probar persistencia: crear, recargar, editar, recargar y eliminar.
6. Probar con dos cuentas y con la red desconectada.
7. Ejecutar export/import antes de cualquier migración de esquema.

# Auditoría UI/UX, Responsive y Navegación

Fecha: 2026-08-20 · Rama: `Feat-UX-UI` · Solo diagnóstico, **sin cambios de código en esta fase**.

## A. Resumen ejecutivo

La app es funcionalmente completa (MVP local, 10 fases + QA ya cerradas) pero su diseño fue
construido con un sistema de tokens mínimo (`css/variables.css`, 34 líneas) pensado para
"que funcione", no para transmitir un producto moderno. El layout es **desktop-first real**:
el sidebar fijo de 260px y las tablas con scroll horizontal se adaptan a móvil por
`overflow`/`transform`, no por una reestructuración de la información. Esto se siente
correctamente como "página de escritorio encogida" en Mandado, Productos y en cualquier
tabla — exactamente el síntoma que describes. Además existe un bug real y reproducible de
scroll del sidebar en móvil, con causa raíz identificada con alta confianza (sección C).

El sistema visual base (paleta, radios, sombras, spacing) es sobrio y ya cumple "no abusar
del diseño" — el trabajo principal no es "rediseñar desde cero", sino: (1) age up de la
paleta/tipografía, (2) transformar tablas/filas en tarjetas en los puntos correctos, (3)
corregir el bug de sidebar y su estrategia móvil, (4) resolver los `100vh` frágiles y
overflow puntual, (5) dar a Mandado una experiencia de lista real en vez de una fila de
formulario comprimida.

## B. Problemas críticos

1. **Bug de scroll del sidebar tras Calendario** (ver C) — reproducible, con causa
   identificada en CSS (`height: 100vh` + falta de scroll-lock en `body`).
2. **`Mandado > Mi lista` en móvil**: cada producto es una fila `flex-wrap` de **9
   elementos** (checkbox, nombre, cantidad, unidad, precio est., precio real, subtotal,
   notas, eliminar) con anchos fijos (`64px`, `90px`×2, `min-width:64px`, `min-width:70px`).
   En 320–390px de ancho no hay overflow horizontal real (el `flex-wrap` sí envuelve), pero
   el resultado es 3-4 líneas por producto con elementos huérfanos y sin jerarquía —
   exactamente "no se acomodan correctamente / distribución no se siente natural".
3. **`Mandado > Productos` / cualquier tabla** usa `.table-wrapper { overflow-x: auto }`
   como única estrategia responsive — es scroll horizontal de tabla de escritorio, no el
   patrón "tabla → card" que pides.
4. **`.charts-grid` (Dashboard/Reportes/Historial de precios)**: `grid-template-columns:
   repeat(auto-fit, minmax(320px, 1fr))` — en un viewport de 320–360px, `320px` de mínimo
   por columna, sumado al padding del `.card` (`--space-lg` = 24px por lado) y al `.app-content`
   (`--space-md` = 16px en `@480px`), puede exceder el ancho disponible → candidato real a
   overflow horizontal (sección 15).
5. **Modales**: `max-width:480px` centrado con `padding:16px` alrededor — en pantallas
   pequeñas queda "modal de escritorio encogido" (≈358px de ancho en 390px), no una hoja
   inferior ni pantalla completa; sin manejo de teclado virtual.

## C. Causa probable del bug del sidebar

**Reproducción del usuario:** abrir sidebar → navegar → entrar a Calendario → el sidebar
"ya no sube" / se ve mal.

**Causa más probable — combinación de dos factores, ambos verificados en el código:**

1. `css/layout.css:7-15` — `.sidebar { position: sticky; top:0; height: 100vh; overflow-y:
   auto; }`. En móvil (`css/responsive.css:8-17`) el sidebar pasa a `position: fixed` pero
   **no** redefine `height` ni `overflow-y` — hereda `height: 100vh`. En navegadores móviles
   (Safari/Chrome), `100vh` se calcula respecto a un viewport que cambia dinámicamente
   cuando la barra de direcciones se oculta/muestra al hacer scroll de una página larga. El
   Calendario (`css/components.css:192-215`, grid de 7 columnas + panel de detalle del día
   debajo) es de las páginas **más altas** de la app — la más propensa a producir scroll real
   de página y, con ello, a disparar el colapso de la barra del navegador. El resultado:
   la altura efectiva del sidebar fijo queda calculada contra un `100vh` que ya no coincide
   con el viewport visual real, y su área con scroll interno (`overflow-y:auto`) mide mal su
   propio `scrollHeight`/`clientHeight` — el scroll interno queda "atascado" o el sidebar se
   ve recortado/mal alineado.
2. **No existe bloqueo de scroll del `body` cuando el sidebar está abierto.** Ni
   `css/responsive.css` ni `js/app.js` (`setupSidebarToggle`, líneas 103-117) agregan
   `overflow: hidden` (u otra técnica de scroll-lock) a `body` mientras `body.sidebar-open`
   está activo. Con el drawer abierto sobre una página larga (como Calendario, ya
   desplazada), un gesto táctil dirigido al sidebar puede ambigüarse con el scroll del body
   detrás del overlay — un problema clásico de "doble scroll" en iOS Safari que se agrava
   precisamente después de haber scrolleado una página larga.

**Archivos/clases/funciones involucrados:**
- `css/layout.css` — regla `.sidebar` (línea 7-15, define `height:100vh` sin variante para fixed).
- `css/responsive.css` — bloque `@media (max-width:768px)` (línea 5-24, no redefine `height`/`overflow-y`, no bloquea `body`).
- `js/app.js` — `setupSidebarToggle()` / `setOpen()` (líneas 103-117, solo hace `classList.toggle('sidebar-open', ...)`, ningún manejo de scroll).
- `js/core/router.js` — `renderRoute()` (línea 38-51) no resetea scroll ni interviene aquí; **no** es la causa (se revisó y descartó: no toca `body`, `sidebar` ni clases relacionadas).
- No hay listeners `touchmove`/`preventDefault` en ningún archivo — se descarta esa hipótesis.

**Nivel de confianza:** alto para la causa (1) y (2) combinadas; no se puede confirmar al
100% sin probar en un dispositivo real, pero el patrón coincide exactamente con el bug
documentado de "100vh + drawer sin scroll-lock" en navegadores móviles, y Calendario es la
página que más probablemente lo dispara por su altura.

## D. Problemas responsive (clasificados)

**Crítico**
- Sidebar: bug de scroll (ver C) + estrategia (drawer con `100vh`, sin `100dvh`, sin lock de `body`).
- Mandado / Mi lista: fila de 9 elementos sin transformación a card en móvil.
- `.charts-grid` con `minmax(320px, …)` puede exceder viewports de 320–360px.
- Modales: sin variante mobile (bottom-sheet/full-screen), sin manejo de teclado virtual.

**Alto**
- Todas las tablas (`Productos`, futuras listas) dependen solo de `overflow-x:auto` — no hay
  patrón "card" reutilizable todavía.
- `grocery-item-row__qty`/`__price` con `width` fijo en px (no `min()`/`clamp()`), poco
  amigable táctil (inputs numéricos angostos).
- Sin `env(safe-area-inset-*)` en ningún lado — el header sticky, el botón hamburguesa
  fijo (`top:14px; left:14px`) y el overlay pueden quedar parcialmente bajo el notch/home
  indicator en iPhones con muescas.
- Calendario: 7 columnas con `aspect-ratio:1/1` funciona en ancho, pero en pantallas muy
  pequeñas (320px) el texto de badges (`0.55rem`) y números de día ya están en el límite de
  legibilidad.

**Medio**
- Botones/inputs con altura implícita (`padding:8px 16px` / `padding:8px 10px`) — cercanos
  a 36-40px, no siempre ≥44px táctil en botones ghost/ícono pequeños (ej. `.modal-close`,
  botones de acción en filas de tabla).
- `--sidebar-width` sólo tiene 2 valores (260px / 220px en tablet) — la reducción a 220px en
  1024px es un ajuste menor, no una estrategia real de tablet.
- Formularios (`form-grid`) ya son 1 columna siempre — **correcto para móvil**, pero
  significa que en desktop tampoco se usan 2 columnas cuando tendría sentido (ej.
  Cantidad + Unidad, Precio + Fecha) — oportunidad de mejora, no un problema per se.

**Bajo**
- Tipografía usa una sola familia (`Segoe UI` system-ui…) — correcto, no hay múltiples
  fuentes; pero la jerarquía tipográfica es limitada (solo 4 tamaños: sm/md/lg/xl).
- Colores de marca únicos (`--color-primary`) sin variantes de énfasis adicionales para
  estados hover/active más ricos.

## E. Comparación conceptual con TKambio.html (solo como referencia de nivel)

**Lo aprovechable (principios, no literal):**
- Paleta neutra con un solo acento (`#2B6CB0` azul) + colores de estado semánticos
  reservados exclusivamente para badges/estados (no decorativos) — igual filosofía que ya
  tenemos, pero con más disciplina en su aplicación.
- Etiquetas "eyebrow" en mayúsculas, pequeñas, con letter-spacing, para metadatos secundarios
  (`.wh-meta-item .k`) — útil para nuestros `summary-card__label`.
- Badges tipo "pill" (estado/nivel) vs. tags rectangulares pequeños (metadatos) —
  diferenciación visual clara entre "estado" e "info adicional" que hoy no distinguimos
  (todo son `<span class="text-muted">`).
- Barra de progreso de dos niveles: gradiente para el total general, color plano para
  subtotales — jerarquía visual útil para Presupuesto/Mandado.
- Secciones colapsables (`sub`/`sub-header`/chevron) para agrupar muchas tareas — aplicable
  directamente a categorías de Mandado con muchos productos.
- Barra de filtros como card independiente, con `flex-wrap` — patrón ya similar a nuestro
  `.toolbar`, pero más pulido visualmente (radios de 6px, bordes más definidos).
- Fila de tarea con indicador circular a la izquierda + contenido flexible + tags debajo del
  nombre — muy cercano al patrón de "card" que queremos para Mandado/Productos en móvil.

**Lo que NO se debe copiar:**
- Su propia estrategia móvil es débil (a 720px solo *oculta* columnas — `rr-period`,
  `rr-badge` — no las transforma en cards). No nos sirve como referencia responsive, solo
  visual.
- Es una app de seguimiento de tareas técnicas (roadmap de desarrollador) — su tono
  "ingenieril" (IDs monoespaciados, tags de horas) no es el tono de una app de finanzas
  personales; no adoptar esa voz.
- No tiene sidebar — es top-bar + timeline horizontal; nuestra navegación por secciones
  (Finanzas/Mandado/General) sigue necesitando un panel lateral o equivalente, TKambio no
  resuelve ese problema.

## F. Nueva dirección visual (propuesta, sin implementar)

- **Tokens**: mantener la base actual (ya es sobria) pero enriquecerla: agregar
  `--color-primary-soft` (fondo tenue para hover/selección, tipo `--accent-soft` de
  TKambio), 1-2 tonos de texto adicionales si faltan, y **formalizar** el spacing system que
  ya existe de facto (`4/8/16/24/32`) como tokens completos (falta `--space-2xl` si se
  necesita, y confirmar que nadie usa `px` sueltos fuera de estas variables).
- **Tipografía**: mantener una sola familia; introducir una escala un poco más rica (ej.
  añadir un tamaño "xs" para metadatos tipo eyebrow) y aplicar mayúsculas+letter-spacing a
  `.summary-card__label`/`.sidebar__group-title` de forma consistente (ya se hace en
  sidebar, falta extenderlo).
- **Cards**: mantener bordes sutiles + `shadow-sm` (ya evita el "sombra grande" que no
  quieres); no agregar más niveles de sombra.
- **Sidebar**: conservar como panel permanente en desktop; en móvil, mismo drawer pero
  corregido (ver G) — no se recomienda cambiar a bottom navigation (ver sección de
  navegación abajo).
- **Tablas → listas de cards** en móvil para Productos y, especialmente, Mandado (ver G).
- **Botones**: formalizar 4 variantes ya existentes (primary/ghost/danger + agregar
  "icon-button" cuadrado ~40px para acciones compactas en filas/cards) sin inventar más.

## G. Estrategia Mobile First por componente

- **Sidebar → Drawer corregido**: `height: 100dvh` (con `min-height:100vh` como fallback),
  `body.sidebar-open { overflow: hidden }` mientras el drawer está abierto, y
  `padding-top/bottom: env(safe-area-inset-*)` en el propio `.sidebar` y en `.sidebar-toggle`.
  Se mantiene drawer lateral (no bottom nav, ver justificación abajo).
- **Mandado / Mi lista → item card**: cada producto pasa de fila de 9 elementos a una
  tarjeta compacta: línea 1 = checkbox + nombre + menú `⋮` (editar/eliminar/notas); línea 2
  = cantidad+unidad y precio (est./real) en dos columnas; subtotal alineado a la derecha.
  Cantidad/precio pasan a inputs de ancho flexible (`clamp()`), no fijo en px. Esto es
  exactamente el ejemplo que diste en la sección 10 del pedido.
- **Productos → tabla (desktop) / card (móvil)**: usar el breakpoint de tabla para decidir
  si `renderTable(...)` se sustituye por un renderer de cards (mismo dato, presentación
  distinta) en vez de envolver la tabla en scroll horizontal.
- **Categorías**: ya es una lista (`category-manager-list`/`item`), no una tabla — solo
  necesita ajuste de espaciado/touch target, no una transformación estructural.
- **Dashboard**: `.stats-grid` (minmax 160px) ya funciona razonablemente en móvil (1-2
  columnas); `.charts-grid` necesita bajar su mínimo (`minmax(280px,...)` o usar `1fr` puro
  bajo 480px) para no arriesgar overflow.
- **Calendario**: mantener grid 7 columnas (ya es fluido, sin px fijos), pero considerar
  reducir la información visible por celda en <360px y confiar más en el panel de detalle
  del día (ya existe) en vez de saturar la celda.
- **Modales**: mobile = casi pantalla completa (`width:100%; height:100dvh` o
  `max-height:100dvh` con el body scrolleable internamente), header sticky con botón cerrar
  grande (44×44px); desktop conserva el modal centrado actual.
- **Formularios**: ya son 1 columna (correcto) — añadir 2 columnas solo en desktop donde
  aporte (ej. cantidad+unidad) vía un modificador opcional, no un cambio global.

**Navegación móvil — drawer vs. bottom navigation:** se recomienda **mantener el drawer**
lateral (Alternativa A), no adoptar bottom navigation. Razón: la app tiene 15 rutas reales
agrupadas en 3 secciones (Finanzas, Mandado, General) — una bottom nav de 4-5 ítems + "Más"
obligaría a esconder la mayoría de los módulos de Mandado (el propio módulo que más quieres
mejorar) detrás de un nivel extra de navegación, lo contrario de lo que buscas. El drawer,
una vez corregido, ya resuelve el problema real (que es el bug, no el patrón).

## H. Plan de corrección (fases propuestas)

1. **UI-1 — Foundation visual**: consolidar/enriquecer tokens en `variables.css` (colores
   suaves, spacing formal), sin tocar layout todavía. Bajo riesgo.
2. **UI-2 — Sidebar + bug + navegación móvil**: `100dvh`, scroll-lock de `body`,
   safe-areas en sidebar/toggle. Corrige el bug reportado. Riesgo medio (es el componente
   más transversal).
3. **UI-3 — Mandado mobile**: transformar `grocery-item-row` a card; ajustar
   `grocery-list.module.js` (solo el render de la fila, no la lógica/repositorios).
4. **UI-4 — Tablas/listados responsive**: patrón reutilizable tabla→card (Productos como
   primer caso; deja el patrón listo para futuros módulos).
5. **UI-5 — Dashboard/Calendario/Reportes**: ajustar `.charts-grid`, revisar densidad de
   Calendario en pantallas pequeñas.
6. **UI-6 — Formularios/Modales**: modal mobile (casi pantalla completa), revisión de
   touch targets en botones de formulario.
7. **UI-7 — QA responsive**: pasar la matriz de pruebas de `docs/responsive-plan.md`,
   revisar consola, confirmar que nada de esto tocó `services/`, `repository.js` ni cálculos.

Orden recomendado: **tal cual arriba** — UI-2 primero porque el bug es lo más molesto y
transversal; UI-1 puede ir en paralelo conceptualmente pero conviene aplicarlo antes para no
repetir retoques de color/espaciado dos veces.

## I. Archivos que probablemente deberán modificarse

- `css/variables.css`, `css/base.css`, `css/layout.css`, `css/components.css`,
  `css/responsive.css` (todas las fases, en distinto grado).
- `js/app.js` (`setupSidebarToggle`/`setOpen` — scroll-lock).
- `index.html` (posible ajuste de meta viewport si se requiere `viewport-fit=cover` para
  safe-areas; estructura del sidebar/toggle si cambia el markup).
- `js/modules/grocery/grocery-list.module.js` (**solo** `renderItemRow`/`renderCategoryGroup`
  y su render — no `groceryService.js`, no repositorios, no cálculos).
- `js/modules/grocery/products.module.js` (variante de render tabla/card).
- `js/components/table.js` (si se generaliza el patrón tabla→card aquí en vez de por módulo).
- `js/components/modal.js` (variante mobile).
- Posiblemente `js/modules/dashboard/dashboard.module.js`/`reports.module.js`/
  `price-history.module.js` solo en el `className`/tamaño de `.chart-wrapper`, no en lógica.

**No deberían tocarse:** `js/services/*.js`, `js/modules/*/*.repository.js`,
`js/core/storage.js`, `js/core/state.js`, `js/data/seed.js`, `js/core/recurrenceService.js`
— nada de esto es responsable de ningún hallazgo de esta auditoría.

## J. Riesgos

- **Sidebar (UI-2)** es el cambio de mayor riesgo porque toca `js/app.js` y CSS transversal
  usado en todas las páginas — probar navegación completa tras el cambio.
- **`grocery-item-row` (UI-3)**: si se toca el markup del row hay que verificar que los
  `addEventListener` de cada input sigan apuntando al elemento correcto (no se debe alterar
  la lógica de `GroceryListItemRepository.update`, solo el layout visual).
- **Modal mobile (UI-6)**: si el modal pasa a casi-pantalla-completa, confirmar que
  `confirm-dialog.js` (que reutiliza `modal.js`) sigue viéndose bien para diálogos cortos de
  confirmación (no debería quedar un modal de confirmación ocupando toda la pantalla de
  forma exagerada) — puede requerir una variante "compacta" vs. "form" del modal.
- **GitHub Pages**: todo lo propuesto es CSS/HTML/JS estático, rutas relativas y hash router
  sin cambios — compatible sin configuración adicional.
- **Ningún punto de este plan requiere tocar `localStorage`, el modelo de datos o los
  cálculos** — el riesgo de romper funcionalidad existente es bajo si las fases se
  respetan en su alcance declarado.

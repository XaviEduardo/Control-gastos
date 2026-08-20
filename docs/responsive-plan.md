# Plan responsive — guía táctica

Complementa `docs/ui-ux-audit.md`. Uso: referencia práctica al implementar las fases UI-1…UI-7.

## Breakpoints propuestos

```
Mobile:   < 640px
Tablet:   640px – 1023px
Desktop:  >= 1024px
```

Actualmente el proyecto usa `768px`/`1024px`/`480px`. Recomendación: **conservar 3 quiebres
simples** (ajustar 768→640 si se simplifica) en vez de agregar quiebres específicos por
dispositivo. No crear breakpoints para "iPhone 12" ni marcas — usar rangos.

## Unidades de viewport

- Sustituir `height: 100vh` por `height: 100dvh` en `.sidebar` (con `min-height: 100vh`
  como fallback para navegadores sin soporte de `dvh`).
- Revisar cualquier otro `vh` en el proyecto antes de tocarlo (actualmente solo aparece en
  `.sidebar` y en `.modal { max-height: 90vh }` — este último puede quedar en `dvh` también
  para el modal mobile).
- No usar `vh`/`dvh` para alturas de contenido normal (cards, listas) — solo para
  contenedores que deben llenar la pantalla (sidebar, modal mobile).

## Safe areas (iPhone con notch/home indicator)

Agregar donde haya elementos `fixed`/`sticky` que puedan quedar bajo el sistema:
- `.sidebar` (fixed en móvil): `padding-top: max(var(--space-md), env(safe-area-inset-top));`
- `.sidebar-toggle` (fixed): sumar `env(safe-area-inset-top)` a su `top`.
- `.app-header` (sticky): igual, si queda pegado arriba sin margen del sistema.
- Modal mobile (si se implementa full-screen): padding inferior con
  `env(safe-area-inset-bottom)` para que los botones de acción no queden bajo el home
  indicator.
- Requiere `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  en `index.html` (hoy no tiene `viewport-fit=cover` — sin esto, `env(safe-area-inset-*)`
  siempre da `0px`).

## Scroll lock del sidebar (fix del bug)

Al abrir el drawer en móvil:
```css
body.sidebar-open { overflow: hidden; }
```
Suficiente para bloquear el scroll del body detrás del overlay sin librerías. No se
requiere `position:fixed` en `body` ni guardar/restaurar `scrollTop` manualmente, porque no
estamos ocultando contenido detrás de un modal centrado — es un overlay + drawer, el patrón
más simple ya cubre el caso.

## Touch targets

Objetivo ~44×44px para controles interactivos en móvil:
- Botones `.btn` actuales (`padding: 8px 16px`) rondan 36-38px de alto — subir el `padding`
  vertical en contextos táctiles clave (fila de Mandado, modal footer) o introducir una
  variante `.btn--icon` cuadrada de 40-44px para acciones compactas (editar/eliminar/notas).
- Checkbox de "comprado" en Mandado: agrandar el área clicable (el input nativo es ~16px;
  envolver en un contenedor de 44×44px con el checkbox centrado).

## Estrategia tabla → card (por módulo)

| Módulo | Desktop | Mobile (< 640px) |
|---|---|---|
| Productos (`/mandado/productos`) | Tabla (`renderTable`) | Card: nombre + categoría + unidad, badge de estado, acciones en menú |
| Mandado / Mi lista | Fila `grocery-item-row` (9 elementos) | Card: checkbox+nombre+menú ⋮ / línea cantidad·unidad / línea precio est.·real / subtotal a la derecha |
| Categorías (mandado/gasto/ingreso) | Ya es lista, sin cambio estructural | Igual, solo espaciado/touch target |
| Tiendas | Tabla (`renderTable`) | Card: nombre + ubicación, acciones en menú |
| Historial de precios (tabla completa) | Tabla | Card: fecha + tienda + presentación + precio (normalizado como subtítulo) |
| Ingresos / Gastos (listas) | Tabla | Card: concepto + monto destacado, categoría/fecha como subtítulo, acciones en menú |

Patrón de card genérico sugerido (reutilizable, ver ejemplo de la sección 9 del pedido):
```
┌─────────────────────────┐
│ Título (dato principal)  │
│ subtítulo · subtítulo    │
│                          │
│ dato secundario: valor   │
│                          │
│ [acción]      [acción]  │
└─────────────────────────┘
```

## Menú de acciones secundarias (`⋮`)

Para no repetir 2-3 botones de texto por card en móvil: un botón `⋮` que abre un menú
contextual simple (lista de acciones tipo `<ul>` posicionada bajo el botón, o un bottom
sheet si se prefiere consistencia con el modal mobile). No se recomienda swipe-to-action en
esta primera pasada (mayor complejidad de gestos táctiles, bajo beneficio frente a `⋮` para
un catálogo con pocas acciones por fila).

## Modales

- Desktop: sin cambios (centrado, `max-width:480px`).
- Mobile (< 640px): `width:100%`, `max-height:100dvh`, sin `border-radius` en la esquina
  superior o solo en la inferior si se prefiere look "sheet"; header sticky con botón de
  cerrar de 44×44px; `.modal-body` mantiene su propio scroll interno.
- `confirm-dialog.js` (diálogos cortos): puede conservar un tamaño más compacto (no forzar
  pantalla completa para un Sí/No) — evaluar una variante `size: 'compact'` opcional en
  `openModal(...)` en vez de aplicar la regla mobile a ciegas a todos los modales.

## Matriz de pruebas responsive

Prioridad **alta** (probar siempre):
```
375 × 812   (iPhone estándar reciente)
390 × 844   (iPhone 12/13/14)
360 × 800   (Android compacto típico)
412 × 915   (Android grande típico — Pixel/Samsung)
768 × 1024  (tablet)
1440 × 900  (desktop típico)
```

Prioridad **media**:
```
320 × 568   (piso mínimo — iPhone SE / gama baja)
428 × 926   (iPhone Pro Max)
1366 × 768
1920 × 1080
```

No es necesario probar combinaciones por marca (Samsung vs. Xiaomi vs. Motorola…) — todas
comparten motor de renderizado (Chrome/WebView Android) y responden igual a los mismos
anchos CSS.

## Accesibilidad — hallazgos rápidos (no WCAG completo)

- Contraste: paleta actual (texto `#1f2430` sobre `#ffffff`/`#f4f6fa`) cumple AA sin
  problema; verificar `--color-text-muted` (`#6b7280`) sobre `--color-bg` en textos
  pequeños (`font-size-sm`), está cerca del límite AA para texto pequeño.
- Labels: los formularios ya usan `<label for>` consistentemente (confirmado en Fase 10).
- Botones sin texto: `.modal-close` **ya tiene** `aria-label="Cerrar"` (`modal.js:12`) —
  correcto, mantener el mismo criterio para el futuro botón `⋮` de acciones (`aria-label`
  descriptivo, ej. "Más acciones para {producto}").
- Focus visible: ya existe `:focus-visible` global en `base.css` — mantenerlo, no
  reemplazarlo por outline:none en ningún componente nuevo.
- Diálogos: `.modal` **ya usa** `role="dialog"` + `aria-modal="true"` + `aria-label`
  (`modal.js:9`) — correcto, no requiere cambio; solo confirmar que la variante mobile
  (UI-6) conserve estos atributos al ajustar el markup/CSS.

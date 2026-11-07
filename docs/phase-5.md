# Fase 5 — consolidación visual, accesibilidad y QA técnico

Fecha: 2026-11-06

## Alcance implementado

- Se centralizó el tema de Chart.js en `js/core/chart-theme.js`; sus colores, rejilla, textos,
  leyenda y tooltip leen los tokens CSS actuales.
- Dashboard, Reportes, evolución de precios e historial de precios usan la configuración
  compartida y se adaptan al modo claro/oscuro al volver a renderizarse.
- Los modales ahora etiquetan el título con `aria-labelledby`, enfocan el botón de cierre al
  abrirse y devuelven el foco al control que los abrió al cerrarse.
- Los mensajes toast exponen `aria-live="polite"` y `aria-atomic="true"`.
- Se agregó un enlace de teclado “Saltar al contenido”.
- El nuevo módulo de tema se incluyó en el app shell del Service Worker y se incrementó su
  caché a `control-gastos-shell-v3`.

## Decisión sobre Supabase

Esta fase no agrega datos locales ni cambia el esquema. Supabase sigue siendo la fuente remota;
la caché local por usuario solo sirve como fallback offline y el seed solo inicializa cuentas
sin documento remoto.

## Validación pendiente

Falta revisar visualmente en navegador el contraste de las gráficas en modo claro/oscuro, el
orden de foco en formularios y confirmaciones, el comportamiento con teclado y VoiceOver/TalkBack,
y la actualización del Service Worker en el dominio real de GitHub Pages.

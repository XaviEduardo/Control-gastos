# Fases 3 y 4 — sistema visual y experiencia móvil

Fecha: 2026-11-06

## Decisiones

- Se mantienen Vanilla JS, módulos nativos y CSS sin build step.
- La navegación móvil reutiliza las rutas de `js/app.js`; no hay un menú paralelo por pantalla.
- En móvil se priorizan Inicio, Movimientos, Mandado y Presupuesto. Las demás rutas siguen disponibles desde `Más`, que abre el drawer existente.
- Los formularios largos usan una hoja inferior; las confirmaciones compactas permanecen centradas.
- La lista del mandado se presenta como tarjetas en tablet y móvil para evitar desbordamiento horizontal.
- Supabase continúa siendo la fuente remota de verdad. La caché local por usuario y el seed de arranque se conservan como fallback offline y para cuentas nuevas; no se agregan datos financieros de demostración.

## Cambios implementados

- Tokens nuevos para superficie elevada, color sobre primario, foco, transición estándar y altura de navegación móvil.
- Barra inferior fija con áreas táctiles de al menos 52 px y soporte para safe areas.
- Estado activo y `aria-current` sincronizados con el hash-router.
- FAB reubicado sobre la barra inferior en pantallas pequeñas.
- Modal de formulario adaptado como hoja inferior con scroll interno y footer accesible.
- Service worker actualizado a `control-gastos-shell-v2` para invalidar el shell anterior en GitHub Pages.

## Validación manual pendiente

Probar en navegador con 320, 390, 768 y 1440 px: navegación primaria, `Más`, apertura/cierre del drawer, captura rápida, formularios largos, lista del mandado, modo oscuro y recarga con red desconectada.

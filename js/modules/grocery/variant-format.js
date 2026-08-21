// Formato de presentación de ProductVariant (V2-1) — compartido entre Productos y Mi Lista
// para no duplicar la misma lógica de armado de etiqueta en dos módulos.

import { UNIT_OPTIONS } from './units.js';

function unitLabel(value) {
  return UNIT_OPTIONS.find((u) => u.value === value)?.label || value;
}

/** Etiqueta legible de una variante, ej. "Lala · 1.5 L · pieza". Si la variante no tiene marca
 * ni presentación (caso de las variantes generadas por la migración V1→V2, o de una nueva sin
 * llenar todavía), cae a solo la unidad de compra. `name` (si el usuario lo definió) tiene
 * prioridad absoluta sobre el armado automático. */
export function formatVariantLabel(variant) {
  if (!variant) return '';
  if (variant.name) return variant.name;
  const parts = [];
  if (variant.brand) parts.push(variant.brand);
  if (variant.presentationAmount && variant.presentationUnit) {
    parts.push(`${variant.presentationAmount} ${unitLabel(variant.presentationUnit)}`);
  }
  parts.push(unitLabel(variant.purchaseUnit));
  return parts.join(' · ');
}

/** true si la variante tiene algo que la distinga de "el producto genérico en su unidad de
 * compra" (marca, presentación o un nombre propio) — usado para decidir si vale la pena mostrar
 * un detalle extra en una fila ya densa (ej. Mi Lista) o si alcanza con el nombre del Product. */
export function hasDistinguishingInfo(variant) {
  return Boolean(variant?.name || variant?.brand || (variant?.presentationAmount && variant?.presentationUnit));
}

/** Igual que formatVariantLabel pero sin la unidad de compra al final — para usarse junto a un
 * selector/etiqueta que ya muestra la unidad por su cuenta (evita repetirla dos veces). Vacío si
 * la variante no tiene ninguna info distintiva (ver hasDistinguishingInfo). */
export function formatVariantSuffix(variant) {
  if (!hasDistinguishingInfo(variant)) return '';
  if (variant.name) return variant.name;
  const parts = [];
  if (variant.brand) parts.push(variant.brand);
  if (variant.presentationAmount && variant.presentationUnit) {
    parts.push(`${variant.presentationAmount} ${unitLabel(variant.presentationUnit)}`);
  }
  return parts.join(' · ');
}

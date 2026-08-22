// V2-4 (ver docs/v2-roadmap.md): puente entre "comprar un producto en Mi Lista" y "que quede
// en Historial", sin captura duplicada. Único punto de código que decide cuándo una compra
// genera una PriceObservation — cualquier pantalla que actualice `purchased`/`actualPrice`/
// `selectedBranchId` de un GroceryListItem debe llamar a syncPurchaseObservation() después
// (ver ejemplo real en js/modules/grocery/grocery-item-row.js#updateItemAndSync). No
// duplica ni modifica ninguna fórmula de groceryService.js/priceService.js — solo reutiliza
// itemRealSubtotal() ya existente para saber cuánto se pagó en total.

import PriceRepository from '../modules/prices/price.repository.js';
import { itemRealSubtotal, effectiveBranchId } from './groceryService.js';
import { toISODate } from '../core/dates.js';

function hasValidActualPrice(item) {
  return item.actualPrice !== null && item.actualPrice !== undefined && item.actualPrice !== '' && Number(item.actualPrice) > 0;
}

/**
 * Sincroniza (crea o actualiza) la PriceObservation automática de `item`, dado su `list`.
 *
 * Reglas:
 * - Requiere `item.purchased === true`, un `actualPrice` válido (> 0), una sucursal conocida
 *   (propia o heredada de la lista — ver `effectiveBranchId`) y una `productVariantId`
 *   resuelta. Si falta cualquiera, no hace nada (devuelve `false`).
 * - Deduplicación por `groceryListItemId`: si ya existe una observación para este item
 *   (`PriceRepository.findByGroceryListItemId`), se ACTUALIZA esa misma fila — nunca se crea
 *   una segunda. Corregir $31 → $32 dos veces seguidas sigue dejando una sola observación.
 * - `price`/`quantity`/`unit` se toman de `itemRealSubtotal(item)` (ya existente, sin
 *   duplicar la fórmula) + `item.quantity`/`item.unit` — exactamente lo que ya paga el
 *   usuario, normalizable igual que cualquier precio manual.
 * - `date` usa `list.startDate` (fecha del mandado, estable) con `hoy` como respaldo — evita
 *   que la fecha de la observación "salte" cada vez que el usuario corrige un dato días
 *   después de la compra real.
 * - **Comportamiento al desmarcar "comprado" (definido explícitamente, ver TESTS de esta
 *   fase)**: la observación YA creada nunca se borra ni se modifica automáticamente al
 *   desmarcar — un precio que sí se pagó sigue siendo un dato histórico válido aunque el
 *   usuario destilde el checkbox después (ej. para reordenar su lista sin perder el registro).
 *   Si el usuario quiere eliminar esa observación de verdad, debe hacerlo explícitamente desde
 *   Historial (acción "Eliminar" ya existente) — nunca de forma automática/silenciosa.
 *
 * @returns {boolean} true si se creó o actualizó una observación, false si no aplicó.
 */
export function syncPurchaseObservation(item, list) {
  if (!item.purchased) return false;
  if (!hasValidActualPrice(item)) return false;
  if (!item.productVariantId) return false;
  const branchId = effectiveBranchId(item, list);
  if (!branchId) return false;

  const payload = {
    productId: item.productId,
    productVariantId: item.productVariantId,
    branchId,
    storeId: branchId,
    price: itemRealSubtotal(item),
    unit: item.unit,
    quantity: item.quantity,
    date: list?.startDate || toISODate(new Date()),
    source: 'purchase',
    groceryListItemId: item.id,
  };

  const existing = PriceRepository.findByGroceryListItemId(item.id);
  if (existing) {
    PriceRepository.update(existing.id, payload);
  } else {
    PriceRepository.create(payload);
  }
  return true;
}

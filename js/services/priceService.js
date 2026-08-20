// Normalización de precios por unidad base. Única fuente de verdad para comparar precios
// entre presentaciones distintas sin mezclar dimensiones incompatibles (kg/g vs L/ml vs
// piezas vs paquetes). Usado por el historial de precios y, más adelante, el comparador.

import { formatMoney } from '../core/currency.js';

// Cada unidad pertenece a una "dimensión": solo unidades de la misma dimensión son
// comparables entre sí. `toBase` convierte la cantidad a la unidad base de su dimensión.
const UNIT_INFO = {
  kg: { dimension: 'mass', toBase: 1, baseLabel: 'kg' },
  g: { dimension: 'mass', toBase: 0.001, baseLabel: 'kg' },
  l: { dimension: 'volume', toBase: 1, baseLabel: 'L' },
  ml: { dimension: 'volume', toBase: 0.001, baseLabel: 'L' },
  pza: { dimension: 'pza', toBase: 1, baseLabel: 'pza' },
  paquete: { dimension: 'paquete', toBase: 1, baseLabel: 'paquete' },
};

export function getUnitDimension(unit) {
  return UNIT_INFO[unit]?.dimension || null;
}

export function areComparable(unitA, unitB) {
  const dimA = getUnitDimension(unitA);
  return Boolean(dimA) && dimA === getUnitDimension(unitB);
}

/** { pricePerBaseUnit, baseUnit, dimension } o null si la unidad es desconocida o la
 * cantidad no es válida. */
export function normalizePrice(price, quantity, unit) {
  const info = UNIT_INFO[unit];
  const qty = Number(quantity) || 0;
  const amount = Number(price) || 0;
  if (!info || qty <= 0) return null;
  const baseQuantity = qty * info.toBase;
  if (baseQuantity <= 0) return null;
  return { pricePerBaseUnit: amount / baseQuantity, baseUnit: info.baseLabel, dimension: info.dimension };
}

export function formatNormalizedPrice(normalized) {
  if (!normalized) return null;
  return `${formatMoney(normalized.pricePerBaseUnit)}/${normalized.baseUnit}`;
}

/** Convierte una cantidad expresada en `unit` a la unidad base de su dimensión
 * (ej. 500 g -> 0.5 kg). Devuelve null si la unidad no se reconoce. */
export function getBaseQuantity(quantity, unit) {
  const info = UNIT_INFO[unit];
  if (!info) return null;
  return (Number(quantity) || 0) * info.toBase;
}

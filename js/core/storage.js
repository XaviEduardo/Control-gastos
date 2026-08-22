// Única abstracción de persistencia. Ningún otro módulo debe llamar a localStorage directamente
// (ver docs/decisions.md). Sustituir esta implementación permite migrar a IndexedDB/API sin
// tocar el resto de la aplicación.

import { generateId } from './id.js';

const STORAGE_KEY = 'control-gastos:data';
const CURRENT_VERSION = 6;

const COLLECTION_KEYS = [
  'incomes', 'incomeTypes',
  'expenses', 'expenseCategories',
  'groceryCategories', 'groceryProducts', 'productVariants',
  'stores', 'storeChains', 'storeBranches', 'prices',
  'groceryLists', 'groceryListItems',
  'budgets',
];

function emptyDocument() {
  const doc = {
    version: CURRENT_VERSION,
    lastUpdated: null,
    settings: {
      currency: 'MXN',
      selectedWeek: null,
      selectedMonth: null,
      selectedYear: null,
      sidebarCollapsed: false,
    },
  };
  COLLECTION_KEYS.forEach((key) => { doc[key] = []; });
  return doc;
}

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('StorageService: no se pudo leer el almacenamiento', error);
    return null;
  }
}

function writeRaw(document) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
    return true;
  } catch (error) {
    console.error('StorageService: no se pudo guardar el almacenamiento', error);
    return false;
  }
}

// Cadena de migraciones de esquema (infraestructura de V2-0, ver docs/v2-roadmap.md).
// MIGRATIONS[fromVersion] es una función PURA `(doc) => doc'` que transforma un documento de esa
// versión exactamente a la siguiente (fromVersion + 1) — nunca salta un escalón, nunca muta el
// documento recibido. Cada fase de contenido que cambie el esquema agrega aquí su paso y sube
// CURRENT_VERSION en 1 — nada más de este archivo necesita cambiar.
/** V2-1 (ver docs/v2-roadmap.md / docs/v2-migration-plan.md): separa `Product` (concepto) de
 * `ProductVariant` (SKU real: marca+presentación+unidad de compra). Cada `GroceryProduct`
 * existente genera EXACTAMENTE una `ProductVariant` con `purchaseUnit = product.preferredUnit`
 * — mapeo 1:1, sin ambigüedad ni decisión del usuario. `Product.preferredUnit` se conserva
 * (campo legacy, no se borra). `Price`/`GroceryListItem` ganan `productVariantId` de forma
 * ADITIVA — `productId` se conserva intacto, ningún código que ya lo lea se rompe. */
function migrateV1ToV2(doc) {
  const variantIdByProductId = new Map();
  const productVariants = (doc.groceryProducts || []).map((product) => {
    const variant = {
      id: generateId(),
      productId: product.id,
      brand: null,
      name: null,
      presentationAmount: null,
      presentationUnit: null,
      purchaseUnit: product.preferredUnit || 'pza',
      notes: '',
      status: 'active',
    };
    variantIdByProductId.set(product.id, variant.id);
    return variant;
  });

  const prices = (doc.prices || []).map((price) => ({
    ...price,
    productVariantId: variantIdByProductId.get(price.productId) || null,
  }));

  const groceryListItems = (doc.groceryListItems || []).map((item) => ({
    ...item,
    productVariantId: variantIdByProductId.get(item.productId) || null,
  }));

  return { ...doc, productVariants, prices, groceryListItems };
}

/** V2-2 (ver docs/v2-roadmap.md / docs/v2-migration-plan.md): separa `Store` (plano) en
 * `StoreChain` + `StoreBranch`. Cada `Store` existente genera una `StoreChain` homónima y se
 * convierte en `StoreBranch` conservando el MISMO `id` — a diferencia de la migración de
 * Product/Variant (que sí necesita un mapa de ids nuevos), aquí `branch.id === store.id`
 * siempre, así que `Price.branchId`/`GroceryListItem.selectedBranchId` son una copia directa de
 * `storeId`/`selectedStoreId` (mismo id, sin tabla de mapeo). La colección vieja `stores` se
 * conserva intacta sin tocar (nunca se borra); `js/modules/stores/store.repository.js` pasa a
 * ser un compatibilidad que delega en `storeBranches`, así que nada que ya lea `StoreRepository`
 * se rompe ni necesita cambiar en esta fase. */
function migrateV2ToV3(doc) {
  const storeChains = [];
  const storeBranches = (doc.stores || []).map((store) => {
    const chain = {
      id: generateId(),
      name: store.name,
      notes: '',
      status: 'active',
    };
    storeChains.push(chain);
    return {
      id: store.id,
      chainId: chain.id,
      name: store.name,
      location: store.location || '',
      notes: store.notes || '',
      status: store.status,
    };
  });

  const prices = (doc.prices || []).map((price) => ({
    ...price,
    branchId: price.storeId || null,
  }));

  const groceryListItems = (doc.groceryListItems || []).map((item) => ({
    ...item,
    selectedBranchId: item.selectedStoreId || null,
  }));

  return { ...doc, storeChains, storeBranches, prices, groceryListItems };
}

/** V2-3 (ver docs/v2-roadmap.md): `GroceryList` gana `activeBranchId` ("¿dónde estoy comprando
 * ahora?"). No hace falta ninguna entidad `ShoppingSession` — `GroceryList` ya cumple ese rol
 * (`status`, sus items, `linkedExpenseId`). Aditivo puro: cada lista existente recibe
 * `activeBranchId: null` (sin sucursal fijada todavía, igual que antes de esta fase). */
function migrateV3ToV4(doc) {
  const groceryLists = (doc.groceryLists || []).map((list) => ({
    ...list,
    activeBranchId: list.activeBranchId ?? null,
  }));
  return { ...doc, groceryLists };
}

/** V2-4 (ver docs/v2-roadmap.md): `Price` gana `source` ('purchase'|'manual'|'external') y
 * `groceryListItemId` (solo presente si `source==='purchase'`, para deduplicar la captura
 * automática). Todo precio capturado hasta hoy fue siempre manual — no existe código anterior
 * a esta fase que haya escrito `prices` automáticamente — así que el backfill es un hecho, no
 * una suposición: `source: 'manual'`. */
function migrateV4ToV5(doc) {
  const prices = (doc.prices || []).map((price) => ({
    ...price,
    source: price.source || 'manual',
    groceryListItemId: price.groceryListItemId ?? null,
  }));
  return { ...doc, prices };
}

/** V2-6 (ver docs/v2-roadmap.md): `ProductVariant` gana `preferredBranchId` opcional — "prefiero
 * comprar esto siempre aquí". Puramente una sugerencia (ver groceryService.js#effectiveBranchId,
 * que la usa como último escalón, por debajo de `selectedBranchId`/`activeBranchId`); nunca
 * bloquea elegir otra sucursal. Aditivo: `null` para toda variante existente. */
function migrateV5ToV6(doc) {
  const productVariants = (doc.productVariants || []).map((variant) => ({
    ...variant,
    preferredBranchId: variant.preferredBranchId ?? null,
  }));
  return { ...doc, productVariants };
}

const MIGRATIONS = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
};

/** Aplica, en orden, solo las migraciones pendientes (version actual -> CURRENT_VERSION).
 * Idempotente: si `doc.version` ya es CURRENT_VERSION (o mayor, ej. un documento de una
 * versión futura de la app), el bucle no corre y el documento vuelve sin cambios — nunca se
 * fuerza `version` hacia abajo. Si falta un escalón registrado (gap en `MIGRATIONS`), se
 * detiene sin forzar `version` hacia arriba tampoco: preferible dejar la versión real explícita
 * a fingir una compatibilidad que no se aplicó. */
function applyPendingMigrations(doc) {
  let version = Number.isInteger(doc.version) ? doc.version : 0;
  let next = doc;
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (typeof step !== 'function') break;
    next = { ...step(next), version: version + 1 };
    version += 1;
  }
  return next;
}

// Punto único de entrada para cargar/restaurar un documento: fusiona con la forma vacía
// (por si faltan colecciones nuevas de una versión más reciente que esta sesión no conoce) y
// aplica solo las migraciones que falten. Determinista y sin efectos secundarios (no escribe
// en localStorage por sí sola — quien llama decide si persiste el resultado).
function migrate(raw) {
  const merged = { ...emptyDocument(), ...raw };
  return applyPendingMigrations(merged);
}

/** Valida que un objeto tenga la forma mínima de un respaldo restaurable: versión conocida
 * (nunca de una versión futura que esta app no sabe migrar), settings como objeto, y cada
 * colección PRESENTE como arreglo. No repara nada — solo determina si es seguro migrar/restaurar.
 * Un respaldo de una versión anterior no tiene por qué incluir colecciones agregadas después
 * (ej. `productVariants` desde V2-1) — `migrate()` las completa vacías al fusionar con
 * `emptyDocument()`; exigir que ya existan rompería la compatibilidad con respaldos legítimos
 * exportados antes de este cambio. */
function isValidBackupShape(json) {
  if (!json || typeof json !== 'object') return false;
  if (!Number.isInteger(json.version) || json.version < 1 || json.version > CURRENT_VERSION) return false;
  if (typeof json.settings !== 'object' || json.settings === null) return false;
  return COLLECTION_KEYS.every((key) => !(key in json) || Array.isArray(json[key]));
}

let doc = null;

const StorageService = {
  /** Carga el documento guardado. Devuelve null si no existe todavía. Si `migrate()` de verdad
   * transformó el documento (versión distinta a la guardada), el resultado se persiste de
   * inmediato — si no, cada carga posterior sin ninguna mutación del usuario volvería a migrar
   * desde el mismo raw viejo, generando ids nuevos (`generateId()`) cada vez en vez de una sola
   * migración estable. */
  load() {
    const raw = readRaw();
    if (!raw) { doc = null; return null; }
    const migrated = migrate(raw);
    if (migrated.version !== raw.version) writeRaw(migrated);
    doc = migrated;
    return doc;
  },

  /** Carga datos guardados o, si no existen, inicializa con el seed y lo persiste. El seed
   * siempre tiene la forma más antigua conocida (`version: 1`, ver data/seed.js) — pasarlo por
   * `migrate()` (en vez de forzar `CURRENT_VERSION` directamente) evita mantener el seed
   * actualizado a mano en cada fase que cambie el esquema; una instalación nueva queda
   * exactamente igual de al día que una migrada. */
  init(seedFactory) {
    const loaded = this.load();
    if (loaded) return loaded;
    const seeded = { ...emptyDocument(), ...seedFactory(), version: 1 };
    doc = { ...migrate(seeded), lastUpdated: new Date().toISOString() };
    writeRaw(doc);
    return doc;
  },

  get(collection) {
    if (!doc) this.load();
    return doc ? doc[collection] : undefined;
  },

  set(collection, data) {
    if (!doc) doc = emptyDocument();
    doc[collection] = data;
    doc.lastUpdated = new Date().toISOString();
    return writeRaw(doc);
  },

  getSettings() {
    if (!doc) this.load();
    return doc ? doc.settings : emptyDocument().settings;
  },

  setSettings(partial) {
    if (!doc) doc = emptyDocument();
    doc.settings = { ...doc.settings, ...partial };
    doc.lastUpdated = new Date().toISOString();
    return writeRaw(doc);
  },

  save() {
    if (!doc) return false;
    doc.lastUpdated = new Date().toISOString();
    return writeRaw(doc);
  },

  remove(collection) {
    return this.set(collection, []);
  },

  clear() {
    doc = emptyDocument();
    localStorage.removeItem(STORAGE_KEY);
    return true;
  },

  exportData() {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },

  importData(json) {
    if (!isValidBackupShape(json)) {
      throw new Error('Respaldo inválido: la versión o la estructura no son compatibles con esta app.');
    }
    // Válido: recién aquí se toca el estado actual (nunca antes) — si la validación falla,
    // los datos existentes quedan intactos.
    doc = migrate(json);
    doc.lastUpdated = new Date().toISOString();
    writeRaw(doc);
    return doc;
  },

  getLastUpdated() {
    return doc ? doc.lastUpdated : null;
  },
};

export default StorageService;

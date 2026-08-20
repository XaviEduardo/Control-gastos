// Única abstracción de persistencia. Ningún otro módulo debe llamar a localStorage directamente
// (ver docs/decisions.md). Sustituir esta implementación permite migrar a IndexedDB/API sin
// tocar el resto de la aplicación.

const STORAGE_KEY = 'control-gastos:data';
const CURRENT_VERSION = 1;

const COLLECTION_KEYS = [
  'incomes', 'incomeTypes',
  'expenses', 'expenseCategories',
  'groceryCategories', 'groceryProducts',
  'stores', 'prices',
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

// Punto único para futuras migraciones de esquema (version N -> N+1).
function migrate(raw) {
  return { ...emptyDocument(), ...raw };
}

/** Valida que un objeto tenga la forma mínima de un respaldo restaurable: versión conocida
 * (nunca de una versión futura que esta app no sabe migrar), settings como objeto, y cada
 * colección como arreglo. No repara nada — solo determina si es seguro migrar/restaurar. */
function isValidBackupShape(json) {
  if (!json || typeof json !== 'object') return false;
  if (!Number.isInteger(json.version) || json.version < 1 || json.version > CURRENT_VERSION) return false;
  if (typeof json.settings !== 'object' || json.settings === null) return false;
  return COLLECTION_KEYS.every((key) => Array.isArray(json[key]));
}

let doc = null;

const StorageService = {
  /** Carga el documento guardado. Devuelve null si no existe todavía. */
  load() {
    const raw = readRaw();
    doc = raw ? migrate(raw) : null;
    return doc;
  },

  /** Carga datos guardados o, si no existen, inicializa con el seed y lo persiste. */
  init(seedFactory) {
    const loaded = this.load();
    if (loaded) return loaded;
    doc = { ...emptyDocument(), ...seedFactory(), version: CURRENT_VERSION, lastUpdated: new Date().toISOString() };
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

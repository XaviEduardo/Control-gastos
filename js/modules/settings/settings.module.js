// Configuración > Datos: moneda, información de almacenamiento, respaldo (exportar/importar)
// y restablecer. Usa exclusivamente StorageService (nunca localStorage directo) y State
// para leer/escribir settings — ver docs/architecture.md, docs/decisions.md.

import State from '../../core/state.js';
import StorageService from '../../core/storage.js';
import { setCurrency } from '../../core/currency.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatDateTime, toISODate } from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';

const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const COLLECTION_LABELS = {
  incomes: 'Ingresos',
  incomeTypes: 'Tipos de ingreso',
  expenses: 'Gastos',
  expenseCategories: 'Categorías de gasto',
  groceryCategories: 'Categorías de mandado',
  groceryProducts: 'Productos',
  stores: 'Tiendas',
  prices: 'Precios registrados',
  groceryLists: 'Listas de mandado',
  groceryListItems: 'Productos en listas',
  budgets: 'Presupuestos',
};

export function renderSettingsModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function render() {
    root.innerHTML = '';
    root.append(
      renderPreferences(),
      renderStorageInfo(),
      renderBackupSection(),
      renderResetSection(),
    );
  }

  // ---------- Preferencias ----------

  function renderPreferences() {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="summary-card__label mb-md">Preferencias</div>';

    const settings = State.getSettings();
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-sm';
    wrap.innerHTML = `
      <label for="settingsCurrency" style="margin:0;">Moneda</label>
      <select id="settingsCurrency">${CURRENCY_OPTIONS.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join('')}</select>
    `;
    const select = wrap.querySelector('select');
    select.value = settings.currency || 'MXN';
    select.addEventListener('change', () => {
      State.setSettings({ currency: select.value });
      setCurrency(select.value);
      showToast('Moneda actualizada');
      render();
    });

    card.appendChild(wrap);
    return card;
  }

  // ---------- Información del almacenamiento ----------

  function storageStats() {
    const data = StorageService.exportData() || {};
    const json = JSON.stringify(data);
    const sizeKB = (new Blob([json]).size / 1024).toFixed(1);
    const counts = Object.entries(COLLECTION_LABELS).map(([key, label]) => ({
      label,
      count: Array.isArray(data[key]) ? data[key].length : 0,
    }));
    return { sizeKB, counts, lastUpdated: StorageService.getLastUpdated() };
  }

  function renderStorageInfo() {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    const { sizeKB, counts, lastUpdated } = storageStats();

    card.innerHTML = `
      <div class="summary-card__label mb-md">Información del almacenamiento</div>
      <p class="text-muted">Motor: localStorage (navegador) · Tamaño de tus datos: ${sizeKB} KB</p>
      <p class="text-muted mt-md">Último guardado: ${lastUpdated ? escapeHtml(formatDateTime(lastUpdated)) : 'todavía no se ha guardado nada'}</p>
    `;

    const list = document.createElement('ul');
    list.className = 'breakdown-list mt-md';
    counts.forEach(({ label, count }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(label)}</span><span>${count}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);

    return card;
  }

  // ---------- Respaldo (exportar / importar) ----------

  function renderBackupSection() {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="summary-card__label mb-md">Respaldo</div>';

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm';
    actions.style.flexWrap = 'wrap';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn--primary';
    exportBtn.textContent = '⬇ Exportar respaldo';
    exportBtn.addEventListener('click', exportBackup);

    const importLabel = document.createElement('label');
    importLabel.className = 'btn btn--ghost';
    importLabel.textContent = '⬆ Importar respaldo';
    importLabel.style.cursor = 'pointer';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.className = 'hidden';
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (file) importBackup(file);
      importInput.value = '';
    });
    importLabel.appendChild(importInput);

    actions.append(exportBtn, importLabel);
    card.appendChild(actions);

    const note = document.createElement('p');
    note.className = 'text-muted mt-md';
    note.textContent = 'El respaldo incluye todos tus ingresos, gastos, categorías, mandado, tiendas, precios y presupuestos. Importar un respaldo reemplaza por completo los datos actuales.';
    card.appendChild(note);

    return card;
  }

  function exportBackup() {
    const data = StorageService.exportData();
    if (!data) {
      showToast('No hay datos para exportar todavía.', { type: 'error' });
      return;
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `control-gastos-backup-${toISODate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Respaldo exportado');
  }

  async function importBackup(file) {
    let text;
    try {
      text = await file.text();
    } catch {
      showToast('No se pudo leer el archivo.', { type: 'error' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      showToast('El archivo no es un JSON válido.', { type: 'error' });
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Restaurar respaldo',
      message: '¿Restaurar este respaldo? Esto reemplazará TODOS tus datos actuales (ingresos, gastos, mandado, precios, presupuestos...). Esta acción no se puede deshacer.',
      confirmText: 'Restaurar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      // Si el respaldo es inválido, importData lanza un error ANTES de tocar los datos
      // actuales — nada se destruye en caso de falla.
      StorageService.importData(parsed);
    } catch (error) {
      showToast(error.message || 'No se pudo restaurar el respaldo.', { type: 'error' });
      return;
    }

    showToast('Respaldo restaurado. Recargando la aplicación…');
    setTimeout(() => window.location.reload(), 700);
  }

  // ---------- Restablecer ----------

  function renderResetSection() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="summary-card__label mb-md">Restablecer datos</div><p class="text-muted mb-md">Borra permanentemente toda la información guardada en este navegador y vuelve a cargar los datos de ejemplo iniciales.</p>';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn--danger';
    resetBtn.textContent = 'Restablecer datos';
    resetBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Restablecer datos',
        message: '¿Estás seguro de que deseas eliminar TODOS los datos? Esta acción no se puede deshacer.',
        confirmText: 'Eliminar todo',
        danger: true,
      });
      if (!confirmed) return;

      StorageService.clear();
      showToast('Datos restablecidos. Recargando la aplicación…');
      setTimeout(() => window.location.reload(), 700);
    });

    card.appendChild(resetBtn);
    return card;
  }

  render();
}

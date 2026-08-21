// Configuración > Datos: moneda, información de almacenamiento, respaldo (exportar/importar)
// y restablecer. Usa exclusivamente StorageService (nunca localStorage directo) y State
// para leer/escribir settings — ver docs/architecture.md, docs/decisions.md.
// Rediseño "Minimal Finance" (ver docs/ui-ux-audit.md): misma lógica de siempre
// (exportData/importData/clear/getLastUpdated), presentación en lista de ajustes agrupada
// por secciones en vez de una card grande por acción.

import State from '../../core/state.js';
import StorageService from '../../core/storage.js';
import { setCurrency } from '../../core/currency.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { iconMarkup } from '../../components/icons.js';
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
      renderHeader(),
      renderPreferencesSection(),
      renderDataSection(),
      renderBackupSection(),
      renderResetSection(),
    );
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Configuración</div>
      <h2 class="dashboard-header__title">Preferencias y datos</h2>
    `;
    return wrap;
  }

  // Contenedor genérico: título de sección (eyebrow) + lista de filas agrupadas — evita que
  // cada ajuste sea su propia card grande (ver PASS 5, "no convertir todo en cards enormes").
  function renderSection(title, rows) {
    const section = document.createElement('div');
    section.className = 'settings-section mb-md';
    section.innerHTML = `<div class="settings-section__title">${escapeHtml(title)}</div>`;
    const list = document.createElement('div');
    list.className = 'settings-list';
    rows.forEach((row) => list.appendChild(row));
    section.appendChild(list);
    return section;
  }

  // Fila de ajuste "de control" (ej. un <select>) — no es tappable, no lleva chevron.
  function settingsControlRow({ icon, title, subtitle, control }) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const iconChip = icon ? `<span class="kpi-card__icon">${iconMarkup(icon, { size: 18 })}</span>` : '';
    row.innerHTML = `
      ${iconChip}
      <span class="settings-row__body">
        <span class="settings-row__title">${escapeHtml(title)}</span>
        ${subtitle ? `<span class="settings-row__subtitle">${escapeHtml(subtitle)}</span>` : ''}
      </span>
    `;
    row.appendChild(control);
    return row;
  }

  // Fila de ajuste "tappable" (dispara una acción al hacer click en toda la fila, con
  // chevron a la derecha) — ej. "Exportar respaldo", "Restablecer datos".
  function settingsActionRow({ icon, title, subtitle, danger, onAction }) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'settings-row settings-row--action';
    const iconChip = icon ? `<span class="kpi-card__icon${danger ? ' kpi-card__icon--danger' : ''}">${iconMarkup(icon, { size: 18 })}</span>` : '';
    row.innerHTML = `
      ${iconChip}
      <span class="settings-row__body">
        <span class="settings-row__title${danger ? ' settings-row__title--danger' : ''}">${escapeHtml(title)}</span>
        ${subtitle ? `<span class="settings-row__subtitle">${escapeHtml(subtitle)}</span>` : ''}
      </span>
      <span class="settings-row__chevron" aria-hidden="true">${iconMarkup('chevron-down', { size: 16 })}</span>
    `;
    row.querySelector('.settings-row__chevron').style.transform = 'rotate(-90deg)';
    row.addEventListener('click', onAction);
    return row;
  }

  // ---------- Preferencias ----------

  function renderPreferencesSection() {
    const settings = State.getSettings();
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Moneda');
    select.style.width = 'auto';
    select.innerHTML = CURRENCY_OPTIONS.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join('');
    select.value = settings.currency || 'MXN';
    select.addEventListener('change', () => {
      State.setSettings({ currency: select.value });
      setCurrency(select.value);
      showToast('Moneda actualizada');
      render();
    });

    const row = settingsControlRow({ icon: 'wallet', title: 'Moneda', control: select });
    return renderSection('Preferencias', [row]);
  }

  // ---------- Datos (información del almacenamiento) ----------

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

  function renderDataSection() {
    const { sizeKB, counts, lastUpdated } = storageStats();
    const lastUpdatedText = lastUpdated ? formatDateTime(lastUpdated) : 'todavía no se ha guardado nada';

    const row = document.createElement('div');
    row.className = 'settings-row';
    row.innerHTML = `
      <span class="kpi-card__icon">${iconMarkup('bar-chart', { size: 18 })}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">Uso de almacenamiento</span>
        <span class="settings-row__subtitle">localStorage · ${sizeKB} KB · Último guardado: ${escapeHtml(lastUpdatedText)}</span>
      </span>
    `;

    const detail = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Ver detalle por tipo de dato';
    detail.appendChild(summary);
    const list = document.createElement('ul');
    list.className = 'breakdown-list mt-md';
    counts.forEach(({ label, count }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(label)}</span><span>${count}</span>`;
      list.appendChild(li);
    });
    detail.appendChild(list);

    const wrap = document.createElement('div');
    wrap.className = 'settings-list';
    wrap.appendChild(row);
    const detailWrap = document.createElement('div');
    detailWrap.style.padding = 'var(--space-md)';
    detailWrap.appendChild(detail);
    wrap.appendChild(detailWrap);

    const section = document.createElement('div');
    section.className = 'settings-section mb-md';
    section.innerHTML = '<div class="settings-section__title">Datos</div>';
    section.appendChild(wrap);
    return section;
  }

  // ---------- Respaldo (exportar / importar) ----------

  function renderBackupSection() {
    const exportRow = settingsActionRow({
      icon: 'arrow-down-right',
      title: 'Exportar respaldo',
      subtitle: 'Descarga una copia de todos tus datos',
      onAction: exportBackup,
    });

    // Fila-<label> nativa: tocar toda la fila abre el selector de archivos, igual que antes
    // (el <input type="file"> real sigue siendo el único mecanismo, solo cambia el envoltorio).
    const importRow = document.createElement('label');
    importRow.className = 'settings-row settings-row--action';
    importRow.innerHTML = `
      <span class="kpi-card__icon">${iconMarkup('arrow-up-right', { size: 18 })}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">Importar respaldo</span>
        <span class="settings-row__subtitle">Reemplaza por completo los datos actuales</span>
      </span>
      <span class="settings-row__chevron" aria-hidden="true" style="transform:rotate(-90deg)">${iconMarkup('chevron-down', { size: 16 })}</span>
    `;
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.className = 'hidden';
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (file) importBackup(file);
      importInput.value = '';
    });
    importRow.appendChild(importInput);

    return renderSection('Respaldo', [exportRow, importRow]);
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
  // Estilo danger en el texto/icono (ver settingsActionRow danger:true) — sin exagerar
  // visualmente (no es un botón rojo enorme), la confirmación existente es la barrera real.

  function renderResetSection() {
    const row = settingsActionRow({
      icon: 'settings',
      title: 'Restablecer datos',
      subtitle: 'Borra todo permanentemente y vuelve a los datos de ejemplo iniciales',
      danger: true,
      onAction: async () => {
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
      },
    });
    return renderSection('Restablecer', [row]);
  }

  render();
}

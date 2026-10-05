import MovementTemplateRepository from '../shared/movement-template.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { iconMarkup } from '../../components/icons.js';
import { escapeHtml, isNonNegativeNumber, isRequired, validate } from '../../core/validators.js';
import { FREQUENCY_OPTIONS, frequencyLabel } from '../../services/recurrenceService.js';
import { WEEKDAY_OPTIONS, weekdayLabel } from '../../services/movementTemplateService.js';
import { formatMoney } from '../../core/currency.js';

const incomeTypeRepo = createCategoryRepository('incomeTypes');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

function movementTypeLabel(type) {
  return type === 'income' ? 'Ingreso' : 'Gasto';
}

function categoryName(template) {
  const repo = template.type === 'income' ? incomeTypeRepo : expenseCategoryRepo;
  const id = template.type === 'income' ? template.incomeTypeId : template.categoryId;
  return repo.list().find((item) => item.id === id)?.name || 'Sin categoria';
}

function scheduleLabel(template) {
  const parts = [frequencyLabel(template.frequency)];
  if (template.weekday !== null && template.weekday !== undefined) parts.push(weekdayLabel(template.weekday));
  if (template.frequency === 'monthly' && template.dueDay) parts.push(`Dia ${template.dueDay}`);
  return parts.filter(Boolean).join(' - ');
}

export function renderMovementTemplatesSection({ onChange } = {}) {
  const section = document.createElement('div');
  section.className = 'settings-section mb-md';
  section.innerHTML = '<div class="settings-section__title">Plantillas de movimientos</div>';

  const list = document.createElement('div');
  list.className = 'settings-list';

  const templates = MovementTemplateRepository.list();
  if (!templates.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-row';
    empty.innerHTML = `
      <span class="kpi-card__icon">${iconMarkup('receipt', { size: 18 })}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">Sin plantillas todavia</span>
        <span class="settings-row__subtitle">Crea una para precargar ingresos o gastos frecuentes.</span>
      </span>
    `;
    list.appendChild(empty);
  } else {
    templates.forEach((template) => list.appendChild(renderTemplateRow(template, onChange)));
  }

  const actions = document.createElement('div');
  actions.className = 'settings-row';
  actions.innerHTML = `
    <span class="kpi-card__icon">${iconMarkup('plus', { size: 18 })}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">Nueva plantilla</span>
      <span class="settings-row__subtitle">Ej. Nomina semanal, renta mensual o pago recurrente.</span>
    </span>
  `;
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn--primary';
  addBtn.textContent = 'Agregar';
  addBtn.addEventListener('click', () => openTemplateForm({ onChange }));
  actions.appendChild(addBtn);
  list.appendChild(actions);

  section.appendChild(list);
  return section;
}

function renderTemplateRow(template, onChange) {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const amount = template.amount !== null && template.amount !== undefined ? ` - ${formatMoney(template.amount)}` : '';
  row.innerHTML = `
    <span class="kpi-card__icon">${iconMarkup(template.type === 'income' ? 'trending-up' : 'trending-down', { size: 18 })}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">${escapeHtml(template.name)}</span>
      <span class="settings-row__subtitle">${movementTypeLabel(template.type)} - ${escapeHtml(categoryName(template))} - ${escapeHtml(scheduleLabel(template))}${amount}</span>
    </span>
  `;

  const actions = document.createElement('div');
  actions.className = 'flex gap-sm';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn--ghost';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', () => openTemplateForm({ existing: template, onChange }));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn--ghost';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Eliminar plantilla',
      message: `Eliminar "${escapeHtml(template.name)}"? Los movimientos ya creados no se modifican.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    MovementTemplateRepository.remove(template.id);
    showToast('Plantilla eliminada');
    onChange?.();
  });

  actions.append(editBtn, deleteBtn);
  row.appendChild(actions);
  return row;
}

function openTemplateForm({ existing, onChange } = {}) {
  const incomeTypes = incomeTypeRepo.list({ includeInactive: false });
  const expenseCategories = expenseCategoryRepo.list({ includeInactive: false });
  if (!incomeTypes.length || !expenseCategories.length) {
    showToast('Primero crea al menos un tipo de ingreso y una categoria de gasto.', { type: 'error' });
    return;
  }

  const formId = `movement-template-form-${Date.now()}`;
  const form = document.createElement('form');
  form.id = formId;
  form.className = 'form-grid';
  form.innerHTML = `
    <div class="form-row">
      <div>
        <label for="${formId}-type">Tipo</label>
        <select id="${formId}-type" name="type">
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
      </div>
      <div>
        <label for="${formId}-name">Nombre de plantilla</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Nomina">
      </div>
    </div>
    <div>
      <label for="${formId}-description">Concepto precargado</label>
      <input type="text" id="${formId}-description" name="description" required value="${escapeHtml(existing?.description || '')}">
    </div>
    <div class="form-row">
      <div>
        <label for="${formId}-amount">Cantidad sugerida (opcional)</label>
        <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" value="${existing?.amount ?? ''}">
      </div>
      <div data-income-category>
        <label for="${formId}-income-type">Tipo de ingreso</label>
        <select id="${formId}-income-type" name="incomeTypeId"></select>
      </div>
      <div data-expense-category>
        <label for="${formId}-expense-category">Categoria de gasto</label>
        <select id="${formId}-expense-category" name="categoryId"></select>
      </div>
    </div>
    <div class="form-row">
      <div>
        <label for="${formId}-frequency">Recurrencia</label>
        <select id="${formId}-frequency" name="frequency"></select>
      </div>
      <div>
        <label for="${formId}-weekday">Dia sugerido</label>
        <select id="${formId}-weekday" name="weekday">
          <option value="">Sin dia fijo</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div data-custom-rule>
        <label for="${formId}-interval">Repetir cada (dias)</label>
        <input type="number" id="${formId}-interval" name="intervalDays" min="1" value="${existing?.intervalDays || 30}">
      </div>
      <div>
        <label for="${formId}-due-day">Dia mensual/pago (opcional)</label>
        <input type="number" id="${formId}-due-day" name="dueDay" min="1" max="31" value="${existing?.dueDay || ''}">
      </div>
    </div>
    <div data-expense-extra>
      <label for="${formId}-payment">Metodo de pago (opcional)</label>
      <input type="text" id="${formId}-payment" name="paymentMethod" value="${escapeHtml(existing?.paymentMethod || '')}">
    </div>
    <div>
      <label for="${formId}-notes">Notas</label>
      <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
    </div>
    <p class="form-error hidden"></p>
  `;

  const typeSelect = form.querySelector(`#${formId}-type`);
  const incomeSelect = form.querySelector(`#${formId}-income-type`);
  const expenseSelect = form.querySelector(`#${formId}-expense-category`);
  const freqSelect = form.querySelector(`#${formId}-frequency`);
  const weekdaySelect = form.querySelector(`#${formId}-weekday`);
  const customRuleField = form.querySelector('[data-custom-rule]');

  typeSelect.value = existing?.type || 'income';
  incomeSelect.innerHTML = incomeTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join('');
  expenseSelect.innerHTML = expenseCategories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  if (existing?.incomeTypeId) incomeSelect.value = existing.incomeTypeId;
  if (existing?.categoryId) expenseSelect.value = existing.categoryId;

  freqSelect.innerHTML = FREQUENCY_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join('');
  freqSelect.value = existing?.frequency || 'once';

  weekdaySelect.innerHTML += WEEKDAY_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join('');
  weekdaySelect.value = existing?.weekday !== null && existing?.weekday !== undefined ? String(existing.weekday) : '';

  function syncVisibility() {
    const isIncome = typeSelect.value === 'income';
    form.querySelector('[data-income-category]').classList.toggle('hidden', !isIncome);
    form.querySelector('[data-expense-category]').classList.toggle('hidden', isIncome);
    form.querySelector('[data-expense-extra]').classList.toggle('hidden', isIncome);
    customRuleField.classList.toggle('hidden', freqSelect.value !== 'custom');
  }

  typeSelect.addEventListener('change', syncVisibility);
  freqSelect.addEventListener('change', syncVisibility);
  syncVisibility();

  const footer = document.createElement('div');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancelar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.setAttribute('form', formId);
  saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar plantilla';
  footer.append(cancelBtn, saveBtn);

  const modal = openModal({ title: existing ? 'Editar plantilla' : 'Nueva plantilla', content: form, footer });
  cancelBtn.addEventListener('click', () => modal.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      type: data.get('type'),
      name: data.get('name'),
      description: data.get('description'),
      amount: data.get('amount'),
      incomeTypeId: data.get('incomeTypeId'),
      categoryId: data.get('categoryId'),
      frequency: data.get('frequency'),
      weekday: data.get('weekday'),
      dueDay: data.get('dueDay'),
      intervalDays: data.get('intervalDays'),
      paymentMethod: data.get('paymentMethod'),
      notes: data.get('notes'),
    };

    const dueDay = Number(payload.dueDay);
    const { valid, errors } = validate([
      { valid: isRequired(payload.name), message: 'El nombre es obligatorio.' },
      { valid: isRequired(payload.description), message: 'El concepto es obligatorio.' },
      { valid: payload.amount === '' || isNonNegativeNumber(payload.amount), message: 'La cantidad sugerida no puede ser negativa.' },
      { valid: payload.type === 'income' ? isRequired(payload.incomeTypeId) : isRequired(payload.categoryId), message: 'Selecciona el tipo o categoria.' },
      { valid: !payload.dueDay || (Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31), message: 'El dia mensual debe estar entre 1 y 31.' },
    ]);

    const errorEl = form.querySelector('.form-error');
    if (!valid) {
      errorEl.textContent = errors.join(' ');
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    if (existing) MovementTemplateRepository.update(existing.id, payload);
    else MovementTemplateRepository.create(payload);
    modal.close();
    showToast(existing ? 'Plantilla actualizada' : 'Plantilla creada');
    onChange?.();
  });
}

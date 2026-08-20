// Formulario compartido para crear/editar un Income o Expense desde cualquier módulo
// (usado por el Calendario). Persiste a través de los MISMOS repositorios que usan las
// pantallas de Ingresos/Gastos — no crea ninguna estructura de datos nueva.

import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createCategoryRepository } from './category-repository.js';
import IncomeRepository from '../income/income.repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { toISODate } from '../../core/dates.js';
import { isRequired, isPositiveNumber, isValidDate, validate, escapeHtml } from '../../core/validators.js';
import { FREQUENCY_OPTIONS } from '../../services/recurrenceService.js';

const incomeTypeRepo = createCategoryRepository('incomeTypes');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

/** type: 'income'|'expense'. existing: registro a editar (opcional). defaultDate: "YYYY-MM-DD"
 * para prellenar la fecha al crear. onSaved: callback tras guardar exitosamente. */
export function openMovementForm({ type, existing, defaultDate, onSaved }) {
  const isIncome = type === 'income';
  const categoryRepo = isIncome ? incomeTypeRepo : expenseCategoryRepo;
  const categories = categoryRepo.list({ includeInactive: false });

  if (!categories.length) {
    showToast(`Primero agrega ${isIncome ? 'un tipo de ingreso' : 'una categoría de gasto'} desde ${isIncome ? 'Ingresos' : 'Gastos'}.`, { type: 'error' });
    return;
  }

  const formId = `movement-form-${Date.now()}`;
  const form = document.createElement('form');
  form.id = formId;
  form.className = 'form-grid';
  form.innerHTML = `
    <div>
      <label for="${formId}-description">Concepto</label>
      <input type="text" id="${formId}-description" name="description" required value="${escapeHtml(existing?.description || '')}">
    </div>
    <div>
      <label for="${formId}-amount">Cantidad</label>
      <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" required value="${existing?.amount ?? ''}">
    </div>
    <div>
      <label for="${formId}-date">Fecha</label>
      <input type="date" id="${formId}-date" name="date" required value="${existing?.date ? existing.date.slice(0, 10) : (defaultDate || toISODate(new Date()))}">
    </div>
    <div>
      <label for="${formId}-category">${isIncome ? 'Tipo' : 'Categoría'}</label>
      <select id="${formId}-category" name="categoryRef"></select>
    </div>
    <div>
      <label for="${formId}-frequency">Recurrencia</label>
      <select id="${formId}-frequency" name="frequency"></select>
    </div>
    <div data-custom-rule class="${existing?.frequency === 'custom' ? '' : 'hidden'}">
      <label for="${formId}-interval">Repetir cada (días)</label>
      <input type="number" id="${formId}-interval" name="intervalDays" min="1" value="${existing?.customRule?.intervalDays || 30}">
    </div>
    <p class="form-error hidden"></p>
  `;

  const categorySelect = form.querySelector(`#${formId}-category`);
  const existingCategoryId = isIncome ? existing?.incomeTypeId : existing?.categoryId;
  // Si se edita un movimiento cuya categoría/tipo fue desactivado después, debe seguir
  // apareciendo como opción (si no, el <select> cae en la primera y reasigna el movimiento).
  if (existingCategoryId && !categories.some((c) => c.id === existingCategoryId)) {
    const currentCategory = categoryRepo.list().find((c) => c.id === existingCategoryId);
    if (currentCategory) categories.push(currentCategory);
  }
  categorySelect.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (existingCategoryId) categorySelect.value = existingCategoryId;

  const freqSelect = form.querySelector(`#${formId}-frequency`);
  freqSelect.innerHTML = FREQUENCY_OPTIONS.map((f) => `<option value="${f.value}">${f.label}</option>`).join('');
  freqSelect.value = existing?.frequency || 'once';
  const customRuleField = form.querySelector('[data-custom-rule]');
  freqSelect.addEventListener('change', () => {
    customRuleField.classList.toggle('hidden', freqSelect.value !== 'custom');
  });

  const footer = document.createElement('div');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancelar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.setAttribute('form', formId);
  saveBtn.textContent = existing ? 'Guardar cambios' : `Agregar ${isIncome ? 'ingreso' : 'gasto'}`;
  footer.append(cancelBtn, saveBtn);

  const modal = openModal({
    title: existing ? `Editar ${isIncome ? 'ingreso' : 'gasto'}` : `Agregar ${isIncome ? 'ingreso' : 'gasto'}`,
    content: form,
    footer,
  });
  cancelBtn.addEventListener('click', () => modal.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const categoryId = data.get('categoryRef');

    const payload = {
      description: data.get('description'),
      amount: data.get('amount'),
      date: data.get('date'),
      frequency: data.get('frequency'),
      intervalDays: data.get('intervalDays'),
      notes: existing?.notes || '',
    };

    if (isIncome) {
      payload.incomeTypeId = categoryId;
    } else {
      payload.categoryId = categoryId;
      // Este formulario simplificado no edita dueDay/paymentMethod: se preservan los
      // valores existentes para no perder información al editar desde el calendario.
      payload.dueDay = existing?.dueDay ?? '';
      payload.paymentMethod = existing?.paymentMethod ?? '';
    }

    const { valid, errors } = validate([
      { valid: isRequired(payload.description), message: 'El concepto es obligatorio.' },
      { valid: isPositiveNumber(payload.amount), message: 'La cantidad debe ser mayor a 0.' },
      { valid: isValidDate(payload.date), message: 'La fecha no es válida.' },
      { valid: isRequired(categoryId), message: `Selecciona ${isIncome ? 'un tipo' : 'una categoría'}.` },
    ]);

    const errorEl = form.querySelector('.form-error');
    if (!valid) {
      errorEl.textContent = errors.join(' ');
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const repository = isIncome ? IncomeRepository : ExpenseRepository;
    if (existing) repository.update(existing.id, payload);
    else repository.create(payload);

    modal.close();
    showToast(existing ? `${isIncome ? 'Ingreso' : 'Gasto'} actualizado` : `${isIncome ? 'Ingreso' : 'Gasto'} agregado`);
    onSaved?.();
  });
}

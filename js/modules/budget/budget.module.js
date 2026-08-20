import State from '../../core/state.js';
import BudgetRepository from './budget.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { budgetProgress } from '../../services/budgetService.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { parseFlexibleDate } from '../../core/dates.js';
import { isRequired, isNonNegativeNumber, validate, escapeHtml } from '../../core/validators.js';

const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderBudgetModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function currentPeriods() {
    const settings = State.getSettings();
    const now = new Date();
    const monthDate = new Date(settings.selectedYear ?? now.getFullYear(), settings.selectedMonth ?? now.getMonth(), 1);
    const weekDate = settings.selectedWeekDate ? parseFlexibleDate(settings.selectedWeekDate) : now;
    return {
      month: { type: 'month', date: monthDate },
      week: { type: 'week', date: weekDate },
    };
  }

  function render() {
    root.innerHTML = '';
    const { month, week } = currentPeriods();

    root.appendChild(renderBudgetCard({
      title: 'Presupuesto mensual total',
      budget: BudgetRepository.find('monthly'),
      period: month,
      scope: 'monthly',
      emptyMessage: 'Configura cuánto quieres gastar como máximo este mes.',
    }));

    root.appendChild(renderBudgetCard({
      title: 'Presupuesto semanal total',
      budget: BudgetRepository.find('weekly'),
      period: week,
      scope: 'weekly',
      emptyMessage: 'Configura cuánto quieres gastar como máximo esta semana.',
    }));

    root.appendChild(renderBudgetCard({
      title: 'Presupuesto de mandado (mensual)',
      budget: BudgetRepository.find('grocery'),
      period: month,
      scope: 'grocery',
      emptyMessage: 'Configura cuánto quieres gastar en mandado este mes.',
    }));

    root.appendChild(renderCategoryBudgets(month));
  }

  function renderBudgetCard({ title, budget, period, scope, categoryId, emptyMessage }) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center gap-sm mb-md';
    header.style.flexWrap = 'wrap';
    const label = document.createElement('div');
    label.className = 'summary-card__label';
    label.textContent = title;
    header.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'flex gap-xs';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = budget ? 'Editar' : 'Configurar';
    editBtn.addEventListener('click', () => openBudgetAmountForm({
      title,
      currentAmount: budget ? budget.amount : '',
      onSave: (value) => {
        BudgetRepository.upsert(scope, value, categoryId);
        showToast('Presupuesto guardado');
        render();
      },
    }));
    actions.appendChild(editBtn);

    if (budget) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--danger';
      removeBtn.textContent = 'Quitar';
      removeBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Quitar presupuesto',
          message: `¿Quitar el presupuesto de "${escapeHtml(title)}"?`,
          confirmText: 'Quitar',
          danger: true,
        });
        if (confirmed) {
          BudgetRepository.remove(budget.id);
          showToast('Presupuesto eliminado');
          render();
        }
      });
      actions.appendChild(removeBtn);
    }

    header.appendChild(actions);
    card.appendChild(header);

    if (!budget) {
      const p = document.createElement('p');
      p.className = 'text-muted';
      p.textContent = emptyMessage || 'Todavía no configuras un presupuesto para este rubro.';
      card.appendChild(p);
      return card;
    }

    const progress = budgetProgress(budget, period);
    const over = progress.remaining < 0;
    const finite = Number.isFinite(progress.percentUsed);

    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';
    grid.appendChild(renderStatCard('Presupuesto', formatMoney(progress.amount)));
    grid.appendChild(renderStatCard('Gastado', formatMoney(progress.spent)));
    grid.appendChild(renderStatCard(
      over ? 'Excedido' : 'Disponible',
      formatMoney(Math.abs(progress.remaining)),
      { tone: over ? 'negative' : 'positive' },
    ));
    card.appendChild(grid);

    const pctForBar = finite ? Math.min(progress.percentUsed * 100, 100) : 100;
    const pctText = finite ? formatPercent(progress.percentUsed, 2) : 'más de 100%';
    const barWrap = document.createElement('div');
    barWrap.innerHTML = `
      <div class="progress-bar"><div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${pctForBar}%"></div></div>
      <div class="text-muted mt-md">${pctText} utilizado${over ? ' — presupuesto excedido' : ''}</div>
    `;
    card.appendChild(barWrap);

    return card;
  }

  function renderCategoryBudgets(period) {
    const wrap = document.createElement('div');
    wrap.className = 'card';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center gap-sm mb-md';
    header.style.flexWrap = 'wrap';
    header.innerHTML = '<div class="summary-card__label">Presupuestos por categoría (mensual)</div>';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = '+ Agregar presupuesto de categoría';
    addBtn.addEventListener('click', () => openCategoryBudgetForm());
    header.appendChild(addBtn);
    wrap.appendChild(header);

    const categoryBudgets = BudgetRepository.list().filter((b) => b.scope === 'category');
    if (!categoryBudgets.length) {
      wrap.appendChild(renderEmptyState({
        icon: '🎯',
        title: 'Sin presupuestos por categoría',
        message: 'Agrega un límite mensual para alguna categoría de gasto (ej. Renta, Internet).',
        actionLabel: '+ Agregar presupuesto de categoría',
        onAction: () => openCategoryBudgetForm(),
      }));
      return wrap;
    }

    const allCategories = expenseCategoryRepo.list();
    categoryBudgets.forEach((budget) => {
      const category = allCategories.find((c) => c.id === budget.categoryId);
      const title = category ? category.name : 'Categoría eliminada';
      wrap.appendChild(renderBudgetCard({
        title, budget, period, scope: 'category', categoryId: budget.categoryId,
      }));
    });

    return wrap;
  }

  function openCategoryBudgetForm() {
    const categories = expenseCategoryRepo.list({ includeInactive: false });
    const existingIds = new Set(BudgetRepository.list().filter((b) => b.scope === 'category').map((b) => b.categoryId));
    const available = categories.filter((c) => !existingIds.has(c.id));

    if (!available.length) {
      showToast('Todas tus categorías activas ya tienen un presupuesto configurado.', { type: 'error' });
      return;
    }

    const formId = `category-budget-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-category">Categoría</label>
        <select id="${formId}-category" name="categoryId">${available.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div>
        <label for="${formId}-amount">Presupuesto mensual</label>
        <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" required>
      </div>
      <p class="form-error hidden"></p>
    `;

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = 'Agregar presupuesto';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: 'Presupuesto por categoría', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const categoryId = data.get('categoryId');
      const amount = data.get('amount');

      const { valid, errors } = validate([
        { valid: isRequired(categoryId), message: 'Selecciona una categoría.' },
        { valid: isNonNegativeNumber(amount), message: 'El monto debe ser 0 o mayor.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      BudgetRepository.upsert('category', amount, categoryId);
      modal.close();
      showToast('Presupuesto agregado');
      render();
    });
  }

  function openBudgetAmountForm({ title, currentAmount, onSave }) {
    const formId = `budget-amount-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-amount">Monto (${escapeHtml(title)})</label>
        <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" required value="${currentAmount ?? ''}">
      </div>
      <p class="form-error hidden"></p>
    `;

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = 'Guardar';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: `Presupuesto — ${title}`, content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const amount = data.get('amount');

      const { valid, errors } = validate([
        { valid: isNonNegativeNumber(amount), message: 'El monto debe ser 0 o mayor.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }

      modal.close();
      onSave(Number(amount));
    });
  }

  render();
}

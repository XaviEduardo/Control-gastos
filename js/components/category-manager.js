import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { createActionMenu, ensureActionMenuOutsideClick } from './action-menu.js';
import { isRequired } from '../core/validators.js';

/** Contenido reutilizable de administración de categorías/tipos (agregar, renombrar,
 * activar/desactivar). Se puede montar dentro de un modal (openCategoryManager) o
 * directamente en una página completa (ej. /mandado/categorias).
 * `itemCount` opcional: (category) => string — texto de conteo por ítem (ej. "12 productos").
 * Si no se pasa, no se muestra nada extra (así los consumidores existentes — Ingresos,
 * Gastos, Productos — no cambian de aspecto). */
export function renderCategoryManagerContent({ repository, onChange, itemCount }) {
  ensureActionMenuOutsideClick();
  const wrapper = document.createElement('div');

  function renderList() {
    wrapper.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'flex gap-sm mb-md category-manager-form';
    form.innerHTML = `
      <input type="text" name="name" placeholder="Nueva categoría" aria-label="Nombre de la nueva categoría" required>
      <button type="submit" class="btn btn--primary">Agregar</button>
    `;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = form.name.value.trim();
      if (!isRequired(name)) return;
      repository.create({ name });
      form.reset();
      renderList();
      onChange?.();
      showToast('Categoría agregada');
    });

    const list = document.createElement('ul');
    list.className = 'category-manager-list';

    repository.list().forEach((item) => {
      const li = document.createElement('li');
      li.className = 'category-manager-item';

      const nameWrap = document.createElement('span');
      nameWrap.className = 'category-manager-item__name';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      if (item.status !== 'active') nameSpan.classList.add('text-muted');
      nameWrap.appendChild(nameSpan);
      if (itemCount) {
        const countSpan = document.createElement('span');
        countSpan.className = 'text-muted text-xs';
        countSpan.textContent = itemCount(item);
        nameWrap.appendChild(countSpan);
      }

      const menu = createActionMenu(`Más acciones para ${item.name}`, [
        {
          label: 'Renombrar',
          onClick: () => {
            const newName = window.prompt('Nuevo nombre', item.name);
            if (newName && isRequired(newName)) {
              repository.update(item.id, { name: newName });
              renderList();
              onChange?.();
            }
          },
        },
        {
          label: item.status === 'active' ? 'Desactivar' : 'Activar',
          onClick: () => {
            repository.setStatus(item.id, item.status === 'active' ? 'inactive' : 'active');
            renderList();
            onChange?.();
          },
        },
      ]);

      li.append(nameWrap, menu);
      list.appendChild(li);
    });

    if (!repository.list().length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'Todavía no hay categorías.';
      wrapper.append(form, empty);
      return;
    }

    wrapper.append(form, list);
  }

  renderList();
  return wrapper;
}

/** Modal genérico para administrar categorías/tipos. */
export function openCategoryManager({ title, repository, onChange }) {
  const content = renderCategoryManagerContent({ repository, onChange });
  openModal({ title, content });
}

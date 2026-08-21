import { createCategoryRepository } from '../shared/category-repository.js';
import { renderCategoryManagerContent } from '../../components/category-manager.js';
import ProductRepository from './product.repository.js';

const groceryCategoryRepo = createCategoryRepository('groceryCategories');

// Conteo real de productos por categoría (ProductRepository ya existente) — no es un dato
// nuevo, solo se muestra junto al nombre (ver docs/ui-ux-audit.md, rediseño PASS 4).
function productCountLabel(category) {
  const count = ProductRepository.list().filter((p) => p.categoryId === category.id).length;
  return `${count} producto${count === 1 ? '' : 's'}`;
}

export function renderGroceryCategoriesModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Categorías</h2>
    `;
    return wrap;
  }

  function render() {
    root.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.appendChild(renderCategoryManagerContent({
      repository: groceryCategoryRepo,
      onChange: render,
      itemCount: productCountLabel,
    }));
    root.append(renderHeader(), card);
  }

  render();
}

import { createCategoryRepository } from '../shared/category-repository.js';
import { renderCategoryManagerContent } from '../../components/category-manager.js';

const groceryCategoryRepo = createCategoryRepository('groceryCategories');

export function renderGroceryCategoriesModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view card';
  container.appendChild(root);

  function render() {
    root.innerHTML = '';
    root.appendChild(renderCategoryManagerContent({ repository: groceryCategoryRepo, onChange: render }));
  }

  render();
}

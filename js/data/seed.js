// Seed inicial derivado de docs/excel-analysis.md. Solo se usa si no existen datos guardados,
// o al restablecer explícitamente (ver docs/decisions.md). Todo aquí es editable/eliminable.

import { generateId } from '../core/id.js';

const GROCERY_CATEGORY_DEFS = [
  { name: 'Frutas y Verduras', icon: '🥦' },
  { name: 'Carnes y Pescados', icon: '🍗' },
  { name: 'Lácteos y Huevo', icon: '🥛' },
  { name: 'Granos y Abarrotes', icon: '🌾' },
  { name: 'Pan y Tortillas', icon: '🫓' },
  { name: 'Productos de Limpieza', icon: '🧼' },
  { name: 'Higiene Personal', icon: '🧴' },
  { name: 'Otros Mandado', icon: '🛒' },
];

const GROCERY_PRODUCT_EXAMPLES = [
  { categoryName: 'Frutas y Verduras', name: 'Tomate', unit: 'kg', quantity: 2, price: 18 },
  { categoryName: 'Carnes y Pescados', name: 'Pechuga de pollo', unit: 'kg', quantity: 1, price: 95 },
  { categoryName: 'Lácteos y Huevo', name: 'Leche', unit: 'l', quantity: 4, price: 25 },
  { categoryName: 'Granos y Abarrotes', name: 'Arroz', unit: 'kg', quantity: 1, price: 22 },
  { categoryName: 'Pan y Tortillas', name: 'Tortillas', unit: 'kg', quantity: 2, price: 18 },
  { categoryName: 'Productos de Limpieza', name: 'Detergente', unit: 'pza', quantity: 1, price: 55 },
  { categoryName: 'Higiene Personal', name: 'Shampoo', unit: 'pza', quantity: 1, price: 65 },
  { categoryName: 'Otros Mandado', name: 'Bolsas', unit: 'pza', quantity: 1, price: 15 },
];

const EXPENSE_CATEGORY_DEFS = [
  { name: 'Coppel', icon: '💳' },
  { name: 'Diezmo', icon: '🙏' },
  { name: 'Renta', icon: '🏠' },
  { name: 'Fernando', icon: '👤' },
  { name: 'Internet', icon: '🌐' },
  { name: 'Mandado', icon: '🛒' },
  { name: 'Croquetas', icon: '🐾' },
  { name: 'Curso', icon: '🎓' },
  { name: 'Mochila', icon: '🎒' },
  { name: 'DiDi', icon: '🚕' },
  { name: 'Otros', icon: '📦' },
];

const INCOME_TYPE_DEFS = ['Sueldo', 'Extra', 'Otros'];

export function buildSeed() {
  const groceryCategories = GROCERY_CATEGORY_DEFS.map((c) => ({
    id: generateId(), name: c.name, icon: c.icon, status: 'active',
  }));
  const categoryIdByName = Object.fromEntries(groceryCategories.map((c) => [c.name, c.id]));

  const groceryProducts = GROCERY_PRODUCT_EXAMPLES.map((p) => ({
    id: generateId(),
    name: p.name,
    categoryId: categoryIdByName[p.categoryName],
    preferredUnit: p.unit,
    notes: '',
    status: 'active',
  }));

  const groceryListId = generateId();
  const now = new Date().toISOString();
  const groceryListItems = GROCERY_PRODUCT_EXAMPLES.map((p, i) => ({
    id: generateId(),
    groceryListId,
    productId: groceryProducts[i].id,
    categoryId: groceryProducts[i].categoryId,
    quantity: p.quantity,
    unit: p.unit,
    selectedStoreId: null,
    estimatedPrice: p.price,
    actualPrice: null,
    purchased: false,
    notes: '',
  }));

  const groceryLists = [{
    id: groceryListId,
    name: 'Mandado de ejemplo',
    startDate: now.slice(0, 10),
    weekNumber: null,
    status: 'open',
    budget: null,
    notes: 'Lista de ejemplo generada a partir de Control_de_Gastos.xlsx. Puedes editarla o eliminarla.',
    linkedExpenseId: null,
    createdAt: now,
    updatedAt: now,
  }];

  const expenseCategories = EXPENSE_CATEGORY_DEFS.map((c) => ({
    id: generateId(), name: c.name, icon: c.icon, status: 'active',
  }));

  const incomeTypes = INCOME_TYPE_DEFS.map((name) => ({
    id: generateId(), name, status: 'active',
  }));

  return {
    settings: {
      currency: 'MXN',
      selectedWeek: null,
      selectedMonth: new Date().getMonth(),
      selectedYear: new Date().getFullYear(),
      sidebarCollapsed: false,
    },
    incomes: [],
    incomeTypes,
    expenses: [],
    expenseCategories,
    groceryCategories,
    groceryProducts,
    stores: [],
    prices: [],
    groceryLists,
    groceryListItems,
    budgets: [],
  };
}

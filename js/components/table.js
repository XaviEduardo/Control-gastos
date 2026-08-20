import { escapeHtml } from '../core/validators.js';

// columns: [{ key, label, render?(row) }]. render() puede devolver HTML de confianza
// (calculado por el módulo); las celdas por defecto se escapan automáticamente.
export function renderTable({ columns, rows, emptyMessage = 'Sin datos todavía.', rowActions }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  if (!rows || !rows.length) {
    wrapper.innerHTML = `<p class="table-empty">${escapeHtml(emptyMessage)}</p>`;
    return wrapper;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}${rowActions ? '<th></th>' : ''}</tr>`;

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = columns
      .map((c) => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key] ?? '')}</td>`)
      .join('');
    if (rowActions) {
      const td = document.createElement('td');
      td.className = 'table-actions';
      td.appendChild(rowActions(row));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

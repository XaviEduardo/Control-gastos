import { escapeHtml } from '../core/validators.js';

// columns: [{ key, label, render?(row) }]. render() puede devolver HTML de confianza
// (calculado por el módulo); las celdas por defecto se escapan automáticamente.
//
// renderCard(row, actionsNode) es opcional: si se pasa, renderTable() arma además una lista
// de tarjetas (misma `rows`, sin estado ni fuente de datos duplicada) para mostrar en móvil
// vía CSS (ver .responsive-card-list en css/components.css y su override en css/responsive.css).
// `actionsNode` es el resultado de rowActions(row) para esa fila — el módulo decide dónde
// colocarlo dentro de su propio layout de tarjeta (ver docs/responsive-plan.md).
export function renderTable({ columns, rows, emptyMessage = 'Sin datos todavía.', rowActions, renderCard }) {
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

  if (renderCard) {
    const cardList = document.createElement('div');
    cardList.className = 'responsive-card-list';
    rows.forEach((row) => {
      const actionsNode = rowActions ? rowActions(row) : null;
      cardList.appendChild(renderCard(row, actionsNode));
    });
    wrapper.appendChild(cardList);
  }

  return wrapper;
}

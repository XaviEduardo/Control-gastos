import { escapeHtml } from '../core/validators.js';

export function renderEmptyState({ icon = '📋', title, message, actionLabel, onAction }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  wrapper.innerHTML = `
    <div class="empty-state__icon" aria-hidden="true">${icon}</div>
    <h3 class="empty-state__title">${escapeHtml(title || '')}</h3>
    ${message ? `<p class="empty-state__message">${escapeHtml(message)}</p>` : ''}
  `;

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--primary mt-md';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    wrapper.appendChild(button);
  }

  return wrapper;
}

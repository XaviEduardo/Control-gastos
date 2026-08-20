import { openModal } from './modal.js';

export function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let resolved = false;
    function resolveOnce(value) {
      if (resolved) return;
      resolved = true;
      resolve(value);
    }

    const footer = document.createElement('div');
    footer.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'btn btn--danger' : 'btn btn--primary';
    confirmBtn.textContent = confirmText;

    footer.append(cancelBtn, confirmBtn);

    const modal = openModal({
      title,
      content: `<p>${message}</p>`,
      footer,
      onClose: () => resolveOnce(false),
      variant: 'compact',
    });

    cancelBtn.addEventListener('click', () => modal.close());
    confirmBtn.addEventListener('click', () => {
      resolveOnce(true);
      modal.close();
    });
  });
}

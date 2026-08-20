let activeModal = null;

// variant: 'form' (default) — formularios largos, casi pantalla completa en móvil.
// 'compact' — confirmaciones/mensajes cortos (ver confirm-dialog.js): SIEMPRE centrado y
// pequeño, nunca full-screen, incluso en móvil (ver css/responsive.css).
export function openModal({ title = '', content, footer, onClose, variant = 'form' } = {}) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--${variant}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h3 class="modal-title"></h3>
        <button type="button" class="modal-close" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer"></div>
    </div>
  `;

  overlay.querySelector('.modal-title').textContent = title;

  const body = overlay.querySelector('.modal-body');
  if (content instanceof HTMLElement) body.appendChild(content);
  else if (typeof content === 'string') body.innerHTML = content;

  const footerEl = overlay.querySelector('.modal-footer');
  if (footer instanceof HTMLElement) footerEl.appendChild(footer);
  else footerEl.remove();

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    activeModal = null;
    if (onClose) onClose();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKeydown);

  document.body.appendChild(overlay);
  activeModal = { close };
  return { close, element: overlay };
}

export function closeModal() {
  activeModal?.close();
}

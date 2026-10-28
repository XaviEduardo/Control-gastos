// Pantalla de login/crear cuenta/recuperar contraseña — bloquea el montaje de la app (app.js)
// hasta que exista una sesión de Supabase "normal" (no de recuperación). Markup reutiliza las
// mismas clases que el resto de la app (.card, .form-grid, .btn, .form-error — ver
// income.module.js) + el set de iconos compartido (js/components/icons.js), sin librerías ni
// patrones nuevos.

import {
  getSession, onAuthStateChange, signInWithPassword, signUpWithPassword,
  sendPasswordReset, updatePassword,
} from './auth.js';
import { iconMarkup } from '../components/icons.js';

// Mensajes crudos de Supabase (en inglés) traducidos a algo consistente con el resto de la app
// (100% en español). Si no hay traducción conocida, se muestra el mensaje original — nunca se
// oculta un error real por no tener traducción.
const ERROR_TRANSLATIONS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/user already registered/i, 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/email not confirmed/i, 'Debes confirmar tu correo antes de entrar — revisa tu bandeja de entrada.'],
  [/unable to validate email address/i, 'Ese correo no parece válido.'],
  [/rate limit/i, 'Demasiados intentos — espera un momento antes de volver a intentar.'],
];

function translateError(error) {
  const message = error?.message || 'No se pudo completar la operación.';
  const match = ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(message));
  return match ? match[1] : message;
}

// Resuelve con la sesión activa en cuanto existe una — ya sea porque el usuario ya tenía sesión
// guardada, o porque acaba de iniciar/crear sesión desde el formulario. El evento especial
// 'PASSWORD_RECOVERY' (usuario llegó desde el link de "¿Olvidaste tu contraseña?") NO resuelve
// la promesa — primero se le pide fijar una contraseña nueva, y solo entonces se deja pasar.
export function waitForSession(authScreen, appShell) {
  return new Promise((resolve) => {
    let settled = false;
    let inRecovery = false;

    function settle(session) {
      if (settled || inRecovery) return;
      settled = true;
      authScreen.classList.add('hidden');
      authScreen.innerHTML = '';
      appShell.classList.remove('hidden');
      resolve(session);
    }

    function showAuthScreen() {
      appShell.classList.add('hidden');
      authScreen.classList.remove('hidden');
    }

    onAuthStateChange((session, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        inRecovery = true;
        showAuthScreen();
        renderUpdatePasswordForm(authScreen, () => {
          inRecovery = false;
          settle(session);
        });
        return;
      }
      if (session) settle(session);
    });

    getSession().then((session) => {
      if (session) { settle(session); return; }
      showAuthScreen();
      renderAuthShell(authScreen, 'signIn');
    });
  });
}

// Envoltorio común (logo + nombre de la app arriba de la card) para las 4 vistas posibles:
// iniciar sesión, crear cuenta, olvidé mi contraseña, correo de recuperación enviado.
function renderAuthShell(container, view, context) {
  container.innerHTML = `
    <div class="auth-screen__inner">
      <div class="auth-screen__brand">
        ${iconMarkup('wallet', { size: 26 })}
        <span>Control de Gastos</span>
      </div>
      <div class="auth-screen__card card" id="authCard"></div>
    </div>
  `;
  const card = container.querySelector('#authCard');
  if (view === 'signIn' || view === 'signUp') renderCredentialsForm(card, container, view);
  else if (view === 'forgot') renderForgotPasswordForm(card, container);
  else if (view === 'forgotSent') renderForgotSentView(card, container, context);
}

function fieldWithIcon(icon, inputHtml) {
  return `<div class="input-group"><span class="input-group__icon">${iconMarkup(icon, { size: 18 })}</span>${inputHtml}</div>`;
}

function renderCredentialsForm(card, container, mode) {
  const isSignIn = mode === 'signIn';
  card.innerHTML = `
    <h1 class="card-title">${isSignIn ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h1>
    <p class="text-secondary text-xs mb-md">
      ${isSignIn ? 'Inicia sesión para ver tus finanzas y tu mandado.' : 'Tus datos se guardan en la nube y se sincronizan entre dispositivos.'}
    </p>
    <form class="form-grid" id="authForm" novalidate>
      <div>
        <label for="authEmail">Correo</label>
        ${fieldWithIcon('mail', `<input type="email" id="authEmail" name="email" class="input-group__input" required autocomplete="email">`)}
      </div>
      <div>
        <label for="authPassword">Contraseña</label>
        <div class="input-group input-group--password">
          <span class="input-group__icon">${iconMarkup('lock', { size: 18 })}</span>
          <input type="password" id="authPassword" name="password" class="input-group__input" required minlength="6" autocomplete="${isSignIn ? 'current-password' : 'new-password'}">
          <button type="button" class="input-group__toggle" id="authPasswordToggle" aria-label="Mostrar contraseña">
            ${iconMarkup('eye', { size: 16 })}
          </button>
        </div>
      </div>
      <p class="form-error hidden"></p>
      <button type="submit" class="btn btn--primary">${isSignIn ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
    ${isSignIn ? '<p class="auth-screen__links"><a href="#" id="authForgotLink">¿Olvidaste tu contraseña?</a></p>' : ''}
    <p class="text-secondary text-xs mt-md">
      ${isSignIn ? 'Aún no tienes cuenta' : '¿Ya tienes cuenta?'}
      <a href="#" id="authToggle">${isSignIn ? 'Crear una' : 'Inicia sesión'}</a>
    </p>
  `;

  const form = card.querySelector('#authForm');
  const errorEl = card.querySelector('.form-error');
  const submitBtn = form.querySelector('button[type="submit"]');
  const passwordInput = card.querySelector('#authPassword');
  const passwordToggle = card.querySelector('#authPasswordToggle');

  passwordToggle.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    passwordToggle.innerHTML = iconMarkup(show ? 'eye-off' : 'eye', { size: 16 });
    passwordToggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  card.querySelector('#authToggle').addEventListener('click', (event) => {
    event.preventDefault();
    renderAuthShell(container, isSignIn ? 'signUp' : 'signIn');
  });

  card.querySelector('#authForgotLink')?.addEventListener('click', (event) => {
    event.preventDefault();
    renderAuthShell(container, 'forgot');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.add('hidden');
    const data = new FormData(form);
    const email = data.get('email').trim();
    const password = data.get('password');

    submitBtn.disabled = true;
    submitBtn.textContent = isSignIn ? 'Entrando…' : 'Creando cuenta…';
    try {
      if (isSignIn) {
        await signInWithPassword(email, password);
        // onAuthStateChange (registrado en waitForSession) resuelve la promesa y monta la app
        // en cuanto Supabase confirme la sesión — no hace falta hacer nada más aquí.
      } else {
        await signUpWithPassword(email, password);
        errorEl.textContent = 'Cuenta creada. Si tu proyecto exige confirmar el correo, revisa tu bandeja antes de entrar.';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      errorEl.textContent = translateError(error);
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignIn ? 'Entrar' : 'Crear cuenta';
    }
  });
}

function renderForgotPasswordForm(card, container) {
  card.innerHTML = `
    <h1 class="card-title">Recuperar contraseña</h1>
    <p class="text-secondary text-xs mb-md">Te mandamos un correo con un link para elegir una contraseña nueva.</p>
    <form class="form-grid" id="forgotForm" novalidate>
      <div>
        <label for="forgotEmail">Correo</label>
        ${fieldWithIcon('mail', `<input type="email" id="forgotEmail" name="email" class="input-group__input" required autocomplete="email">`)}
      </div>
      <p class="form-error hidden"></p>
      <button type="submit" class="btn btn--primary">Enviar correo</button>
    </form>
    <p class="text-secondary text-xs mt-md"><a href="#" id="backToSignIn">Volver a iniciar sesión</a></p>
  `;

  card.querySelector('#backToSignIn').addEventListener('click', (event) => {
    event.preventDefault();
    renderAuthShell(container, 'signIn');
  });

  const form = card.querySelector('#forgotForm');
  const errorEl = card.querySelector('.form-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.add('hidden');
    const email = new FormData(form).get('email').trim();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';
    try {
      await sendPasswordReset(email);
      renderAuthShell(container, 'forgotSent', { email });
    } catch (error) {
      errorEl.textContent = translateError(error);
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar correo';
    }
  });
}

function renderForgotSentView(card, container, { email } = {}) {
  card.innerHTML = `
    <h1 class="card-title">Revisa tu correo</h1>
    <p class="text-secondary text-xs mb-md">
      Mandamos un link de recuperación a <strong>${email || 'tu correo'}</strong>. Ábrelo para elegir una contraseña nueva.
    </p>
    <button type="button" class="btn btn--secondary" id="backToSignIn">Volver a iniciar sesión</button>
  `;
  card.querySelector('#backToSignIn').addEventListener('click', () => renderAuthShell(container, 'signIn'));
}

// Vista especial: el usuario llegó desde el link del correo de recuperación. Supabase ya le dio
// una sesión válida (necesaria para poder llamar updateUser) pero NO se le deja entrar a la app
// todavía — primero debe fijar una contraseña nueva. onDone() es lo que hace que
// waitForSession() finalmente resuelva y monte la app.
function renderUpdatePasswordForm(authScreen, onDone) {
  authScreen.innerHTML = `
    <div class="auth-screen__inner">
      <div class="auth-screen__brand">
        ${iconMarkup('wallet', { size: 26 })}
        <span>Control de Gastos</span>
      </div>
      <div class="auth-screen__card card">
        <h1 class="card-title">Elige una contraseña nueva</h1>
        <p class="text-secondary text-xs mb-md">Esto reemplaza tu contraseña anterior.</p>
        <form class="form-grid" id="updatePasswordForm" novalidate>
          <div>
            <label for="newPassword">Contraseña nueva</label>
            <div class="input-group input-group--password">
              <span class="input-group__icon">${iconMarkup('lock', { size: 18 })}</span>
              <input type="password" id="newPassword" name="password" class="input-group__input" required minlength="6" autocomplete="new-password">
              <button type="button" class="input-group__toggle" id="newPasswordToggle" aria-label="Mostrar contraseña">${iconMarkup('eye', { size: 16 })}</button>
            </div>
          </div>
          <p class="form-error hidden"></p>
          <button type="submit" class="btn btn--primary">Guardar contraseña</button>
        </form>
      </div>
    </div>
  `;

  const form = authScreen.querySelector('#updatePasswordForm');
  const errorEl = authScreen.querySelector('.form-error');
  const submitBtn = form.querySelector('button[type="submit"]');
  const passwordInput = authScreen.querySelector('#newPassword');
  authScreen.querySelector('#newPasswordToggle').addEventListener('click', (event) => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    event.currentTarget.innerHTML = iconMarkup(show ? 'eye-off' : 'eye', { size: 16 });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.add('hidden');
    const password = new FormData(form).get('password');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando…';
    try {
      await updatePassword(password);
      onDone();
    } catch (error) {
      errorEl.textContent = translateError(error);
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar contraseña';
    }
  });
}

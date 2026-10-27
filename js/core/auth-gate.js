// Pantalla de login/crear cuenta — bloquea el montaje de la app (app.js) hasta que exista una
// sesión de Supabase. Markup reutiliza las mismas clases que el resto de la app (.card,
// .form-grid, .btn, .form-error — ver income.module.js) para no agregar CSS nuevo.

import { getSession, onAuthStateChange, signInWithPassword, signUpWithPassword } from './auth.js';

// Resuelve con la sesión activa en cuanto existe una — ya sea porque el usuario ya tenía sesión
// guardada, o porque acaba de iniciar/crear sesión desde el formulario. Mientras tanto, muestra
// `authScreen` y oculta `appShell` (y viceversa al resolver).
export function waitForSession(authScreen, appShell) {
  return new Promise((resolve) => {
    let settled = false;

    function settle(session) {
      if (settled) return;
      settled = true;
      authScreen.classList.add('hidden');
      authScreen.innerHTML = '';
      appShell.classList.remove('hidden');
      resolve(session);
    }

    onAuthStateChange((session) => {
      if (session) settle(session);
    });

    getSession().then((session) => {
      if (session) { settle(session); return; }
      appShell.classList.add('hidden');
      authScreen.classList.remove('hidden');
      renderForm(authScreen, 'signIn');
    });
  });
}

function renderForm(container, mode) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'auth-screen__card card';

  const isSignIn = mode === 'signIn';
  wrap.innerHTML = `
    <h1 class="card-title mb-md">${isSignIn ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
    <form class="form-grid" id="authForm">
      <div>
        <label for="authEmail">Correo</label>
        <input type="email" id="authEmail" name="email" required autocomplete="email">
      </div>
      <div>
        <label for="authPassword">Contraseña</label>
        <input type="password" id="authPassword" name="password" required minlength="6" autocomplete="${isSignIn ? 'current-password' : 'new-password'}">
      </div>
      <p class="form-error hidden"></p>
      <button type="submit" class="btn btn--primary">${isSignIn ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
    <p class="text-secondary text-xs mt-md">
      ${isSignIn ? 'Aún no tienes cuenta' : '¿Ya tienes cuenta?'}
      <a href="#" id="authToggle">${isSignIn ? 'Crear una' : 'Inicia sesión'}</a>
    </p>
  `;
  container.appendChild(wrap);

  const form = wrap.querySelector('#authForm');
  const errorEl = wrap.querySelector('.form-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  wrap.querySelector('#authToggle').addEventListener('click', (event) => {
    event.preventDefault();
    renderForm(container, isSignIn ? 'signUp' : 'signIn');
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
      } else {
        await signUpWithPassword(email, password);
        errorEl.textContent = 'Cuenta creada. Si tu proyecto exige confirmar el correo, revisa tu bandeja antes de entrar.';
        errorEl.classList.remove('hidden');
      }
      // onAuthStateChange (registrado en waitForSession) resuelve la promesa y monta la app
      // en cuanto Supabase confirme la sesión — no hace falta hacer nada más aquí.
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo completar la operación.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignIn ? 'Entrar' : 'Crear cuenta';
    }
  });
}

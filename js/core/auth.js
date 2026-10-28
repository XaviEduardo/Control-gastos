// Capa fina sobre supabase-js Auth (Fase 1 Supabase — ver docs/decisions.md). Nada de UI aquí;
// auth-gate.js es quien renderiza el formulario y app.js quien decide cuándo montar la app.

import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Notifica cada vez que cambia la sesión (login, logout, refresh de token, o el evento especial
// 'PASSWORD_RECOVERY' cuando el usuario llega desde el link de "¿Olvidaste tu contraseña?").
// Devuelve la suscripción por si en el futuro hace falta cancelarla (hoy vive mientras viva la
// pestaña).
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return data.subscription;
}

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Envía el correo de "restablecer contraseña". redirectTo apunta a la app misma (sin query ni
// hash) — Supabase agrega sus propios parámetros al volver, y auth-gate.js detecta el evento
// 'PASSWORD_RECOVERY' resultante para mostrar el formulario de nueva contraseña en vez de
// dejar pasar directo al dashboard.
export async function sendPasswordReset(email) {
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

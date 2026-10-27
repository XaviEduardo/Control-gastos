// Capa fina sobre supabase-js Auth (Fase 1 Supabase — ver docs/decisions.md). Nada de UI aquí;
// auth-gate.js es quien renderiza el formulario y app.js quien decide cuándo montar la app.

import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Notifica cada vez que cambia la sesión (login, logout, refresh de token). Devuelve la
// suscripción por si en el futuro hace falta cancelarla (hoy vive mientras viva la pestaña).
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
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

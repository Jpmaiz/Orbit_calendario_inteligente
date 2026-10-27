'use server';

import { crearClienteServidor } from '@/lib/supabase/servidor';
import { redirect } from 'next/navigation';
import { asegurarPerfil } from '@/lib/usuarios/perfil';

export async function registrarse(formData: FormData) {
  const supabase = await crearClienteServidor();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nombre = String(formData.get('nombre') ?? '').trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // El nombre queda también en Supabase: permite reconstruir el perfil si falla la base local
    options: { data: { nombre } },
  });

  if (error) {
    redirect('/registro?error=' + encodeURIComponent(error.message));
  }

  // Correo ya registrado: Supabase responde con un usuario sin identidades (para no revelar cuentas).
  // No hay que crear nada local con ese id.
  if (data.user && data.user.identities?.length === 0) {
    redirect('/registro?error=' + encodeURIComponent('Ese correo ya está registrado. Inicia sesión.'));
  }

  // Perfil local. Si falla, el registro NO se rompe: se repara solo al confirmar el correo,
  // al iniciar sesión o al entrar al dashboard (asegurarPerfil es idempotente).
  if (data.user) {
    await asegurarPerfil(data.user, nombre);
  }

  redirect('/login?mensaje=' + encodeURIComponent('Revisa tu correo para confirmar tu cuenta'));
}

export async function iniciarSesion(formData: FormData) {
  const supabase = await crearClienteServidor();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  // Repara la cuenta si quedó sin perfil local
  if (data.user) {
    await asegurarPerfil(data.user);
  }

  redirect('/dia');
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}

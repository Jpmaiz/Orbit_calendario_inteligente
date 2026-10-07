'use server';

import { crearClienteServidor } from '@/lib/supabase/servidor';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma/cliente';

export async function registrarse(formData: FormData) {
  const supabase = await crearClienteServidor();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const nombre = formData.get('nombre') as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect('/registro?error=' + encodeURIComponent(error.message));
  }

  // Crear usuario en nuestra tabla
  if (data.user) {
    await prisma.usuario.create({
      data: {
        id: data.user.id,
        email,
        nombre,
      },
    });
  }

  redirect('/login?mensaje=Revisá tu email para confirmar');
}

export async function iniciarSesion(formData: FormData) {
  const supabase = await crearClienteServidor();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  redirect('/dia');
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}
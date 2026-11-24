import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { nombreVisible, normalizarApodo } from '@/lib/usuarios/perfil';
import { franjaCompatible, leerRitmo, normalizarRitmo, RITMO_POR_DEFECTO, type Ritmo } from '@/lib/usuarios/ritmo';
import { olvidarRitmo } from '@/lib/usuarios/zona';
import { olvidarDisponibilidad } from '@/lib/plan/disponibilidad';

const seleccion = { nombre: true, apodo: true, email: true, ritmo: true } as const;
/** El ritmo con `franja` (v2.13: primer momento con energía alta) para que el front anterior siga funcionando. */
const conFranja = (r: Ritmo) => ({ ...r, franja: franjaCompatible(r.energia) });
const respuesta = (u: { nombre: string; apodo: string | null; email: string; ritmo: unknown }) => ({
  nombre: u.nombre, apodo: u.apodo, nombreVisible: nombreVisible(u), correo: u.email,
  ritmo: conFranja(leerRitmo(u.ritmo)), ritmoPorDefecto: conFranja(RITMO_POR_DEFECTO),
});

/**
 * GET /api/perfil → { nombre, apodo, nombreVisible, correo, ritmo, ritmoPorDefecto }
 * nombre = el de registro (no se edita aquí); apodo = cómo quiere que Orbit lo llame; nombreVisible = apodo || nombre.
 * ritmo = "Mi ritmo" { desde, hasta, maxHorasDia, diasLibres, energia: { manana, mediodia, tarde, noche: alta|normal|baja },
 *   energiaPreguntada, menosEstudio: [1–7], franja (solo compatibilidad v2.13) } (con los valores por defecto si no lo cambió).
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: seleccion });
    if (!u) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    return NextResponse.json(respuesta(u));
  } catch (error) {
    console.error('Error GET /api/perfil:', error);
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 });
  }
}

/**
 * PATCH /api/perfil  Body: { apodo?: string | null, ritmo?: { desde?, hasta?, maxHorasDia?, diasLibres?, energia?, energiaPreguntada?,
 *   menosEstudio?, franja? } | null }
 * - apodo: máx. 40 caracteres; "" o null lo quita. El nombre de registro, el correo y Supabase Auth no se tocan.
 * - ritmo: cambio parcial (lo que no viene se conserva); null = volver a los valores por defecto. Todo con toques, sin texto:
 *   energia es parcial por momento ({ noche: "alta" }); las dos preguntas de la primera vez mandan
 *   { energia: { <mejor>: "alta", <cuesta>: "baja" }, energiaPreguntada: true } ("no sé" = no se manda ese momento).
 *   Desde el siguiente pedido, el plan, los huecos y "te faltarían" usan el ritmo nuevo.
 * 200 = lo mismo que GET
 */
export async function PATCH(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { apodo?: unknown; ritmo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const trae = (k: string) => typeof body === 'object' && body !== null && k in body;
  if (!trae('apodo') && !trae('ritmo')) return NextResponse.json({ error: 'Usa { apodo } y/o { ritmo }' }, { status: 400 });

  try {
    const data: Prisma.UsuarioUpdateInput = {};
    if (trae('apodo')) {
      const v = normalizarApodo(body.apodo);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      data.apodo = v.apodo;
    }
    if (trae('ritmo')) {
      if (body.ritmo === null) {
        data.ritmo = RITMO_POR_DEFECTO;
      } else {
        const actual = await prisma.usuario.findUnique({ where: { id: user.id }, select: { ritmo: true } });
        const v = normalizarRitmo(body.ritmo, leerRitmo(actual?.ritmo ?? null));
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
        data.ritmo = v.ritmo;
      }
    }
    const u = await prisma.usuario.update({ where: { id: user.id }, data, select: seleccion });
    if (trae('ritmo')) {
      olvidarRitmo(user.id);
      olvidarDisponibilidad(user.id);
    }
    return NextResponse.json(respuesta(u));
  } catch (error) {
    console.error('Error PATCH /api/perfil:', error);
    return NextResponse.json({ error: 'Error al guardar el perfil' }, { status: 500 });
  }
}

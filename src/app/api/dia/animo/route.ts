import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { ritmoDeUsuario, zonaDeUsuario } from '@/lib/usuarios/zona';
import { CONFIG_ENERGIA, patronCansancio } from '@/lib/aprendizaje/energia';
import { avisoReciente, registrarAviso } from '@/lib/aprendizaje/senales';
import { ESTADOS_ANIMO, inicioDeDia, proponerParaHoy, type EstadoAnimo } from '@/lib/plan/animo';

const DIA_MS = 86_400_000;
const iso = (t: { inicio: Date; fin: Date }) => ({ inicio: t.inicio.toISOString(), fin: t.fin.toISOString() });

/**
 * GET /api/dia/animo → { hoy: "energia" | "normal" | "cansado" | null, sugerencia: { texto, cambio: { menosEstudio } } | null }
 * hoy = lo que el usuario marcó hoy en "¿Cómo estás hoy?" (null = nada: los tres botones siguen ahí, sin insistir).
 * sugerencia = "Los lunes sueles tener poca energía. ¿Te pongo menos estudio ese día?" (3 "cansado" el mismo día de la
 * semana en 8 semanas). Aceptar: PATCH /api/perfil { ritmo: sugerencia.cambio }. Queda registrada al mostrarse:
 * si la ignora, no vuelve en 60 días.
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const ahora = new Date();
    const [zona, ritmo] = await Promise.all([zonaDeUsuario(user.id), ritmoDeUsuario(user.id)]);
    const animos = await prisma.senalAprendizaje.findMany({
      where: { usuarioId: user.id, clase: 'animo', creadoEn: { gte: new Date(ahora.getTime() - CONFIG_ENERGIA.semanasCansancio * 7 * DIA_MS) } },
      select: { fuente: true, creadoEn: true },
      orderBy: { creadoEn: 'desc' },
    });
    const desdeHoy = inicioDeDia(ahora, zona);
    const hoy = animos.find((a) => a.creadoEn >= desdeHoy)?.fuente ?? null;

    let sugerencia: { texto: string; cambio: { menosEstudio: number[] } } | null = null;
    const patron = patronCansancio(animos.map((a) => ({ fecha: a.creadoEn, estado: a.fuente })), zona, ahora, ritmo.menosEstudio);
    if (patron && !(await avisoReciente(user.id, 'cansancio', CONFIG_ENERGIA.diasEntreSugerencias, ahora))) {
      await registrarAviso(user.id, 'cansancio');
      sugerencia = { texto: patron.texto, cambio: { menosEstudio: [...ritmo.menosEstudio, patron.diaSemana].sort() } };
    }
    return NextResponse.json({ hoy, sugerencia });
  } catch (error) {
    console.error('Error GET /api/dia/animo:', error);
    return NextResponse.json({ error: 'Error al leer cómo estás hoy' }, { status: 500 });
  }
}

/**
 * POST /api/dia/animo  Body: { estado: "energia" | "normal" | "cansado" }
 * Guarda cómo está hoy (uno por día: cambiarlo reemplaza el anterior) y devuelve una PROPUESTA. No mueve nada:
 * si el usuario acepta, el front manda los cambios a POST /api/dia/reacomodar.
 * 200 { estado, propuesta: { cambios: [{ id, tareaId, titulo, de: { inicio, fin }, a: { inicio, fin }, razon }], mensaje } }
 *   cansado → el estudio profundo de hoy a otros días (si alcanza el tiempo); mensaje dice qué no se pudo mover y por qué
 *   energia → un bloque futuro traído a hoy ("¿Adelanto 1 h de «Redes» para hoy a las 20:00?")
 *   normal  → { cambios: [], mensaje: null }
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { estado?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!ESTADOS_ANIMO.includes(body?.estado as EstadoAnimo)) {
    return NextResponse.json({ error: 'estado: "energia", "normal" o "cansado"' }, { status: 400 });
  }
  const estado = body.estado as EstadoAnimo;
  try {
    const ahora = new Date();
    const zona = await zonaDeUsuario(user.id);
    const desdeHoy = inicioDeDia(ahora, zona);
    await prisma.$transaction([
      prisma.senalAprendizaje.deleteMany({ where: { usuarioId: user.id, clase: 'animo', creadoEn: { gte: desdeHoy } } }),
      prisma.senalAprendizaje.create({ data: { usuarioId: user.id, clase: 'animo', fuente: estado, peso: 0 } }),
    ]);
    const propuesta = await proponerParaHoy(user.id, estado, ahora);
    return NextResponse.json({
      estado,
      propuesta: {
        cambios: propuesta.cambios.map((c) => ({ id: c.id, tareaId: c.tareaId, titulo: c.titulo, de: iso(c.de), a: iso(c.a), razon: c.razon })),
        mensaje: propuesta.mensaje,
      },
    });
  } catch (error) {
    console.error('Error POST /api/dia/animo:', error);
    return NextResponse.json({ error: 'Error al armar la propuesta' }, { status: 500 });
  }
}

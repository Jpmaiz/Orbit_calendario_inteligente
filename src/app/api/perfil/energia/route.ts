import { NextResponse } from 'next/server';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { ritmoDeUsuario } from '@/lib/usuarios/zona';
import { HORARIO_MOMENTO, MOMENTOS, aMinutos, type Momento } from '@/lib/usuarios/ritmo';
import { CONFIG_ENERGIA, energiaEfectiva } from '@/lib/aprendizaje/energia';
import { avisoReciente, cargarAprendizaje, registrarAviso } from '@/lib/aprendizaje/senales';

const NOMBRE: Record<Momento, string> = { manana: 'Mañana', mediodia: 'Mediodía', tarde: 'Tarde', noche: 'Noche' };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * GET /api/perfil/energia → tu energía por momento del día (D23), para el mapa del perfil.
 * 200 {
 *   momentos: [{ momento, nombre, desde, hasta, disponible, nivel: alta|normal|baja, aprendido }],
 *     desde/hasta = el momento recortado a tu horario de estudio; disponible = false si queda fuera de él
 *     aprendido = true si Orbit lo marcó como alto por su cuenta (no elegiste ningún momento alto)
 *   preguntar: boolean,  ← mostrar las dos preguntas de la primera vez (nunca las vio)
 *   sugerencia: { texto, cambio: { energia } } | null  ← "Últimamente mueves tus bloques a la noche. ¿Marco…?"
 * }
 * Cambiar algo: PATCH /api/perfil { ritmo: { energia: { noche: "alta" } } } (con la sugerencia: { ritmo: sugerencia.cambio }).
 * La sugerencia queda registrada al mostrarse: si el usuario la ignora, no vuelve en 60 días.
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const ahora = new Date();
    const [ritmo, senales] = await Promise.all([ritmoDeUsuario(user.id), cargarAprendizaje(user.id, ahora)]);
    const ef = energiaEfectiva(ritmo.energia, senales.momentos, ahora);
    const [ini, fin] = [aMinutos(ritmo.desde), aMinutos(ritmo.hasta)];

    const momentos = MOMENTOS.map((m) => {
      const [a, b] = HORARIO_MOMENTO[m].map(aMinutos);
      const desde = Math.max(a, ini), hasta = Math.min(b, fin);
      return {
        momento: m, nombre: NOMBRE[m], desde: hhmm(Math.min(desde, hasta)), hasta: hhmm(hasta), disponible: hasta > desde,
        nivel: ef.energia[m], aprendido: ef.aprendidos.includes(m),
      };
    });

    let sugerencia: { texto: string; cambio: { energia: Record<string, string> } } | null = null;
    if (ef.sugerencia && !(await avisoReciente(user.id, 'energia', CONFIG_ENERGIA.diasEntreSugerencias, ahora))) {
      await registrarAviso(user.id, 'energia');
      sugerencia = { texto: ef.sugerencia.texto, cambio: { energia: ef.sugerencia.cambio as Record<string, string> } };
    }
    return NextResponse.json({ momentos, preguntar: !ritmo.energiaPreguntada, sugerencia });
  } catch (error) {
    console.error('Error GET /api/perfil/energia:', error);
    return NextResponse.json({ error: 'Error al leer tu energía' }, { status: 500 });
  }
}

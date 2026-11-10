import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarItem, type ItemConfirmado } from '@/lib/borrador/validarConfirmacion';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';
import { revisarEvento } from '@/lib/eventos/revisarEvento';
import {
  choquesDeEvento, revisarClase, nombreDia, proponerHoraDesdeHorario, diasDeClase, normalizarNombre,
  type ClaseFija, type EventoPuntual, type Choque, type HoraPropuesta,
} from '@/lib/borrador/enriquecer';
import { zonaDeUsuario } from '@/lib/usuarios/zona';

const HORA_MS = 3_600_000;

/**
 * POST /api/ia/revisar
 * Body: { items: [...] }  ← los ítems del borrador YA EDITADOS por el usuario (mismo formato que /api/ia/confirmar)
 *
 * Recalcula duplicados y choques con los datos nuevos. NO llama a la IA y NO guarda nada:
 * es instantáneo y se puede llamar cada vez que el usuario cambia fecha, hora o materia.
 * También revisa los ítems ENTRE SÍ (dos eventos del mismo borrador que se cruzan).
 *
 * Tareas: "horaClase" = la clase de esa materia el día de la fecha (guardada o del mismo borrador), o null;
 *   "diasClase" = días de la semana con clase de esa materia (puntos del calendario), [] si no tiene materia.
 *   Con clase → "¿Es en horario de clase, 16:00 – 17:30?"; null con materia → "¿A qué hora? No tienes X este día".
 *
 * 200 { items: [{ indice, duplicado, choques, horaClase?, diasClase? } | { indice, error }] }  ← un resultado por ítem, en el mismo orden
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 20) {
    return NextResponse.json({ error: 'Envía entre 1 y 20 ítems' }, { status: 400 });
  }

  // Un ítem incompleto (ej. todavía sin fecha) no bloquea la revisión de los demás
  const validados = body.items.map((x, i) => ({ i, v: validarItem(x, i) }));

  try {
    const ahora = new Date();
    const [zona, clasesGuardadas] = await Promise.all([
      zonaDeUsuario(user.id),
      prisma.eventoFijo.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        select: { id: true, titulo: true, materiaId: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
      }),
    ]);
    const materiaIdDe = (it: ItemConfirmado) => (it.materia.accion === 'vincular' ? it.materia.materiaId : null);

    // Ítems válidos del mismo borrador, para revisarlos entre sí
    const ok = validados.flatMap(({ i, v }) => (v.ok ? [{ i, item: v.valor }] : []));
    const eventosDelBorrador: (EventoPuntual & { indice: number })[] = ok.flatMap(({ i, item }) =>
      item.clase === 'evento'
        ? [{ indice: i, id: `borrador-${i}`, titulo: `${item.titulo} (en este borrador)`, inicio: item.inicio, fin: item.fin }]
        : [],
    );
    const clasesDelBorrador: (ClaseFija & { indice: number })[] = ok.flatMap(({ i, item }) =>
      item.clase === 'evento_fijo'
        ? item.diasSemana.map((d) => ({
            indice: i, id: `borrador-${i}-${d}`, titulo: item.titulo, materiaId: materiaIdDe(item),
            diaSemana: d, horaInicio: item.hora, horaFin: item.horaFin, vigenteDesde: null, vigenteHasta: null,
          }))
        : [],
    );

    // Clases del borrador con materia nueva (aún sin id): se comparan por nombre normalizado
    const clasesDelTexto = ok.flatMap(({ item }) =>
      item.clase === 'evento_fijo' && item.materia.accion === 'crear'
        ? [{ materiaClave: normalizarNombre(item.materia.nombre), diasSemana: item.diasSemana, hora: item.hora, horaFin: item.horaFin, titulo: item.titulo }]
        : [],
    );
    const todasLasClases = [...(clasesGuardadas as ClaseFija[]), ...clasesDelBorrador];
    const claseDe = (item: ItemConfirmado & { clase: 'tarea' }): { horaClase: HoraPropuesta; diasClase: number[] } => {
      const m = item.materia;
      if (m.accion === 'ninguna') return { horaClase: null, diasClase: [] };
      const propuesta = m.accion === 'vincular'
        ? { accion: 'vincular' as const, materiaId: m.materiaId, nombre: '', seguro: true, alternativas: [] }
        : { accion: 'ninguna' as const };
      const clave = m.accion === 'crear' ? normalizarNombre(m.nombre) : null;
      return {
        horaClase: proponerHoraDesdeHorario(item.inicio, zona, propuesta, todasLasClases, clasesDelTexto, clave),
        diasClase: diasDeClase(propuesta, todasLasClases, clasesDelTexto, clave, ahora),
      };
    };

    const resultados = [];
    for (const { i, v } of validados) {
      if (!v.ok) {
        resultados.push({ indice: i, error: v.error });
        continue;
      }
      const item = v.valor;
      let duplicado: Record<string, unknown> | null = null;
      let choques: Choque[] = [];
      let clase: { horaClase: HoraPropuesta; diasClase: number[] } | undefined;

      if (item.clase === 'tarea') {
        clase = claseDe(item);
        const dup = await buscarDuplicada(user.id, {
          titulo: item.titulo, fechaLimite: item.inicio, materiaId: materiaIdDe(item),
        });
        if (dup.estado !== 'nuevo') {
          duplicado = {
            tipoDuplicado: dup.estado,
            similitud: dup.similitud,
            tarea: dup.tarea,
            pregunta: preguntaDuplicado(dup.tarea),
            sugerenciasDiferencia: DIFERENCIAS_POR_TIPO[item.tipo] ?? [],
          };
        }
      }

      if (item.clase === 'evento') {
        const r = await revisarEvento(user.id, item.titulo, item.inicio, item.fin);
        choques = [
          ...r.choques,
          // contra los otros eventos y clases del mismo borrador
          ...choquesDeEvento(item.inicio, item.fin, zona,
            clasesDelBorrador.map((k) => ({ ...k, titulo: `${k.titulo} (en este borrador)` })),
            eventosDelBorrador.filter((e) => e.indice !== i)),
        ];
        if (r.duplicado) {
          duplicado = {
            tipoDuplicado: 'seguro',
            evento: r.duplicado,
            pregunta: `Ya tienes «${r.duplicado.titulo}» a esa hora.`,
          };
        } else {
          const repetido = eventosDelBorrador.find(
            (e) => e.indice < i && Math.abs(e.inicio.getTime() - item.inicio.getTime()) < HORA_MS
              && e.titulo === `${item.titulo} (en este borrador)`,
          );
          if (repetido) duplicado = { tipoDuplicado: 'seguro', pregunta: `«${item.titulo}» está repetido en este borrador.` };
        }
      }

      if (item.clase === 'evento_fijo') {
        const enBase = revisarClase(item.diasSemana, item.hora, item.horaFin, item.titulo, materiaIdDe(item), clasesGuardadas as ClaseFija[], ahora);
        const enBorrador = revisarClase(
          item.diasSemana, item.hora, item.horaFin, item.titulo, materiaIdDe(item),
          clasesDelBorrador.filter((c) => c.indice !== i), ahora,
        );
        choques = [...enBase.choques, ...enBorrador.choques.map((c) => ({ ...c, titulo: `${c.titulo} (en este borrador)` }))];
        if (enBase.existentes.length > 0) {
          duplicado = {
            tipoDuplicado: enBase.existentes.length === item.diasSemana.length ? 'seguro' : 'parcial',
            diasExistentes: enBase.existentes,
            pregunta: `Ya tienes «${item.titulo}» los ${enBase.existentes.map(nombreDia).join(' y ')} de ${item.hora} a ${item.horaFin}.`,
          };
        } else if (enBorrador.existentes.length > 0) {
          duplicado = { tipoDuplicado: 'seguro', pregunta: `«${item.titulo}» está repetida en este borrador.` };
        }
      }

      resultados.push({ indice: i, duplicado, choques, ...(clase ?? {}) });
    }

    return NextResponse.json({ items: resultados });
  } catch (error) {
    console.error('Error en /api/ia/revisar:', error);
    return NextResponse.json({ error: 'Error al revisar el borrador' }, { status: 500 });
  }
}

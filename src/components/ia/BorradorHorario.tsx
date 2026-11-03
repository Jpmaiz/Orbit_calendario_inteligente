'use client';

import { useMemo, useState } from 'react';
import TarjetaBorrador from './TarjetaBorrador';
import { problemasItem, type ItemRevision, type MateriaUsuario } from './borradorCaptura';
import type { DocumentoLeido } from './capturaArchivo';

/**
 * Borrador de un HORARIO: en vez de una tarjeta-formulario por clase,
 * una semana en miniatura con un color por materia y una fila por materia.
 * Los bloques "caen" en su lugar uno por uno; tocar una materia la resalta en la semana.
 * Editar abre las tarjetas de siempre solo para esa materia.
 */

// Misma línea de color que el calendario (#80ACC3 clases, #82AB95 tareas, #C5A355 eventos) + tonos afines
const PALETA = ['#80ACC3', '#9C8FC4', '#C5A355', '#82AB95', '#C98B7A', '#6FA3A0', '#B48AA8', '#8FA36F'];
const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const minutos = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', timeZone: 'America/La_Paz' }).replace('.', '');

type Grupo = { clave: string; nombre: string; codigo: string | null; color: string; indices: number[] };

export default function BorradorHorario({ items, materias, documento, cambiar }: {
  items: ItemRevision[];
  materias: MateriaUsuario[];
  documento: DocumentoLeido;
  cambiar: (indice: number, cambios: Partial<ItemRevision>) => void;
}) {
  const [foco, establecerFoco] = useState<string | null>(null);
  const [editando, establecerEditando] = useState<string | null>(null);

  // Agrupar las clases por materia (código si hay, si no el título), en orden de aparición
  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>();
    items.forEach((it, i) => {
      if (it.clase !== 'evento_fijo') return;
      const clave = it.original.codigoMateria?.toLowerCase().replace(/[^a-z0-9]/g, '') || it.titulo.trim().toLowerCase();
      const g = mapa.get(clave);
      if (g) g.indices.push(i);
      else mapa.set(clave, { clave, nombre: it.titulo, codigo: it.original.codigoMateria, color: PALETA[mapa.size % PALETA.length], indices: [i] });
    });
    return [...mapa.values()];
  }, [items]);

  // Bloques visibles (sin omitidos), ordenados por día y hora: así "caen" en orden de lectura
  const bloques = grupos.flatMap((g) => g.indices.flatMap((i) => {
    const it = items[i];
    if (it.excluido || !/^\d\d:\d\d$/.test(it.hora) || !/^\d\d:\d\d$/.test(it.horaFin)) return [];
    return it.diasSemana.map((d) => ({ g, i, d, ini: it.hora, fin: it.horaFin, dudosa: it.original.confianza < 0.9 }));
  })).sort((a, b) => a.d - b.d || minutos(a.ini) - minutos(b.ini));

  const dias = [1, 2, 3, 4, 5, ...[6, 7].filter((d) => bloques.some((b) => b.d === d))];
  const inicio = Math.min(7 * 60, ...bloques.map((b) => Math.floor(minutos(b.ini) / 60) * 60));
  const fin = Math.max(21 * 60, ...bloques.map((b) => Math.ceil(minutos(b.fin) / 60) * 60));
  const horas = Array.from({ length: Math.floor((fin - inicio) / 120) + 1 }, (_, k) => inicio + k * 120).filter((m) => m < fin);
  const pct = (m: number) => ((m - inicio) / (fin - inicio)) * 100;

  const conflictos = documento.revision.conflictos;
  const enfocar = (clave: string) => establecerFoco((actual) => (actual === clave ? null : clave));

  return (
    <div className="min-w-0 space-y-4">
      {/* Cómo se verificó la lectura y de dónde salió el semestre */}
      <div className="flex flex-wrap gap-1.5">
        {documento.revision.hecha && (conflictos === 0
          ? <span className="orbit-aparece rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-semibold text-[#1F5D50]">✓ Leído dos veces, todo coincide</span>
          : <span className="orbit-aparece rounded-full bg-[#FCF2DE] px-2.5 py-1 text-xs font-semibold text-[#916820]">{conflictos} {conflictos === 1 ? 'casilla' : 'casillas'} para revisar</span>)}
        {documento.periodo && <span className="orbit-aparece rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-semibold text-[#1F5D50]" style={{ ['--i' as string]: 1 }}>
          ✓ Semestre {documento.periodo.nombre} · {fechaCorta(documento.periodo.inicio)} – {fechaCorta(documento.periodo.fin)}
        </span>}
      </div>

      {/* La semana en miniatura */}
      <div role="img" aria-label={`Tu semana: ${bloques.length} clases de ${grupos.length} materias`}
        className="rounded-[20px] border border-[#E3E8DE] bg-white p-2.5 pl-1.5"
        style={{ display: 'grid', gridTemplateColumns: `1.6rem repeat(${dias.length}, minmax(0, 1fr))`, gap: '4px' }}>
        <span />
        {dias.map((d) => <span key={d} className="pb-1 text-center text-xs font-semibold text-[#647168]">{DIAS[d]}</span>)}
        <div className="relative h-60">
          {horas.map((m) => <span key={m} className="absolute right-1 -translate-y-1/2 font-mono text-[9px] text-[#768075]" style={{ top: `${pct(m)}%` }}>{m / 60}</span>)}
        </div>
        {dias.map((d) => <div key={d} className="relative h-60 rounded-lg"
          style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent calc(12.5% - 1px), #EEF1EB calc(12.5% - 1px), #EEF1EB 12.5%)' }}>
          {bloques.filter((b) => b.d === d).map((b) => {
            const alto = pct(minutos(b.fin)) - pct(minutos(b.ini));
            const atenuado = foco !== null && foco !== b.g.clave;
            return <button key={`${b.i}-${b.d}`} type="button" onClick={() => enfocar(b.g.clave)} title={`${b.g.nombre} · ${b.ini}–${b.fin}`}
              className={'orbit-bloque absolute inset-x-px overflow-hidden rounded-md border-l-[3px] px-1 pt-0.5 text-left text-[10px] font-semibold leading-tight text-[#263D34] transition-[opacity,transform,box-shadow] duration-300 ' +
                (atenuado ? 'opacity-25 ' : '') + (foco === b.g.clave ? 'z-10 scale-[1.06] shadow-md ' : '') +
                (b.dudosa ? 'outline-dashed outline-[1.5px] -outline-offset-1 outline-[#916820] ' : '')}
              style={{
                top: `${pct(minutos(b.ini))}%`, height: `${alto}%`, borderLeftColor: b.g.color,
                background: `color-mix(in srgb, ${b.g.color} 30%, white)`, ['--i' as string]: bloques.indexOf(b),
              }}>
              <span className="block truncate">{b.g.codigo ?? b.g.nombre}</span>
              {alto > 9 && <span className="block font-mono text-[8px] font-medium opacity-70">{b.ini}</span>}
            </button>;
          })}
        </div>)}
      </div>

      {/* Una fila por materia */}
      <ul className="space-y-1.5">
        {grupos.map((g, k) => {
          const its = g.indices.map((i) => items[i]);
          const omitida = its.every((it) => it.excluido);
          const sinNombre = its[0].materia.accion === 'crear' && !its[0].materia.nombre.trim();
          const revisar = !omitida && its.some((it) => problemasItem(it).length > 0 || it.original.confianza < 0.9 ||
            it.original.choques.length > 0 || !!it.original.duplicado);
          const sesiones = new Map<string, number[]>();
          its.filter((it) => !it.excluido).forEach((it) => {
            const h = `${it.hora}–${it.horaFin}`;
            sesiones.set(h, [...(sesiones.get(h) ?? []), ...it.diasSemana]);
          });
          const resumen = [...sesiones].map(([h, ds]) => `${[...new Set(ds)].sort().map((d) => DIAS[d]).join(', ')} ${h}`).join(' · ');
          const aula = its.find((it) => it.ubicacion)?.ubicacion;
          return <li key={g.clave} className="orbit-aparece" style={{ ['--i' as string]: k + 6 }}>
            <div className={'rounded-2xl border bg-white p-3 transition-colors ' + (foco === g.clave ? 'border-current' : 'border-[#E3E8DE]') + (omitida ? ' opacity-60' : '')}
              style={{ color: foco === g.clave ? g.color : undefined }}>
              <div className="flex items-start gap-3 text-[#263D34]">
                <button type="button" onClick={() => enfocar(g.clave)} className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: g.color }} aria-label={`Resaltar ${g.nombre} en la semana`} />
                <button type="button" onClick={() => enfocar(g.clave)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{sinNombre ? `¿Cómo se llama ${g.codigo}?` : g.nombre}</span>
                  <span className="block text-xs text-[#647168]">{omitida ? 'No se agregará' : [g.codigo && !sinNombre ? g.codigo : null, resumen, aula].filter(Boolean).join(' · ')}</span>
                </button>
                <button type="button" onClick={() => establecerEditando((e) => (e === g.clave ? null : g.clave))}
                  className={'min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold ' + (revisar || sinNombre ? 'text-[#916820]' : 'text-[#35695D]') + ' hover:bg-[#EDF4E8]'}>
                  {editando === g.clave ? 'Listo' : revisar || sinNombre ? 'Revisar' : 'Editar'}
                </button>
              </div>
              {sinNombre && editando !== g.clave && (
                <input aria-label={`Nombre de ${g.codigo}`} placeholder="Ej. Redes de Computadoras II"
                  className="mt-2 block min-h-10 w-full rounded-xl border border-[#CEDFD5] bg-white px-3 text-sm text-[#263D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]"
                  onBlur={(e) => {
                    const nombre = e.target.value.trim();
                    if (!nombre) return;
                    g.indices.forEach((i) => cambiar(i, { titulo: nombre, materia: { accion: 'crear', nombre, codigo: g.codigo } }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              )}
              {editando === g.clave && <div className="mt-3 space-y-3">
                {g.indices.map((i) => <TarjetaBorrador key={i} item={items[i]} indice={i} materias={materias} cambiar={(c) => cambiar(i, c)} />)}
                <button type="button" onClick={() => g.indices.forEach((i) => cambiar(i, { excluido: !omitida }))}
                  className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[#A34955] hover:bg-[#FCF0F1]">
                  {omitida ? 'Volver a incluir esta materia' : 'No agregar esta materia'}
                </button>
              </div>}
            </div>
          </li>;
        })}
      </ul>
    </div>
  );
}

/** Cuántas clases (bloques por semana) se van a agregar: para el botón y el aviso de Calendario. */
export function contarClases(items: ItemRevision[]) {
  return items.filter((it) => !it.excluido && it.clase === 'evento_fijo').reduce((s, it) => s + it.diasSemana.length, 0);
}

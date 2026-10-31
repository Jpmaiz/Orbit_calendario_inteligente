'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfiguracionPeriodo from '../periodos/ConfiguracionPeriodo';
import { usePeriodos } from '../periodos/ProveedorPeriodos';
import { esPeriodoActual, type PeriodoAcademico } from '../periodos/periodosFrontend';
import TarjetaBorrador, { botonCaptura, campoCaptura } from './TarjetaBorrador';
import {
  actualizarRevision, aplicarPeriodoARevision, construirConfirmacion, crearRevision, leerBorrador, leerMaterias, leerResultado,
  mensajeBackend, problemasItem,
  type Borrador, type ItemRevision, type MateriaUsuario, type ResultadoConfirmacion,
} from './borradorCaptura';
import { avisarAgendaActualizada } from '../calendario/actualizacionAgenda';
import { prepararArchivo, resumenDocumento } from './capturaArchivo';

const principal = 'min-h-12 w-full rounded-xl bg-[#234F45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#316457] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';

async function consultar(url: string, body?: unknown): Promise<unknown> {
  const respuesta = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeBackend(datos, 'No se pudo completar la solicitud. Intenta de nuevo.'));
  return datos;
}

type Exito = { resultado: ResultadoConfirmacion | null; excluidos: string[] };

export default function CapturaRapida({ onOcupadoChange, onCerrar }: {
  onOcupadoChange: (ocupado: boolean) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { datos: datosPeriodos, guardando: guardandoPeriodo } = usePeriodos();
  const id = useId();
  const [texto, establecerTexto] = useState('');
  const [periodoAplicado, establecerPeriodoAplicado] = useState<string | null>(null);
  const periodoEnCurso = useRef(false);
  const [borrador, establecerBorrador] = useState<Borrador | null>(null);
  const [items, establecerItems] = useState<ItemRevision[]>([]);
  const [corregida, establecerCorregida] = useState(false);
  const [enviando, establecerEnviando] = useState<'extraer' | 'confirmar' | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [exito, establecerExito] = useState<Exito | null>(null);
  const [materias, establecerMaterias] = useState<MateriaUsuario[]>([]);
  const [errorMaterias, establecerErrorMaterias] = useState<string | null>(null);
  // Captura por foto, captura de pantalla o PDF
  const [archivo, establecerArchivo] = useState<string | null>(null);
  const [lectura, establecerLectura] = useState<string | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const [cargandoMaterias, establecerCargandoMaterias] = useState(false);
  const enCurso = useRef(false);
  const materiasEnCurso = useRef(false);
  const tituloRevision = useRef<HTMLHeadingElement>(null);
  const tituloResultado = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (borrador) tituloRevision.current?.focus(); }, [borrador]);
  useEffect(() => { if (exito) tituloResultado.current?.focus(); }, [exito]);

  async function cargarMaterias() {
    if (materiasEnCurso.current) return;
    materiasEnCurso.current = true;
    establecerCargandoMaterias(true);
    establecerErrorMaterias(null);
    try {
      establecerMaterias(leerMaterias(await consultar('/api/materias')));
    } catch (error) {
      establecerErrorMaterias(error instanceof Error ? error.message : 'No se pudieron cargar las materias.');
    } finally {
      materiasEnCurso.current = false;
      establecerCargandoMaterias(false);
    }
  }

  async function extraer() {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    if (!texto.trim() || texto.length > 2000) {
      establecerError('Escribe entre 1 y 2000 caracteres.');
      return;
    }
    enCurso.current = true;
    establecerEnviando('extraer');
    onOcupadoChange(true);
    establecerError(null);
    establecerExito(null);
    // La carga de materias no impide revisar el borrador si ese GET falla.
    void cargarMaterias();
    try {
      const nuevo = leerBorrador(await consultar('/api/ia/extraer', { texto }));
      establecerArchivo(null);
      establecerLectura(null);
      establecerBorrador(nuevo);
      establecerItems(nuevo.items.map(crearRevision));
      establecerCorregida(false);
      establecerPeriodoAplicado(null);
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    } finally {
      enCurso.current = false;
      establecerEnviando(null);
      onOcupadoChange(false);
    }
  }

  /** Foto, captura o PDF → mismo borrador que el texto (revisar y confirmar no cambian). */
  async function extraerArchivo(seleccionado: File) {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    enCurso.current = true;
    establecerEnviando('extraer');
    onOcupadoChange(true);
    establecerError(null);
    establecerExito(null);
    void cargarMaterias();
    try {
      const { imagenes, textoAdjunto, paginasOmitidas } = await prepararArchivo(seleccionado);
      const datos = await consultar('/api/ia/extraer-imagen', { imagenes, textoAdjunto });
      const nuevo = leerBorrador(datos);
      if (paginasOmitidas > 0) nuevo.advertencias.unshift(`Solo se leyeron las primeras ${imagenes.length} páginas del PDF.`);
      establecerArchivo(seleccionado.name);
      establecerLectura(resumenDocumento(datos));
      establecerBorrador(nuevo);
      establecerItems(nuevo.items.map(crearRevision));
      establecerCorregida(false);
      establecerPeriodoAplicado(null);
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      enCurso.current = false;
      establecerEnviando(null);
      onOcupadoChange(false);
      if (entradaArchivo.current) entradaArchivo.current.value = ''; // permite elegir el mismo archivo otra vez
    }
  }

  function cambiarItem(indice: number, cambios: Partial<ItemRevision>) {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    establecerItems((actuales) => actualizarRevision(actuales, indice, cambios));
    establecerCorregida(true);
    establecerError(null);
  }

  async function confirmar() {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo || !borrador) return;
    let body: ReturnType<typeof construirConfirmacion>;
    try {
      body = construirConfirmacion(borrador.interpretacionId, items, corregida);
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'Revisa los datos pendientes.');
      return;
    }
    enCurso.current = true;
    establecerEnviando('confirmar');
    onOcupadoChange(true);
    establecerError(null);
    try {
      const respuesta = await fetch('/api/ia/confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const datos: unknown = await respuesta.json().catch(() => null);
      if (respuesta.status !== 200 && respuesta.status !== 201) throw new Error(mensajeBackend(datos, 'No se pudo guardar el borrador. Intenta de nuevo.'));
      // Un 200 o 201 confirma que el borrador ya se aplicó: no ofrecer reenviarlo si el resumen fuese ilegible.
      let resultado: ResultadoConfirmacion | null = null;
      try { resultado = leerResultado(datos); } catch { /* El guardado ya fue confirmado por el servidor. */ }
      establecerExito({ resultado, excluidos: items.filter((i) => i.excluido).map((i) => i.titulo) });
      establecerBorrador(null);
      establecerItems([]);
      establecerTexto('');
      establecerCorregida(false);
      avisarAgendaActualizada();
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor. Se conservó el borrador.');
    } finally {
      enCurso.current = false;
      establecerEnviando(null);
      onOcupadoChange(false);
    }
  }

  function aplicarPeriodo(periodo: PeriodoAcademico) {
    if (!esPeriodoActual(periodo)) return;
    establecerItems((actuales) => aplicarPeriodoARevision(actuales, periodo));
    establecerBorrador((actual) => actual ? {
      ...actual, periodo: { nombre: periodo.nombre, inicio: periodo.inicio, fin: periodo.fin },
    } : null);
    establecerCorregida(true);
    establecerPeriodoAplicado(periodo.nombre);
  }

  const faltaPeriodo = items.some((item) => !item.excluido && item.clase === 'evento_fijo' &&
    item.original.faltantes.includes('periodo') && !item.original.vigencia);
  const incluidos = items.filter((i) => !i.excluido);
  const pendientes = incluidos.some((i) => problemasItem(i).length > 0);
  const ocupada = enviando !== null || guardandoPeriodo;

  return (
    <div className="mt-5 min-w-0 space-y-4" aria-busy={ocupada}>
      {exito ? <section className="space-y-4">
        <h3 ref={tituloResultado} tabIndex={-1} className="rounded-sm text-base font-semibold focus:outline-none">Resultado de la captura</h3>
        <div role="status" className="space-y-2 rounded-xl border border-[#C6E6D3] bg-[#E7F8EF] p-4 text-sm text-[#1F5D50]">
          {exito.resultado ? <>
            <p>Se guardaron {exito.resultado.creados.tareas.length} tareas, {exito.resultado.creados.eventos.length} eventos y {exito.resultado.creados.clases.length} clases.</p>
            {exito.resultado.creados.materias.length > 0 && <p>Materias creadas: {exito.resultado.creados.materias.map((m) => m.nombre).join(', ')}.</p>}
          </> : <p>El servidor confirmó el guardado, pero no se pudo leer el resumen. Revisa tu agenda antes de volver a capturar estas actividades.</p>}
        </div>
        {exito.resultado && exito.resultado.omitidos.length > 0 && <section className="space-y-2">
          <h4 className="text-sm font-semibold">Omitidos por el servidor</h4>
          <ul className="space-y-2 text-xs text-[#657360]">
            {exito.resultado.omitidos.map((o, indice) => <li key={indice}>{o.titulo}: {o.motivo}</li>)}
          </ul>
        </section>}
        {exito.excluidos.length > 0 && <p className="text-xs text-[#657360]">Excluidos durante la revisión: {exito.excluidos.join(', ')}.</p>}
        <button type="button" className={principal} onClick={onCerrar}>Listo</button>
        <button type="button" className={botonCaptura} onClick={() => establecerExito(null)}>Nueva captura</button>
      </section> : !borrador ? (
        <form noValidate onSubmit={(evento) => { evento.preventDefault(); void extraer(); }}>
          <fieldset disabled={ocupada} className="min-w-0 space-y-4">
            <legend className="sr-only">Captura rápida de actividades</legend>
            <div>
              <label htmlFor={id + '-texto'} className="text-sm font-semibold">¿Qué necesitas agregar?</label>
              <textarea id={id + '-texto'} rows={4} value={texto} maxLength={2000}
                onChange={(e) => establecerTexto(e.target.value)}
                placeholder="Ej. examen de redes el miércoles y reunión del grupo mañana a las 16:00"
                aria-describedby={id + '-ayuda'} className={campoCaptura + ' resize-y'} />
              <p id={id + '-ayuda'} className="mt-2 text-xs leading-5 text-[#647168]">Escribe uno o varios pendientes. Primero revisarás el borrador; las actividades se guardan al confirmar.</p>
            </div>
            <button type="submit" className={principal}>{enviando === 'extraer' ? 'Extrayendo…' : 'Revisar con Orbit'}</button>
            <div>
              <input ref={entradaArchivo} id={id + '-archivo'} type="file" accept="image/*,application/pdf" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void extraerArchivo(f); }} />
              <label htmlFor={id + '-archivo'} className={botonCaptura + ' flex w-full cursor-pointer items-center justify-center text-center'}>
                Subir foto o PDF (horario, afiche o captura)
              </label>
            </div>
            <button type="button" className={botonCaptura} onClick={() => { onCerrar(); router.push('/dia/nueva'); }}>Crear tarea manualmente</button>
          </fieldset>
        </form>
      ) : (
        <section className="min-w-0 space-y-4">
          <h3 ref={tituloRevision} tabIndex={-1} className="rounded-sm text-base font-semibold focus:outline-none">Revisa tu borrador</h3>
          <p className="text-xs text-[#647168]">Aún no se guardaron actividades. Corrige lo necesario y omite las que no quieras agregar.</p>
          {periodoAplicado && <p role="status" className="rounded-xl bg-[#E7F8EF] p-3 text-xs text-[#1F5D50]">Semestre {periodoAplicado} aplicado a las clases pendientes. Se conservaron las fechas que editaste.</p>}
          {faltaPeriodo && <fieldset disabled={enviando !== null} className="min-w-0">
            <legend className="sr-only">Período de las clases</legend>
            {datosPeriodos?.actual ? <div className="space-y-2 rounded-xl bg-[#EDF4E8] p-3 text-xs text-[#526A5A]">
              <p>Tu período actual es {datosPeriodos.actual.nombre}. Puedes usarlo para las clases de este borrador.</p>
              <button type="button" className={botonCaptura} disabled={ocupada} onClick={() => aplicarPeriodo(datosPeriodos.actual!)}>Usar este período</button>
            </div> : <ConfiguracionPeriodo origen="ia" onCreado={aplicarPeriodo} onOcupadoChange={(ocupado) => {
              periodoEnCurso.current = ocupado;
              onOcupadoChange(ocupado);
            }} />}
          </fieldset>}
          {archivo ? <p className="rounded-xl bg-[#EDF4E8] p-3 text-xs text-[#526A5A]">
            Archivo: <span className="font-semibold">{archivo}</span>{lectura ? ` · ${lectura}` : ''}
          </p> : <details className="text-xs text-[#647168]">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">Ver texto original</summary>
            <p className="whitespace-pre-wrap break-words">{texto}</p>
          </details>}
          {borrador.advertencias.length > 0 && <ul className="space-y-1 rounded-xl bg-[#FCF2DE] p-3 text-sm text-[#916820]">
            {borrador.advertencias.map((mensaje, indice) => <li key={indice}>{mensaje}</li>)}
          </ul>}
          {cargandoMaterias && <p role="status" className="text-xs text-[#657360]">Cargando tus materias…</p>}
          {errorMaterias && <div className="space-y-2 rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3 text-xs text-[#916820]">
            <p role="alert">Materias: {errorMaterias}</p>
            <button type="button" disabled={ocupada || cargandoMaterias} className={botonCaptura} onClick={() => void cargarMaterias()}>Volver a cargar materias</button>
          </div>}
          <fieldset disabled={ocupada} className="min-w-0 space-y-4">
            <legend className="sr-only">Editar actividades del borrador</legend>
            {items.map((item, indice) => <TarjetaBorrador key={indice} item={item} indice={indice} materias={materias} cambiar={(cambios) => cambiarItem(indice, cambios)} />)}
          </fieldset>
          {incluidos.length === 0 && <p className="text-sm text-[#657360]">{items.length ? 'Todas las actividades están omitidas. No se enviará ninguna a guardar.' : 'No hay actividades para confirmar. Puedes editar el texto e intentar de nuevo.'}</p>}
          {pendientes && <p className="text-xs font-medium text-[#A34955]">Completa los datos pendientes señalados en las tarjetas o marca Omitir.</p>}
          <button type="button" className={principal} disabled={ocupada || pendientes || incluidos.length === 0 || incluidos.length > 20} onClick={() => void confirmar()}>
            {enviando === 'confirmar' ? 'Guardando…' : 'Confirmar todo'}
          </button>
          <button type="button" className={botonCaptura} disabled={ocupada} onClick={() => {
            establecerBorrador(null); establecerItems([]); establecerError(null); establecerArchivo(null); establecerLectura(null);
          }}>{archivo ? 'Subir otro archivo o escribir' : 'Editar texto original'}</button>
        </section>
      )}
      {ocupada && <p role="status" className="text-sm text-[#35695D]">{enviando === 'extraer' ? 'Preparando tu borrador… (una foto o PDF tarda unos 10 segundos)' : 'Guardando tus actividades…'}</p>}
      {error && <p role="alert" className="whitespace-pre-wrap break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] p-4 text-sm text-[#A34955]">{error}</p>}
    </div>
  );
}

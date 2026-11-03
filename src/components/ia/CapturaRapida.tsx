'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfiguracionPeriodo from '../periodos/ConfiguracionPeriodo';
import { usePeriodos } from '../periodos/ProveedorPeriodos';
import { esPeriodoActual, type PeriodoAcademico } from '../periodos/periodosFrontend';
import TarjetaBorrador, { botonCaptura } from './TarjetaBorrador';
import BorradorHorario, { contarClases } from './BorradorHorario';
import {
  actualizarRevision, aplicarPeriodoARevision, construirConfirmacion, crearRevision, leerBorrador, leerMaterias, leerResultado,
  aplicarRevisionCalculada, construirSolicitudRevision, leerRevisionCalculada, mensajeBackend, problemasItem,
  type Borrador, type ItemRevision, type MateriaUsuario, type ResultadoConfirmacion,
} from './borradorCaptura';
import { avisarAgendaActualizada } from '../calendario/actualizacionAgenda';
import { leerDocumento, prepararArchivo, type DocumentoLeido } from './capturaArchivo';
import { useDictado } from './useDictado';

/** Evento que avisa a la barra (Calendario) cuántas cosas se acaban de agregar. */
export const ORBIT_AGREGADO = 'orbit:agregado';

const principal = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#234F45] px-4 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#316457] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const herramienta = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#CEDFD5] bg-white px-3 text-sm font-medium text-[#35695D] transition-colors hover:bg-[#EDF4E8] focus-within:ring-2 focus-within:ring-[#28746B]';

/** Ejemplos reales: el placeholder se escribe solo y las sugerencias se pueden tocar. */
const EJEMPLOS = [
  'examen de redes el miércoles',
  'tenis martes y jueves a las 18:00',
  'pega aquí lo que te mandaron por WhatsApp',
  'reunión de grupo mañana a las 4',
];
const SUGERENCIAS = [
  'Examen teórico de Redes el siguiente miércoles',
  'Entregar informe de Datos el viernes y reunión de grupo mañana a las 16:00',
];
const PASOS_ARCHIVO = ['Preparando tu archivo', 'Leyendo la imagen', 'Revisándola otra vez para no equivocarme', 'Armando tu borrador'];

async function consultar(url: string, body?: unknown): Promise<unknown> {
  const respuesta = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeBackend(datos, 'No se pudo completar la solicitud. Intenta de nuevo.'));
  return datos;
}

type Exito = { resultado: ResultadoConfirmacion | null; excluidos: string[]; periodoCreado: string | null };

export default function CapturaRapida({ tituloId, ocupado: bloqueado = false, onOcupadoChange, onCerrar }: {
  tituloId?: string;
  ocupado?: boolean;
  onOcupadoChange: (ocupado: boolean) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { datos: datosPeriodos, guardando: guardandoPeriodo, recargar: recargarPeriodos } = usePeriodos();
  const [texto, establecerTexto] = useState('');
  const [periodoAplicado, establecerPeriodoAplicado] = useState<string | null>(null);
  const periodoEnCurso = useRef(false);
  const [borrador, establecerBorrador] = useState<Borrador | null>(null);
  const [items, establecerItems] = useState<ItemRevision[]>([]);
  const [corregida, establecerCorregida] = useState(false);
  const [enviando, establecerEnviando] = useState<'extraer' | 'revisar' | 'confirmar' | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [estadoRevision, establecerEstadoRevision] = useState<string | null>(null);
  const [exito, establecerExito] = useState<Exito | null>(null);
  const [materias, establecerMaterias] = useState<MateriaUsuario[]>([]);
  const [errorMaterias, establecerErrorMaterias] = useState<string | null>(null);
  const [cargandoMaterias, establecerCargandoMaterias] = useState(false);
  // Foto, captura de pantalla o PDF
  const [archivo, establecerArchivo] = useState<string | null>(null);
  const [documento, establecerDocumento] = useState<DocumentoLeido | null>(null);
  const [vistaPrevia, establecerVistaPrevia] = useState<string | null>(null);
  const [pasoLectura, establecerPasoLectura] = useState(0);
  const [placeholder, establecerPlaceholder] = useState('');
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const enCurso = useRef(false);
  const materiasEnCurso = useRef(false);
  const tituloResultado = useRef<HTMLHeadingElement>(null);

  const dictado = useDictado((dicho) => establecerTexto((t) => (t.trim() ? t.trim() + ' ' : '') + dicho));

  useEffect(() => { if (exito) tituloResultado.current?.focus(); }, [exito]);

  // Placeholder que se escribe y se borra solo con ejemplos (se detiene al escribir)
  useEffect(() => {
    if (texto || borrador || exito || enviando) return;
    let frase = 0, letras = 0, borrando = false;
    let temporizador: ReturnType<typeof setTimeout>;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      temporizador = setTimeout(() => establecerPlaceholder('Ej. ' + EJEMPLOS[0]), 0);
      return () => clearTimeout(temporizador);
    }
    const paso = () => {
      const actual = EJEMPLOS[frase];
      letras += borrando ? -1 : 1;
      establecerPlaceholder('Ej. ' + actual.slice(0, letras));
      let espera = borrando ? 22 : 48;
      if (!borrando && letras === actual.length) { borrando = true; espera = 1600; }
      else if (borrando && letras === 0) { borrando = false; frase = (frase + 1) % EJEMPLOS.length; espera = 350; }
      temporizador = setTimeout(paso, espera);
    };
    temporizador = setTimeout(paso, 400);
    return () => clearTimeout(temporizador);
  }, [texto, borrador, exito, enviando]);

  // Pasos de la lectura de un archivo: avanzan mientras el servidor trabaja (el último espera la respuesta)
  useEffect(() => {
    if (enviando !== 'extraer' || !archivo || pasoLectura < 1) return;
    const t1 = setTimeout(() => establecerPasoLectura((p) => Math.max(p, 2)), 3500);
    const t2 = setTimeout(() => establecerPasoLectura((p) => Math.max(p, 3)), 7500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [enviando, archivo, pasoLectura]);

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

  function empezar() {
    enCurso.current = true;
    establecerEnviando('extraer');
    onOcupadoChange(true);
    establecerError(null);
    establecerExito(null);
    // La carga de materias no impide revisar el borrador si ese GET falla.
    void cargarMaterias();
  }
  function terminar() {
    enCurso.current = false;
    establecerEnviando(null);
    onOcupadoChange(false);
  }
  function mostrarBorrador(nuevo: Borrador) {
    establecerBorrador(nuevo);
    establecerItems(nuevo.items.map(crearRevision));
    establecerEstadoRevision(null);
    establecerCorregida(false);
    establecerPeriodoAplicado(null);
  }

  async function extraer(desde?: string) {
    const contenido = (desde ?? texto).trim();
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    if (!contenido || contenido.length > 2000) {
      establecerError('Escribe algo (hasta 2000 caracteres).');
      return;
    }
    if (desde !== undefined) establecerTexto(desde);
    empezar();
    try {
      const nuevo = leerBorrador(await consultar('/api/ia/extraer', { texto: contenido }));
      establecerArchivo(null);
      establecerDocumento(null);
      mostrarBorrador(nuevo);
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    } finally {
      terminar();
    }
  }

  /** Foto, captura o PDF → mismo borrador que el texto (revisar y confirmar no cambian). */
  async function extraerArchivo(seleccionado: File) {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    establecerArchivo(seleccionado.name);
    establecerVistaPrevia(null);
    establecerPasoLectura(0);
    empezar();
    try {
      const { imagenes, textoAdjunto, paginasOmitidas } = await prepararArchivo(seleccionado);
      establecerVistaPrevia(imagenes[0] ?? null);
      establecerPasoLectura(1);
      const datos = await consultar('/api/ia/extraer-imagen', { imagenes, textoAdjunto });
      const nuevo = leerBorrador(datos);
      if (paginasOmitidas > 0) nuevo.advertencias.unshift(`Solo leí las primeras ${imagenes.length} páginas del PDF.`);
      establecerDocumento(leerDocumento(datos));
      mostrarBorrador(nuevo);
    } catch (error) {
      establecerArchivo(null);
      establecerError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      terminar();
      if (entradaArchivo.current) entradaArchivo.current.value = ''; // permite elegir el mismo archivo otra vez
    }
  }

  function cambiarItem(indice: number, cambios: Partial<ItemRevision>) {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo) return;
    establecerItems((actuales) => actualizarRevision(actuales, indice, cambios));
    establecerEstadoRevision(null);
    establecerCorregida(true);
    establecerError(null);
  }

  async function revisarCambios() {
    if (enCurso.current || periodoEnCurso.current || guardandoPeriodo || !borrador) return;
    enCurso.current = true;
    establecerEnviando('revisar');
    onOcupadoChange(true);
    establecerError(null);
    establecerEstadoRevision(null);
    try {
      const { indices, body } = construirSolicitudRevision(items);
      const datos = await consultar('/api/ia/revisar', body);
      const resultados = leerRevisionCalculada(datos, indices.length);
      establecerItems((actuales) => aplicarRevisionCalculada(actuales, indices, resultados));
      const errores = resultados.flatMap((resultado) => 'error' in resultado
        ? ['Actividad ' + (indices[resultado.indice] + 1) + ': ' + resultado.error] : []);
      establecerEstadoRevision(errores.length === resultados.length
        ? 'No se pudieron revisar las actividades. Completa los datos indicados y vuelve a intentar.'
        : errores.length
        ? 'Se actualizaron los avisos de las actividades que se pudieron revisar.'
        : 'Duplicados y choques actualizados.');
      if (errores.length) establecerError(errores.join('\n'));
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo revisar el borrador. Tus cambios se conservaron.');
    } finally {
      terminar();
    }
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
      const periodoCreado = (datos as { periodoCreado?: { nombre?: string } | null } | null)?.periodoCreado?.nombre ?? null;
      establecerExito({ resultado, excluidos: items.filter((i) => i.excluido).map((i) => i.titulo), periodoCreado });
      if (resultado) {
        const { tareas, eventos, clases } = resultado.creados;
        window.dispatchEvent(new CustomEvent(ORBIT_AGREGADO, { detail: { cantidad: tareas.length + eventos.length + clases.length } }));
      }
      establecerBorrador(null);
      establecerItems([]);
      establecerTexto('');
      establecerArchivo(null);
      establecerDocumento(null);
      establecerCorregida(false);
      avisarAgendaActualizada();
      void recargarPeriodos();
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor. Se conservó el borrador.');
    } finally {
      terminar();
    }
  }

  function aplicarPeriodo(periodo: PeriodoAcademico) {
    if (!esPeriodoActual(periodo)) return;
    establecerItems((actuales) => aplicarPeriodoARevision(actuales, periodo));
    establecerEstadoRevision(null);
    establecerBorrador((actual) => actual ? {
      ...actual, periodo: { nombre: periodo.nombre, inicio: periodo.inicio, fin: periodo.fin },
    } : null);
    establecerCorregida(true);
    establecerPeriodoAplicado(periodo.nombre);
  }

  function volverAEscribir() {
    establecerBorrador(null); establecerItems([]); establecerError(null);
    establecerArchivo(null); establecerDocumento(null); establecerExito(null);
    setTimeout(() => campoTexto.current?.focus(), 50);
  }

  const faltaPeriodo = items.some((item) => !item.excluido && item.clase === 'evento_fijo' &&
    item.original.faltantes.includes('periodo') && !item.original.vigencia);
  const incluidos = items.filter((i) => !i.excluido);
  const pendientes = incluidos.some((i) => problemasItem(i).length > 0);
  const ocupada = enviando !== null || guardandoPeriodo;
  const esHorario = !!borrador && documento?.tipo === 'horario' && items.some((i) => i.clase === 'evento_fijo');
  const leyendo = enviando === 'extraer';
  const clasesHorario = esHorario ? contarClases(items) : 0;
  const materiasHorario = esHorario
    ? new Set(incluidos.filter((i) => i.clase === 'evento_fijo').map((i) => i.original.codigoMateria ?? i.titulo)).size : 0;

  // Encabezado según el momento
  const [titulo, subtitulo] = exito ? ['Listo', 'Ya está en tu semana.']
    : leyendo && archivo ? ['Leyendo tu archivo', 'Unos segundos. La imagen no se guarda.']
    : leyendo ? ['Ordenando lo que escribiste', 'Un momento…']
    : esHorario ? ['Así queda tu semana', `${clasesHorario} clases · ${materiasHorario} materias · toca una para verla`]
    : borrador ? ['Revisa antes de guardar', 'Corrige lo que haga falta. Nada se guarda hasta que confirmes.']
    : ['¿Qué tienes en mente?', 'Escríbelo como se lo dirías a un amigo. Yo lo ordeno.'];

  return (
    <div className="min-w-0 space-y-4" aria-busy={ocupada}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={tituloId} className="text-xl font-semibold tracking-[-0.02em] text-[#233E33]">{titulo}</h2>
          <p className="mt-1 text-xs text-[#647168]">{subtitulo}</p>
        </div>
        <button type="button" disabled={bloqueado} onClick={onCerrar}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium text-[#35695D] hover:bg-[#E9EEE5] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">
          Cerrar
        </button>
      </header>

      {exito ? (
        /* ── Listo ── */
        <section className="orbit-aparece flex flex-col items-center gap-2 py-2 text-center">
          <span className="orbit-pop grid h-16 w-16 place-items-center rounded-full bg-[#1F5D50]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="orbit-traza" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h3 ref={tituloResultado} tabIndex={-1} className="mt-1 text-lg font-semibold text-[#233E33] focus:outline-none">
            {exito.resultado ? resumenGuardado(exito.resultado) : 'Guardado'}
          </h3>
          {!exito.resultado && <p className="text-sm text-[#647168]">Se guardó, pero no pude leer el resumen. Revisa tu agenda antes de volver a agregarlo.</p>}
          {exito.resultado && exito.resultado.creados.materias.length > 0 && (
            <p className="text-sm text-[#647168]">Materias nuevas: {exito.resultado.creados.materias.map((m) => m.nombre).join(', ')}.</p>
          )}
          {exito.periodoCreado && <p className="text-sm text-[#647168]">Creé tu semestre {exito.periodoCreado}.</p>}
          {exito.resultado && exito.resultado.omitidos.length > 0 && (
            <ul className="mt-1 space-y-1 rounded-xl bg-[#FCF2DE] p-3 text-left text-xs text-[#916820]">
              {exito.resultado.omitidos.map((o, i) => <li key={i}>No agregué «{o.titulo}»: {o.motivo}</li>)}
            </ul>
          )}
          <div className="mt-3 flex w-full flex-wrap justify-center gap-2">
            <button type="button" className={botonCaptura + ' px-4'} onClick={volverAEscribir}>Agregar otra cosa</button>
            <button type="button" className={principal} onClick={() => { onCerrar(); router.push('/semana'); }}>Ver mi semana</button>
          </div>
        </section>
      ) : leyendo ? (
        /* ── Leyendo ── */
        archivo ? (
          <section className="orbit-aparece grid grid-cols-[7.5rem_1fr] items-center gap-5 py-2">
            <div className="orbit-papel relative aspect-[3/4] -rotate-3 overflow-hidden rounded-md bg-white shadow-[0_10px_24px_-12px_rgba(20,46,39,.5)]">
              {vistaPrevia
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={vistaPrevia} alt="" className="h-full w-full object-cover object-top" />
                : <div className="h-full w-full animate-pulse bg-[#EDF4E8]" />}
              <span className={pasoLectura >= 2 ? 'orbit-scan-h' : 'orbit-scan-v'} aria-hidden="true" />
            </div>
            <ol className="space-y-3" aria-live="polite">
              {PASOS_ARCHIVO.map((paso, i) => {
                const estado = i < pasoLectura ? 'hecho' : i === pasoLectura ? 'activo' : 'pendiente';
                return <li key={paso} className={'flex items-center gap-2.5 text-sm transition-colors ' + (estado === 'pendiente' ? 'text-[#9AA59D]' : 'text-[#263D34]') + (estado === 'activo' ? ' font-medium' : '')}>
                  <span aria-hidden="true" className={'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ' +
                    (estado === 'hecho' ? 'border-[#1F5D50] bg-[#1F5D50]' : estado === 'activo' ? 'orbit-gira border-[#234F45] border-r-transparent' : 'border-[#CEDFD5]')}>
                    {estado === 'hecho' && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </span>
                  {paso}
                </li>;
              })}
            </ol>
          </section>
        ) : (
          <section className="orbit-aparece flex items-center gap-3 rounded-2xl bg-[#EDF4E8] p-4" aria-live="polite">
            <span aria-hidden="true" className="orbit-gira h-5 w-5 shrink-0 rounded-full border-2 border-[#234F45] border-r-transparent" />
            <p className="min-w-0 text-sm text-[#526A5A]">“{texto.trim().slice(0, 140)}{texto.trim().length > 140 ? '…' : ''}”</p>
          </section>
        )
      ) : !borrador ? (
        /* ── Escribir ── */
        <form noValidate className="orbit-aparece space-y-3" onSubmit={(evento) => { evento.preventDefault(); void extraer(); }}>
          <fieldset disabled={ocupada} className="min-w-0 space-y-3">
            <legend className="sr-only">Agregar con Orbit</legend>
            <div className="rounded-2xl border border-[#CEDFD5] bg-white px-3.5 py-3 transition-shadow focus-within:border-[#28746B] focus-within:shadow-[0_0_0_4px_rgba(40,116,107,.14)]">
              <label htmlFor={(tituloId ?? 'orbit') + '-texto'} className="sr-only">¿Qué tienes en mente?</label>
              <textarea ref={campoTexto} id={(tituloId ?? 'orbit') + '-texto'} rows={3} value={texto} maxLength={2000} autoFocus
                onChange={(e) => establecerTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void extraer(); } }}
                placeholder={placeholder}
                className="block min-h-[4.5rem] w-full resize-none bg-transparent text-base leading-relaxed text-[#263D34] outline-none placeholder:text-[#9AA59D]" />
            </div>

            {!texto.trim() && <div className="space-y-2">
              <p className="text-xs font-semibold text-[#647168]">Prueba con</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map((s, i) => <button key={s} type="button" onClick={() => void extraer(s)} style={{ ['--i' as string]: i }}
                  className="orbit-aparece rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-left text-xs text-[#263D34] transition-[border-color,transform] hover:-translate-y-px hover:border-[#35695D]">{s}</button>)}
                <button type="button" onClick={() => entradaArchivo.current?.click()} style={{ ['--i' as string]: SUGERENCIAS.length }}
                  className="orbit-aparece rounded-xl border border-dashed border-[#93B4A5] bg-[#EDF4E8] px-3 py-2 text-left text-xs font-semibold text-[#35695D] transition-transform hover:-translate-y-px">
                  Tu horario del SIAAN en PDF o foto
                </button>
              </div>
            </div>}

            <div className="flex items-center gap-2 border-t border-[#E4E8DF] pt-3">
              <label className={herramienta + ' cursor-pointer'} title="Horario, afiche o captura de chat">
                <input ref={entradaArchivo} type="file" accept="image/*,application/pdf" className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void extraerArchivo(f); }} />
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                Foto o PDF
              </label>
              {dictado.disponible && (
                <button type="button" onClick={dictado.alternar} aria-pressed={dictado.escuchando}
                  aria-label={dictado.escuchando ? 'Dejar de dictar' : 'Dictar'}
                  className={herramienta + ' w-11 px-0 ' + (dictado.escuchando ? 'border-[#A34955] text-[#A34955]' : '')}>
                  <svg viewBox="0 0 24 24" className={'h-[18px] w-[18px] ' + (dictado.escuchando ? 'animate-pulse' : '')} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </button>
              )}
              <button type="submit" className={principal + ' ml-auto'} disabled={!texto.trim()}>Agregar</button>
            </div>
            {dictado.escuchando && <p role="status" className="text-xs text-[#A34955]">Te escucho… habla y toca el micrófono para terminar.</p>}
          </fieldset>
        </form>
      ) : (
        /* ── Borrador ── */
        <section className="min-w-0 space-y-4">
          {periodoAplicado && <p role="status" className="rounded-xl bg-[#E7F8EF] p-3 text-xs text-[#1F5D50]">Semestre {periodoAplicado} aplicado a las clases. Se conservaron las fechas que editaste.</p>}
          {faltaPeriodo && <fieldset disabled={enviando !== null} className="min-w-0">
            <legend className="sr-only">Semestre de las clases</legend>
            {datosPeriodos?.actual ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EDF4E8] p-3 text-xs text-[#526A5A]">
              <p>¿Estas clases son del semestre {datosPeriodos.actual.nombre}?</p>
              <button type="button" className={botonCaptura} disabled={ocupada} onClick={() => aplicarPeriodo(datosPeriodos.actual!)}>Sí, usarlo</button>
            </div> : <ConfiguracionPeriodo origen="ia" onCreado={aplicarPeriodo} onOcupadoChange={(ocupado) => {
              periodoEnCurso.current = ocupado;
              onOcupadoChange(ocupado);
            }} />}
          </fieldset>}

          {borrador.advertencias.length > 0 && <ul className="space-y-1 rounded-xl bg-[#FCF2DE] p-3 text-xs text-[#916820]">
            {borrador.advertencias.map((mensaje, indice) => <li key={indice}>{mensaje}</li>)}
          </ul>}
          {cargandoMaterias && <p role="status" className="text-xs text-[#657360]">Cargando tus materias…</p>}
          {errorMaterias && <div className="space-y-2 rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3 text-xs text-[#916820]">
            <p role="alert">Materias: {errorMaterias}</p>
            <button type="button" disabled={ocupada || cargandoMaterias} className={botonCaptura} onClick={() => void cargarMaterias()}>Volver a cargar materias</button>
          </div>}

          <fieldset disabled={ocupada} className="min-w-0 space-y-4">
            <legend className="sr-only">Revisar lo que se va a agregar</legend>
            {esHorario && documento
              ? <BorradorHorario items={items} materias={materias} documento={documento} cambiar={cambiarItem} />
              : items.map((item, indice) => <div key={indice} className="orbit-aparece" style={{ ['--i' as string]: indice }}>
                <TarjetaBorrador item={item} indice={indice} materias={materias} cambiar={(cambios) => cambiarItem(indice, cambios)} />
              </div>)}
          </fieldset>

          {incluidos.length === 0 && <p className="text-sm text-[#657360]">{items.length ? 'Quitaste todo: no hay nada que agregar.' : 'No encontré nada que agregar. Prueba escribiéndolo de otra forma.'}</p>}
          {pendientes && <p className="text-xs font-medium text-[#A34955]">Completa lo marcado o quítalo para continuar.</p>}
          {corregida && <button type="button" className="min-h-9 text-xs font-semibold text-[#35695D] underline-offset-4 hover:underline" disabled={ocupada || incluidos.length === 0 || incluidos.length > 20} onClick={() => void revisarCambios()}>
            {enviando === 'revisar' ? 'Revisando…' : 'Volver a revisar duplicados y choques'}
          </button>}
          {estadoRevision && <p role="status" className="text-xs text-[#526A5A]">{estadoRevision}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={botonCaptura + ' px-4'} disabled={ocupada} onClick={volverAEscribir}>
              {archivo ? 'Otro archivo' : 'Volver'}
            </button>
            <button type="button" className={principal + ' flex-1'} disabled={ocupada || pendientes || incluidos.length === 0 || incluidos.length > 20} onClick={() => void confirmar()}>
              {enviando === 'confirmar' ? 'Guardando…' : esHorario ? 'Agregar mi horario' : incluidos.length > 1 ? `Agregar ${incluidos.length}` : 'Agregar'}
            </button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="whitespace-pre-wrap break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] p-4 text-sm text-[#A34955]">{error}</p>}
    </div>
  );
}

/** "Agregué 14 clases" · "Agregué 1 tarea y 1 evento" */
function resumenGuardado(r: ResultadoConfirmacion) {
  const conteos: [number, string, string][] = [
    [r.creados.clases.length, 'clase', 'clases'],
    [r.creados.tareas.length, 'tarea', 'tareas'],
    [r.creados.eventos.length, 'evento', 'eventos'],
  ];
  const partes = conteos.filter(([n]) => n > 0).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
  if (!partes.length) return 'No había nada nuevo que agregar';
  return 'Agregué ' + (partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]);
}

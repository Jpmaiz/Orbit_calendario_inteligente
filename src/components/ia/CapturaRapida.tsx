'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmarDuplicado, fechaElegidaISO, fechaRapida, peticionDe, resolverRespuesta, solicitudConFecha } from './flujoCaptura';
import type { Paso, Solicitud } from './flujoCaptura';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const boton = 'min-h-11 max-w-full rounded-xl border border-[#CEDFD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#245B4C] transition-colors hover:bg-[#E7F2E9] disabled:cursor-wait disabled:opacity-60 ' + foco;
const principal = 'min-h-12 w-full rounded-xl bg-[#234F45] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#316457] disabled:cursor-wait disabled:opacity-60 ' + foco;
const campo = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-white px-3.5 py-3 text-base text-[#263D34] placeholder:text-[#687A6C] disabled:opacity-60 ' + foco;

export default function CapturaRapida({ onOcupadoChange, onCerrar }: {
  onOcupadoChange: (ocupado: boolean) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [texto, establecerTexto] = useState('');
  const [paso, establecerPaso] = useState<Paso>({ tipo: 'texto' });
  const [enviando, establecerEnviando] = useState(false);
  const [error, establecerError] = useState<{ mensaje: string; ofrecerManual: boolean } | null>(null);
  const [exito, establecerExito] = useState(false);
  const [elegirFecha, establecerElegirFecha] = useState(false);
  const [fecha, establecerFecha] = useState('');
  const [otroNombre, establecerOtroNombre] = useState(false);
  const [nombre, establecerNombre] = useState('');
  const enCurso = useRef(false);
  const pregunta = useRef<HTMLHeadingElement>(null);
  const entradaFecha = useRef<HTMLInputElement>(null);
  const entradaNombre = useRef<HTMLInputElement>(null);

  useEffect(() => { if (paso.tipo !== 'texto') pregunta.current?.focus(); }, [paso]);
  useEffect(() => { if (elegirFecha) entradaFecha.current?.focus(); }, [elegirFecha]);
  useEffect(() => { if (otroNombre) entradaNombre.current?.focus(); }, [otroNombre]);

  function editarTexto() {
    if (enCurso.current) return;
    establecerPaso({ tipo: 'texto' });
    establecerError(null);
    establecerExito(false);
    establecerElegirFecha(false);
    establecerOtroNombre(false);
  }

  async function enviar(solicitud: Solicitud) {
    if (enCurso.current) return;
    enCurso.current = true;
    establecerEnviando(true);
    onOcupadoChange(true);
    establecerError(null);
    establecerExito(false);
    try {
      const peticion = peticionDe(solicitud);
      const respuesta = await fetch(peticion.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(peticion.body),
      });
      const datos: unknown = respuesta.status === 201 ? null : await respuesta.json().catch(() => null);
      const resultado = resolverRespuesta(respuesta.status, datos, solicitud);
      if (resultado.tipo === 'creada') {
        establecerTexto('');
        establecerPaso({ tipo: 'texto' });
        establecerFecha('');
        establecerNombre('');
        establecerElegirFecha(false);
        establecerOtroNombre(false);
        establecerExito(true);
        router.refresh();
      } else if (resultado.tipo === 'error') {
        establecerError(resultado);
      } else {
        establecerPaso(resultado);
        establecerElegirFecha(false);
        establecerOtroNombre(false);
        establecerFecha('');
        establecerNombre('');
      }
    } catch {
      establecerError({ mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.', ofrecerManual: false });
    } finally {
      enCurso.current = false;
      establecerEnviando(false);
      onOcupadoChange(false);
    }
  }

  function guardarFecha(iso: string | null) {
    if (paso.tipo !== 'fecha' || enCurso.current) return;
    if (!iso) {
      establecerError({ mensaje: 'Elige una fecha y hora válidas.', ofrecerManual: false });
      return;
    }
    void enviar(solicitudConFecha(paso, iso));
  }

  function guardarDuplicado(titulo: string | null) {
    if (paso.tipo !== 'duplicado' || enCurso.current) return;
    if (titulo !== null && (!titulo.trim() || titulo.trim().length > 200)) {
      establecerOtroNombre(true);
      establecerNombre(titulo);
      establecerError({ mensaje: 'El título debe tener entre 1 y 200 caracteres.', ofrecerManual: false });
      return;
    }
    void enviar(confirmarDuplicado(paso, titulo === null ? null : titulo.trim()));
  }

  return (
    <div className="mt-5 min-w-0 space-y-4" aria-busy={enviando}>
      {paso.tipo === 'texto' ? (
        <form noValidate onSubmit={(evento) => {
          evento.preventDefault();
          if (enCurso.current) return;
          if (!texto.trim()) {
            establecerError({ mensaje: 'Escribe qué necesitas agregar.', ofrecerManual: false });
            return;
          }
          void enviar({ via: 'ia', texto, confirmarNueva: false, tituloFinal: null });
        }}>
          <fieldset disabled={enviando} className="min-w-0 space-y-4">
            <legend className="sr-only">Captura rápida de tareas</legend>
            <div>
              <label htmlFor={id + '-texto'} className="text-sm font-semibold">¿Qué necesitas agregar?</label>
              <textarea id={id + '-texto'} rows={3} value={texto} onChange={(evento) => { establecerTexto(evento.target.value); establecerExito(false); }} placeholder="Ej. examen de redes el miércoles" required aria-describedby={id + '-ayuda'} className={campo + ' block resize-y'} />
              <p id={id + '-ayuda'} className="mt-2 text-xs leading-5 text-[#647168]">Describe una tarea con tus palabras. Orbit puede tardar entre 1 y 4 segundos.</p>
            </div>
            <button type="submit" className={principal}>{enviando ? 'Procesando…' : 'Agregar con Orbit'}</button>
          </fieldset>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-[#EAF0E5] p-3 text-sm leading-6 text-[#526A5A]">{texto}</p>
          <h3 ref={pregunta} tabIndex={-1} id={id + '-pregunta'} className="whitespace-pre-wrap break-words rounded-sm text-base font-semibold leading-6 focus:outline-none">
            {paso.tipo === 'fecha' ? '¿Para cuándo es?' : paso.pregunta}
          </h3>
          <fieldset disabled={enviando} aria-labelledby={id + '-pregunta'} className="min-w-0 space-y-3">
            <legend className="sr-only">{paso.tipo === 'fecha' ? 'Elegir fecha' : 'Resolver posible duplicado'}</legend>
            {paso.tipo === 'fecha' ? (
              <>
                <p className="text-xs leading-5 text-[#647168]">Mañana y Viernes usan las 23:59, hora de Bolivia. Viernes es el próximo viernes. Para otra hora, elige una fecha.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => guardarFecha(fechaRapida('manana'))} className={boton}>Mañana</button>
                  <button type="button" onClick={() => guardarFecha(fechaRapida('viernes'))} className={boton}>Viernes</button>
                  <button type="button" onClick={() => establecerElegirFecha(true)} aria-expanded={elegirFecha} aria-controls={id + '-fecha-panel'} className={boton}>Elegir fecha</button>
                </div>
                {elegirFecha && (
                  <form id={id + '-fecha-panel'} noValidate onSubmit={(evento) => { evento.preventDefault(); guardarFecha(fechaElegidaISO(fecha)); }} className="space-y-3">
                    <div>
                      <label htmlFor={id + '-fecha'} className="text-sm font-medium">Fecha y hora de Bolivia</label>
                      <input ref={entradaFecha} id={id + '-fecha'} type="datetime-local" value={fecha} onChange={(evento) => establecerFecha(evento.target.value)} required className={campo} />
                    </div>
                    <button type="submit" className={principal}>Guardar tarea</button>
                  </form>
                )}
              </>
            ) : otroNombre ? (
              <form noValidate onSubmit={(evento) => { evento.preventDefault(); guardarDuplicado(nombre); }} className="space-y-3">
                <div>
                  <label htmlFor={id + '-nombre'} className="text-sm font-medium">Título diferente</label>
                  <input ref={entradaNombre} id={id + '-nombre'} type="text" value={nombre} onChange={(evento) => establecerNombre(evento.target.value)} maxLength={200} required className={campo} />
                </div>
                <button type="submit" className={principal}>Guardar con este título</button>
                <button type="button" onClick={() => { establecerOtroNombre(false); establecerError(null); }} className={boton}>Volver a las opciones</button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={boton} onClick={() => { editarTexto(); establecerTexto(''); onCerrar(); }}>Es la misma</button>
                {paso.sugerencias.map((opcion, indice) => (
                  <button key={indice} type="button" className={boton + ' break-words'} onClick={() => guardarDuplicado(paso.titulo + ' (' + opcion + ')')}>{opcion}</button>
                ))}
                <button type="button" className={boton} onClick={() => establecerOtroNombre(true)}>Otro nombre.</button>
                <button type="button" className={boton} onClick={() => guardarDuplicado(null)}>Guardar igual</button>
              </div>
            )}
            <button type="button" onClick={editarTexto} className={'min-h-11 rounded-lg px-2 text-sm font-medium text-[#35695D] underline underline-offset-4 disabled:opacity-60 ' + foco}>Editar texto original</button>
          </fieldset>
        </>
      )}
      {enviando && <p role="status" className="flex items-center gap-2 text-sm leading-6 text-[#35695D]"><span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#BCD2C3] border-t-[#35695D] motion-reduce:animate-none" />Procesando tu solicitud… Espera un momento.</p>}
      {exito && <p role="status" className="rounded-xl border border-[#C6E6D3] bg-[#E7F8EF] px-4 py-3 text-sm font-semibold text-[#1F5D50]">Tarea agregada</p>}
      {error && (
        <div className="space-y-3">
          <p role="alert" className="whitespace-pre-wrap break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">{error.mensaje}</p>
          {error.ofrecerManual && (
            <>
              <p className="text-sm leading-6 text-[#647168]">No pude interpretar el texto. ¿Quieres cargarla a mano?</p>
              <button type="button" disabled={enviando} className={boton} onClick={() => { onCerrar(); router.push('/dia/nueva'); }}>Crear manualmente</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

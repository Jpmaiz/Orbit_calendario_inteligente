'use client';

import { useId, useRef, useState } from 'react';
import { usePeriodos } from './ProveedorPeriodos';
import { esPeriodoActual, type PeriodoAcademico } from './periodosFrontend';

const boton = 'min-h-11 rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-xs font-semibold text-[#245B4C] hover:bg-[#E7F2E9] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const campo = 'mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-base text-[#263D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';

export default function ConfiguracionPeriodo({ origen = 'dashboard', onCreado, onOcupadoChange }: {
  origen?: 'dashboard' | 'ia';
  onCreado?: (periodo: PeriodoAcademico) => void;
  onOcupadoChange?: (ocupado: boolean) => void;
}) {
  const id = useId();
  const estado = usePeriodos();
  const [nombre, establecerNombre] = useState('');
  const [inicio, establecerInicio] = useState('');
  const [fin, establecerFin] = useState('');
  const [error, establecerError] = useState<string | null>(null);
  const [guardado, establecerGuardado] = useState<PeriodoAcademico | null>(null);
  const [resumenCerrado, establecerResumenCerrado] = useState(false);
  const enviando = useRef(false);
  const abierto = estado.formulario === origen;

  async function guardar() {
    if (enviando.current || estado.guardando) return;
    enviando.current = true;
    onOcupadoChange?.(true);
    establecerError(null);
    try {
      const periodo = await estado.guardar({ nombre, inicio, fin });
      establecerGuardado(periodo);
      establecerResumenCerrado(false);
      onCreado?.(periodo);
    } catch (error) {
      establecerError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    } finally {
      enviando.current = false;
      onOcupadoChange?.(false);
    }
  }

  if (guardado && !resumenCerrado) return <aside className="mb-5 rounded-xl border border-[#C6E6D3] bg-[#E7F8EF] p-3 text-sm text-[#1F5D50]">
    <p role="status">Período {guardado.nombre} guardado.{!esPeriodoActual(guardado) && ' Sus fechas no incluyen hoy; aún no hay un período actual nuevo.'}</p>
    <button type="button" className={boton + ' mt-2'} onClick={() => establecerResumenCerrado(true)}>Cerrar</button>
  </aside>;

  if (estado.datos?.actual) return null;
  if (!abierto && estado.pospuesto) {
    return origen === 'ia' ? <button type="button" className={boton} disabled={estado.guardando}
      onClick={() => estado.abrir(origen)}>Configurar semestre (opcional)</button> : null;
  }
  if (estado.cargando && !estado.datos) return null;
  if (!estado.datos) return estado.errorConsulta ? <aside className="mb-5 rounded-xl border border-[#E3E8DE] bg-[#FAFBF7] p-3 text-xs text-[#657360]">
    <p role="alert">{estado.errorConsulta}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={boton} disabled={estado.cargando} onClick={() => void estado.recargar()}>Reintentar</button>
      <button type="button" className={boton} onClick={estado.posponer}>Ahora no</button>
    </div>
  </aside> : null;

  return <aside aria-labelledby={id + '-titulo'} className="mb-5 min-w-0 rounded-[20px] border border-[#DCE5D5] bg-[#EDF4E8] p-4 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 id={id + '-titulo'} className="text-sm font-semibold text-[#2C4236]">¿Cuándo termina tu semestre?</h2>
      <button type="button" className={boton} disabled={estado.guardando} onClick={estado.posponer}>No sé todavía</button>
    </div>
    <p className="mt-2 text-xs leading-5 text-[#657360]">Configura las fechas para dar vigencia a tus clases. Puedes hacerlo después.</p>
    {!abierto ? <button type="button" className={boton + ' mt-3'} disabled={estado.guardando} onClick={() => estado.abrir(origen)}>Configurar semestre</button> : (
      <form noValidate className="mt-4 space-y-3" aria-busy={estado.guardando} onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <fieldset disabled={estado.guardando} className="min-w-0 space-y-3">
          <legend className="sr-only">Configurar período académico</legend>
          <div>
            <label htmlFor={id + '-nombre'} className="text-xs font-semibold">Nombre del período</label>
            <input id={id + '-nombre'} value={nombre} onChange={(e) => establecerNombre(e.target.value)} maxLength={50} placeholder="Ej. II/2026" required className={campo} />
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor={id + '-inicio'} className="text-xs font-semibold">Fecha de inicio</label>
              <input id={id + '-inicio'} type="date" value={inicio} onChange={(e) => establecerInicio(e.target.value)} required className={campo} />
            </div>
            <div className="min-w-0">
              <label htmlFor={id + '-fin'} className="text-xs font-semibold">Fecha de fin</label>
              <input id={id + '-fin'} type="date" value={fin} onChange={(e) => establecerFin(e.target.value)} required className={campo} />
            </div>
          </div>
          <p className="text-xs leading-5 text-[#657360]">Necesitamos ambas fechas. Si aún no las conoces, puedes posponer la configuración.</p>
          <button type="submit" className="min-h-11 w-full rounded-xl bg-[#234F45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#316457] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">
            {estado.guardando ? 'Guardando…' : 'Guardar período'}
          </button>
        </fieldset>
        {estado.guardando && <p role="status" className="text-xs text-[#35695D]">Guardando tu período…</p>}
        {error && <p role="alert" className="whitespace-pre-wrap rounded-xl border border-[#EED4D7] bg-[#FCF0F1] p-3 text-sm text-[#A34955]">{error}</p>}
      </form>
    )}
  </aside>;
}

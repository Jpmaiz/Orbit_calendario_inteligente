'use client';

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { activarAvisos, avisosActivos, avisosDisponibles, desactivarAvisos, probarAvisos } from '@/lib/pwa/avisos';
import { esIPhone, estaInstalada, suscribirInstalacion } from '../pwa/instalacion';
import NecesitasInternet from '../pwa/NecesitasInternet';
import { useEnLinea } from '../pwa/useEnLinea';
import { mensajeError } from '../pwa/errorRed';
import { guardarPreferencia, leerAvisos, type PreferenciasAvisos } from './contratoAvisos';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const nada = () => () => {};

/** Interruptor accesible (role="switch"): toda la fila es el área de toque. */
function Interruptor({ titulo, detalle, activo, alCambiar, deshabilitado = false, principal = false }: {
  titulo: string; detalle?: string; activo: boolean; alCambiar: () => void; deshabilitado?: boolean; principal?: boolean;
}) {
  return <button type="button" role="switch" aria-checked={activo} disabled={deshabilitado} onClick={alCambiar}
    className={'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors disabled:opacity-55 ' + foco + ' ' +
      (principal ? (activo ? 'bg-[#E3EEE6]' : 'bg-[#F3F5F0]') : 'hover:bg-[#F6F8F3]')}>
    <span className="min-w-0 flex-1">
      <span className={'block leading-snug ' + (principal ? 'text-[15px] font-bold' : 'text-[14.5px] font-semibold')}>{titulo}</span>
      {detalle && <span className="mt-0.5 block text-[12.5px] leading-snug text-[#647168]">{detalle}</span>}
    </span>
    <span aria-hidden="true" className={'relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 ' + (activo ? 'bg-[#35695D]' : 'bg-[#CBD3CC]')}>
      <span className={'absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200 motion-reduce:transition-none ' + (activo ? 'left-[21px]' : 'left-[3px]')} />
    </span>
  </button>;
}

type Carga = { configurado: boolean; activo: boolean; preferencias: PreferenciasAvisos };

/**
 * «Avisos» en el perfil (v2.16): interruptor del dispositivo, «Antes de estudiar», «La noche antes» y «Probar».
 * Si el back no tiene avisos configurados, la sección no aparece.
 */
export default function Avisos({ style }: { style?: CSSProperties }) {
  const enLinea = useEnLinea();
  const disponible = useSyncExternalStore(nada, avisosDisponibles, () => false);
  const iphone = useSyncExternalStore(nada, esIPhone, () => false);
  const instalada = useSyncExternalStore(suscribirInstalacion, estaInstalada, () => false);
  const bloqueado = useSyncExternalStore(nada, () => typeof Notification !== 'undefined' && Notification.permission === 'denied', () => false);
  const [carga, establecerCarga] = useState<Carga | null>(null);
  const [cambiando, establecerCambiando] = useState(false);
  const [mensaje, establecerMensaje] = useState<string | null>(null);
  const [prueba, establecerPrueba] = useState<'nada' | 'enviando' | 'enviada'>('nada');

  useEffect(() => {
    const abortar = new AbortController();
    Promise.all([leerAvisos(abortar.signal), avisosActivos()])
      .then(([d, activo]) => { if (!abortar.signal.aborted) establecerCarga({ configurado: d.configurado, activo, preferencias: d.preferencias }); })
      .catch(() => {}); // sin red o sin back: la sección no aparece
    return () => abortar.abort();
  }, []);

  function alternarPrincipal() {
    if (!carga || cambiando) return;
    establecerMensaje(null);
    if (!carga.activo) {
      // iPhone: activarAvisos() va PRIMERO en el toque, sin await antes, o iOS no muestra el permiso.
      const resultado = activarAvisos();
      establecerCambiando(true);
      void resultado.then((r) => {
        if (r.ok) establecerCarga((c) => c && { ...c, activo: true });
        else establecerMensaje(r.mensaje);
      }, (e: unknown) => establecerMensaje(mensajeError(e, 'No se pudieron activar los avisos.')))
        .finally(() => establecerCambiando(false));
      return;
    }
    establecerCambiando(true);
    void desactivarAvisos()
      .then((r) => {
        if (r.ok) establecerCarga((c) => c && { ...c, activo: false });
        else establecerMensaje(r.mensaje);
      }, (e: unknown) => establecerMensaje(mensajeError(e, 'No se pudieron apagar los avisos.')))
      .finally(() => establecerCambiando(false));
  }

  /** Se ve al instante; si el PATCH falla, vuelve atrás. */
  function alternar(clave: keyof PreferenciasAvisos) {
    if (!carga) return;
    const valor = !carga.preferencias[clave];
    establecerMensaje(null);
    establecerCarga((c) => c && { ...c, preferencias: { ...c.preferencias, [clave]: valor } });
    guardarPreferencia({ [clave]: valor }).catch((e: unknown) => {
      establecerCarga((c) => c && { ...c, preferencias: { ...c.preferencias, [clave]: !valor } });
      establecerMensaje(mensajeError(e, 'No pude guardar el cambio.'));
    });
  }

  async function probar() {
    establecerPrueba('enviando');
    establecerMensaje(null);
    try {
      const r = await probarAvisos();
      if (!r.ok) { establecerPrueba('nada'); establecerMensaje(r.mensaje); return; }
      establecerPrueba('enviada');
      setTimeout(() => establecerPrueba('nada'), 4000);
    } catch (e) {
      establecerPrueba('nada');
      establecerMensaje(mensajeError(e, 'No se pudo enviar la prueba.'));
    }
  }

  // Sin back configurado o en un navegador sin avisos: nada. En iPhone sin instalar, la nota para instalar.
  if (!carga?.configurado || (!disponible && !(iphone && !instalada))) return null;

  return <section aria-labelledby="perfil-avisos" style={style}
    className="orbit-aparece col-span-2 flex flex-col gap-2.5 rounded-[28px] bg-white p-[18px] shadow-[inset_0_0_0_1px_#E3E8DE]">
    <div className="flex items-baseline justify-between gap-2 px-0.5">
      <h2 id="perfil-avisos" className="text-base font-bold">Avisos</h2>
      {carga.activo && <span className="text-[12px] font-semibold text-[#35695D]">En este dispositivo</span>}
    </div>

    {!disponible
      ? <p className="rounded-2xl bg-[#F3F5F0] px-3.5 py-3 text-[13.5px] leading-snug text-[#4C5A51]">
        Para recibir avisos, primero instala Orbit en tu pantalla de inicio.
      </p>
      : bloqueado
        ? <p className="rounded-2xl bg-[#FCF2DE] px-3.5 py-3 text-[13.5px] leading-snug text-[#4A3810]">
          {iphone ? 'Los avisos están bloqueados. Actívalos en Configuración → Notificaciones → Orbit.' : 'Los avisos están bloqueados. Actívalos desde la configuración del sitio (el candado junto a la dirección).'}
        </p>
        : <>
          <Interruptor principal titulo="Avisos en este dispositivo" activo={carga.activo} deshabilitado={cambiando || !enLinea} alCambiar={alternarPrincipal}
            detalle={cambiando ? (carga.activo ? 'Apagando…' : 'Activando…') : undefined} />

          {carga.activo && <div className="orbit-aparece flex flex-col">
            <Interruptor titulo="Antes de estudiar" detalle="15 min antes de cada bloque de estudio" activo={carga.preferencias.bloques}
              deshabilitado={!enLinea} alCambiar={() => alternar('bloques')} />
            <Interruptor titulo="La noche antes" detalle="A las 20:00, si algo vence mañana" activo={carga.preferencias.manana}
              deshabilitado={!enLinea} alCambiar={() => alternar('manana')} />
            <div className="mt-1 flex items-center gap-3 px-3.5">
              <button type="button" onClick={() => void probar()} disabled={prueba === 'enviando' || !enLinea}
                className={'inline-flex min-h-11 items-center gap-2 rounded-full bg-[#F1F5EF] px-4 text-[13.5px] font-semibold text-[#35695D] hover:bg-[#E3EEE6] disabled:opacity-55 ' + foco}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5ZM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
                {prueba === 'enviando' ? 'Enviando…' : 'Probar'}
              </button>
              {prueba === 'enviada' && <p role="status" className="orbit-aparece text-[13px] text-[#1F5D50]">Enviado. Te llega en unos segundos.</p>}
            </div>
          </div>}
          <NecesitasInternet className="px-1" />
        </>}

    {mensaje && mensaje !== 'Necesitas internet para esto.' && <p role="status" className="px-1 text-[13px] leading-snug text-[#647168]">{mensaje}</p>}
  </section>;
}

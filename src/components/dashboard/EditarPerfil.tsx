'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { crearClienteSupabase } from '@/lib/supabase/cliente';
import AvatarPerfil from './AvatarPerfil';
import IconoDashboard from './IconoDashboard';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';

export default function EditarPerfil({ nombre, correo, fotoUrl, focoFoto, onCerrar, onGuardado }: {
  nombre: string | null; correo: string | null; fotoUrl: string | null; focoFoto: boolean;
  onCerrar: () => void; onGuardado: (nombre: string) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const campoNombre = useRef<HTMLInputElement>(null);
  const seccionFoto = useRef<HTMLDivElement>(null);
  const id = useId();
  const [nuevoNombre, establecerNombre] = useState(nombre ?? '');
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [guardado, establecerGuardado] = useState(false);
  const hayCambios = nuevoNombre.trim() !== (nombre ?? '').trim();

  useEffect(() => {
    dialogo.current?.showModal();
    if (focoFoto) seccionFoto.current?.focus();
    else campoNombre.current?.focus();
  }, [focoFoto]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const valor = nuevoNombre.trim();
    if (guardando || !hayCambios || !valor) return;
    establecerGuardando(true);
    establecerError(null);
    establecerGuardado(false);
    try {
      const supabase = crearClienteSupabase();
      const { data, error: errorSupabase } = await supabase.auth.updateUser({ data: { nombre: valor, full_name: valor } });
      if (errorSupabase || !data.user || data.user.user_metadata.nombre !== valor) {
        establecerError('No se pudo guardar el nombre. Revisa tu conexión y que tu sesión siga activa, e inténtalo de nuevo.');
        return;
      }
      onGuardado(data.user.user_metadata.nombre);
      establecerNombre(data.user.user_metadata.nombre);
      establecerGuardado(true);
    } catch {
      establecerError('No se pudo conectar. Inténtalo de nuevo en unos momentos.');
    } finally {
      establecerGuardando(false);
    }
  }

  return (
    <dialog ref={dialogo} aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-descripcion`}
      onClose={onCerrar} onCancel={(evento) => { if (guardando) evento.preventDefault(); }}
      onClick={(evento) => { if (evento.target === dialogo.current && !guardando) dialogo.current?.close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-[20px] border border-[#E5EAE0] bg-white p-5 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35 [overflow-wrap:anywhere] md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-titulo`} className="text-xl font-semibold tracking-tight">Editar perfil</h2>
        <button type="button" disabled={guardando} aria-label="Cerrar editor" onClick={() => dialogo.current?.close()} className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#647168] hover:bg-[#F3F7EE] disabled:opacity-50 ' + foco}><IconoDashboard nombre="cerrar" /></button>
      </div>
      <p id={`${id}-descripcion`} className="mt-1 text-sm leading-6 text-[#647168]">Actualiza el nombre que aparece en tu perfil.</p>
      <form onSubmit={guardar} aria-busy={guardando} className="mt-5 space-y-5">
        <div ref={seccionFoto} tabIndex={-1} role="group" aria-labelledby={`${id}-foto`} aria-describedby={`${id}-foto-ayuda`} className={'rounded-2xl bg-[#F5F8F1] p-4 ' + foco}>
          <div className="flex items-center gap-4">
            <AvatarPerfil nombre={nombre} fotoUrl={fotoUrl} />
            <div className="min-w-0">
              <h3 id={`${id}-foto`} className="text-sm font-semibold">Foto de perfil</h3>
              <p id={`${id}-foto-ayuda`} className="mt-1 text-xs leading-5 text-[#647168]">La foto de perfil estará disponible próximamente.</p>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-nombre`} className="block text-sm font-medium">Nombre</label>
          <input ref={campoNombre} id={`${id}-nombre`} name="nombre" autoComplete="name" required maxLength={100} disabled={guardando} value={nuevoNombre}
            onChange={(evento) => { establecerNombre(evento.target.value); establecerError(null); establecerGuardado(false); }}
            className={'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#DDE5D7] bg-white px-3 py-2 text-base disabled:opacity-60 ' + foco} />
        </div>
        <div>
          <label htmlFor={`${id}-correo`} className="block text-sm font-medium">Correo</label>
          <input id={`${id}-correo`} name="email" type="email" autoComplete="email" readOnly value={correo ?? ''} aria-describedby={`${id}-correo-ayuda`}
            className={'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#E5EAE0] bg-[#F6F7F2] px-3 py-2 text-base text-[#647168] ' + foco} />
          <p id={`${id}-correo-ayuda`} className="mt-2 text-xs leading-5 text-[#647168]">Solo lectura. El cambio de correo no está disponible desde ORBIT.</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-[#EED4D7] bg-[#FCF5F5] p-3 text-sm leading-6 text-[#A34955]">{error}</p>}
        {guardado && <p role="status" className="rounded-xl bg-[#EDF3E8] p-3 text-sm text-[#245B4C]">Nombre actualizado.</p>}
        {guardando && <p role="status" className="text-sm text-[#647168]">Guardando cambios…</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#EBEEE6] pt-4">
          <button type="button" disabled={guardando} onClick={() => dialogo.current?.close()} className={'min-h-11 rounded-xl border border-[#DDE5D7] px-4 py-2 text-sm font-medium text-[#35695D] hover:bg-[#F3F7EE] disabled:opacity-50 ' + foco}>{guardado ? 'Cerrar' : 'Cancelar'}</button>
          <button type="submit" disabled={guardando || !hayCambios || !nuevoNombre.trim()} className={'min-h-11 rounded-xl bg-[#234F45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#316457] disabled:cursor-not-allowed disabled:opacity-50 ' + foco}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </dialog>
  );
}

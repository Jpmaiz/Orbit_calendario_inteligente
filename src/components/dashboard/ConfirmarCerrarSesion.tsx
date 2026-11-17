'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';

function BotonesConfirmacion({ enviandoRef, onCancelar }: { enviandoRef: RefObject<boolean>; onCancelar: () => void }) {
  const { pending } = useFormStatus();

  useEffect(() => { enviandoRef.current = pending; }, [pending, enviandoRef]);

  return <div aria-busy={pending} className="mt-6 flex flex-wrap justify-end gap-3">
    <button type="button" disabled={pending} onClick={onCancelar}
      className={'min-h-11 rounded-xl border border-[#DDE5D7] px-4 py-2 text-sm font-medium text-[#35695D] transition-colors hover:bg-[#F3F7EE] disabled:cursor-wait disabled:opacity-50 ' + foco}>
      Cancelar
    </button>
    <button type="submit" disabled={pending}
      className={'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E6CDD0] bg-[#FAF0F1] px-4 py-2 text-sm font-semibold text-[#934B56] transition-colors hover:bg-[#F4E4E7] disabled:cursor-wait disabled:opacity-60 ' + foco}>
      {pending && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />}
      <span role="status">{pending ? 'Cerrando sesión.' : 'Cerrar sesión'}</span>
    </button>
  </div>;
}

export default function ConfirmarCerrarSesion({ cerrarSesionAction, onCerrar }: {
  cerrarSesionAction: () => Promise<void>; onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!dialogo.current?.open) dialogo.current?.showModal();
    dialogo.current?.querySelector<HTMLButtonElement>('button[type="button"]')?.focus();
  }, []);

  function cancelar() {
    if (!enviandoRef.current) dialogo.current?.close();
  }

  return <dialog ref={dialogo} aria-labelledby={id + '-titulo'} aria-describedby={id + '-descripcion'}
    onClose={onCerrar} onCancel={evento => { if (enviandoRef.current) evento.preventDefault(); }}
    onClick={evento => { if (evento.target === dialogo.current) cancelar(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-[20px] border border-[#E5EAE0] bg-white p-5 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35 [overflow-wrap:anywhere] md:p-6">
    <h2 id={id + '-titulo'} className="text-xl font-semibold tracking-tight text-[#234F45]">¿Cerrar sesión?</h2>
    <p id={id + '-descripcion'} className="mt-2 text-sm leading-6 text-[#647168]">Tendrás que volver a iniciar sesión para entrar a ORBIT.</p>
    <form action={cerrarSesionAction} onSubmit={evento => {
      if (enviandoRef.current) evento.preventDefault();
      else enviandoRef.current = true;
    }}>
      <BotonesConfirmacion enviandoRef={enviandoRef} onCancelar={cancelar} />
    </form>
  </dialog>;
}

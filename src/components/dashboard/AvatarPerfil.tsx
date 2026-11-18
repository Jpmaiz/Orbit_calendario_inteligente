'use client';

import Image from 'next/image';
import { useState } from 'react';
import IconoDashboard from './IconoDashboard';

/** `pequeno`: 58 px para la cabecera compacta del perfil en módulos. */
export default function AvatarPerfil({ nombre, fotoUrl, pequeno = false }: { nombre: string | null; fotoUrl: string | null; pequeno?: boolean }) {
  const [fotoFallida, establecerFotoFallida] = useState<string | null>(null);
  const iniciales = nombre?.trim().split(/\s+/).slice(0, 2).map((parte) => Array.from(parte)[0]).join('').toLocaleUpperCase('es');
  const mostrarFoto = fotoUrl && /^https?:\/\//i.test(fotoUrl) && fotoFallida !== fotoUrl;

  return (
    <div className={(pequeno ? 'h-[58px] w-[58px] text-[22px] ' : 'h-24 w-24 text-3xl ') + 'flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-linear-to-br from-[#E9F0E2] to-[#DCE9D5] font-semibold text-[#245B4C] shadow-[0_3px_12px_rgba(38,61,52,0.06)] ring-1 ring-[#DDE7D5]'}>
      {mostrarFoto ? <Image src={fotoUrl} alt="Foto de perfil" width={96} height={96} unoptimized onError={() => establecerFotoFallida(fotoUrl)} className="h-full w-full object-cover" /> : <span aria-hidden="true">{iniciales || <IconoDashboard nombre="perfil" className="h-9 w-9" />}</span>}
    </div>
  );
}

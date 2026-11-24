'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import AvatarPerfil from './AvatarPerfil';
import EditarPerfil from './EditarPerfil';
import Dodecaedro from '../marca/Dodecaedro';
import { useAgendaRango } from '../calendario/useAgendaRango';
import { lunesDeSemana, sumarDias } from '../calendario/agendaSemana';
import { diaEnBolivia } from '../calendario/organizarTareasDia';
import { cuantoFalta } from '../calendario/hitosCalendario';
import { formatearHoras } from '../estimacion/estimacionFrontend';
import { leerMateriasPerfil } from './resumenPerfil';
import { useConsulta } from '../perfil/useConsulta';
import { leerPerfilRitmo, leerSemestre, type Semestre } from '../perfil/contratoPerfil';
import RuedaSemestre from '../perfil/RuedaSemestre';
import MiRitmo from '../perfil/MiRitmo';
import LoQueSabe from '../perfil/LoQueSabe';
import CargaFallida from '../pwa/CargaFallida';
import InstalarOrbit from '../pwa/InstalarOrbit';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const modulo = 'rounded-[28px] bg-white p-[18px] shadow-[inset_0_0_0_1px_#E3E8DE]';
const paso = (i: number) => ({ '--i': i }) as CSSProperties;

function semestreVacio(s: Semestre) {
  return s.semanas.every((semana) => semana.horas === 0) && !s.proximoExamen && s.porPlanificarHoras === 0;
}

function Flecha({ color }: { color: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M7 17 17 7M9 7h8v8" /></svg>;
}

/**
 * Perfil en módulos: quién eres, tu semestre a la vista, tu ritmo, lo que Orbit aprendió y tus materias.
 * Una acción principal por módulo y sin números internos (las frases y mensajes ya vienen redactados del back).
 */
export default function PerfilVista({ nombre, apodo = null, correo, fotoUrl = null, fechaActual, cerrarSesionAction }: {
  nombre: string | null; apodo?: string | null; correo: string | null; fotoUrl?: string | null; fechaActual: string;
  cerrarSesionAction: () => Promise<void>;
}) {
  const lunes = lunesDeSemana(new Date(fechaActual));
  const hoy = diaEnBolivia(new Date(fechaActual));
  const agenda = useAgendaRango(lunes, sumarDias(lunes, 6));
  const semestre = useConsulta('/api/perfil/semestre', leerSemestre);
  const perfil = useConsulta('/api/perfil', leerPerfilRitmo);
  const materias = useConsulta('/api/materias', leerMateriasPerfil);
  const router = useRouter();
  // undefined = no se editó en esta visita; null = se quitó el apodo
  const [apodoGuardado, establecerApodoGuardado] = useState<string | null | undefined>(undefined);
  const [editor, establecerEditor] = useState<'nombre' | 'foto' | null>(null);
  const apodoActual = apodoGuardado === undefined ? apodo : apodoGuardado;
  const nombreActual = apodoActual?.trim() || nombre;
  const nombreVisible = nombreActual?.trim() || correo;
  const datosSemestre = semestre.carga?.datos ?? null;
  const examen = datosSemestre?.proximoExamen ?? null;
  const masPesada = datosSemestre?.materiaMasPesada?.nombre ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-4 pt-1 [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Perfil</h1>
        <span aria-hidden="true" className="text-[#35695D]"><Dodecaedro className="h-8 w-8" girando /></span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <section aria-label="Datos del perfil" className="orbit-aparece col-span-2 flex items-center gap-3.5 rounded-[26px] p-4" style={{ ...paso(0), background: 'linear-gradient(135deg, #E3EEDD, #F4F8F0 55%, #E2EEE8)' }}>
          <button type="button" onClick={() => establecerEditor('foto')} aria-label="Editar foto de perfil" className={'shrink-0 rounded-full ' + foco}>
            <AvatarPerfil nombre={nombreActual} fotoUrl={fotoUrl} pequeno />
          </button>
          <div className="min-w-0 flex-1">
            {nombreVisible ? <p className="truncate text-xl font-bold tracking-[-0.02em] text-[#234F45]">{nombreVisible}</p>
              : <p className="text-sm text-[#647168]">No se pudieron obtener los datos de tu cuenta.</p>}
            {nombreActual?.trim() && (correo || apodoActual) && <p className="mt-0.5 truncate text-[12.5px] text-[#647168]">
              {[apodoActual?.trim() ? nombre : null, correo].filter(Boolean).join(' · ')}</p>}
          </div>
          <button type="button" onClick={() => establecerEditor('nombre')}
            className={'min-h-10 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#234F45] shadow-[0_1px_3px_rgba(35,79,69,.12)] hover:bg-[#F4F8F0] ' + foco}>Editar</button>
        </section>

        {!semestre.carga && <div role="status" className="orbit-aparece col-span-2 flex h-40 items-center justify-center rounded-[28px] text-sm text-[#CFE0D7]" style={{ ...paso(1), background: '#1F4A40' }}>Cargando tu semestre…</div>}
        {semestre.carga?.error && <CargaFallida texto="No pude cargar tu semestre." recargar={semestre.recargar} className={'col-span-2 ' + modulo} />}
        {datosSemestre && (semestreVacio(datosSemestre)
          ? <section aria-label="Tu semestre a la vista" className="orbit-aparece col-span-2 flex flex-col items-center gap-3 rounded-[28px] px-[22px] py-7 text-center"
            style={{ ...paso(1), background: 'radial-gradient(circle at 50% 30%, #2F6656 0, #1F4A40 70%)' }}>
            <svg aria-hidden="true" viewBox="0 0 84 84" className="h-[84px] w-[84px]"><circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeDasharray="3 6" /><circle cx="42" cy="8" r="5" fill="#A9CDB9" /></svg>
            <p className="text-[15px] leading-relaxed text-[#DCEBE2]">Cuando cargues tu horario y tus tareas, aquí verás tu semestre.</p>
          </section>
          : <>
            <RuedaSemestre semestre={datosSemestre} />
            <Link href="/mes" style={paso(2)} aria-label={datosSemestre.porPlanificarHoras > 0 ? `Por planificar: ${formatearHoras(datosSemestre.porPlanificarHoras)?.replace('~', 'unas ')}. Ver el mes` : 'Todo planificado. Ver el mes'}
              className={'orbit-aparece flex min-h-[116px] flex-col justify-between gap-3.5 rounded-3xl bg-white px-4 pb-4 pt-3.5 shadow-[inset_0_0_0_1px_#E3E8DE] transition-transform hover:-translate-y-0.5 ' + (examen ? '' : 'col-span-2 ') + foco}>
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#4C6A5D]">
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#EAF1EC] text-[#245B4C]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  </span>Por planificar
                </span>
                <Flecha color="#8A958D" />
              </span>
              <span className="flex flex-col">
                <span className="text-[27px] leading-tight font-bold tracking-[-0.02em] tabular-nums">{datosSemestre.porPlanificarHoras > 0 ? formatearHoras(datosSemestre.porPlanificarHoras) : 'Todo listo'}</span>
                <span className="text-[13px] text-[#647168]">{datosSemestre.porPlanificarHoras > 0 ? 'reparte el estudio en el mes' : 'tienes todo planificado'}</span>
              </span>
            </Link>
            {examen && <Link href={'/semana?dia=' + diaEnBolivia(examen.fecha)} style={paso(2)}
              aria-label={`Próximo examen: ${examen.titulo}, ${cuantoFalta(hoy, diaEnBolivia(examen.fecha))}. Ver ese día`}
              className={'orbit-aparece flex min-h-[116px] flex-col justify-between gap-3.5 rounded-3xl bg-[#FCF2DE] px-4 pb-4 pt-3.5 text-[#4A3810] transition-transform hover:-translate-y-0.5 ' + foco}>
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#916820]">
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white/75">
                    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]"><path d="M12 2.5 21.5 9.4 17.9 20.6H6.1L2.5 9.4Z" fill="currentColor" /></svg>
                  </span>Próximo examen
                </span>
                <Flecha color="#B08A3C" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base leading-snug font-bold">{examen.titulo}</span>
                <span className="text-[13px] font-semibold text-[#916820]">{cuantoFalta(hoy, diaEnBolivia(examen.fecha))}</span>
              </span>
            </Link>}
          </>)}

        {!perfil.carga && <div role="status" className={'col-span-2 text-sm text-[#647168] ' + modulo}>Cargando tu ritmo…</div>}
        {perfil.carga?.error && <CargaFallida texto="No pude cargar tu ritmo." recargar={perfil.recargar} className={'col-span-2 ' + modulo} />}
        {perfil.carga?.datos && <MiRitmo inicial={perfil.carga.datos.ritmo} clases={agenda.agenda?.clases ?? []} />}

        <LoQueSabe />

        <section aria-labelledby="perfil-materias" className={'orbit-aparece col-span-2 flex flex-col gap-3 ' + modulo} style={paso(5)}>
          <h2 id="perfil-materias" className="text-base font-bold">Materias</h2>
          {!materias.carga && <p role="status" className="text-sm text-[#647168]">Cargando materias…</p>}
          {materias.carga?.error && <CargaFallida texto="No se pudieron cargar las materias." recargar={materias.recargar} />}
          {materias.carga?.datos?.length === 0 && <p className="text-sm leading-relaxed text-[#647168]">Tus materias aparecerán aquí cuando las registres.</p>}
          {!!materias.carga?.datos?.length && <ul className="flex flex-wrap gap-2">
            {materias.carga.datos.map((materia) => {
              const pesada = materia.nombre === masPesada;
              return <li key={materia.id} className="inline-flex min-h-10 items-center gap-2 rounded-full py-1 pl-3 pr-3.5 text-[13.5px] font-medium"
                style={{ background: pesada ? `color-mix(in srgb, ${materia.color} 16%, white)` : '#F3F5F0' }}>
                <span aria-hidden="true" className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: materia.color }} />
                {materia.nombre}
                {pesada && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold" style={{ color: `color-mix(in srgb, ${materia.color} 60%, #142E27)` }}>más carga</span>}
              </li>;
            })}
          </ul>}
        </section>

        <InstalarOrbit style={paso(6)} />
      </div>

      <form action={cerrarSesionAction} className="flex justify-center pb-6 pt-1">
        <button type="submit" className={'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#647168] hover:bg-[#EEF1EA] hover:text-[#263D34] ' + foco}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 4H5v16h4m0-8h12m-4-4 4 4-4 4" /></svg>
          Cerrar sesión
        </button>
      </form>

      {editor && <EditarPerfil nombre={nombre} apodo={apodoActual} correo={correo} fotoUrl={fotoUrl} focoFoto={editor === 'foto'}
        onCerrar={() => establecerEditor(null)} onGuardado={(nuevoApodo) => { establecerApodoGuardado(nuevoApodo); router.refresh(); }} />}
    </div>
  );
}

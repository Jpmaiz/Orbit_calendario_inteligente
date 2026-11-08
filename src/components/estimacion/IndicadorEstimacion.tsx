import type { Estimado } from '@/tipos/tarea';
import { formatearHoras } from './estimacionFrontend';

const colores = { ligera: '#82AB95', media: '#C5A355', pesada: '#C98B7A' };
export default function IndicadorEstimacion({ estimado, horasDelUsuario }: {
  estimado?: Estimado | null; horasDelUsuario?: boolean;
}) {
  if (!estimado) return null;
  const horas = formatearHoras(estimado.horas);
  if (horas === null) return null;
  const origen = horasDelUsuario ? 'Horas definidas por ti' : 'Horas estimadas';
  return <span title={origen} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#E3E8DE] bg-white px-2 py-1 text-xs font-medium text-[#647168]">
    <span className="sr-only">{origen}: </span>
    {estimado.carga && <span role="img" aria-label={'Carga ' + estimado.carga} className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colores[estimado.carga] }} />}
    {horas}
  </span>;
}

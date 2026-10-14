import FormularioTarea from '@/components/formularios/FormularioTarea';

export default function PaginaNuevaTarea() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 md:space-y-8">
      <header>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#708070]">Organiza tu día</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] text-[#233E33] md:text-4xl">Nueva tarea</h1>
        <p className="mt-2 text-sm leading-6 text-[#647168]">Agrega una tarea y mantén tus pendientes en órbita.</p>
      </header>
      <FormularioTarea />
    </div>
  );
}

import FormularioTarea from '@/components/formularios/FormularioTarea';

export default function PaginaNuevaTarea() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 md:space-y-8">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] text-[#233E33] md:text-4xl">Nueva tarea</h1>
      </header>
      <FormularioTarea />
    </div>
  );
}

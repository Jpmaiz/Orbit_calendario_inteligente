import { registrarse } from '../acciones';
import PresentacionAuth from '../PresentacionAuth';
import FormularioAuth from '../FormularioAuth';

export default async function PaginaRegistro({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <PresentacionAuth tipo="registro">
    <FormularioAuth tipo="registro" accion={registrarse} error={error} />
  </PresentacionAuth>;
}

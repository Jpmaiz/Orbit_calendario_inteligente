import { iniciarSesion } from '../acciones';
import PresentacionAuth from '../PresentacionAuth';
import FormularioAuth from '../FormularioAuth';

export default async function PaginaLogin({ searchParams }: {
  searchParams: Promise<{ error?: string; mensaje?: string }>;
}) {
  const { error, mensaje } = await searchParams;
  return <PresentacionAuth tipo="login">
    <FormularioAuth tipo="login" accion={iniciarSesion} error={error} mensaje={mensaje} />
  </PresentacionAuth>;
}

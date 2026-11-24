import LimpiarDatosOffline from '@/components/pwa/LimpiarDatosOffline';

/** Login y registro: al llegar aquí no hay sesión, así que se borran los datos guardados para usar sin conexión. */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LimpiarDatosOffline />
    </>
  );
}

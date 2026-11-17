'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import estilos from './auth.module.css';

type Campo = 'nombre' | 'email' | 'password' | 'confirmacion';
type Errores = Partial<Record<Campo, string>>;
type Props = { tipo: 'login' | 'registro'; accion: (datos: FormData) => Promise<void>; error?: string; mensaje?: string };

function traducirError(error: string, registro: boolean): string {
  switch (error) {
    case 'Invalid login credentials': return 'Correo o contraseña incorrectos.';
    case 'User already registered': return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    case 'Password should be at least 6 characters': return 'La contraseña debe tener al menos 6 caracteres.';
    case 'Email not confirmed': return 'Revisa tu correo y confirma tu cuenta antes de iniciar sesión.';
    case 'Email rate limit exceeded': return 'Se han enviado varios correos. Espera un momento e inténtalo de nuevo.';
    case 'Too many requests': return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    case 'Ese correo ya está registrado. Inicia sesión.': return error;
    default: return registro ? 'No pudimos crear tu cuenta. Revisa los datos e inténtalo de nuevo.' : 'No pudimos iniciar sesión. Inténtalo de nuevo en un momento.';
  }
}

function Flecha() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
}

function CampoAuth({ campo, etiqueta, tipo = 'text', placeholder, autoComplete, error, ayuda, minLength, onChange, onBlur, disabled }: {
  campo: Campo; etiqueta: string; tipo?: 'text' | 'email' | 'password'; placeholder: string; autoComplete: string;
  error?: string; ayuda?: string; minLength?: number; onChange: () => void; onBlur: () => void; disabled: boolean;
}) {
  const [visible, establecerVisible] = useState(false);
  const contrasena = tipo === 'password';
  const id = 'auth-' + campo;
  const descripcion = error ? id + '-error' : ayuda ? id + '-ayuda' : undefined;
  return <div className={estilos.campo}>
    <label htmlFor={id}>{etiqueta}</label>
    <div className={estilos.entrada}>
      <input id={id} name={campo === 'confirmacion' ? undefined : campo} type={contrasena && visible ? 'text' : tipo} autoComplete={autoComplete}
        placeholder={placeholder} required minLength={minLength} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={descripcion}
        onChange={onChange} onBlur={onBlur} className={contrasena ? estilos.contrasena : undefined} />
      {contrasena && <button type="button" disabled={disabled} onClick={() => establecerVisible(v => !v)} aria-label={visible ? 'Ocultar ' + etiqueta.toLocaleLowerCase('es') : 'Mostrar ' + etiqueta.toLocaleLowerCase('es')} aria-controls={id} aria-pressed={visible} className={estilos.verContrasena}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>
      </button>}
    </div>
    <div className={estilos.mensajeCampo} aria-live="polite">
      {error ? <p id={id + '-error'} className={estilos.errorCampo}>{error}</p> : ayuda ? <p id={id + '-ayuda'}>{ayuda}</p> : null}
    </div>
  </div>;
}

function ContenidoFormulario({ registro, errores, onChange, onBlur }: {
  registro: boolean; errores: Errores; onChange: (campo: Campo) => void; onBlur: (campo: Campo) => void;
}) {
  const { pending } = useFormStatus();
  const campo = (id: Campo, etiqueta: string, tipo: 'text' | 'email' | 'password', placeholder: string, autoComplete: string, ayuda?: string, minLength?: number) =>
    <CampoAuth campo={id} etiqueta={etiqueta} tipo={tipo} placeholder={placeholder} autoComplete={autoComplete} ayuda={ayuda} minLength={minLength} error={errores[id]} onChange={() => onChange(id)} onBlur={() => onBlur(id)} disabled={pending} />;
  return <>
    <div className={estilos.campos}>
      {registro && campo('nombre', 'Nombre', 'text', '¿Cómo te llamas?', 'name')}
      {campo('email', 'Correo', 'email', 'tu@universidad.edu', 'email')}
      {campo('password', 'Contraseña', 'password', registro ? 'Crea tu contraseña' : 'Tu contraseña', registro ? 'new-password' : 'current-password', registro ? 'Usa al menos 6 caracteres.' : undefined, registro ? 6 : undefined)}
      {registro && campo('confirmacion', 'Confirmar contraseña', 'password', 'Escribe tu contraseña otra vez', 'new-password')}
    </div>
    <button type="submit" disabled={pending} aria-busy={pending} className={estilos.botonPrincipal}>
      <span role="status">{pending ? (registro ? 'Creando cuenta.' : 'Ingresando.') : (registro ? 'Crear cuenta' : 'Iniciar sesión')}</span>
      {pending ? <span className={estilos.spinner} aria-hidden="true" /> : <Flecha />}
    </button>
  </>;
}

export default function FormularioAuth({ tipo, accion, error, mensaje }: Props) {
  const registro = tipo === 'registro';
  const formulario = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);
  const [errores, establecerErrores] = useState<Errores>({});

  function validarCampo(campo: Campo): string | undefined {
    const entrada = formulario.current?.querySelector<HTMLInputElement>('#auth-' + campo);
    if (!entrada) return;
    const valor = entrada.value;
    if (!(campo === 'password' || campo === 'confirmacion' ? valor : valor.trim())) return campo === 'email' ? 'Escribe tu correo.' : campo === 'nombre' ? 'Escribe tu nombre.' : campo === 'confirmacion' ? 'Confirma tu contraseña.' : 'Escribe tu contraseña.';
    if (campo === 'email' && entrada.validity.typeMismatch) return 'Escribe un correo válido.';
    if (campo === 'password' && registro && valor.length < 6) return 'Usa al menos 6 caracteres.';
    if (campo === 'confirmacion' && valor !== formulario.current?.querySelector<HTMLInputElement>('#auth-password')?.value) return 'Las contraseñas no coinciden.';
  }

  function validar(evento: FormEvent<HTMLFormElement>) {
    if (enviando.current) { evento.preventDefault(); return; }
    const campos: Campo[] = registro ? ['nombre', 'email', 'password', 'confirmacion'] : ['email', 'password'];
    const nuevos: Errores = {};
    for (const campo of campos) { const mensaje = validarCampo(campo); if (mensaje) nuevos[campo] = mensaje; }
    establecerErrores(nuevos);
    if (Object.keys(nuevos).length) {
      evento.preventDefault();
      formulario.current?.querySelector<HTMLInputElement>('#auth-' + Object.keys(nuevos)[0])?.focus();
    } else { enviando.current = true; }
  }

  function actualizar(campo: Campo, forzar = false) {
    establecerErrores(actuales => {
      const nuevos = { ...actuales };
      if (forzar || actuales[campo]) nuevos[campo] = validarCampo(campo);
      if (campo === 'password' && actuales.confirmacion) nuevos.confirmacion = validarCampo('confirmacion');
      return nuevos;
    });
  }

  async function enviar(datos: FormData) {
    try { await accion(datos); }
    finally { enviando.current = false; }
  }

  return <>
    {(error || mensaje) && <div className={error ? estilos.avisoError : estilos.avisoExito} role={error ? 'alert' : 'status'}>{error ? traducirError(error, registro) : mensaje}</div>}
    <form ref={formulario} action={enviar} onSubmit={validar} noValidate className={estilos.formulario}>
      <ContenidoFormulario registro={registro} errores={errores} onChange={campo => actualizar(campo)} onBlur={campo => actualizar(campo, true)} />
    </form>
    <p className={estilos.enlaceAlternativo}>{registro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} <Link href={registro ? '/login' : '/registro'}>{registro ? 'Iniciar sesión' : 'Crear cuenta'}<Flecha /></Link></p>
  </>;
}

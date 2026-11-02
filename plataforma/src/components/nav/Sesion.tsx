"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@/lib/usuario";
import { useRuta } from "./useRuta";

// Sesion de quien mira la pagina, en el navegador (D175). Antes la leia el servidor en el layout raiz y por eso toda la web
// era dinamica; ahora las paginas publicas se sirven ya hechas desde la cache y la sesion llega aparte, de /api/sesion
// (sin cache). Sin cookie de sesion no se pide nada: el HTML publico ya es el de «sin sesion». Con cookie, la cabecera se
// esconde (sin quitarle el sitio) hasta saber quien es: nunca un parpadeo de «Acceso» para quien ya ha entrado.

export type Chat = { nombre: string; dueno: string } | null;
export type DatosSesion = { usuario: Usuario | null; chat: Chat; /** puede_ver_liga(): Scouting rivales y Liga consolidada (D162). */ verLiga: boolean };
/** listo = ya se sabe si hay sesion (false solo mientras se pide /api/sesion con cookie de sesion puesta). */
export type EstadoSesion = DatosSesion & { listo: boolean };

const SIN_SESION: EstadoSesion = { usuario: null, chat: null, verLiga: false, listo: true };
const Contexto = createContext<EstadoSesion>(SIN_SESION);
export const useSesion = () => useContext(Contexto);

// Antes de pintar (en el servidor no hay nada que medir): al entrar o salir, la cabecera cambia en el mismo cuadro.
const useEfectoAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Nombres de las cookies de sesion de Supabase Auth (sb-<proyecto>-auth-token, a trozos si son grandes). */
const COOKIES_SESION = /(?:^|;\s*)(sb-[^=;]*-auth-token(?:\.\d+)?)=/g;
const nombresCookie = () => [...document.cookie.matchAll(COOKIES_SESION)].map((m) => m[1]).sort().join("|");

export default function SesionProvider({ children }: { children: React.ReactNode }) {
  // El HTML (servidor y primera pintura) es siempre el de «sin sesion»; solo `listo` mira la cookie, para que quien tenga
  // algo que borrar sin sesion (el asistente) no lo haga antes de saber.
  const [estado, setEstado] = useState<EstadoSesion>(() => (typeof document !== "undefined" && nombresCookie() ? { ...SIN_SESION, listo: false } : SIN_SESION));
  // Firma (nombres de cookie) de la ultima sesion pedida: con la misma cookie no se vuelve a pedir, aunque la sesion
  // resultara no valida; si cambia (entrar, salir) se pide de nuevo.
  const pedida = useRef("");
  const ruta = useRuta();
  const router = useRouter();

  // Sin lista de dependencias a proposito: el proveedor se vuelve a pintar en cada navegacion y tras cada accion del
  // servidor (entrar, salir) y asi se nota que la cookie ha cambiado. Pedir solo ocurre si la firma es distinta.
  useEfectoAntesDePintar(() => {
    const firma = nombresCookie();
    const html = document.documentElement;
    if (firma === pedida.current) return;
    pedida.current = firma;
    if (!firma) {
      setEstado(SIN_SESION);
      html.dataset.sesion = "listo";
      return;
    }
    html.dataset.sesion = "pendiente";
    setEstado((e) => (e.usuario ? e : { ...SIN_SESION, listo: false }));
    fetch("/api/sesion", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<DatosSesion>) : null))
      .catch(() => null)
      .then((d) => {
        if (pedida.current !== firma) return; // otra sesion ha tomado el relevo mientras tanto
        setEstado(d?.usuario ? { ...d, listo: true } : SIN_SESION);
        html.dataset.sesion = "listo";
      });
  });

  // Red de seguridad: con sesion, «/» es el inicio personal (el proxy reescribe «/» a /inicio). Si alguna vez llegara la
  // portada publica a quien ha entrado (p. ej. un proyecto de Supabase nuevo cuya cookie no esta en el matcher del proxy),
  // se le lleva al inicio en vez de dejarle sin el.
  useEffect(() => {
    if (estado.usuario && ruta === "/" && document.querySelector('.w-publica[data-actual="inicio"]')) router.replace("/inicio");
  }, [estado.usuario, ruta, router]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

/** Script de la cabecera del HTML: antes de pintar, marca si hay cookie de sesion (CSS esconde la cabecera hasta saber
 *  quien es). Va como texto en el <head>; la CSP ya admite scripts en linea. */
export const SCRIPT_SESION = String.raw`try{if(/(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/.test(document.cookie))document.documentElement.dataset.sesion="pendiente"}catch(e){}`;

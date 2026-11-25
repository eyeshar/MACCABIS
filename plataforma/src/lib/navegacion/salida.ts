// D198 + D203: un toque en un enlace importante nunca se queda sin respuesta, y lo que sí está cargando no se recarga.
//
// El 24/11 los toques de un jugador en «Responder al domingo» no llegaron al servidor: la navegación del cliente se quedó
// dentro del móvil (lo más probable, una pestaña de Safari con una versión vieja tras un despliegue). Pero en producción
// hay cargas reales de 12–31 s: recargar algo que ya está pidiéndose duplica el trabajo del servidor (cuota de CPU
// compartida con TCPC) y hace esperar más. Lo común a AbrirDomingo y GuardaEnlaces:
//   - pestaña de otro despliegue (/version.txt, D199): carga entera en seguida;
//   - a los ~6 s, si la dirección sigue igual y NO ha salido ninguna petición de esa navegación: carga entera;
//   - si la petición salió (aunque siga en curso): no se recarga; a los ~20 s, si sigue igual, `alTardar` (el aviso
//     «Está tardando más de lo normal», con recarga a mano).
// Si la navegación llegó (o se fue a otra página), la dirección ya no es la de antes y no se hace nada. Una redirección o
// un 404 del destino (/evento/[id] a quien no está invitado) cambian la dirección igual.
//
// «Ha salido la petición»: PerformanceObserver no sirve (una petición solo aparece en Resource Timing al terminar, y lo
// que importa es la que sigue en curso). Se envuelve `fetch` (Next lo busca al llamar, segment-cache/fetch.js) y se anota
// cada petición RSC de navegación (`?_rsc=`, sin cabecera de prefetch): la ruta y cuándo salió. No cambia la petición ni
// su respuesta.
import { pestanaVieja } from "@/lib/version/cliente";

export const ESPERA_EMERGENCIA_MS = 6000;
export const ESPERA_TARDA_MS = 20_000;

const aqui = () => window.location.pathname + window.location.search;

/** Dirección (ruta + consulta) de un enlace, o null si es de otro sitio. */
export function rutaDe(href: string): string | null {
  try {
    const u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

const salidas: { ruta: string; t: number }[] = [];
let vigilando = false;

/** Envuelve `fetch` una sola vez para anotar las peticiones RSC de navegación. Lo llaman GuardaEnlaces y AbrirDomingo. */
export function vigilarPeticiones() {
  if (vigilando || typeof window === "undefined" || typeof window.fetch !== "function") return;
  vigilando = true;
  const original = window.fetch;
  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    try {
      const [entrada, init] = args;
      const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url, window.location.href);
      if (url.origin === window.location.origin && url.searchParams.has("_rsc")) {
        const h = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
        if (!h.has("next-router-prefetch") && !h.has("next-router-segment-prefetch")) {
          salidas.push({ ruta: url.pathname, t: Date.now() });
          if (salidas.length > 30) salidas.shift();
        }
      }
    } catch {
      // nunca por esto se deja de hacer la petición
    }
    return original.apply(this as typeof window, args);
  } as typeof fetch;
}

/** ¿Ha salido alguna petición de navegación a `ruta` desde `desde`? */
const salio = (ruta: string, desde: number) => salidas.some((s) => s.ruta === ruta && s.t >= desde);

let pendiente: { timers: number[] } | null = null;

export type Avisos = {
  /** La navegación ya no está en el aire: llegó, se fue a otra página o se hizo la carga entera. */
  alCambiar?: () => void;
  /** La petición salió y a los ~20 s sigue sin llegar: decirlo, con recarga a mano. */
  alTardar?: () => void;
};

/** Tras un toque que navega a `href`. Un solo seguimiento a la vez (un toque nuevo sustituye al anterior). */
export function salidaDeEmergencia(href: string, { alCambiar, alTardar }: Avisos = {}) {
  vigilarPeticiones();
  const antes = aqui();
  const t0 = Date.now();
  const destino = new URL(href, window.location.href).pathname;
  if (pendiente) pendiente.timers.forEach((t) => window.clearTimeout(t));
  const mio: { timers: number[] } = { timers: [] };
  pendiente = mio;
  const fin = () => { if (pendiente === mio) pendiente = null; };
  const cargaEntera = () => { fin(); mio.timers.forEach((t) => window.clearTimeout(t)); window.location.assign(href); };
  mio.timers.push(window.setTimeout(() => {
    if (aqui() !== antes) { fin(); alCambiar?.(); return; }
    if (!salio(destino, t0)) { cargaEntera(); return; }   // la navegación no ha salido del navegador
    mio.timers.push(window.setTimeout(() => {           // ha salido: se espera, sin pedirla otra vez
      fin();
      if (aqui() !== antes) alCambiar?.(); else alTardar?.();
    }, ESPERA_TARDA_MS - ESPERA_EMERGENCIA_MS));
  }, ESPERA_EMERGENCIA_MS));
  void pestanaVieja().then((vieja) => { if (vieja && pendiente === mio && aqui() === antes) cargaEntera(); });
}

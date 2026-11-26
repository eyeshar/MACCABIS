// D198 + D203: un toque en un enlace importante nunca se queda sin respuesta, y lo que sí está cargando no se recarga.
//
// El 24/11 los toques de un jugador en «Responder al domingo» no llegaron al servidor: la navegación del cliente se quedó
// dentro del móvil (lo más probable, una pestaña de Safari con una versión vieja tras un despliegue). Pero en producción
// hay cargas reales de 12–31 s: recargar algo que ya está pidiéndose duplica el trabajo del servidor (cuota de CPU
// compartida con TCPC) y hace esperar más. Lo común a AbrirDomingo y GuardaEnlaces:
//   - pestaña de otro despliegue (/version.txt, D199): carga entera en seguida;
//   - a los ~6 s, si no ha llegado y NO ha salido ninguna petición de esa navegación: carga entera;
//   - si la petición salió (aunque siga en curso): no se recarga; a los ~20 s, `alTardar` (el aviso «Está tardando más
//     de lo normal» junto al enlace, con recarga a mano) o, si la pantalla está en blanco, el indicador fijo (abajo).
// «Ha llegado» = la dirección ya no es la de antes Y hay algo en pantalla (la página, su esqueleto, un 404 o un error).
// Una redirección o un 404 del destino (/evento/[id] a quien no está invitado) cuentan igual. Dirección cambiada con la
// pantalla en blanco NO es llegar: ver «La pantalla en blanco».
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

// ---------------------------------------------------------------------------------------------------------------------
// La pantalla en blanco (D199 + D203, 26/11/2026). El layout de /mi-zona/domingo/[fecha] hace la sesión, la fecha y si
// hay partido POR ENCIMA de su loading.tsx (D198, para que el 307 y el 404 sean de verdad). Si el prefetch no ha traído
// el esqueleto, Next cambia la dirección y deja vacío el sitio de la página (#contenido, del layout raíz) hasta que el
// servidor responde: ni esqueleto (sin él no hay VigiaEsqueleto) ni el enlace tocado (esa página ya no está). Entonces:
//   - a los ~1,5 s en blanco, un indicador fijo («Cargando tu domingo…»), que pinta GuardaEnlaces (layout raíz);
//   - la regla de siempre: si la petición no salió, carga entera a los ~6 s; si salió y sigue en curso, no se recarga y
//     a los ~20 s el indicador pasa a «Está tardando más de lo normal» con «Recargar».

/** En blanco tanto tiempo, el indicador fijo. */
export const ESPERA_INDICADOR_MS = 1500;
const CADA_MS = 250;

export type Indicador = { tipo: "cargando" | "tarda"; texto: string; href: string };
let indicador: Indicador | null = null;
const oyentes = new Set<() => void>();
const ponerIndicador = (i: Indicador | null) => { indicador = i; oyentes.forEach((f) => f()); };
/** Para useSyncExternalStore (GuardaEnlaces). */
export const suscribirIndicador = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
export const indicadorActual = () => indicador;

/** El sitio de la página vacío: ni la página, ni su esqueleto, ni un 404 o un error (todos se pintan dentro). */
const enBlanco = () => { const c = document.getElementById("contenido"); return Boolean(c && !c.firstElementChild); };

let pendiente: { intervalo: number; indicador: boolean } | null = null;

export type Avisos = {
  /** La navegación ya no está en el aire: llegó (algo en pantalla en otra dirección) o se fue a otra página. */
  alCambiar?: () => void;
  /** La petición salió y a los ~20 s sigue sin llegar, con la dirección sin cambiar: decirlo junto al enlace. */
  alTardar?: () => void;
  /** Lo que dice el indicador fijo si la pantalla se queda en blanco («Cargando tu domingo…»). */
  textoCargando?: string;
};

/** Tras un toque que navega a `href`. Un solo seguimiento a la vez (un toque nuevo sustituye al anterior). */
export function salidaDeEmergencia(href: string, { alCambiar, alTardar, textoCargando = "Cargando…" }: Avisos = {}) {
  vigilarPeticiones();
  const antes = aqui();
  const t0 = Date.now();
  const destino = new URL(href, window.location.href).pathname;
  if (pendiente) { window.clearInterval(pendiente.intervalo); if (pendiente.indicador) ponerIndicador(null); }
  const mio = { intervalo: 0, indicador: false };
  pendiente = mio;
  const indicar = (tipo: Indicador["tipo"]) => {
    if (indicador?.tipo === tipo && mio.indicador) return;
    mio.indicador = true;
    ponerIndicador({ tipo, texto: tipo === "tarda" ? "Está tardando más de lo normal." : textoCargando, href });
  };
  const parar = () => {
    window.clearInterval(mio.intervalo);
    if (pendiente === mio) pendiente = null;
    if (mio.indicador) { mio.indicador = false; ponerIndicador(null); }
  };
  const cargaEntera = () => { parar(); window.location.assign(href); };
  const llego = () => aqui() !== antes && !enBlanco();
  let comprobado = false, avisado = false, blancoDesde: number | null = null;
  mio.intervalo = window.setInterval(() => {
    const ahora = Date.now();
    if (llego()) { parar(); alCambiar?.(); return; }
    const blanco = aqui() !== antes && enBlanco();
    blancoDesde = blanco ? (blancoDesde ?? ahora) : null;
    if (!comprobado && ahora - t0 >= ESPERA_EMERGENCIA_MS) {
      comprobado = true;
      if (!salio(destino, t0)) { cargaEntera(); return; }   // la navegación no ha salido del navegador
    }
    if (comprobado && ahora - t0 >= ESPERA_TARDA_MS) {     // ha salido y no llega: se dice, sin pedirla otra vez
      if (blanco) indicar("tarda");
      else if (!avisado) { avisado = true; alTardar?.(); }
    } else if (blancoDesde !== null && ahora - blancoDesde >= ESPERA_INDICADOR_MS) indicar("cargando");
  }, CADA_MS);
  void pestanaVieja().then((vieja) => { if (vieja && pendiente === mio && !llego()) cargaEntera(); });
}

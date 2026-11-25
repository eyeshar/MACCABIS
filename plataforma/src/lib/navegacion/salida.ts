// D198 + D203: un toque en un enlace importante nunca se queda sin respuesta.
//
// El 24/11 los toques de un jugador en «Responder al domingo» no llegaron al servidor: la navegación del cliente se quedó
// dentro del móvil (lo más probable, una pestaña de Safari con una versión vieja tras un despliegue). Aquí, lo común a
// todos los enlaces que lo necesitan (AbrirDomingo y GuardaEnlaces):
//   - salida de emergencia: si a los ~6 s del toque la dirección sigue siendo la de antes, carga entera del destino,
//     como un enlace normal;
//   - versión: si la pestaña es de un despliegue anterior (/version.txt, D199), carga entera en seguida, sin esperar.
// Ni una cosa ni la otra actúan si la navegación sí llegó (o se fue a otra página): la dirección ya no es la de antes.
// Una redirección o un 404 del destino (/evento/[id] a quien no está invitado) cambian la dirección igual: no se toca.
import { pestanaVieja } from "@/lib/version/cliente";

export const ESPERA_EMERGENCIA_MS = 6000;

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

let pendiente: { t: number; href: string } | null = null;

/**
 * Tras un toque que navega a `href`: carga entera si la pestaña es vieja (en cuanto se sabe) o si a los ~6 s la dirección
 * sigue igual. Un solo temporizador a la vez (un toque nuevo sustituye al anterior). `alCambiar` se llama cuando la
 * navegación ya no está en el aire (llegó, se fue a otra página o se hizo la carga entera).
 */
export function salidaDeEmergencia(href: string, alCambiar?: () => void) {
  const antes = aqui();
  if (pendiente) window.clearTimeout(pendiente.t);
  const ir = () => { pendiente = null; if (aqui() === antes) window.location.assign(href); else alCambiar?.(); };
  pendiente = { href, t: window.setTimeout(ir, ESPERA_EMERGENCIA_MS) };
  const mio = pendiente;
  void pestanaVieja().then((vieja) => {
    if (vieja && pendiente === mio && aqui() === antes) { window.clearTimeout(mio.t); pendiente = null; window.location.assign(href); }
  });
}

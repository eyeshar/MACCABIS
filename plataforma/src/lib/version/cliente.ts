// D199: una respuesta nunca se pierde en silencio por una pestaña de una version vieja.
//
// Tras un despliegue, una pestaña abierta antes sigue con el JavaScript viejo. Sin Skew Protection, sus acciones del
// servidor llegan al despliegue nuevo, que puede no conocerlas («Server Action ... was not found», 409) y la respuesta no
// se guarda. Aqui: (1) antes de guardar se compara la version de la pestaña con /version.txt y, si el servidor ya es
// otro, se recarga entera; (2) si el guardado falla igualmente (accion no encontrada o cualquier otro error), tambien se
// recarga, y la pagina nueva dice «La web se ha actualizado: vuelve a pulsar tu respuesta» (AvisoRecarga). Nunca se
// marca una respuesta que el servidor no ha confirmado.

export const VERSION_PESTANA = process.env.NEXT_PUBLIC_VERSION_WEB ?? "";
export const CLAVE_AVISO = "maccabis-recarga";
const CLAVE_ULTIMA = "maccabis-recarga-en";
/** Dos recargas seguidas por lo mismo en menos de esto: no se recarga otra vez (sin bucles), se dice en la pantalla. */
const SIN_BUCLE_MS = 30_000;

export type MotivoRecarga = "version" | "fallo";
export type Resultado = { ok: true } | { ok: false; error: string };

/** La version que sirve ahora el servidor; null si no se ha podido saber (sin red, tarda): entonces no se decide nada. */
export async function versionServidor(ms = 3000): Promise<string | null> {
  try {
    const r = await fetch("/version.txt", { cache: "no-store", signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return (await r.text()).trim() || null;
  } catch {
    return null;
  }
}

/** true solo si se sabe que el servidor ya es otro despliegue. */
export async function pestanaVieja(): Promise<boolean> {
  const v = await versionServidor();
  return v !== null && VERSION_PESTANA !== "" && v !== VERSION_PESTANA;
}

/** La accion del servidor no existe en el despliegue de ahora (Next: UnrecognizedActionError / cabecera x-nextjs-action-not-found). */
export function esAccionNoEncontrada(e: unknown): boolean {
  const x = e as { name?: string; message?: string } | null;
  return x?.name === "UnrecognizedActionError" || /Server Action .* was not found|Failed to find Server Action/i.test(x?.message ?? "");
}

/** Recarga la pagina entera y deja dicho por que, para que la nueva lo cuente. false si acaba de recargar por lo mismo. */
export function recargar(motivo: MotivoRecarga): boolean {
  try {
    const antes = Number(sessionStorage.getItem(CLAVE_ULTIMA) ?? 0);
    if (Date.now() - antes < SIN_BUCLE_MS) return false;
    sessionStorage.setItem(CLAVE_ULTIMA, String(Date.now()));
    sessionStorage.setItem(CLAVE_AVISO, motivo);
  } catch {
    // sin sessionStorage (modo privado antiguo): se recarga igual, sin aviso
  }
  window.location.reload();
  return true;
}

const SIN_RED = "Sin conexión: tu respuesta NO se ha guardado. Vuelve a pulsarla cuando tengas red.";
const SIN_GUARDAR = "No se ha podido guardar tu respuesta. Recarga la página y vuelve a pulsarla.";

/**
 * Guarda con la accion dada sin perder nunca la respuesta en silencio. Devuelve el resultado del servidor, o «recargando»
 * si la pagina se va a recargar (entonces no hay que tocar nada mas). Una accion que lanza nunca acaba en «guardado».
 */
export async function guardarSeguro<R extends Resultado>(accion: () => Promise<R>): Promise<R | { ok: false; error: string } | "recargando"> {
  if (await pestanaVieja()) {
    if (recargar("version")) return "recargando";
  }
  try {
    const r = await accion();
    // Algo que no es una respuesta del servidor (p. ej., undefined): no se da por guardado.
    if (!r || typeof r !== "object" || typeof (r as { ok?: unknown }).ok !== "boolean") return { ok: false, error: SIN_GUARDAR };
    return r;
  } catch (e) {
    console.error(e);
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, error: SIN_RED };
    if (recargar(esAccionNoEncontrada(e) || (await pestanaVieja()) ? "version" : "fallo")) return "recargando";
    return { ok: false, error: SIN_GUARDAR };
  }
}

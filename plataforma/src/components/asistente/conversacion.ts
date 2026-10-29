// La conversacion con el asistente (D142) se guarda SOLO en el navegador, en sessionStorage de la pestaña: sigue al
// navegar entre pantallas y al recargar, y se borra al cerrar sesion (o al cerrar la pestaña). Nunca en la base de datos.
// `dueno` es un resumen de la cuenta: si en la pestaña entra otra persona, no ve la conversacion anterior.
export type Mensaje = { role: "user" | "assistant"; content: string };

const CLAVE = "maccabis-asistente";
const MAX = 40;

const valido = (m: unknown): m is Mensaje =>
  typeof m === "object" && m !== null && ((m as Mensaje).role === "user" || (m as Mensaje).role === "assistant") && typeof (m as Mensaje).content === "string";

export function leerConversacion(dueno: string): Mensaje[] {
  try {
    const d = JSON.parse(sessionStorage.getItem(CLAVE) ?? "null");
    return d?.dueno === dueno && Array.isArray(d.mensajes) ? d.mensajes.filter(valido).slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function guardarConversacion(dueno: string, mensajes: Mensaje[]) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ dueno, mensajes: mensajes.slice(-MAX) })); } catch { /* sin almacenamiento: solo en memoria */ }
}

export function borrarConversacion() {
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada que borrar */ }
}

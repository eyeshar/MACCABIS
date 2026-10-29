// Quien puede usar el asistente (D142): interruptor CHAT_IA_ABIERTO en Vercel = "gestores" (por defecto) | "todos" | "off".
// Con "gestores" solo Ivan, Carlos y Edu (is_gestor): los demas no ven el acceso y la pagina y la ruta dan 403.
export type ModoChat = "gestores" | "todos" | "off";

export function modoChat(valor = process.env.CHAT_IA_ABIERTO): ModoChat {
  const v = (valor ?? "").trim().toLowerCase();
  return v === "todos" || v === "off" ? v : "gestores";
}

/** Sin el Worker configurado (URL y secreto) el asistente no existe, sea cual sea el interruptor. */
export const chatConfigurado = () => Boolean(process.env.CHAT_WORKER_URL && process.env.CHAT_SECRET);

/** Pantallas con el boton flotante: Inicio con sesion y las que exigen login. Fuera de la parte publica (liga, plantilla,
 *  historia, club…), de /entrar y de /asistente, que ya es el chat. */
const CON_BOTON = ["/mi-zona", "/gestion", "/cuenta", "/avisos", "/agenda", "/planes", "/mis-numeros"];
export const asistenteEnRuta = (ruta: string) => ruta === "/" || CON_BOTON.some((r) => ruta === r || ruta.startsWith(`${r}/`));

export function puedeUsarChat(u: { esGestor: boolean } | null, modo: ModoChat = modoChat(), configurado = chatConfigurado()) {
  if (!u || !configurado || modo === "off") return false;
  return modo === "todos" || u.esGestor;
}

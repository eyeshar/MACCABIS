import "server-only";
import { cache } from "react";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { esGestorActual, sesionActual } from "./sesion";
import { nombreNatural } from "./ropa";
import { NOMBRE_EQUIPO } from "./web";

// Quien mira la pagina, para la cabecera unica (D89): sin sesion, jugador o gestor (gestor = jugador + Gestion).
// Se lee en el servidor una vez por peticion; las paginas que exigen login siguen comprobandolo por su cuenta.
export type Usuario = {
  /** Nombre corto del boton de usuario ("Jon"). */
  corto: string;
  /** Nombre completo de la cabecera del menu de usuario ("Jon Esteban García"). */
  completo: string;
  inicial: string;
  email: string;
  esJugador: boolean;
  esGestor: boolean;
  /** "Jugador · MdA y MdL", "Gestor · Jugador · MdA", "Gestor". */
  papel: string;
};

export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const { supabase, user } = await sesionActual();
  if (!supabase || !user) return null;
  const [zona, esGestor] = await Promise.all([cargarMiZona().catch(() => null), esGestorActual()]);
  let visible = zona?.jugador.nombre_visible;
  let completo = zona ? nombreNatural(zona.jugador.nombre_oficial) : undefined;
  if (!visible && esGestor) {
    const { data: g } = await supabase.from("gestores").select("nombre").eq("user_id", user.id).maybeSingle();
    visible = (g?.nombre as string | undefined) ?? undefined;
  }
  visible ??= user.email?.split("@")[0] ?? "Tú";
  completo ??= visible;
  const equipos = zona ? (["MDA", "MDL"] as const).filter((e) => (e === "MDA" ? zona.jugador.ficha_mda : zona.jugador.ficha_mdl)) : [];
  const jugador = zona ? ["Jugador", ...(equipos.length ? [equipos.map((e) => NOMBRE_EQUIPO[e]).join(" y ")] : [])].join(" · ") : null;
  return {
    corto: visible.split(" ")[0],
    completo,
    inicial: visible.slice(0, 1).toUpperCase(),
    email: user.email ?? "",
    esJugador: Boolean(zona),
    esGestor,
    papel: [esGestor ? "Gestor" : null, jugador].filter(Boolean).join(" · "),
  };
});

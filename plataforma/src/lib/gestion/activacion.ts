import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoNum } from "@/components/numeros/Numeros";
import type { JugadorBasico } from "@/lib/eventos/dominio";
import { hrefJugador } from "@/lib/numeros/enlaces";
import { mensajeFaltanEntrar, mensajePidieronNoEntraron, mensajeSinAvisos } from "./mensajesActivacion";

/** Lo que muestra el recuadro «Respuestas en la web» y que se vuelve a pedir cada minuto (la pagina y la API lo comparten). */
export type EstadoActivacion = {
  encendido: boolean; encendido_desde: string | null; sporteasy_comprobado: boolean; cambiado_en: string | null; cambiado_por: string | null;
  jornadas_seguidas: number; plantilla: number; entrados: number; con_avisos: number; se_puede_encender: boolean;
  minimo_entrados: number; faltan_por_entrar: string[]; puede_manejar: boolean;
  /** Con cuenta de Auth pero sin haber entrado nunca (pidieron un codigo y no lo usaron); ausente si la migracion D140 no esta aplicada. */
  pidio_codigo?: string[];
};

export type ActivacionViva = {
  estado: EstadoActivacion;
  grupos: { entrada: GrupoNum[]; avisos: GrupoNum[] };
  mensajeAvisos: string;
  /** A quien aun no ha pedido acceso. */
  mensajeEntrar: string;
  /** A quien lo pidio y no llego a entrar (cuenta en auth.users sin last_sign_in_at, D157). */
  mensajePidieron: string;
  /** Entrenadores activos: quedan fuera del total y del recuento («Con avisos: 13/27 jugadores»). `conAvisos` = cuantos de ellos tienen avisos. */
  entrenadores: { total: number; conAvisos: number };
  calculadoEn: string;
};

/** «Han entrado» y «con avisos» con sus nombres (D139). La plantilla son los activos que no son entrenador (la misma base que
 *  la tarjeta: incluye a quien solo entrena y no tiene ficha de equipo); quien falta por entrar, lo da la base. Devuelve null
 *  si la funcion de la base no responde (sin permiso o sin migracion). */
export async function cargarActivacionViva(supabase: SupabaseClient, js: JugadorBasico[], web: string): Promise<ActivacionViva | null> {
  const [{ data: activacion }, { data: subsAvisos }] = await Promise.all([
    supabase.rpc("estado_activacion"),
    supabase.from("suscripciones_avisos").select("person_id").eq("activa", true),
  ]);
  if (!activacion) return null;
  const estado = activacion as EstadoActivacion;
  const faltan = estado.faltan_por_entrar ?? [];
  const conAvisos = new Set(((subsAvisos ?? []) as { person_id: string | null }[]).map((s) => s.person_id));
  const plantilla = js.filter((j) => j.activo && j.rol !== "entrenador");
  // Quien tiene cuenta pero nunca ha entrado (pidio un codigo y no lo uso) cuenta como «falta», con su nota (D140).
  const pidioCodigo = new Set(estado.pidio_codigo ?? []);
  // Quien no tiene ficha MdA/MdL va marcado: «solo entrenos» si es su rol, «sin ficha» si no.
  const sinFicha = (j: JugadorBasico) => (j.ficha_mda || j.ficha_mdl ? null : j.rol === "solo_entreno" ? "solo entrenos" : "sin ficha");
  const persona = (j: JugadorBasico) => ({ nombre: j.nombre_visible, href: hrefJugador(j.person_id), nota: sinFicha(j) });
  const personaEntrada = (j: JugadorBasico) => ({ ...persona(j), nota: [sinFicha(j), pidioCodigo.has(j.nombre_visible) ? "pidió código pero no llegó a entrar" : null].filter(Boolean).join(" · ") || null });
  const entrados = plantilla.filter((j) => !faltan.includes(j.nombre_visible));
  const faltantes = plantilla.filter((j) => faltan.includes(j.nombre_visible));
  const pidieron = faltantes.filter((j) => pidioCodigo.has(j.nombre_visible));
  const sinPedir = faltantes.filter((j) => !pidioCodigo.has(j.nombre_visible));
  const con = plantilla.filter((j) => conAvisos.has(j.person_id));
  const sin = plantilla.filter((j) => !conAvisos.has(j.person_id));
  const entrenadores = js.filter((j) => j.activo && j.rol === "entrenador");
  return {
    estado,
    grupos: {
      entrada: [
        { k: "entrados", etiqueta: "han entrado", n: entrados.length, tono: "ok", personas: entrados.map(persona) },
        { k: "faltan", etiqueta: "no han pedido acceso", n: sinPedir.length, tono: "sin", personas: sinPedir.map(persona) },
        { k: "pidieron", etiqueta: "lo pidieron y no terminaron", n: pidieron.length, tono: "duda", personas: pidieron.map(personaEntrada) },
      ],
      avisos: [
        { k: "con", etiqueta: "con avisos activados", n: con.length, tono: "ok", personas: con.map(persona) },
        { k: "sin", etiqueta: "sin avisos", n: sin.length, tono: "sin", personas: sin.map(persona) },
      ],
    },
    mensajeAvisos: mensajeSinAvisos(sin.map((j) => j.nombre_visible), web),
    mensajeEntrar: mensajeFaltanEntrar(sinPedir.map((j) => j.nombre_visible), web),
    mensajePidieron: mensajePidieronNoEntraron(pidieron.map((j) => j.nombre_visible), web),
    entrenadores: { total: entrenadores.length, conAvisos: entrenadores.filter((j) => conAvisos.has(j.person_id)).length },
    calculadoEn: new Date().toISOString(),
  };
}

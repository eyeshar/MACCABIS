import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { AJUSTES, CLAVES, PARAMETROS, parametros } from "@/lib/fantasy/reglas";
import AjustesFormulario from "./AjustesFormulario";
import "../fantasy.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes · MdFantasy", robots: { index: false, follow: false } };

// Ajustes de MdFantasy (D196), solo gestores: interruptor, todos los parametros, nombres de la hoja sin casar y «Puntuar ahora».
export default async function Ajustes() {
  const { supabase } = await exigirGestor();
  const { data: c, error } = await supabase.from("fantasy_config").select("*").eq("id", 1).maybeSingle();
  if (error || !c) {
    return (
      <main className="pagina fz" data-testid="fz-ajustes-sin-base">
        <Volver defecto="/mdfantasy" etiqueta="MdFantasy" />
        <h1 className="fz-h1">Ajustes de MdFantasy</h1>
        <p className="suave">MdFantasy aún no está instalado en esta base de datos (falta aplicar su migración).</p>
      </main>
    );
  }
  const [{ data: jornadas }, { data: jugadores }] = await Promise.all([
    supabase.from("fantasy_jornadas").select("fecha, sin_casar, puntuada_en").order("fecha"),
    supabase.from("jugadores").select("person_id, nombre_visible, nombre_oficial").eq("activo", true).eq("rol", "jugador").order("nombre_visible"),
  ]);
  const sinCasar = [...new Set(((jornadas ?? []) as { sin_casar: string[] }[]).flatMap((j) => j.sin_casar ?? []))];
  const vigentes = parametros(c.parametros);
  return (
    <main className="pagina fz" data-testid="fz-ajustes">
      <Volver defecto="/mdfantasy" etiqueta="MdFantasy" />
      <h1 className="fz-h1">Ajustes de MdFantasy</h1>
      <AjustesFormulario
        modo={c.modo as string}
        campos={CLAVES.map((k) => ({ clave: k, ...AJUSTES[k], valor: vigentes[k], salida: PARAMETROS[k] }))}
        alias={(c.alias ?? {}) as Record<string, string>} sinCasar={sinCasar}
        jugadores={((jugadores ?? []) as { person_id: string; nombre_visible: string; nombre_oficial: string }[]).map((j) => ({ id: j.person_id, nombre: `${j.nombre_visible} · ${j.nombre_oficial}` }))}
        puntuadas={((jornadas ?? []) as { puntuada_en: string | null }[]).filter((j) => j.puntuada_en).length}
        cambiado={c.cambiado_por_nombre ? `${c.cambiado_por_nombre}` : null}
      />
    </main>
  );
}

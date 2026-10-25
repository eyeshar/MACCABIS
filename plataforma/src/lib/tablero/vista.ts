// Tablero de asistencias y convocatoria (D121): funciones PURAS (las usan la pantalla, que recalcula al momento, y las
// pruebas). El motor sigue proponiendo; el tablero es para ver de un vistazo quien va y ajustar a mano.
import { LINEA_DE, revisar, type Convocatoria, type Entrada, type Equipo, type Linea, type Nivel, type Posicion, type RespuestaPartido } from "../convocatoria/motor.ts";

export type FilaTablero = {
  person_id: string; nombre: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null;
  ficha: Record<Equipo, boolean>; solo_entreno: boolean;
  /** Respuesta a cada partido del domingo (o al evento suelto, en la clave "evento"). */
  respuesta: Partial<Record<Equipo | "evento", RespuestaPartido>>;
  invitadoA: (Equipo | "evento")[];
  /** Solo gestores: el motivo del «no» y la ausencia por periodo que cubre el dia. */
  motivo: string | null; ausencia: string | null;
  /** Quien puso la respuesta y cuando («puesta por Ivan»). */
  puestaPor: string | null;
};

export type Celda = "convocado" | "convocar" | "no_va" | "duda" | "sin_responder" | "sin_ficha" | "no_juega";
export const TEXTO_CELDA: Record<Celda, string> = {
  convocado: "Convocado", convocar: "Convocar", no_va: "No va", duda: "Duda", sin_responder: "Sin responder", sin_ficha: "Sin ficha", no_juega: "—",
};

export const enConvocatoria = (conv: Convocatoria, e: Equipo, id: string) => (conv[e] ?? []).some((c) => c.person_id === id);

/** El estado de un jugador en UN partido del domingo: Convocado; Convocar (va y no esta convocado); o apagada: no va,
 *  duda, sin responder o sin ficha (sin ficha de ese equipo). */
export function celda(f: FilaTablero, e: Equipo, conv: Convocatoria, juegan: Equipo[]): Celda {
  if (!juegan.includes(e)) return "no_juega";
  if (enConvocatoria(conv, e, f.person_id)) return "convocado";
  if (!f.ficha[e] || !f.invitadoA.includes(e)) return "sin_ficha";
  const r = f.respuesta[e] ?? "sin_responder";
  if (r === "va") return "convocar";
  if (r === "no") return "no_va";
  return r === "duda" ? "duda" : "sin_responder";
}

/** «Duda o sin responder»: la marca que se calcula sola (en algun partido al que esta invitado). */
export function marcaDuda(f: FilaTablero, juegan: (Equipo | "evento")[]) {
  const rs = juegan.filter((e) => f.invitadoA.includes(e)).map((e) => f.respuesta[e] ?? "sin_responder");
  if (rs.includes("duda")) return "Duda";
  if (rs.includes("sin_responder")) return "Sin responder";
  return null;
}

/** «No van»: no van a NINGUN partido al que estan invitados. El resto (van, dudan o no han respondido), arriba. */
export function noVaANinguno(f: FilaTablero, juegan: Equipo[]) {
  const suyos = juegan.filter((e) => f.invitadoA.includes(e));
  return suyos.length > 0 && suyos.every((e) => (f.respuesta[e] ?? "sin_responder") === "no");
}

export const doblaEn = (f: FilaTablero, conv: Convocatoria) => enConvocatoria(conv, "MdA", f.person_id) && enConvocatoria(conv, "MdL", f.person_id);

// ---------------------------------------------------------------- agrupar (solo cambia como se ve)
export type ModoAgrupar = "posicion" | "equipo" | "nombre" | "nivel";
export const MODOS: { id: ModoAgrupar; texto: string }[] = [
  { id: "posicion", texto: "Posición" }, { id: "equipo", texto: "Equipo" }, { id: "nombre", texto: "Nombre" }, { id: "nivel", texto: "Nivel" },
];
export type Bloque = { clave: string; titulo: string; filas: FilaTablero[] };

const alfa = (a: FilaTablero, b: FilaTablero) => a.nombre.localeCompare(b.nombre, "es");
const lineaDe = (f: FilaTablero): Linea | null => (f.posicion ? LINEA_DE[f.posicion] : null);

/** Bloques segun «Agrupar por». Posicion (por defecto): Bases · Exteriores · Interiores (los bases de reserva van en
 *  Exteriores con su marca). Equipo: Convocados al MdA · al MdL · En los dos · Sin convocar o en duda (sin bloques
 *  vacios). Nombre: alfabetico. Nivel: de A a E. Dentro de cada bloque, orden alfabetico. */
export function agrupar(filas: FilaTablero[], modo: ModoAgrupar, conv: Convocatoria, vista: "domingo" | "evento" = "domingo"): Bloque[] {
  const ord = [...filas].sort(alfa);
  const bloques: Bloque[] = [];
  const poner = (clave: string, titulo: string, fs: FilaTablero[]) => { if (fs.length) bloques.push({ clave, titulo, filas: fs }); };
  if (modo === "nombre") { poner("todos", "Por nombre", ord); return bloques; }
  if (modo === "posicion") {
    poner("base", "Bases", ord.filter((f) => lineaDe(f) === "base"));
    poner("exterior", "Exteriores", ord.filter((f) => lineaDe(f) === "exterior"));
    poner("interior", "Interiores", ord.filter((f) => lineaDe(f) === "interior"));
    poner("sin", "Sin posición", ord.filter((f) => !lineaDe(f)));
    return bloques;
  }
  if (modo === "nivel") {
    for (const n of ["A", "B", "C", "D", "E"] as Nivel[]) poner(n, `Nivel ${n}`, ord.filter((f) => f.nivel === n));
    poner("sin", "Sin nivel", ord.filter((f) => !f.nivel));
    return bloques;
  }
  if (vista === "evento") {
    // Un evento suelto no tiene convocatoria: «Equipo» agrupa por fichas.
    poner("dos", "MdA y MdL", ord.filter((f) => f.ficha.MdA && f.ficha.MdL));
    poner("mda", "Solo MdA", ord.filter((f) => f.ficha.MdA && !f.ficha.MdL));
    poner("mdl", "Solo MdL", ord.filter((f) => !f.ficha.MdA && f.ficha.MdL));
    poner("entreno", "Solo entreno", ord.filter((f) => !f.ficha.MdA && !f.ficha.MdL));
    return bloques;
  }
  const a = (f: FilaTablero) => enConvocatoria(conv, "MdA", f.person_id), l = (f: FilaTablero) => enConvocatoria(conv, "MdL", f.person_id);
  poner("mda", "Convocados al MdA", ord.filter((f) => a(f) && !l(f)));
  poner("mdl", "Convocados al MdL", ord.filter((f) => l(f) && !a(f)));
  poner("dos", "En los dos", ord.filter((f) => a(f) && l(f)));
  poner("sin", "Sin convocar o en duda", ord.filter((f) => !a(f) && !l(f)));
  return bloques;
}

// ---------------------------------------------------------------- acciones en grupo
/** «Al MdA» / «Al MdL»: solo a quien esta disponible (va) para ese partido, con ficha, y no estaba ya. */
export function convocarGrupo(conv: Convocatoria, e: Equipo, filas: FilaTablero[], ids: string[]): { conv: Convocatoria; anadidos: string[] } {
  const anadidos = ids.filter((id) => {
    const f = filas.find((x) => x.person_id === id);
    return f && !enConvocatoria(conv, e, id) && f.ficha[e] && f.invitadoA.includes(e) && f.respuesta[e] === "va";
  });
  return { conv: { ...conv, [e]: [...(conv[e] ?? []), ...anadidos.map((person_id) => ({ person_id }))] }, anadidos };
}

/** «Quitar convocatoria»: de los dos partidos (o de uno). */
export function quitarGrupo(conv: Convocatoria, ids: string[], solo?: Equipo): { conv: Convocatoria; quitados: string[] } {
  const quitados = new Set<string>();
  const out: Convocatoria = { ...conv };
  for (const e of ["MdA", "MdL"] as Equipo[]) {
    if (solo && e !== solo) continue;
    if (!out[e]) continue;
    out[e] = out[e]!.filter((c) => { const q = ids.includes(c.person_id); if (q) quitados.add(c.person_id); return !q; });
  }
  return { conv: out, quitados: [...quitados] };
}

// ---------------------------------------------------------------- resumen por equipo y avisos de las reglas
export type PartidoTablero = { equipo: Equipo; rival: string; inicio: string | null; dificultad: "alta" | "media" | "baja" };
export type Resumen = { equipo: Equipo; rival: string; inicio: string | null; total: number; bases: number; basesReserva: number; exteriores: number; interiores: number; avisos: string[] };

/** Resumen de cada equipo y los avisos de las reglas recalculados al momento: minimos (1.3), «evitar 5 interiores»
 *  (2.3), mas de 10 (1.1), ningun base puro (2.1 / 5.4) y la diferencia de convocados con rivales parejos (D112). */
export function resumenEquipos(entrada: Entrada, conv: Convocatoria, partidos: PartidoTablero[]): Resumen[] {
  const r = revisar(entrada, conv);
  const salida: Resumen[] = partidos.map((p) => {
    const rc = r.recuento[p.equipo];
    const avisos = r.avisos.filter((a) => a.equipo === p.equipo && ["1.1", "1.3", "2.3"].includes(a.regla)).map((a) => a.texto);
    if (rc && rc.total > 0 && rc.bases.puros === 0) avisos.push("Ningún base puro.");
    return {
      equipo: p.equipo, rival: p.rival, inicio: p.inicio, total: rc?.total ?? 0, bases: rc?.bases.puros ?? 0, basesReserva: rc?.bases.reserva ?? 0,
      exteriores: rc?.exteriores.n ?? 0, interiores: rc?.interiores.n ?? 0, avisos,
    };
  });
  if (partidos.length === 2 && partidos[0].dificultad === partidos[1].dificultad) {
    const d = Math.abs(salida[0].total - salida[1].total);
    if (d > 1) {
      const corto = salida[0].total < salida[1].total ? salida[0] : salida[1];
      corto.avisos.push(`Rivales parejos: ${d} convocados de diferencia (máximo 1, D112).`);
    }
  }
  return salida;
}

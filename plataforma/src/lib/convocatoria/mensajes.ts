// Textos de salida de la convocatoria (D107): el mensaje de WhatsApp (formato de D98: hora, encuentro, pista y
// direccion) y el aviso «Estás convocado». Funciones PURAS. Nunca llevan niveles, posiciones,
// reglas personales ni motivos: solo el nombre visible de cada convocado.

import type { Convocatoria, Equipo } from "./motor";

export type PartidoMensaje = {
  equipo: Equipo; rival: string | null; es_local: boolean | null; inicio: string | null; encuentro: string | null;
  /** "CDM Moratalaz, pista 2" o "pista por confirmar" */
  sitio: string; direccion: string | null;
  /** Línea de equipación (D160: lineaConvocatoria de data/avisos_equipacion.js, siempre que haya rival), o null */
  lineaEquipacion: string | null;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const diaTexto = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${ddmm(f)}`;
const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim() : "rival por confirmar");
export const cruce = (p: Pick<PartidoMensaje, "equipo" | "rival" | "es_local">) => (p.es_local === false ? `${limpiar(p.rival)} – ${p.equipo}` : `${p.equipo} – ${limpiar(p.rival)}`);
const nombres = (ids: string[], nombre: (id: string) => string) => ids.map(nombre).sort((a, b) => a.localeCompare(b, "es"));

/** Aviso de data/avisos.json vigente ese domingo (lo filtra quien llama, con avisosDelFichero). */
export type AvisoMensaje = { texto: string; para: "todos" | Equipo };

/** Mensaje de WhatsApp para el grupo. Con `cambios` (tras aprobar), empieza diciendo qué ha cambiado. Con `avisos`, una
 *  línea por aviso al final (con el equipo delante si no es para todos), sin los del dorsal, que ya van en el recordatorio. */
export function mensajeConvocatoria(fecha: string, jornada: number | null, partidos: PartidoMensaje[], conv: Convocatoria, nombre: (id: string) => string, cambios: string[] = [], avisos: AvisoMensaje[] = []) {
  const j = jornada ? ` (J${jornada})` : "";
  const lineas: string[] = [];
  if (cambios.length) lineas.push(`Cambio en la convocatoria del ${diaTexto(fecha)}${j}: ${cambios.join("; ")}.`, "");
  else lineas.push(`Convocatoria del ${diaTexto(fecha)}${j}`, "");
  for (const p of partidos) {
    const ids = (conv[p.equipo] ?? []).map((c) => c.person_id);
    const hora = p.inicio ? `${p.inicio}${p.encuentro ? ` (encuentro ${p.encuentro})` : ""}` : "hora por confirmar";
    const sitio = p.sitio === "pista por confirmar" ? "pista por confirmar" : `en ${p.sitio}${p.direccion ? ` — ${p.direccion.replace(/\.$/, "")}` : ""}`;
    lineas.push(`${p.equipo} · ${cruce(p)}`);
    lineas.push(`${hora} ${sitio}.`);
    lineas.push(p.lineaEquipacion ?? "Equipación habitual (negra).");
    lineas.push(ids.length ? `Convocados (${ids.length}): ${nombres(ids, nombre).join(", ")}.` : "Convocados: por confirmar.");
    lineas.push("");
  }
  const juegan = partidos.map((p) => p.equipo);
  for (const a of avisos) {
    if (/dorsal/i.test(a.texto) || (a.para !== "todos" && !juegan.includes(a.para))) continue;
    lineas.push(a.para === "todos" ? a.texto : `${a.para}: ${a.texto}`);
  }
  lineas.push("Recordad: el dorsal es obligatorio.");
  return lineas.join("\n");
}

/** Firma corta y estable de una convocatoria (para la clave unica del aviso: mismo estado = misma clave, nada doble). */
export function firmaConvocatoria(conv: Convocatoria) {
  const t = (["MdA", "MdL"] as Equipo[]).map((e) => `${e}:${(conv[e] ?? []).map((c) => c.person_id).sort().join(",")}`).join("|");
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const detallePartidos = (suyos: PartidoMensaje[]) => suyos.map((p) => `${p.equipo} a las ${p.inicio ?? "?"}${p.encuentro ? ` (quedada ${p.encuentro})` : ""}`).join(" y ");
const FIN_EQUIPACION = / ?Llevad la \S+ por si acaso\.$/;
/** Equipación de la jornada para el aviso al móvil (D160). Un partido: su línea tal cual. Dos (dobla): cada línea con su
 *  equipo delante y «Llevad la amarilla por si acaso.» una sola vez, al final. */
function lineasJornada(suyos: PartidoMensaje[]) {
  const con = suyos.filter((p) => p.lineaEquipacion).map((p) => ({ equipo: p.equipo, l: /[.!?]$/.test(p.lineaEquipacion!) ? p.lineaEquipacion! : `${p.lineaEquipacion}.` }));
  if (con.length <= 1) return con[0]?.l ?? "";
  const fin = con.map((x) => x.l.match(FIN_EQUIPACION)?.[0].trim()).find(Boolean);
  return [...con.map((x) => `${x.equipo}: ${x.l.replace(FIN_EQUIPACION, "")}`), ...(fin ? [fin] : [])].join(" ");
}

/** Aviso al móvil «Estás convocado» (D127; pantalla de bloqueo: sin niveles ni motivos). Con la línea de equipación de
 *  la jornada (D160), la misma del WhatsApp. */
export function textoEstasConvocado(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[]) {
  const suyos = partidos.filter((p) => equipos.includes(p.equipo));
  const extra = lineasJornada(suyos);
  return { titulo: `Estás convocado · ${diaTexto(fecha)}`, cuerpo: `${detallePartidos(suyos)}.${extra ? ` ${extra}` : ""}` };
}

/** «MdL · 11:30, quedada 11:10» (D173: el aviso de un solo equipo). */
const horaEquipo = (p: PartidoMensaje) => `${p.equipo} · ${p.inicio ?? "hora por confirmar"}${p.encuentro ? `, quedada ${p.encuentro}` : ""}`;

/** Tras un cambio de la convocatoria ya avisada (D173): a quien entra («Entras en la convocatoria del MdA…»), cambia de
 *  equipo o sale («Ya no estás convocado…»). `antes` = sus equipos en lo ya avisado. */
export function textoCambioConvocatoria(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[], antes: Equipo[] = []) {
  const titulo = `Cambio en la convocatoria · ${diaTexto(fecha)}`;
  if (!equipos.length) return { titulo, cuerpo: "Ya no estás convocado este domingo." };
  const suyos = partidos.filter((p) => equipos.includes(p.equipo));
  const extra = lineasJornada(suyos);
  const fin = extra ? ` ${extra}` : "";
  if (!antes.length && suyos.length === 1) return { titulo, cuerpo: `Entras en la convocatoria del ${horaEquipo(suyos[0])}.${fin}` };
  if (antes.length && suyos.length === 1 && !antes.includes(suyos[0].equipo)) return { titulo, cuerpo: `Ahora vas con el ${horaEquipo(suyos[0])}.${fin}` };
  return { titulo, cuerpo: `Estás convocado: ${detallePartidos(suyos)}.${fin}` };
}

/** El aviso al aprobar (D173), UNO por jugador según su caso (pantalla de bloqueo: sin niveles ni la marca «reserva», F):
 *   - convocado en un equipo y disponible para los dos: «Estás convocado con el MdL (no con el MdA) · 11:30, quedada 11:10.»
 *     y la línea de equipación (D160);
 *   - convocado en el único equipo al que podía ir (o en los dos): el «Estás convocado» de siempre;
 *   - dijo «voy» y no está en ningún equipo: «Esta vez no entras en la convocatoria…». */
export function textoAvisoConvocatoria(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[], disponiblePara: Equipo[]) {
  if (!equipos.length) {
    return {
      titulo: `Convocatoria · ${diaTexto(fecha)}`,
      cuerpo: `Esta vez no entras en la convocatoria: somos muchos ${partidos.length === 1 ? "para un solo partido" : "este domingo"}. Gracias por estar disponible, cuenta contigo para el siguiente.`,
    };
  }
  const juegan = partidos.map((p) => p.equipo);
  if (equipos.length === 1 && juegan.length === 2 && juegan.every((e) => disponiblePara.includes(e))) {
    const p = partidos.find((x) => x.equipo === equipos[0])!;
    const extra = lineasJornada([p]);
    return { titulo: `Estás convocado · ${diaTexto(fecha)}`, cuerpo: `Estás convocado con el ${p.equipo} (no con el ${juegan.find((e) => e !== p.equipo)}) · ${p.inicio ?? "hora por confirmar"}${p.encuentro ? `, quedada ${p.encuentro}` : ""}.${extra ? ` ${extra}` : ""}` };
  }
  return textoEstasConvocado(fecha, partidos, equipos);
}

export type Destinatario = { person_id: string; equipos: Equipo[]; antes: Equipo[]; disponiblePara: Equipo[] };

/** A quien hay que avisar respecto a lo ya avisado (`base`). Sin base (al aprobar, D173): a todos los convocados y a quien
 *  dijo «voy» y no está en ningún equipo (`disponibles`: equipos a los que dijo «voy» con ficha). Con base: a quien entra,
 *  cambia de equipo o sale (con sus equipos de ahora, vacío = sale, y los de antes). */
export function destinatariosAviso(conv: Convocatoria, base: Convocatoria | null, disponibles: Map<string, Equipo[]> = new Map()): { cambio: boolean; personas: Destinatario[] } {
  const equiposDe = (c: Convocatoria | null) => {
    const m = new Map<string, Equipo[]>();
    for (const e of ["MdA", "MdL"] as Equipo[]) for (const x of c?.[e] ?? []) m.set(x.person_id, [...(m.get(x.person_id) ?? []), e]);
    return m;
  };
  const ahora = equiposDe(conv), antes = equiposDe(base);
  const disp = (id: string) => disponibles.get(id) ?? [];
  if (!base) {
    const fuera = [...disponibles.entries()].filter(([id, eqs]) => eqs.length && !ahora.has(id)).map(([id]) => id).sort();
    return {
      cambio: false,
      personas: [...[...ahora.entries()].map(([person_id, equipos]) => ({ person_id, equipos, antes: [] as Equipo[], disponiblePara: disp(person_id) })),
        ...fuera.map((person_id) => ({ person_id, equipos: [] as Equipo[], antes: [] as Equipo[], disponiblePara: disp(person_id) }))],
    };
  }
  const ids = [...new Set([...ahora.keys(), ...antes.keys()])];
  return {
    cambio: true,
    personas: ids.filter((id) => (ahora.get(id) ?? []).join() !== (antes.get(id) ?? []).join())
      .map((person_id) => ({ person_id, equipos: ahora.get(person_id) ?? [], antes: antes.get(person_id) ?? [], disponiblePara: disp(person_id) })),
  };
}

/** El texto de cada aviso, según sea al aprobar o tras un cambio. */
export function textoParaPersona(fecha: string, partidos: PartidoMensaje[], cambio: boolean, x: Omit<Destinatario, "person_id">) {
  return cambio ? textoCambioConvocatoria(fecha, partidos, x.equipos, x.antes) : textoAvisoConvocatoria(fecha, partidos, x.equipos, x.disponiblePara);
}

/** «(los otros 3 no tienen avisos activados)» / «(el otro no tiene avisos activados)» */
export const sinAvisosTexto = (n: number) => (n === 1 ? "el otro no tiene avisos activados" : `los otros ${n} no tienen avisos activados`);

// ---------------------------------------------------------------- D173: avisos a los gestores (pueden llevar el aviso de línea, nunca niveles)
const TEXTO_LINEA_G = { base: "bases", exterior: "exteriores", interior: "interiores" } as const;
const listaYm = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
export type RecuentoCorto = { total: number; bases: { puros: number; reserva: number; estado: string }; exteriores: { n: number; estado: string }; interiores: { n: number; estado: string } };

/** Lo que dice de un equipo un aviso a gestores: «MdL: 6 de 7, faltan interiores» (por debajo de un mínimo) o «MdL con 3
 *  interiores» (en el mínimo). Sin nombres ni niveles. null si está bien. */
export function problemasEquipo(e: Equipo, r: RecuentoCorto) {
  const faltan = ([["base", r.bases.puros + r.bases.reserva < 2], ["exterior", r.exteriores.n < 3], ["interior", r.interiores.n < 3]] as const)
    .filter(([, f]) => f).map(([l]) => TEXTO_LINEA_G[l]);
  if (r.total < 7) return { grave: true, texto: `${e}: ${r.total} de 7${faltan.length ? `, faltan ${listaYm(faltan)}` : ""}` };
  if (faltan.length) return { grave: true, texto: `${e}: faltan ${listaYm(faltan)}` };
  const justos = [
    r.bases.estado === "minimo" ? `${r.bases.puros} base${r.bases.puros === 1 ? "" : "s"} puro${r.bases.puros === 1 ? "" : "s"}` : null,
    r.exteriores.estado === "minimo" ? `${r.exteriores.n} exteriores` : null,
    r.interiores.estado === "minimo" ? `${r.interiores.n} interiores` : null,
  ].filter((x): x is string => !!x);
  return justos.length ? { grave: false, texto: `${e} con ${listaYm(justos)}` } : null;
}

/** Push a Iván cuando la plataforma deja la propuesta lista (D173): «Convocatoria del domingo 15/11 lista» · «MdA 9 · MdL 9 ·
 *  1 aviso (MdL con 3 interiores)», o con lo que falta: «MdL: 6 de 7, faltan interiores». */
export function textoPropuestaLista(fecha: string, equipos: { equipo: Equipo; recuento: RecuentoCorto }[], riesgo: string | null = null) {
  const cifras = equipos.map((x) => `${x.equipo} ${x.recuento.total}`).join(" · ");
  const ps = equipos.map((x) => problemasEquipo(x.equipo, x.recuento)).filter((p): p is { grave: boolean; texto: string } => !!p);
  const graves = ps.filter((p) => p.grave);
  const cola = graves.length ? ` · ${graves.map((p) => p.texto).join(" · ")}`
    : ps.length ? ` · ${ps.length === 1 ? "1 aviso" : `${ps.length} avisos`} (${ps.map((p) => p.texto).join("; ")})` : " · sin avisos";
  return { titulo: `Convocatoria del domingo ${ddmm(fecha)} lista`, cuerpo: `${cifras}${cola}${riesgo ? ` · ${riesgo}` : ""}. Revísala y apruébala.` };
}

/** Recordatorio a los gestores si el martes sigue sin aprobar (D173): a las 19:00 a Iván, a las 21:00 a los tres. */
export function textoSinAprobar(fecha: string, tarde: boolean) {
  return {
    titulo: `Convocatoria del domingo ${ddmm(fecha)} sin aprobar`,
    cuerpo: tarde ? "Sigue sin aprobar. Cualquiera de los tres puede revisarla y aprobarla: toca para abrirla." : "La propuesta está lista desde las 12:00 y aún no está aprobada. Toca para revisarla.",
  };
}

/** Baja de un convocado tras aprobar (D173): «Sale Jon (MdA). Propuesta: entra Fernando M.» (sin «→»: la pila local de
 *  pruebas es WIN1252 y no lo guarda). */
export function textoBaja(nombre: string, equipo: Equipo, fecha: string, recambio: string | null) {
  return {
    titulo: `Convocatoria del ${ddmm(fecha)}: sale ${nombre}`,
    cuerpo: `Sale ${nombre} (${equipo}). ${recambio ? `Propuesta: entra ${recambio.replace(/\.$/, "")}` : "Sin recambio propuesto"}. Toca para elegir.`,
  };
}

/** «Voy» tardío de alguien no convocado cuando un equipo está por debajo de un mínimo (D173). */
export function textoVoyTardio(nombre: string, fecha: string, faltas: string[]) {
  return { titulo: `Convocatoria del ${ddmm(fecha)}: ${nombre} dice «voy»`, cuerpo: `${nombre} dice «voy» y ${listaYm(faltas)}. Toca para añadirlo si quieres.` };
}

/** Un cambio de calendario rompe la convocatoria aprobada (D173). */
export function textoCalendarioRompe(fecha: string, que: string, arreglo: string | null) {
  return { titulo: `Convocatoria del ${ddmm(fecha)}: revisar tras el cambio de calendario`, cuerpo: `${que}.${arreglo ? ` Propuesta: ${arreglo}.` : ""} Toca para revisarlo.` };
}

/** WhatsApp para escribir a quien no ha respondido o dijo «duda» cuando no se llega a un mínimo (D173). Sin niveles. */
export function mensajeFaltan(fecha: string, nombres: string[], web = "https://maccabis.vercel.app") {
  const a = nombres.length ? `Hola, ${listaYm(nombres)}: ` : "Hola: ";
  return `${a}nos faltan jugadores para el ${diaTexto(fecha)} y aún no sabemos si podéis venir. Si podéis jugar, entrad y poned «voy» cuanto antes: ${web}/mi-zona/domingo/${fecha}`;
}

/** «Avisados N de M (los otros M−N no tienen avisos)» (D173). */
export const textoAvisados = (n: number, m: number) => `Avisados ${n} de ${m}${m - n ? ` (${sinAvisosTexto(m - n).replace(" activados", "")})` : ""}`;

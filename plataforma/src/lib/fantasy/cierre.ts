// MdFantasy (D196): el cierre de una jornada, de principio a fin y sin tocar la base: de lo que da
// fantasy_datos_jornada(fecha) a lo que guarda fantasy_guardar_jornada(p). Logica pura (pruebas:fantasy-logica).
import { puntuarJornada, type DatosJornada } from "./jornada.ts";
import { arrastrar, duelos, ingreso, puntosManager, type Alineacion, type PuntosDe } from "./manager.ts";
import { parametros, type Parametros } from "./reglas.ts";

type FilaAlineacion = { titulares: string[]; capitan: string | null; vice: string | null };
export type ManagerDatos = {
  person_id: string; nombre: string; plantilla: string[];
  alineacion: FilaAlineacion | null; anterior: FilaAlineacion | null;
  porras: Record<string, string>;
};
export type DatosCierre = DatosJornada & {
  huella: string | null; parametros?: unknown; managers: ManagerDatos[]; ronda: number;
  partidos: (DatosJornada["partidos"][number] & { evento?: string })[];
};

export type Logro = { manager: string; logro: string; texto: string };

export function cerrarJornada(d: DatosCierre, Pfijo?: Parametros) {
  const P = Pfijo ?? parametros(d.parametros);
  const r = puntuarJornada(d, P);
  const puntos = new Map<string, PuntosDe>([...r.puntos].map(([id, p]) => [id, { rendimiento: p.rendimiento, compromiso: p.compromiso, total: p.total, minutos: p.minutos }]));

  const arrastradas: ({ manager: string } & Alineacion)[] = [];
  const managers = d.managers.map((m) => {
    let a: Alineacion;
    if (m.alineacion) a = { titulares: m.alineacion.titulares.filter((x) => m.plantilla.includes(x)), capitan: m.alineacion.capitan, vice: m.alineacion.vice };
    else if (m.anterior) { a = arrastrar(m.anterior, m.plantilla); arrastradas.push({ manager: m.person_id, ...a }); }
    else a = { titulares: [], capitan: null, vice: null };
    const aciertos = Object.entries(m.porras ?? {}).filter(([eq, pr]) => r.resultados[eq] === pr).length;
    const pm = puntosManager(a, puntos, aciertos, P);
    return { manager: m.person_id, nombre: m.nombre, alineacion: pm.alineacion, porra: pm.porra, total: pm.total, ingreso: ingreso(pm.total, P), aciertos, apuestas: Object.keys(m.porras ?? {}).length, detalle: { dobla: pm.dobla, jugadores: pm.jugadores, capitan: a.capitan, vice: a.vice } };
  });

  const totalDe = new Map(managers.map((m) => [m.manager, m.total]));
  const pares = duelos(d.managers.map((m) => m.person_id), d.ronda).map(([a, b]) => ({ a, b, puntos_a: totalDe.get(a) ?? 0, puntos_b: b ? totalDe.get(b) ?? 0 : null }));

  const logros: Logro[] = [];
  if (managers.length) {
    const mejor = Math.max(...managers.map((m) => m.total));
    if (mejor > 0) for (const m of managers.filter((x) => x.total === mejor)) logros.push({ manager: m.manager, logro: "mejor_jornada", texto: "Mejor mánager de la jornada" });
    for (const m of managers) {
      if (m.apuestas > 0 && m.aciertos === m.apuestas && m.apuestas === d.partidos.length) logros.push({ manager: m.manager, logro: "pleno_porra", texto: "Pleno en la porra" });
      const cap = m.detalle.jugadores.find((j) => j.person_id === m.detalle.dobla);
      if (cap && cap.doble >= 15) logros.push({ manager: m.manager, logro: "capitan_de_oro", texto: "Capitán de oro (15 o más de rendimiento)" });
      if (m.detalle.jugadores.length >= P.alineados && m.detalle.jugadores.every((j) => j.rendimiento > 0)) logros.push({ manager: m.manager, logro: "pleno_alineacion", texto: "Los cinco alineados jugaron" });
    }
    for (const p of pares) {
      if (!p.b || p.puntos_b == null || p.puntos_a === p.puntos_b) continue;
      logros.push({ manager: p.puntos_a > p.puntos_b ? p.a : p.b, logro: "duelo_ganado", texto: "Duelo ganado" });
    }
  }

  const guardar = {
    fecha: d.fecha, huella: d.huella, ronda: d.managers.length >= 2 ? d.ronda : null,
    sin_casar: r.sinCasar, resultados: r.resultados,
    jugadores: [...r.puntos].map(([person_id, p]) => ({ person_id, rendimiento: p.rendimiento, compromiso: p.compromiso, total: p.total, minutos: p.minutos, convocado: p.convocado, doblete: p.doblete, detalle: { partidos: p.partidos, unidades: p.unidades } })),
    arrastradas,
    managers: managers.map((m) => ({ manager: m.manager, alineacion: m.alineacion, porra: m.porra, total: m.total, ingreso: m.ingreso, detalle: m.detalle })),
    duelos: pares, logros,
  };
  return { guardar, sinCasar: r.sinCasar, aproximados: r.aproximados, convocadosSinHoja: r.convocadosSinHoja, parametros: P };
}

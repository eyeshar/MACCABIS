import { avisoDe, coloresDe, nombreRival, type Partido } from "@/lib/equipacion";

// Un partido nuestro con su rival, lugar y, si toca, el aviso de equipacion (D79). Mismo aspecto en Mi zona e Inicio de gestion.
const NOMBRE = { MDA: "MdA", MDL: "MdL" } as const;

export function diaLargo(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export function Camiseta({ rival }: { rival: string }) {
  const c = coloresDe(rival);
  if (!c) return null;
  return (
    <span className="eq-color" data-testid="color-rival">
      <i className="eq-punto" style={{ background: c.css }} aria-hidden="true" />
      camiseta {c.camiseta}, pantalón {c.pantalon}
    </span>
  );
}

export function AvisoEquipacion({ partido }: { partido: Partido }) {
  const a = avisoDe(partido);
  if (!a?.hay) return null;
  return (
    <p className="eq-aviso" role="note">
      <span className="etiqueta etiqueta-aviso">{a.etiqueta}</span> <span>{a.texto}</span>
    </p>
  );
}

export default function ProximoPartido({ partido }: { partido: Partido }) {
  return (
    <div className="eq-partido">
      <p style={{ margin: 0 }}>
        <b>{NOMBRE[partido.equipo]} {partido.local ? "vs" : "en"} {nombreRival(partido.rival)}</b>
      </p>
      <p className="pequeno suave" style={{ margin: "2px 0 6px" }}>
        J{partido.jornada} · {partido.fecha ? diaLargo(partido.fecha) : ""} · {partido.hora} · pista {partido.campo} · {partido.local ? "en casa" : "fuera"}
      </p>
      <p className="pequeno" style={{ margin: "0 0 6px" }}>{partido.rival && <Camiseta rival={partido.rival} />}</p>
      <AvisoEquipacion partido={partido} />
    </div>
  );
}

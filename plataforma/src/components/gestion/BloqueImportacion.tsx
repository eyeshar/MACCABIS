import Link from "next/link";
import { TAREA_RESPUESTAS, type EstadoImportacion } from "@/lib/eventos/importacionAuto";

const fechaHora = (t: string) => new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Estado de la importacion de respuestas de SportEasy (D126): ultima, proxima automatica y como pedirla ya. La web no
 *  puede lanzar a Claude: no hay ningun boton que lo parezca. */
export default function BloqueImportacion({ estado, enlaceImportar = true }: { estado: EstadoImportacion; enlaceImportar?: boolean }) {
  return (
    <div className="gs-importacion" data-testid="bloque-importacion" role="note">
      {estado.desactualizadas && <p className="gs-importacion-aviso" role="alert" data-testid="importacion-desactualizada"><b>Las respuestas pueden estar desactualizadas.</b> La última importación tiene más de 48 horas y hay partido en los próximos 5 días.</p>}
      <p style={{ margin: 0 }}>
        <b>Última importación:</b> {estado.ultima ? `${fechaHora(estado.ultima)}${estado.por ? ` (${estado.por})` : ""}` : "ninguna"} · <b>Próxima automática:</b> <span data-testid="importacion-proxima">{estado.proxima}</span>
      </p>
      <p className="pequeno suave" style={{ margin: 0 }}>
        ¿Lo necesitas ya? Pídeselo a Claude en el chat o abre la app de Claude → Tareas programadas → «{TAREA_RESPUESTAS.nombre}» → Ejecutar ahora.
        {enlaceImportar && <> <Link href="/gestion/eventos/importar?t=respuestas">Ver las importaciones</Link></>}
      </p>
    </div>
  );
}

import type { Aviso } from "@/lib/equipacion";
import { Alerta, Check, Info } from "@/components/Iconos";

// Aviso de equipacion con el aspecto de las maquetas (icono + titulo + texto). Mismo calculo y mismos textos que el
// resto de pantallas (D75): clases eq-aviso eq-<tipo> y data-tipo para las pruebas.
export default function AvisoTarjeta({ aviso, corto = false }: { aviso: Aviso | null | undefined; corto?: boolean }) {
  if (!aviso) return null;
  if (!aviso.hay) {
    return (
      <div className="eq-tarjeta eq-sin" data-tipo="sin_choque">
        <Check />
        <span>Equipación habitual: negra. {aviso.conocido ? "Sin choque de color." : "Sin color del rival: confirmadlo antes del partido."}</span>
      </div>
    );
  }
  const etiqueta = (aviso.etiqueta ?? "").replace(/^[⚠ℹ]\s*/, "");
  return (
    <div className={`eq-aviso eq-tarjeta eq-${aviso.tipo}`} role="note" data-tipo={aviso.tipo}>
      {aviso.tipo === "cambian_ellos" ? <Info /> : <Alerta />}
      <span>
        <strong className="eq-etq">{etiqueta}.</strong>{" "}
        <span className="eq-txt">{corto && aviso.tipo === "cambian_ellos" ? "Jugamos de negro." : aviso.texto}</span>
      </span>
    </div>
  );
}

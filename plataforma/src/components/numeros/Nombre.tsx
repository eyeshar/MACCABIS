import Link from "next/link";
import { hrefJugador } from "@/lib/numeros/enlaces";

/** Nombre de un jugador como enlace a su ficha (D139), salvo que no tenga estadisticas o se pase `aqui` (ya estas en su pagina). */
export default function NombreJugador({ nombre, personId, aqui = false, negrita = false }: { nombre: string; personId: string | null | undefined; aqui?: boolean; negrita?: boolean }) {
  const href = aqui ? null : hrefJugador(personId);
  const texto = negrita ? <b>{nombre}</b> : nombre;
  return href ? <Link href={href} className="num-nombre">{texto}</Link> : <>{texto}</>;
}

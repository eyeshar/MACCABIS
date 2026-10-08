import { descripcionColores } from "@/data/avisosEquipacion";

/** "camiseta roja, pantalón rojo": el texto del color de un equipo, con el género de cada prenda (D105). Aparte de
 *  lib/equipacion.ts para que lo usen también los componentes de cliente sin cargar el calendario ni las equipaciones. */
export const textoColores = (c: { camiseta: string; pantalon: string }) => descripcionColores(c.camiseta, c.pantalon);

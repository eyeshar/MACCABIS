"use client";

import { usePathname } from "next/navigation";

/** La direccion que ve la persona. Con los rewrites de D175 («/» con sesion -> /inicio; /liga?g= -> /liga/con-parametros...)
 *  el navegador hidrata con la ruta INTERNA al cargar la pagina de golpe (no al navegar): aqui se deshace, para que la
 *  navegacion, el rastro y el asistente sigan viendo «/», «/liga»… como siempre. */
const GEMELAS = ["/liga", "/club", "/club/historia"];
export const rutaVisible = (ruta: string) => (ruta === "/inicio" ? "/" : GEMELAS.find((g) => ruta === `${g}/con-parametros`) ?? ruta);

export const useRuta = () => rutaVisible(usePathname());

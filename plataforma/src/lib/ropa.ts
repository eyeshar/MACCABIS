// Prendas y tallas del pedido de ropa (proveedor VIVE). Confirmado por Ivan (26/09/2026).

export const TALLAS = ["3", "4", "6", "8", "10", "12", "XS", "S", "M", "L", "XL", "XXL", "3XL", "5XL", "7XL"] as const;
export type Talla = (typeof TALLAS)[number];

export type PrendaId = "camiseta" | "pantalon" | "cubre" | "sudadera";

export type Prenda = {
  id: PrendaId;
  nombre: string;
  detalle: string;
  llevaNombre: boolean;
  llevaDorsal: boolean;
  imagen: string;
  imagenAlt: string;
  nota?: string;
};

export const PRENDAS: Prenda[] = [
  {
    id: "camiseta",
    nombre: "Camiseta de juego",
    detalle: "Negra, de tirantes",
    llevaNombre: true,
    llevaDorsal: true,
    imagen: "/ropa/camiseta.webp",
    imagenAlt: "Camiseta de juego negra de tirantes, vista de espaldas con nombre y dorsal",
  },
  {
    id: "pantalon",
    nombre: "Pantalón",
    detalle: "Negro",
    llevaNombre: false,
    llevaDorsal: true,
    imagen: "/ropa/pantalon.webp",
    imagenAlt: "Pantalón negro de baloncesto, vista de frente",
  },
  {
    id: "cubre",
    nombre: "Cubre",
    detalle: "Amarillo, de manga corta",
    llevaNombre: true,
    llevaDorsal: true,
    imagen: "/ropa/cubre.webp",
    imagenAlt: "Cubre amarillo de manga corta, vista de espaldas con nombre y dorsal",
    nota: "¿No tienes la equipación amarilla? El cubre lleva tu nombre y dorsal y vale como segunda camiseta de juego. No hace falta pedir otra.",
  },
  {
    id: "sudadera",
    nombre: "Sudadera / chaqueta",
    detalle: "Amarilla y negra, con capucha",
    llevaNombre: true,
    llevaDorsal: false,
    imagen: "/ropa/sudadera.webp",
    imagenAlt: "Sudadera amarilla y negra con capucha, vista de frente",
  },
];

export const PRENDA_POR_ID = Object.fromEntries(PRENDAS.map((p) => [p.id, p])) as Record<PrendaId, Prenda>;

export function lleva(prenda: PrendaId) {
  const p = PRENDA_POR_ID[prenda];
  return [p.llevaNombre ? "nombre" : null, p.llevaDorsal ? "dorsal" : null, "talla"].filter(Boolean).join(" + ");
}

export const ordenTalla = (t: string) => {
  const i = (TALLAS as readonly string[]).indexOf(t);
  return i === -1 ? 999 : i;
};

export type Tallas = Partial<Record<PrendaId, string>>;

export type Pedido = {
  id: string;
  campana_id: string;
  para: "yo" | "familiar";
  nombre_completo: string;
  nombre_ropa: string | null;
  dorsal: number | null;
  tallas: Tallas;
  actualizado_en?: string;
  campana_nombre?: string;
  campana_abierta?: boolean;
};

export type Campana = {
  id: string;
  nombre: string;
  proveedor: string;
  estado: "abierta" | "cerrada";
  fecha_limite: string | null;
  precios: Partial<Record<PrendaId, number>>;
  guia_tallas_url: string | null;
  abierta_ahora: boolean;
};

// Mensajes para el jugador de los codigos de error de guardar_pedido().
export const ERRORES_PEDIDO: Record<string, string> = {
  enlace_invalido: "Tu enlace ya no es válido. Pide uno nuevo a los gestores.",
  no_encontrado: "No encontramos ese pedido.",
  campana_cerrada: "El pedido de ropa está cerrado: ya no se pueden enviar ni cambiar pedidos.",
  falta_talla: "Falta elegir la talla de alguna prenda.",
  talla_invalida: "Hay una talla que no existe en VIVE.",
  sin_prendas: "Elige al menos una prenda.",
  falta_nombre_completo: "Escribe el nombre completo de la persona.",
  falta_nombre_ropa: "Escribe el nombre que irá en la ropa (máximo 15 letras).",
  dorsal_invalido: "El dorsal tiene que ser un número del 0 al 99.",
  dorsal_cogido: "Ese dorsal ya está cogido. Elige otro.",
  datos_invalidos: "Revisa los datos del pedido.",
};

// "Apellidos, Nombre" -> "Nombre Apellidos"
export function nombreNatural(oficial: string) {
  const [apellidos, nombre] = oficial.split(",").map((s) => s.trim());
  return nombre ? `${nombre} ${apellidos}` : oficial;
}

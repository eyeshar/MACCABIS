// "Descargar Excel para VIVE": reproduce el formato del listado que se mando a VIVE
// en 24/25 (privado/LISTADO MACCABIS 2024 (revisado).xlsx, que NO esta en git).
// Una hoja "Hoja1". Cabeceras en la fila 1. Bloques:
//   CAMISETA  A-C (NAME, Nº, talla)     D vacia
//   PANTALON  E-F (Nº, talla)           G vacia
//   CUBRE     H-J (NAME, Nº, talla)     K vacia
//   SUDADERA  L-M (NAME, talla)
// Cada bloque ordenado por talla de menor a mayor (y luego por dorsal y nombre).
// Estilo copiado de la plantilla: cabecera en negrita con fondo amarillo FFFF00,
// bordes finos en toda la tabla, todo centrado; nombres en Calibri 11 y numeros
// y tallas en Arial 10; columnas separadoras D, G y K en blanco; y una fila vacia
// con bordes al final, como en la plantilla.
import ExcelJS from "exceljs";
import { ordenTalla } from "./ropa";

export type FilaPedido = {
  nombre_ropa: string | null;
  dorsal: number | null;
  talla_camiseta: string | null;
  talla_pantalon: string | null;
  talla_cubre: string | null;
  talla_sudadera: string | null;
};

type Celda = string | number | null;

const valorTalla = (t: string): string | number => (/^\d+$/.test(t) ? Number(t) : t);

function ordenar<T extends { talla: string; dorsal?: number | null; nombre?: string | null }>(filas: T[]) {
  return filas.sort(
    (a, b) =>
      ordenTalla(a.talla) - ordenTalla(b.talla) ||
      (a.dorsal ?? 999) - (b.dorsal ?? 999) ||
      (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
  );
}

export function bloquesVive(pedidos: FilaPedido[]) {
  const camiseta = ordenar(pedidos.filter((p) => p.talla_camiseta).map((p) => ({ nombre: p.nombre_ropa, dorsal: p.dorsal, talla: p.talla_camiseta! })));
  const pantalon = ordenar(pedidos.filter((p) => p.talla_pantalon).map((p) => ({ dorsal: p.dorsal, talla: p.talla_pantalon! })));
  const cubre = ordenar(pedidos.filter((p) => p.talla_cubre).map((p) => ({ nombre: p.nombre_ropa, dorsal: p.dorsal, talla: p.talla_cubre! })));
  const sudadera = ordenar(pedidos.filter((p) => p.talla_sudadera).map((p) => ({ nombre: p.nombre_ropa, talla: p.talla_sudadera! })));
  return { camiseta, pantalon, cubre, sudadera };
}

const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const CABECERAS = ["NAME", "Nº", "CAMISETA", null, "Nº", "PANTALON", null, "NAME", "Nº", "CUBRE", null, "NAME", "SUDADERA"];
const SEPARADORES = new Set([4, 7, 11]); // D, G, K
const COLUMNAS_NOMBRE = new Set([1, 8, 12]); // A, H, L

export async function excelVive(pedidos: FilaPedido[]) {
  const b = bloquesVive(pedidos);
  const filas = Math.max(b.camiseta.length, b.pantalon.length, b.cubre.length, b.sudadera.length);

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Hoja1");
  hoja.getColumn(1).width = 11.42578125;
  hoja.getColumn(4).width = 6.28515625;
  hoja.getColumn(6).width = 11.42578125;
  hoja.getColumn(7).width = 6.28515625;
  hoja.getColumn(8).width = 11.42578125;
  hoja.getColumn(11).width = 6.28515625;
  hoja.getColumn(12).width = 11.42578125;

  // Fila 1: cabeceras.
  CABECERAS.forEach((texto, i) => {
    const c = hoja.getCell(1, i + 1);
    c.value = texto;
    c.font = { name: "Calibri", size: 11, bold: true };
    c.border = BORDE;
    c.alignment = { horizontal: "center" };
    c.fill = SEPARADORES.has(i + 1)
      ? { type: "pattern", pattern: "solid", fgColor: { theme: 0 } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  });

  // Filas de datos (+1 fila vacia con bordes al final, como la plantilla).
  for (let r = 0; r < filas + 1; r++) {
    const fila: Celda[] = new Array(13).fill(null);
    const cam = b.camiseta[r];
    if (cam) [fila[0], fila[1], fila[2]] = [cam.nombre, cam.dorsal, valorTalla(cam.talla)];
    const pan = b.pantalon[r];
    if (pan) [fila[4], fila[5]] = [pan.dorsal, valorTalla(pan.talla)];
    const cub = b.cubre[r];
    if (cub) [fila[7], fila[8], fila[9]] = [cub.nombre, cub.dorsal, valorTalla(cub.talla)];
    const sud = b.sudadera[r];
    if (sud) [fila[11], fila[12]] = [sud.nombre, valorTalla(sud.talla)];

    fila.forEach((valor, i) => {
      const col = i + 1;
      const c = hoja.getCell(r + 2, col);
      if (valor !== null && valor !== undefined) c.value = valor;
      c.border = BORDE;
      if (COLUMNAS_NOMBRE.has(col)) {
        c.font = { name: "Calibri", size: 11 };
        c.alignment = { horizontal: "center" };
      } else {
        c.font = { name: "Arial", size: 10 };
        c.alignment = { horizontal: "center", wrapText: true };
      }
      if (SEPARADORES.has(col)) c.fill = { type: "pattern", pattern: "solid", fgColor: { theme: 0 } };
      // Rareza de la plantilla, copiada para que sea identica: las celdas vacias de la
      // columna E (dorsal del pantalon) bajo el bloque llevan relleno blanco (no se ve).
      if (col === 5 && (valor === null || valor === undefined)) c.fill = { type: "pattern", pattern: "solid", fgColor: { theme: 0 } };
    });
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

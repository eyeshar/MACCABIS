export type Partido = {
  equipo: "MDA" | "MDL"; jornada: number; fecha: string | null; hora: string | null; local: boolean | null;
  descansa: boolean; rival: string | null; campo: string | null;
};
export type Equipaciones = {
  fecha: string; fuente: string;
  regla_choque: { camiseta_rival_choca: string[]; nuestra_segunda: string; nuestra_primera: string; quien_cambia: null | { articulo: string; cambia: "segundo_en_calendario"; cita: string; fuente: string } };
  paleta: Record<string, string>;
  equipos: Record<string, { nombre: string; grupo: string; camiseta: string; pantalon: string; camiseta_original: string; pantalon_original: string; nuestro?: boolean }>;
};
export type Aviso = {
  rival: string; colorRival: string | null; pantalonRival: string | null; conocido: boolean; hay: boolean;
  tipo: "nos_toca" | "cambian_ellos" | "dudoso" | null; quien: "nosotros" | "rival" | "dudoso" | null; etiqueta: string | null; texto: string | null; convocatoria: string | null;
};
export function clave(nombre: string | null | undefined): string;
export function colorNormalizado(texto: string): string;
export function equipoPorNombre(equip: Equipaciones, nombre: string | null | undefined): Equipaciones["equipos"][string] | null;
export function chocan(equip: Equipaciones, colorRival: string): boolean;
export function avisoPartido(equip: Equipaciones, partido: Partial<Partido> | null): Aviso | null;
export function lineaConvocatoria(equip: Equipaciones, partido: Partial<Partido> | null): string | null;
export function proximoPartido(calendario: { partidos: Partido[] }, hoy: string, equipo: "MDA" | "MDL"): Partido | null;
export function listarAvisos(equip: Equipaciones, calendario: { partidos: Partido[] }): { fecha: string; equipo: string; jornada: number; rival: string; color: string; tipo: string; texto: string }[];
export function rivalesSinColor(equip: Equipaciones, calendario: { partidos: Partido[] }): string[];

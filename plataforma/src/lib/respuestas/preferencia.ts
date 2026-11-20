// Preferencia de partido en un domingo con dos partidos (D194). Funciones PURAS (las usan las pantallas, el motor y las
// pruebas). Solo cuenta si el jugador va a los dos («A los dos», o «Voy» con los dos partidos a la misma hora): entonces
// puede decir cuál prefiere y por qué. La ven SOLO él y los gestores (RLS de preferencias_domingo).

/** EL ÚNICO SITIO con la lista de motivos (id, texto y orden). La base comprueba los mismos identificadores
 *  (migración 20261120100000, check de preferencias_domingo.motivo y guardar_preferencia): para cambiar la lista, se
 *  cambia aquí y se añade una migración con el check nuevo (pruebas:preferencia-rls falla si no coinciden). */
export const MOTIVOS_PREFERENCIA = [
  { id: "trabajo", texto: "Trabajo" },
  { id: "familia", texto: "Familia" },
  { id: "ninos", texto: "Niños" },
  { id: "desplazamiento", texto: "Desplazamiento" },
  { id: "otro", texto: "Otro" },
] as const;
export type MotivoPreferencia = (typeof MOTIVOS_PREFERENCIA)[number]["id"];
/** Con este motivo la nota es obligatoria. */
export const MOTIVO_CON_NOTA: MotivoPreferencia = "otro";
export const NOTA_MAXIMA = 200;
export const TEXTO_FIJO_PREFERENCIA = "Es una preferencia: intentaremos tenerla en cuenta, pero no es seguro.";

export const textoMotivoPreferencia = (id: string | null | undefined) => MOTIVOS_PREFERENCIA.find((m) => m.id === id)?.texto ?? "Otro";
export const esMotivoPreferencia = (id: unknown): id is MotivoPreferencia => MOTIVOS_PREFERENCIA.some((m) => m.id === id);

/** Una preferencia guardada (fila de preferencias_domingo). */
export type Preferencia = { fecha: string; person_id: string; evento_id: string; motivo: MotivoPreferencia; nota: string | null; cambiado_en: string };

/** ¿Se puede guardar? (lo mismo que comprueba guardar_preferencia en la base). null = sí; si no, el texto del porqué. */
export function faltaParaGuardar(evento: string | null, motivo: string | null, nota: string): string | null {
  if (!evento) return "Elige el partido que prefieres.";
  if (!motivo || !esMotivoPreferencia(motivo)) return "Elige un motivo para guardar.";
  const n = nota.trim();
  if (motivo === MOTIVO_CON_NOTA && !n) return "Con «Otro», escribe el motivo en la nota.";
  if (n.length > NOTA_MAXIMA) return `La nota es demasiado larga (${NOTA_MAXIMA} letras como mucho).`;
  return null;
}

/** ¿Se enseña el bloque «¿Prefieres alguno?»? Solo con dos partidos y la opción que le pone en los dos («ambos» con horas
 *  distintas, «voy» a la misma hora). Con una ficha, un solo partido, «solo», «no» o «duda», nada. */
export const muestraPreferencia = (nPartidos: number, opcionMarcada: string | null) =>
  nPartidos === 2 && (opcionMarcada === "ambos" || opcionMarcada === "voy");

/** El texto de la marca para el gestor: «Prefiere el MdA · Trabajo · «nota»». */
export function textoPreferenciaGestor(p: { motivo: string; nota: string | null }) {
  return `${textoMotivoPreferencia(p.motivo)}${p.nota ? ` · «${p.nota}»` : ""}`;
}

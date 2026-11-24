// D200: en el real, una respuesta nueva con origen 'sporteasy' se rechaza (disparador respuestas_sin_importadas). En la
// pila de las pruebas muchas suites siguen creando filas «importadas de SportEasy» como dato de partida (es el histórico
// que hay en el real), así que aquí el disparador se apaga tras cada migración. pruebas:fin-sporteasy lo enciende para
// comprobar que rechaza y lo vuelve a apagar.
export async function permitirImportadasEnPruebas(sql) {
  const [t] = await sql`select 1 from pg_trigger where tgname = 'respuestas_sin_importadas' and tgrelid = 'public.respuestas'::regclass`;
  if (t) await sql`alter table public.respuestas disable trigger respuestas_sin_importadas`;
}

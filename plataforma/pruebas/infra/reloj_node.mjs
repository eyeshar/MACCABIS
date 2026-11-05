// Se carga con `node --import` en el proceso de la web de las PRUEBAS (infra/reloj.mjs: entornoReloj). Con PRUEBAS_RELOJ,
// Date empieza en ese instante y avanza al ritmo normal (D185). Sin la variable no hace nada. Nunca va a Vercel.
// Es una función (no una subclase) para que valga también llamada sin `new` y con los métodos estáticos propios (parse, UTC):
// Next los copia al compilar. Las fechas que crea son Date normales (mismo prototipo: instanceof sigue valiendo).
const instante = process.env.PRUEBAS_RELOJ;
if (instante) {
  const Real = Date;
  // Con la referencia común de la prueba (PRUEBAS_RELOJ_REF), la misma hora que la base y el navegador (infra/reloj.mjs).
  const desfase = new Real(instante).getTime() - Number(process.env.PRUEBAS_RELOJ_REF || Real.now());
  if (Number.isNaN(desfase)) throw new Error(`PRUEBAS_RELOJ no es una fecha: ${instante}`);
  const ahora = () => Real.now() + desfase;
  function DatePrueba(...a) {
    if (!new.target) return new Real(ahora()).toString();
    return a.length === 0 ? new Real(ahora()) : new Real(...a);
  }
  DatePrueba.prototype = Real.prototype;
  DatePrueba.now = ahora;
  DatePrueba.parse = Real.parse;
  DatePrueba.UTC = Real.UTC;
  globalThis.Date = DatePrueba;
}

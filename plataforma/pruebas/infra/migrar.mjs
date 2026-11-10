// `migrar` de las pruebas: el de scripts/db.mjs y, después, el reloj de las pruebas en la base (D185). Lo usan las suites
// que deshacen una migración y la vuelven a aplicar: al recrear funciones, volverían a usar el now() real. Y espera a que
// PostgREST tenga el esquema al día (infra/esquema.mjs): sin eso, la primera llamada a la API tras volver a migrar podía
// llegar a una caché a medias (404/503; pruebas:domingo y pruebas:planes, intermitentes en Actions).
import { migrar as migrarDe } from '../../scripts/db.mjs';
import { fijarRelojBase } from './reloj.mjs';
import { esquemaAlDia } from './esquema.mjs';

export async function migrar(sql, opciones) {
  const r = await migrarDe(sql, opciones);
  await fijarRelojBase(sql);
  await esquemaAlDia(sql);
  return r;
}

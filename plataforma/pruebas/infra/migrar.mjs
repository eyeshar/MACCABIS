// `migrar` de las pruebas: el de scripts/db.mjs y, después, el reloj de las pruebas en la base (D185). Lo usan las suites
// que deshacen una migración y la vuelven a aplicar: al recrear funciones, volverían a usar el now() real.
import { migrar as migrarDe } from '../../scripts/db.mjs';
import { fijarRelojBase } from './reloj.mjs';

export async function migrar(sql, opciones) {
  const r = await migrarDe(sql, opciones);
  await fijarRelojBase(sql);
  return r;
}

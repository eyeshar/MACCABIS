// Revierte, en orden inverso, las migraciones POSTERIORES a `desde` que tienen su .revertir.sql y estan aplicadas (solo en la pila
// de pruebas). Las pruebas de reversibilidad deshacen migraciones antiguas: con otras mas nuevas encima (la vista publica con la
// ubicacion libre, D138; «han entrado», D140) fallaria con «cannot drop columns from view». `migrar` las vuelve a aplicar todas.
import fs from 'node:fs';
import path from 'node:path';

export async function revertirPosteriores(sql, migs, desde) {
  const lista = fs.readdirSync(migs).map((f) => f.match(/^(\d{14})_.*\.revertir\.sql$/)).filter((m) => m && m[1] > desde).sort((a, b) => (a[1] < b[1] ? 1 : -1));
  for (const m of lista) {
    if ((await sql`select 1 from supabase_migrations.schema_migrations where version = ${m[1]}`).length) await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(migs, m[0]), 'utf8')));
  }
}

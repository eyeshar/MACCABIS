-- Paso 2 (pista E, D94): lo publico (club, panel) necesita saber cual es la pista habitual de la serie de entrenos y si
-- esta en obras. Vista nueva, SOLO ADITIVA, con lo minimo (nombre y estado): sin direccion ni notas internas.
-- Reversion: 20261007232000_pista_habitual_publica.revertir.sql
create view public.v_pista_habitual_publica as
select nombre, nombre_corto, estado from public.pistas where es_de_serie and uso = 'entreno';
revoke all on public.v_pista_habitual_publica from anon, authenticated, public;
grant select on public.v_pista_habitual_publica to anon, authenticated;

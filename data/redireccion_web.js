/* Redireccion de las URL antiguas de GitHub Pages a la web nueva (maccabis.vercel.app), paso 2 del rediseño.
 *
 * Cada pestaña de index.html tiene su pagina nueva. Esta tabla es la unica fuente de la correspondencia: la usa index.html
 * (cuando Iván dé el OK final) y la prueba plataforma/pruebas/liga_cuadre.mjs (que comprueba que cada URL antigua lleva a
 * una pagina nueva que existe).
 *
 *   ESTA_ACTIVA = false  -> GitHub Pages sigue publicada como siempre, con su barra «← Volver a Maccabis».
 *   ESTA_ACTIVA = true   -> cada pestaña redirige (location.replace) a su pagina nueva. Es el cambio del OK final.
 *
 * MIGRADAS lista lo que ya está en la web nueva: lo que no está aqui no redirige (sigue en GitHub Pages).
 */
(function (raiz) {
  var NUEVA_WEB = 'https://maccabis.vercel.app';
  var ESTA_ACTIVA = false;
  var TEMPORADA_POR_DEFECTO = '2026-27';
  /* Pestañas de GitHub Pages (?p=) ya migradas. Entrega 1: Liga. Entrega 2: Plantilla (?p=jugadores) y Ficha (?p=jugador&j=). Entrega 3: Historia. */
  var MIGRADAS = ['equipo', 'jugadores', 'jugador', 'rankings', 'cuartos', 'asistencia', 'mda', 'liga', 'rivales'];
  var DE_TEMPORADA = ['equipo', 'rankings', 'cuartos', 'asistencia', 'mda'];

  function nuevaUrl(search, hash) {
    var q = new URLSearchParams(search || '');
    var t = q.get('t') || String(hash || '').replace('#', '');
    if (!/^\d{4}-\d{2}$/.test(t)) t = TEMPORADA_POR_DEFECTO;
    var p = q.get('j') ? 'jugador' : (q.get('p') || 'equipo');
    if (MIGRADAS.indexOf(p) < 0) return null;
    var extra = new URLSearchParams();
    if (DE_TEMPORADA.indexOf(p) >= 0) return '/liga/' + t + '/' + p;
    if (p === 'jugadores') return '/plantilla?t=' + t;
    if (p === 'jugador') return q.get('j') ? '/jugador/' + encodeURIComponent(q.get('j')) + '?t=' + t : '/jugador?t=' + t;
    if (p === 'liga') {
      if (q.get('g') === 'G1' || q.get('g') === 'G2') extra.set('g', q.get('g'));
      if (q.get('hoy')) extra.set('hoy', q.get('hoy'));
      return '/liga' + (extra.toString() ? '?' + extra.toString() : '');
    }
    if (p === 'rivales') {
      if (q.get('g') === 'MdA' || q.get('g') === 'MdL') extra.set('g', q.get('g'));
      if (q.get('r')) extra.set('r', q.get('r'));
      return '/liga/rivales' + (extra.toString() ? '?' + extra.toString() : '');
    }
    return null;
  }

  var api = { NUEVA_WEB: NUEVA_WEB, ESTA_ACTIVA: ESTA_ACTIVA, MIGRADAS: MIGRADAS, nuevaUrl: nuevaUrl };
  /* En el navegador: si esta activa, salta a la pagina nueva antes de pintar nada. */
  if (ESTA_ACTIVA && raiz.location) {
    var destino = nuevaUrl(raiz.location.search, raiz.location.hash);
    if (destino) raiz.location.replace(NUEVA_WEB + destino);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MaccabisRedireccion = api;
})(typeof window !== 'undefined' ? window : globalThis);

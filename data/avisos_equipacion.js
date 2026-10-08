// Avisos de choque de equipación (D79). UN SOLO cálculo para la web pública (<script src>) y la plataforma (copia
// sincronizada en plataforma/src/data/, ver plataforma/scripts/sincronizar_equipacion.mjs). Sin dependencias, sin
// fs y sin fecha "de hoy" implícita: todo entra por parámetros, así se prueba con datos fijos.
//
// Entradas: `equip` = data/equipaciones_2026-27.json; partidos = los de data/calendario_2026-27.json
// ({equipo: 'MDA'|'MDL', jornada, fecha, hora, local, descansa, rival, campo}).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AvisosEquipacion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  /** Clave de comparación: minúsculas, sin tildes ni comillas, sin puntos finales repetidos y con espacios simples. */
  function clave(nombre) {
    return String(nombre == null ? '' : nombre)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')       // ñ -> n, tildes fuera
      .replace(/�/g, 'n')                                 // la ñ rota del calendario ("CASTA?AZO")
      .replace(/["'“”‘’`´]/g, '')
      .toLowerCase().replace(/\.+(\s|$)/g, '$1').replace(/\s+/g, ' ').trim();
  }

  /** Quita el género y deja el color normalizado ("negra" -> "negro", "amarilla" -> "amarillo"). */
  function colorNormalizado(texto) {
    return clave(texto).replace(/\b(\w+?)a\b/g, (m, r) => (/^(negr|blanc|amarill|roj)$/.test(r) ? r + 'o' : m));
  }

  /** Equipo de `equip` por el nombre que venga (calendario, clasificación, mayúsculas...). null si no está. */
  function equipoPorNombre(equip, nombre) {
    const k = clave(nombre);
    if (!k) return null;
    const lista = equip.equipos;
    for (const id of Object.keys(lista)) {
      if (id === k || clave(lista[id].nombre) === k) return lista[id];
      if ((lista[id].alias || []).some((a) => clave(a) === k)) return lista[id];
    }
    return null;
  }

  /** Color con el género de la prenda ('f': camiseta -> "roja"; 'm': pantalón -> "rojo"). Azul, naranja y rosa no cambian. */
  function colorConGenero(color, genero) {
    const c = String(color == null ? '' : color);
    if (genero !== 'f') return c;
    return c.replace(/^(negr|blanc|amarill|roj)o$/, '$1a');
  }

  /** "camiseta roja, pantalón rojo": la descripción de una equipación, con cada color concordando con su prenda. */
  function descripcionColores(camiseta, pantalon) {
    return 'camiseta ' + colorConGenero(camiseta, 'f') + ', pantalón ' + colorConGenero(pantalon, 'm');
  }

  function chocan(equip, colorRival) {
    return equip.regla_choque.camiseta_rival_choca.indexOf(colorRival) >= 0;
  }

  function nuestraSegunda(equip) { return equip.regla_choque.nuestra_segunda; }  // "amarilla"

  /**
   * Aviso de un partido nuestro. null si descansa o no hay rival.
   * { rival, colorRival, pantalonRival, conocido, hay, quien, etiqueta, texto, convocatoria }
   *  tipo: 'nos_toca' (vamos segundos: cambiamos) | 'cambian_ellos' (vamos primeros) | 'dudoso' (sin regla) | null (sin choque)
   */
  function avisoPartido(equip, partido) {
    if (!partido || partido.descansa || !partido.rival) return null;
    const e = equipoPorNombre(equip, partido.rival);
    const segunda = nuestraSegunda(equip);
    if (!e) return { rival: partido.rival, colorRival: null, pantalonRival: null, conocido: false, hay: false, tipo: null, quien: null, etiqueta: null, texto: 'Sin color del rival', convocatoria: null };
    const color = e.camiseta;
    const base = { rival: e.nombre, colorRival: color, pantalonRival: e.pantalon, conocido: true };
    if (!chocan(equip, color)) return { ...base, hay: false, tipo: null, quien: null, etiqueta: null, texto: null, convocatoria: null };
    const regla = equip.regla_choque.quien_cambia;
    const primera = equip.regla_choque.nuestra_primera;
    // Bases 47 JDM, 5.11: cambia el equipo que figura en SEGUNDO lugar del calendario (el visitante: el calendario
    // lista primero al local). Sin regla, o sin saber quién es local, solo se avisa de la coincidencia.
    if (regla && regla.cambia === 'segundo_en_calendario' && typeof partido.local === 'boolean') {
      if (!partido.local) {
        return {
          ...base, hay: true, tipo: 'nos_toca', quien: 'nosotros', etiqueta: '⚠ Nos toca cambiar: equipación ' + segunda.toUpperCase(),
          texto: 'Vamos en segundo lugar contra ' + e.nombre + ' (' + color + '). Obligatorio: si no cambiamos, partido perdido (Bases 47 JDM, 5.11).',
          convocatoria: 'Llevad la equipación ' + segunda.toUpperCase() + ' (nos toca cambiar).',
        };
      }
      return {
        ...base, hay: true, tipo: 'cambian_ellos', quien: 'rival', etiqueta: 'ℹ Coinciden colores: cambia ' + e.nombre,
        texto: 'Jugamos de ' + primera + '; ' + e.nombre + ' (' + color + ') va en segundo lugar y debe cambiar. Llevad la ' + segunda + ' por si acaso.',
        convocatoria: 'Jugamos de ' + primera + '; cambia ' + e.nombre + '. Llevad la ' + segunda + ' por si acaso.',
      };
    }
    return {
      ...base, hay: true, tipo: 'dudoso', quien: 'dudoso', etiqueta: '⚠ Equipación ' + segunda,
      texto: 'Coincidencia de color con ' + e.nombre + ' (' + color + '): llevad la ' + segunda + ' por si acaso',
      convocatoria: 'Llevad la equipación ' + segunda,
    };
  }

  /** Línea para la convocatoria / WhatsApp (rutina C): "Llevad la equipación amarilla", o null si no toca. */
  function lineaConvocatoria(equip, partido) {
    const a = avisoPartido(equip, partido);
    return a ? a.convocatoria : null;
  }

  /** Próximo partido (con rival) de `equipo` desde `hoy` ("AAAA-MM-DD", inclusive). */
  function proximoPartido(calendario, hoy, equipo) {
    return calendario.partidos
      .filter((p) => p.equipo === equipo && !p.descansa && p.rival && p.fecha && p.fecha >= hoy)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))[0] || null;
  }

  /** Todos los partidos con aviso, ordenados por fecha: [{fecha, equipo, jornada, rival, color, texto}]. */
  function listarAvisos(equip, calendario) {
    return calendario.partidos
      .map((p) => ({ p, a: avisoPartido(equip, p) }))
      .filter((x) => x.a && x.a.hay)
      .map((x) => ({ fecha: x.p.fecha, equipo: x.p.equipo, jornada: x.p.jornada, rival: x.a.rival, color: x.a.colorRival, tipo: x.a.tipo, texto: x.a.texto }))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.equipo < b.equipo ? -1 : 1));
  }

  /** Rivales del calendario sin color mapeado (la prueba exige que esté vacío). */
  function rivalesSinColor(equip, calendario) {
    const f = {};
    calendario.partidos.forEach((p) => { if (p.rival && !equipoPorNombre(equip, p.rival)) f[p.rival] = 1; });
    return Object.keys(f);
  }

  return { clave, colorNormalizado, colorConGenero, descripcionColores, equipoPorNombre, chocan, avisoPartido, lineaConvocatoria, proximoPartido, listarAvisos, rivalesSinColor };
});

"""
build_rivales_2026_27.py

Scouting de los rivales de 2026/27: trayectoria completa en los Juegos Deportivos Municipales
(baloncesto, sénior masculino, TODOS los distritos) y cara a cara con el club.

Fuente: Ayuntamiento de Madrid, portal de datos abiertos, licencia CC BY 4.0.
  - 300257 "Deportes colectivos - histórico" (2014/15 - 2024/25), descarga directa
    https://datos.madrid.es/egob/catalogo/300257-{n}-deportes-colectivos-historico.csv
      partidos        n = 3, 7, 11, 15, 19, 22, 26, 30, 34, 38
      clasificaciones n = 1, 5, 9, 13, 16, 20, 24, 28, 32, 36
  - 211549 "Juegos deportivos - temporada en curso" (2025/26), copia bruta en data/raw/.

NO toca season_*.json, personas.json ni el dashboard: sólo los lee.

Salidas: data/rivales_2026-27.json y docs/RIVALES_2026-27.md.

USO:  python scripts/build_rivales_2026_27.py [--csv .cache-jdm]
      En --csv deben estar p{n}.csv (partidos) y c{n}.csv (clasificaciones) del 300257.
"""
import csv, io, json, os, re, sys, glob, unicodedata, difflib, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA = os.path.join(ROOT, 'data')
DOCS = os.path.join(ROOT, 'docs')
args = sys.argv[1:]
CSVDIR = args[args.index('--csv') + 1] if '--csv' in args else os.path.join(ROOT, '.cache-jdm')

HOY = '2026-09-25'
FUENTE = 'Ayuntamiento de Madrid, portal de datos abiertos (datos.madrid.es), datasets 300257 y 211549. Licencia CC BY 4.0.'

# temporada -> (partidos, clasificaciones). None = 211549 (copia bruta en data/raw).
RECURSOS = {
    '2025-26': (None, None),
    '2024-25': (38, 36), '2023-24': (34, 32), '2022-23': (26, 24), '2021-22': (30, 28),
    '2020-21': (22, 20), '2018-19': (19, 16), '2017-18': (3, 1), '2016-17': (7, 5),
    '2015-16': (11, 9), '2014-15': (15, 13),
}
TEMPORADAS = list(RECURSOS)                      # la 2025/26 primero ("temporada pasada")
HUECOS = {
    '2013-14': 'No existe en el portal de datos abiertos.',
    '2019-20': 'No existe en el portal de datos abiertos.',
}

# Rivales de 2026/27, nombres tal cual los da la organización.
RIVALES = {
    'MdA': ['"TROPICALEROS"', 'Chavalitros', 'CHUPITIMANGUIS', 'Enfermos del Aro', 'LITROS DE MAHOU',
            'LOS KHINKIS RUSOS', 'NABUCO TD', 'RIF', 'VALLEKAS BASKET', 'WILD BOYS'],
    'MdL': ['28500', 'CASTAÑAZO', 'Craps', 'F.T. FLOPPERS', 'La Cancha Roja', 'MEJORADA 2012 C.B.',
            'Quinto Tiempo', 'Suanzes Motor', 'TRASCENDEDORES C.B.', 'VANNER'],
}
# Nombres antiguos CONFIRMADOS por Iván (25/09/2026): el mismo equipo a todos los efectos
# (trayectoria, temporadas en JDM, mejor resultado y cara a cara). La normalización ya cubre las
# variantes de puntuación y mayúsculas (SUIZA B. C., SUIZA B.C., Floppers…).
# `apodos` son nombres que sólo escribe el histórico propio: cuentan en el cara a cara, pero no se
# buscan en el portal (un "KINKIS" de otro distrito no sería el mismo equipo).
ALIAS_CONFIRMADOS = {
    'Suanzes Motor': {'alias': ['SUIZA', 'CARPASION SUIZA', 'CARPASION', 'SUIZA B.C.']},
    'VANNER': {'alias': ['VANNER PONENOS']},
    'NABUCO TD': {'alias': ['NABUCO']},
    'LOS KHINKIS RUSOS': {'alias': ['LOS KINKIS RUSOS', 'KHINKIS RUSOS'], 'apodos': ['KINKIS']},
    'F.T. FLOPPERS': {'alias': ['FLOPPERS']},
    'CASTAÑAZO': {'alias': ['EL CASTAÑAZO']},
    'VALLEKAS BASKET': {'alias': ['VALLEKAS BASKET THUNDERS']},
}
for _v in ALIAS_CONFIRMADOS.values():
    _v.update({'confirmado_por': 'Iván', 'fecha': HOY})
# Posibles alias que propuso el asistente en el chat (Iván no señaló ninguno). Siguen sin confirmar.
CANDIDATOS_PROPUESTOS_EN_CHAT = {
    'VANNER': ['PONENOS'],
}
# Descartados expresamente por Iván (25/09/2026): no son el mismo equipo.
DESCARTADOS_POR_IVAN = {
    'VALLEKAS BASKET': ['SPORTING DE VALLECAS', 'SPORTING DE VALLEKAS', 'SPORTING VALLECAS', 'SPORT. DE VALLECAS',
                        'SPORTING', 'GSD VALLECAS'],
}
# Regla del nombre del club, confirmada por Iván el 25/09/2026 (D26): en cuanto aparece "MDL" en
# una temporada, el "MACCABI DE LEVANTAR" de esa temporada NO es el club. Por eso #149233 (2020/21)
# es un rival, no un tercer equipo.
REGLA_NOMBRE_CLUB = ('El club compitió como MACCABI DE LEVANTAR hasta que otro grupo se quedó con ese nombre. '
                     'En cuanto aparece MDL en una temporada, el equipo llamado MACCABI DE LEVANTAR de esa temporada '
                     'NO es el club. MdL y MdA son el mismo club: el cara a cara siempre suma las dos fichas.')

# Códigos del club en 2025/26 (211549). Nombre inequívoco en Moratalaz; se validan por marcador
# contra season_2025-26.json en la verificación.
CLUB_2025_26 = {'177542': 'MdL', '178977': 'MdA', '190128': 'MdA'}
RIVAL_MACCABI_2020_21 = '149233'   # "MACCABI DE LEVANTAR" de 2020/21: rival, no del club
# En estas temporadas la etiqueta "MDL" de season_*.json es en realidad la ficha MdA
# (docs/DIAGNOSTICO_MDL_MDA.md).
ETIQUETA_MDL_ES_MDA = {'2017-18', '2018-19', '2020-21'}


# ------------------------------------------------------------------ lectura y limpieza
def leer_csv(path):
    """Parser CSV real (comillas, saltos de línea dentro de campo), separador ';'.
    Unos ficheros vienen en UTF-8 con BOM y otros en latin-1: se decide por fichero."""
    b = open(path, 'rb').read()
    try:
        s = b.decode('utf-8')
    except UnicodeDecodeError:
        s = b.decode('latin-1')
    s = s.lstrip('﻿')
    out = []
    for row in csv.DictReader(io.StringIO(s, newline=''), delimiter=';'):
        out.append({(k or '').strip(): (v or '').strip() if isinstance(v, str) else '' for k, v in row.items()})
    return out


# Los CSV antiguos (2014/15-2016/17, algo de 2018/19) traen texto en CP850 leído como latin-1:
# "CASTA¥AZO" es CASTAÑAZO, "MA¥ANA" es MAÑANA, "1¦ DIVISION" es 1ª DIVISION.
CP850 = {'¥': 'Ñ', '¤': 'ñ', '¦': 'ª', '§': 'º', '\x8e': 'Ä', '\x92': '’'}


def reparar(s):
    s = s or ''
    for a, b in CP850.items():
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def norm(s):
    """Normalización para emparejar: sin tildes, sin signos, en mayúsculas."""
    s = unicodedata.normalize('NFD', reparar(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z0-9]', '', s.upper())


def fecha_iso(f):
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', f or '')
    if m:
        return '-'.join(m.groups())
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})', f or '')
    return f'{m[3]}-{m[2]}-{m[1]}' if m else None


def es_bc_senior_masc_partido(r):
    # "SENIOR" hasta 2020/21 (con Sexo_grupo) y "SENIOR MASCULINO" desde 2021/22.
    return (r['Nombre_deporte'] == 'BALONCESTO' and r['Nombre_categoria'].startswith('SENIOR')
            and 'FEMENINO' not in r['Nombre_categoria'] and r.get('Sexo_grupo', '') == 'M')


def es_bc_senior_masc_clas(r):
    return (r['Nombre_deporte'] == 'BALONCESTO' and r['Nombre_categoria'].startswith('SENIOR')
            and r.get('Nombre-Sexo', '') == 'MASCULINO')


def ultimo_raw(prefijo):
    fs = sorted(glob.glob(os.path.join(DATA, 'raw', f'{prefijo}_*.csv')))
    if not fs:
        sys.exit(f'Falta data/raw/{prefijo}_AAAAMMDD.csv')
    return fs[-1]


def cargar():
    P, C, ficheros = {}, {}, {}
    for t, (np_, nc) in RECURSOS.items():
        fp = ultimo_raw('211549_partidos') if np_ is None else os.path.join(CSVDIR, f'p{np_}.csv')
        fc = ultimo_raw('211549_clasificaciones') if nc is None else os.path.join(CSVDIR, f'c{nc}.csv')
        for f in (fp, fc):
            if not os.path.exists(f):
                sys.exit(f'Falta {f}. Descarga los CSV del 300257 (ver cabecera).')
        ficheros[t] = {'partidos': os.path.relpath(fp, ROOT).replace('\\', '/'),
                       'clasificaciones': os.path.relpath(fc, ROOT).replace('\\', '/')}
        P[t] = [r for r in leer_csv(fp) if es_bc_senior_masc_partido(r)]
        C[t] = [r for r in leer_csv(fc) if es_bc_senior_masc_clas(r)]
        for r in P[t]:
            for k in ('Equipo_local', 'Equipo_visitante', 'Nombre_grupo', 'Nombre_fase', 'Distrito', 'Nombre_competicion'):
                r[k] = reparar(r[k])
        for r in C[t]:
            for k in ('Nombre_equipo', 'Nombre_grupo', 'Nombre_fase', 'Nombre_distrito', 'Nombre_competicion'):
                r[k] = reparar(r[k])
    return P, C, ficheros


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def es_descanso(r):
    txt = (r['Equipo_local'] + ' ' + r['Equipo_visitante']).upper()
    return (not r['Equipo_local'] or not r['Equipo_visitante']
            or re.search(r'DESCANSA|DESCANSO|PASA RONDA|\*\*', txt) is not None)


def jugado(r):
    """Partido con resultado: ni descanso, ni ronda vacía, ni 0-0 sin disputar."""
    if es_descanso(r):
        return False
    a, b = num(r['Resultado1']), num(r['Resultado2'])
    return a is not None and b is not None and not (a == 0 and b == 0)


# ------------------------------------------------------------------ fases
def tipo_fase(nombre_fase, nombre_comp):
    f = (nombre_fase or '').upper()
    if 'TMPAL' in f or 'TORNEO' in (nombre_comp or '').upper():
        if 'FINAL' in f:
            return 'torneo_final_madrid', 'Torneo municipal: final de Madrid'
        if 'ELIMINATORIA' in f:
            return 'torneo_eliminatorias', 'Torneo municipal: eliminatorias'
        return 'torneo_grupo', 'Torneo municipal: grupos'
    if 'FINAL' in f and 'MADRID' in f:
        return 'final_madrid', 'Fase final de Madrid'
    if 'DISTRITO' in f:
        return 'distrito', 'Fase de distrito'
    if 'SEGUNDA' in f:
        return 'liga_2', 'Liga: segunda fase'
    return 'liga', 'Liga: fase de grupos'


RONDAS = {1: 'Final', 2: 'Semifinales', 4: 'Cuartos', 8: 'Octavos', 16: 'Dieciseisavos'}


def indices(P):
    """Por temporada: filas por código de equipo y por grupo, y sistema de cada grupo."""
    idx = {}
    for t, rows in P.items():
        por_eq, por_grupo, sistema = collections.defaultdict(list), collections.defaultdict(list), {}
        for r in rows:
            por_grupo[r['Codigo_grupo']].append(r)
            sistema[r['Codigo_grupo']] = r.get('SISTEMA_COMPETICION', '') or sistema.get(r['Codigo_grupo'], '')
            por_eq[r['Codigo_equipo1']].append(r)
            if r['Codigo_equipo2'] != r['Codigo_equipo1']:
                por_eq[r['Codigo_equipo2']].append(r)
        idx[t] = {'eq': por_eq, 'grupo': por_grupo, 'sistema': sistema}
    return idx


def ronda_de(idx_t, r):
    n = sum(1 for x in idx_t['grupo'][r['Codigo_grupo']] if x['Jornada'] == r['Jornada'])
    return RONDAS.get(n, f'Ronda {r["Jornada"]}')


def incomparecencias_perdidas(idx_t, cod, grupo):
    """Partidos del grupo que el equipo perdió por no presentarse (estado "N" y marcador en contra).
    El portal los cuenta en PJ pero no en G ni en P, y restan puntos (D29)."""
    n = 0
    for r in idx_t['grupo'].get(grupo, []):
        if r['Estado'] != 'N' or cod not in (r['Codigo_equipo1'], r['Codigo_equipo2']):
            continue
        a, b = num(r['Resultado1']) or 0, num(r['Resultado2']) or 0
        if a != b and (a < b) == (r['Codigo_equipo1'] == cod):
            n += 1
    return n


def recorrido_eliminatoria(idx_t, cod, grupo):
    """Hasta dónde llegó un equipo en un cuadro de eliminatorias (sistema COPA)."""
    ps = [r for r in idx_t['grupo'][grupo] if cod in (r['Codigo_equipo1'], r['Codigo_equipo2'])]
    ps.sort(key=lambda r: (num(r['Jornada']) or 0))
    jug = [r for r in ps if jugado(r)]
    if not jug:
        return {'texto': 'inscrito en el cuadro, sin partidos con resultado en el portal', 'ronda': None, 'nivel': 0}
    u = jug[-1]
    local = u['Codigo_equipo1'] == cod
    pf, pc = num(u['Resultado1']), num(u['Resultado2'])
    if not local:
        pf, pc = pc, pf
    ronda = ronda_de(idx_t, u)
    gano = pf > pc
    max_j = max(num(x['Jornada']) or 0 for x in idx_t['grupo'][grupo])
    if ronda == 'Final':
        txt = 'Campeón' if gano else 'Subcampeón'
    elif gano and (num(u['Jornada']) or 0) < max_j:
        txt = f'Ganó {ronda.lower()} ({pf}-{pc}); la ronda siguiente no tiene resultado en el portal'
    elif gano:
        txt = f'Ganó {ronda.lower()} ({pf}-{pc})'
    else:
        txt = f'Eliminado en {ronda.lower()} ({pf}-{pc})'
    orden = {'Final': 5, 'Semifinales': 4, 'Cuartos': 3, 'Octavos': 2, 'Dieciseisavos': 1}
    nivel = orden.get(ronda, 0) + (1 if (ronda == 'Final' and gano) else 0)
    return {'texto': txt, 'ronda': ronda, 'gano_ultima': gano, 'nivel': nivel}


# ------------------------------------------------------------------ trayectoria
def codigos_por_nombre(P, C):
    """temporada -> norm(nombre) -> {codigo: nombre tal cual}."""
    out = {}
    for t in TEMPORADAS:
        m = collections.defaultdict(dict)
        for r in C[t]:
            m[norm(r['Nombre_equipo'])][r['Codigo_equipo']] = r['Nombre_equipo']
        for r in P[t]:
            for e, c in ((r['Equipo_local'], r['Codigo_equipo1']), (r['Equipo_visitante'], r['Codigo_equipo2'])):
                if e:
                    m[norm(e)].setdefault(c, e)
        out[t] = m
    return out


def fila_clas(r, n_equipos):
    pj, g, e, p = (num(r[k]) for k in ('Partidos_jugados', 'Partidos_ganados', 'Partidos_empatados', 'Partidos_perdidos'))
    pf, pc = num(r['Goles_favor']), num(r['Goles_contra'])
    return {'posicion': num(r['Posicion']), 'equipos_en_grupo': n_equipos, 'pj': pj, 'g': g, 'p': p,
            **({'e': e} if e else {}), 'pf': pf, 'pc': pc,
            'dif': (pf - pc) if pf is not None and pc is not None else None}


def trayectoria(nombres_norm, P, C, idx, cods):
    """Temporada a temporada, todas las inscripciones cuyo nombre normalizado está en nombres_norm."""
    out = []
    n_grupo = {t: collections.Counter(r['Codigo_grupo'] for r in C[t]) for t in TEMPORADAS}
    for t in TEMPORADAS:
        codigos = {}
        for n in nombres_norm:
            codigos.update(cods[t].get(n, {}))
        if not codigos:
            continue
        inscripciones = []
        for cod, nombre in sorted(codigos.items()):
            fases = []
            filas_c = [r for r in C[t] if r['Codigo_equipo'] == cod]
            grupos_vistos = set()
            for r in filas_c:
                g = r['Codigo_grupo']
                grupos_vistos.add(g)
                clave, etiqueta = tipo_fase(r['Nombre_fase'], r['Nombre_competicion'])
                f = {'tipo': clave, 'fase': etiqueta, 'competicion': r['Nombre_competicion'],
                     'nombre_fase': r['Nombre_fase'], 'grupo': r['Nombre_grupo'], 'distrito': r['Nombre_distrito'],
                     'codigo_grupo': g, 'fuente': 'clasificacion', **fila_clas(r, n_grupo[t][g])}
                n_np = incomparecencias_perdidas(idx[t], cod, g)
                if n_np:
                    f['incomparecencias'] = n_np
                if idx[t]['sistema'].get(g) == 'COPA':
                    f['eliminatoria'] = recorrido_eliminatoria(idx[t], cod, g)
                fases.append(f)
            # grupos con partidos pero sin fila de clasificación: se calculan de los partidos
            for g in sorted({r['Codigo_grupo'] for r in idx[t]['eq'].get(cod, [])} - grupos_vistos):
                rs = [r for r in idx[t]['eq'][cod] if r['Codigo_grupo'] == g]
                r0 = rs[0]
                clave, etiqueta = tipo_fase(r0['Nombre_fase'], r0['Nombre_competicion'])
                f = {'tipo': clave, 'fase': etiqueta, 'competicion': r0['Nombre_competicion'],
                     'nombre_fase': r0['Nombre_fase'], 'grupo': r0['Nombre_grupo'], 'distrito': r0['Distrito'],
                     'codigo_grupo': g, 'fuente': 'calculado de partidos (sin fila de clasificación)'}
                jg = [r for r in rs if jugado(r)]
                pf = sum(num(r['Resultado1'] if r['Codigo_equipo1'] == cod else r['Resultado2']) for r in jg)
                pc = sum(num(r['Resultado2'] if r['Codigo_equipo1'] == cod else r['Resultado1']) for r in jg)
                gw = sum(1 for r in jg if (num(r['Resultado1']) > num(r['Resultado2'])) == (r['Codigo_equipo1'] == cod))
                f.update({'posicion': None, 'equipos_en_grupo': None, 'pj': len(jg), 'g': gw, 'p': len(jg) - gw,
                          'pf': pf, 'pc': pc, 'dif': pf - pc})
                if idx[t]['sistema'].get(g) == 'COPA':
                    f['eliminatoria'] = recorrido_eliminatoria(idx[t], cod, g)
                fases.append(f)
            orden = ['liga', 'liga_2', 'distrito', 'final_madrid', 'torneo_grupo', 'torneo_eliminatorias', 'torneo_final_madrid']
            fases.sort(key=lambda f: orden.index(f['tipo']))
            if fases:
                inscripciones.append({'codigo_equipo': cod, 'nombre': nombre, 'fases': fases})
        # Antes de 2021/22 la segunda fase también se llama "JDM GRUPO": si hay varias ligas en la
        # temporada, se numeran por la fecha de su primer partido.
        por_distrito = collections.defaultdict(list)
        for i in inscripciones:
            for f in i['fases']:
                if f['tipo'] in ('liga', 'liga_2'):
                    por_distrito[norm(f['distrito'])].append(f)

        def inicio(f):
            fs = [fecha_iso(r['Fecha']) for r in idx[t]['grupo'].get(f['codigo_grupo'], []) if fecha_iso(r['Fecha'])]
            return min(fs) if fs else '9999'
        for ligas in por_distrito.values():
            if len(ligas) < 2:
                continue
            for n, f in enumerate(sorted(ligas, key=inicio), 1):
                f['fase'] = f'Liga: {n}ª fase'
                if n > 1:
                    f['tipo'] = 'liga_2'
        if inscripciones:
            # varios códigos en ligas de distritos distintos = homónimos simultáneos
            dist_liga = {f['distrito'] for i in inscripciones for f in i['fases'] if f['tipo'] == 'liga'}
            out.append({'temporada': t, 'temporada_pasada': t == '2025-26',
                        'nombres': sorted({i['nombre'] for i in inscripciones}),
                        'aviso_homonimos': (f'El mismo nombre compite en ligas de {len(dist_liga)} distritos esta temporada: '
                                            'pueden ser equipos distintos.') if len(dist_liga) > 1 else None,
                        'inscripciones': inscripciones})
    return out


def puntuar(t, f):
    """Mejor resultado histórico. Criterio: fase final de Madrid > torneo (final de Madrid) >
    fase de distrito > liga; dentro de cada una, la ronda o el puesto."""
    el = f.get('eliminatoria')
    pos = f.get('posicion') or 99
    if f['tipo'] == 'final_madrid':
        return 400 + (el['nivel'] if el else 0), f"{el['texto'] if el else 'Participó'} en la fase final de Madrid"
    if f['tipo'] == 'torneo_final_madrid':
        return 300 + (el['nivel'] if el else 0), f"{el['texto'] if el else 'Participó'} en la final de Madrid del torneo municipal"
    if f['tipo'] == 'distrito' and el:
        return 200 + el['nivel'], f"{el['texto']} en la fase de distrito ({f['distrito']})"
    if f['tipo'] in ('liga', 'liga_2', 'distrito'):
        # Puesto relativo al tamaño del grupo (1º = 100, último = 0). Una fase de distrito en formato
        # liga cuenta como una liga más.
        n = f.get('equipos_en_grupo') or pos
        rel = 100 if pos == 1 else (100 * (n - pos) / (n - 1) if n > 1 else 0)
        return rel, f"{pos}º de {n} en {f['grupo']} ({f['distrito']})"
    if f['tipo'] == 'torneo_eliminatorias' and el:
        return 50 + el['nivel'], f"{el['texto']} en las eliminatorias del torneo municipal"
    return 50 - min(pos, 49), f"{pos}º en {f['grupo']} (torneo municipal)"


def mejor_resultado(tray):
    best = None
    for s in tray:
        for i in s['inscripciones']:
            for f in i['fases']:
                sc, txt = puntuar(s['temporada'], f)
                if best is None or sc > best[0]:
                    best = (sc, f"{txt}, {s['temporada'].replace('-', '/')}")
    return best[1] if best else None


# ------------------------------------------------------------------ cara a cara
def leer_rivales_jdm():
    return json.load(open(os.path.join(DATA, 'rivales_jdm.json'), encoding='utf-8')), 'data/rivales_jdm.json'


def partidos_de_codigo(t, cod, ficha, idx, origen, nota=None):
    out = []
    for r in idx[t]['eq'].get(cod, []):
        if not jugado(r):
            continue
        local = r['Codigo_equipo1'] == cod
        pf, pc = num(r['Resultado1']), num(r['Resultado2'])
        if not local:
            pf, pc = pc, pf
        clave, etiqueta = tipo_fase(r['Nombre_fase'], r['Nombre_competicion'])
        p = {'temporada': t, 'fecha': fecha_iso(r['Fecha']), 'ficha': ficha, 'codigo_equipo': cod,
             'rival': r['Equipo_visitante'] if local else r['Equipo_local'],
             'codigo_rival': r['Codigo_equipo2'] if local else r['Codigo_equipo1'],
             'fase': etiqueta, 'grupo': r['Nombre_grupo'], 'pf': pf, 'pc': pc, 'res': 'G' if pf > pc else 'P',
             'origen': origen}
        if r['Estado'] == 'N':
            p['incomparecencia'] = True
        if nota:
            p['nota'] = nota
        out.append(p)
    return out


def construir_partidos_club(idx, P):
    rj, rj_ruta = leer_rivales_jdm()
    # nombre reparado del rival a partir de su código (rivales_jdm.json trae la codificación rota)
    nombre_cod = {t: {} for t in TEMPORADAS}
    for t in TEMPORADAS:
        for r in P[t]:
            nombre_cod[t][r['Codigo_equipo1']] = r['Equipo_local']
            nombre_cod[t][r['Codigo_equipo2']] = r['Equipo_visitante']
    incomp = {t: {(r['Codigo_equipo1'], r['Codigo_equipo2'], fecha_iso(r['Fecha'])) for r in P[t] if r['Estado'] == 'N'}
              for t in TEMPORADAS}
    club = []
    for p in rj['partidos']:
        t = p['temporada']
        par = {(p['codigo_equipo'], p['codigo_rival'], p.get('fecha')), (p['codigo_rival'], p['codigo_equipo'], p.get('fecha'))}
        clave, etiqueta = tipo_fase(p.get('nombre_fase'), p.get('competicion'))
        club.append({'temporada': t, 'fecha': p.get('fecha'), 'ficha': p['equipo'], 'codigo_equipo': p['codigo_equipo'],
                     'rival': nombre_cod.get(t, {}).get(p['codigo_rival']) or reparar(p['rival']),
                     'codigo_rival': p['codigo_rival'], 'fase': etiqueta, 'grupo': reparar(p.get('grupo')),
                     'pf': p['pf'], 'pc': p['pc'], 'res': 'G' if p['pf'] > p['pc'] else 'P',
                     'origen': 'rivales_jdm.json (portal 300257)',
                     **({'incomparecencia': True} if par & incomp.get(t, set()) else {})})
    for cod, ficha in CLUB_2025_26.items():
        club += partidos_de_codigo('2025-26', cod, ficha, idx, 'portal 211549')
    return club, rj_ruta


def leer_season(t):
    f = os.path.join(DATA, f'season_{t}.json')
    return json.load(open(f, encoding='utf-8')) if os.path.exists(f) else None


def fusionar_historico_propio(club):
    """Añade los partidos de season_*.json que el portal no trae. Deduplica por fecha+marcador y,
    sin fecha, por temporada+marcador."""
    anadidos, dup, ambiguos, difs, sin_marcador = [], 0, [], [], []
    seasons = sorted(f[7:14] for f in os.listdir(DATA) if re.match(r'season_\d{4}-\d{2}\.json$', f))
    usados = set()
    avisos = []
    for t in seasons:
        s = leer_season(t)
        # contradicción: el fichero etiquetado MDL juega contra "MDL" (o MDA contra "MDA")
        mismo = {'MDL': {'MDL', 'MACCABIDELEVANTAR'}, 'MDA': {'MDA', 'MACCABIDEACOSTAR'}}
        contra_club = sorted({q.get('rival') for q in s.get('partidos', [])
                              if norm(q.get('rival')) in mismo.get((q.get('equipo') or '').upper(), set())})
        aviso_t = None
        if contra_club and t not in ETIQUETA_MDL_ES_MDA and t != '2025-26':
            aviso_t = (f'season_{t}.json (etiqueta {s["partidos"][0].get("equipo")}) anota partidos contra '
                       f'{", ".join(contra_club)}: no puede ser ese equipo (misma prueba que DIAGNOSTICO_MDL_MDA.md). '
                       'No se ha cambiado la etiqueta; decide Iván.')
            avisos.append({'temporada': t, 'aviso': aviso_t})
        for q in s.get('partidos', []):
            if q.get('pf') is None or q.get('pc') is None:
                continue
            etq = (q.get('equipo') or '').upper()
            ficha = {'MDL': 'MdL', 'MDA': 'MdA'}.get(etq, etq)
            if t in ETIQUETA_MDL_ES_MDA and ficha == 'MdL':
                ficha = 'MdA'
            cands = [i for i, p in enumerate(club) if p['temporada'] == t and p['pf'] == q['pf'] and p['pc'] == q['pc']
                     and i not in usados]
            marcador_distinto = False
            if q.get('fecha'):
                cands = [i for i in cands if club[i]['fecha'] == q['fecha']]
                if not cands:
                    mismo_dia = [i for i, p in enumerate(club) if p['temporada'] == t and p['fecha'] == q['fecha']
                                 and p['ficha'] == ficha and i not in usados]
                    if len(mismo_dia) == 1:
                        cands, marcador_distinto = mismo_dia, True
            if len(cands) > 1:
                # misma temporada y mismo marcador en dos partidos: se desempata por ficha
                por_ficha = [i for i in cands if club[i]['ficha'] == ficha]
                if len(por_ficha) == 1:
                    cands = por_ficha
                else:
                    ambiguos.append({'temporada': t, 'rival_historico_propio': q.get('rival'), 'pf': q['pf'], 'pc': q['pc']})
            if cands:
                usados.add(cands[0])
                club[cands[0]].setdefault('tambien_en', []).append(f'season_{t}.json')
                club[cands[0]]['rival_historico_propio'] = q.get('rival')
                if marcador_distinto:
                    club[cands[0]]['marcador_historico_propio'] = f"{q['pf']}-{q['pc']}"
                    difs.append({'temporada': t, 'fecha': q['fecha'], 'rival': q.get('rival'),
                                 'portal': f"{club[cands[0]]['pf']}-{club[cands[0]]['pc']}", 'historico_propio': f"{q['pf']}-{q['pc']}"})
                dup += 1
            elif q['pf'] == 0 and q['pc'] == 0:
                sin_marcador.append({'temporada': t, 'rival': q.get('rival'), 'fecha': q.get('fecha')})
            else:
                anadidos.append({'temporada': t, 'fecha': q.get('fecha'), 'ficha': ficha, 'codigo_equipo': None,
                                 'rival': q.get('rival'), 'codigo_rival': None, 'fase': q.get('fase') or None,
                                 'grupo': None, 'pf': q['pf'], 'pc': q['pc'], 'res': 'G' if q['pf'] > q['pc'] else 'P',
                                 'origen': f'season_{t}.json (histórico propio; nombre del rival escrito por el club)',
                                 **({'aviso_ficha': aviso_t} if aviso_t else {})})
    # Igual que en la trayectoria: si una ficha jugó varias ligas en la temporada, se numeran por fecha.
    ligas = collections.defaultdict(dict)
    for p in club:
        if p['fase'] and p['fase'].startswith('Liga') and p['grupo'] and p['fecha']:
            k = (p['temporada'], p['ficha'])
            ligas[k][p['grupo']] = min(ligas[k].get(p['grupo'], '9999'), p['fecha'])
    for p in club:
        gs = ligas.get((p['temporada'], p['ficha']), {})
        if len(gs) > 1 and p['grupo'] in gs:
            p['fase'] = f"Liga: {sorted(gs, key=gs.get).index(p['grupo']) + 1}ª fase"
    return club + anadidos, {'duplicados_fusionados': dup, 'solo_historico_propio': len(anadidos), 'ambiguos': ambiguos,
                             'marcador_distinto': difs, 'descartados_0_0_sin_casar': sin_marcador,
                             'avisos_etiqueta': avisos}


def resumen_h2h(ps):
    g = sum(1 for p in ps if p['res'] == 'G')
    return {'pj': len(ps), 'g': g, 'p': len(ps) - g, 'pf': sum(p['pf'] for p in ps), 'pc': sum(p['pc'] for p in ps)}


def h2h(nombres_norm, partidos):
    ps = [p for p in partidos if norm(p['rival']) in nombres_norm]
    # de más reciente a más antiguo; sin fecha (histórico propio antiguo), al final de su temporada
    ps.sort(key=lambda p: (p['temporada'], p['fecha'] or ''), reverse=True)
    u = ps[0] if ps else None
    return {'resumen': resumen_h2h(ps), 'partidos': ps,
            'ultimo': ({k: u[k] for k in ('temporada', 'fecha', 'ficha', 'rival', 'pf', 'pc', 'res')} if u else None)}


# ------------------------------------------------------------------ candidatos
STOP = {'LOS', 'LAS', 'LA', 'EL', 'DE', 'DEL', 'CB', 'BC', 'BASKET', 'TD', 'CLUB', 'THE', 'TEAM'}


def palabras(s):
    s = unicodedata.normalize('NFD', reparar(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').upper()
    return {w for w in re.findall(r'[A-Z0-9]+', s) if w not in STOP and len(w) >= 3}


def clave_distrito(d):
    return norm(d).replace('DE', '').replace('EL', '') if d else ''


def buscar_candidatos(objetivo, exactos, universo, distritos_obj):
    """universo: norm -> {'nombres': set, 'distritos': set, 'temporadas': set}.
    Regla: (a) uno contiene al otro, (b) muy parecidos (>= 0,8) o (c) comparten una palabra
    significativa Y han jugado en el mismo distrito. Nunca se fusionan: van a la tabla de Iván."""
    fuertes, debiles = [], []
    base = [(n, palabras(x)) for x, n in exactos]
    for m, info in universo.items():
        if not m or m in {n for _, n in exactos}:
            continue
        motivos = []
        for n, pal in base:
            if len(n) >= 4 and len(m) >= 4 and (n in m or m in n):
                motivos.append('un nombre contiene al otro')
            if difflib.SequenceMatcher(None, n, m).ratio() >= 0.8:
                motivos.append('nombres muy parecidos')
            comunes = pal & set().union(*(palabras(x) for x in info['nombres']))
            if comunes:
                mismo = bool({clave_distrito(d) for d in info['distritos']} & distritos_obj)
                motivos.append(('comparte palabra ' if mismo else 'sólo comparte palabra ') + ', '.join(sorted(comunes))
                               + (' y distrito' if mismo else ''))
        if not motivos:
            continue
        motivos = sorted(set(motivos))
        (debiles if all(x.startswith('sólo') for x in motivos) else fuertes).append((m, motivos))
    return fuertes, debiles


# ------------------------------------------------------------------ verificaciones
def verificar_2025_26(club):
    s = leer_season('2025-26')
    portal = [p for p in club if p['temporada'] == '2025-26' and p['origen'] == 'portal 211549']
    propios = s['partidos']
    libres = list(range(len(portal)))
    casan, sin_portal, distinto = 0, [], []
    for q in propios:
        i = next((i for i in libres if portal[i]['fecha'] == q.get('fecha') and portal[i]['pf'] == q['pf']
                  and portal[i]['pc'] == q['pc']), None)
        if i is None:
            ficha = {'MDL': 'MdL', 'MDA': 'MdA'}.get((q.get('equipo') or '').upper())
            mismo_dia = [j for j in libres if portal[j]['fecha'] == q.get('fecha') and portal[j]['ficha'] == ficha]
            if len(mismo_dia) == 1:
                j = mismo_dia[0]
                libres.remove(j)
                distinto.append({'fecha': q.get('fecha'), 'ficha': ficha, 'rival': portal[j]['rival'],
                                 'portal': f"{portal[j]['pf']}-{portal[j]['pc']}", 'season': f"{q['pf']}-{q['pc']}",
                                 'incomparecencia_en_portal': bool(portal[j].get('incomparecencia'))})
            else:
                sin_portal.append({'fecha': q.get('fecha'), 'equipo': q.get('equipo'), 'rival': q.get('rival'), 'pf': q['pf'], 'pc': q['pc']})
        else:
            libres.remove(i)
            casan += 1
    sin_propio = [{k: portal[i][k] for k in ('fecha', 'ficha', 'rival', 'pf', 'pc')} for i in libres]
    return {'partidos_season_2025_26': len(propios), 'partidos_portal_club': len(portal), 'casan_fecha_y_marcador': casan,
            'mismo_partido_marcador_distinto': distinto,
            'en_season_sin_portal': sin_portal, 'en_portal_sin_season': sin_propio}


def verificar_clasificaciones(C, idx):
    filas, grupos = [], []
    for t in TEMPORADAS:
        por_g = collections.defaultdict(list)
        for r in C[t]:
            por_g[r['Codigo_grupo']].append(r)
            pj, g, e, p = (num(r[k]) or 0 for k in ('Partidos_jugados', 'Partidos_ganados', 'Partidos_empatados', 'Partidos_perdidos'))
            if pj != g + p:
                ps = [x for x in idx[t]['grupo'].get(r['Codigo_grupo'], [])
                      if r['Codigo_equipo'] in (x['Codigo_equipo1'], x['Codigo_equipo2'])]
                # incomparecencias PERDIDAS por este equipo (su marcador es el menor)
                n_np = sum(1 for x in ps if x['Estado'] == 'N' and (num(x['Resultado1']) or 0) != (num(x['Resultado2']) or 0)
                           and ((num(x['Resultado1']) or 0) < (num(x['Resultado2']) or 0)) == (x['Codigo_equipo1'] == r['Codigo_equipo']))
                filas.append({'temporada': t, 'grupo': r['Nombre_grupo'], 'distrito': r['Nombre_distrito'],
                              'equipo': r['Nombre_equipo'], 'pj': pj, 'g': g, 'e': e, 'p': p,
                              'incomparecencias_en_partidos': n_np if ps else None,
                              'explicado_por_incomparecencias': bool(ps) and pj - g - p == n_np})
        for gcode, rs in por_g.items():
            spf = sum(num(r['Goles_favor']) or 0 for r in rs)
            spc = sum(num(r['Goles_contra']) or 0 for r in rs)
            if spf != spc:
                grupos.append({'temporada': t, 'grupo': rs[0]['Nombre_grupo'], 'fase': rs[0]['Nombre_fase'],
                               'distrito': rs[0]['Nombre_distrito'], 'codigo_grupo': gcode,
                               'suma_pf': spf, 'suma_pc': spc, 'diferencia': spf - spc})
    total_filas = sum(len(C[t]) for t in TEMPORADAS)
    total_grupos = sum(len({r['Codigo_grupo'] for r in C[t]}) for t in TEMPORADAS)
    return {'filas_revisadas': total_filas, 'filas_pj_distinto_de_g_mas_p': filas,
            'grupos_revisados': total_grupos, 'grupos_pf_distinto_de_pc': grupos}


def cobertura(P, C):
    """Grupos con clasificación pero sin ningún partido en el CSV de partidos."""
    out = []
    for t in TEMPORADAS:
        gp = {r['Codigo_grupo'] for r in P[t]}
        faltan = collections.Counter()
        for r in C[t]:
            if r['Codigo_grupo'] not in gp:
                faltan[(r['Nombre_distrito'], r['Nombre_fase'], r['Nombre_grupo'])] += 1
        for (d, f, g), n in sorted(faltan.items()):
            out.append({'temporada': t, 'distrito': d, 'fase': f, 'grupo': g, 'equipos': n})
    return out


def comprobar_regla_nombre(P, C, rj):
    """Aplica la regla del nombre SÓLO como comprobación (no cambia nada). Busca temporadas en que un
    código del club que viene de ficha se llama MACCABI DE LEVANTAR y a la vez hay un "MDL"."""
    club = collections.defaultdict(dict)
    for p in rj['partidos']:
        club[p['temporada']][p['codigo_equipo']] = (p['equipo'], p['identificado_por'])
    for c, e in CLUB_2025_26.items():
        club['2025-26'][c] = (e, 'nombre_en_distrito')
    out = []
    for t in TEMPORADAS:
        nombres = collections.defaultdict(set)
        for r in P[t]:
            nombres[r['Codigo_equipo1']].add((r['Equipo_local'], r['Distrito']))
            nombres[r['Codigo_equipo2']].add((r['Equipo_visitante'], r['Distrito']))
        for r in C[t]:
            nombres[r['Codigo_equipo']].add((r['Nombre_equipo'], r['Nombre_distrito']))
        mdl = {c: sorted({norm(d): reparar(d) for e, d in sorted(v, key=lambda x: x[1]) if d}.values())
               for c, v in nombres.items() if any(norm(e) == 'MDL' for e, _ in v)}
        mdl_mor = {c for c, ds in mdl.items() if any(norm(d) == 'MORATALAZ' for d in ds)}
        lev = sorted(c for c, v in nombres.items() if any(norm(e) == 'MACCABIDELEVANTAR' for e, _ in v))
        entrada = {'temporada': t, 'mdl_en_moratalaz': sorted(mdl_mor),
                   'mdl_en_otros_distritos': {c: ds for c, ds in mdl.items() if c not in mdl_mor},
                   'maccabi_de_levantar': lev, 'conflictos': []}
        for c, (eq, via) in club[t].items():
            if c in lev and via == 'ficha' and mdl:
                ambito = 'Moratalaz' if mdl_mor else 'sólo si la regla se lee para todo Madrid'
                entrada['conflictos'].append({'codigo_club': c, 'ficha': eq, 'via': via, 'ambito': ambito,
                                              'mdl': {k: mdl[k] for k in mdl}})
        entrada['no_son_del_club_por_la_regla'] = [c for c in lev if mdl_mor and c not in club[t]]
        out.append(entrada)
    return out


def comprobar_dobles(partidos, rivales):
    """Tras las fusiones, ningún partido debe contar dos veces."""
    problemas = []
    vistos = collections.Counter((p['temporada'], p['codigo_equipo'], p['codigo_rival'], p['fecha'], p['pf'], p['pc'])
                                 for p in partidos if p['codigo_equipo'])
    problemas += [{'tipo': 'partido del portal repetido', 'clave': list(k)} for k, n in vistos.items() if n > 1]
    portal = collections.Counter((p['temporada'], p['pf'], p['pc']) for p in partidos if p['codigo_equipo'])
    for p in partidos:
        if not p['codigo_equipo'] and portal[(p['temporada'], p['pf'], p['pc'])]:
            problemas.append({'tipo': 'partido sólo del histórico propio con el mismo marcador que uno del portal',
                              'temporada': p['temporada'], 'rival': p['rival'], 'marcador': f"{p['pf']}-{p['pc']}"})
    dueno = collections.defaultdict(list)
    for r in rivales:
        for p in r['cara_a_cara']['partidos']:
            dueno[id(p)].append(r['rival'])
    problemas += [{'tipo': 'partido asignado a dos rivales', 'rivales': v} for v in dueno.values() if len(v) > 1]
    return {'partidos_revisados': len(partidos), 'problemas': problemas}


def puesto_relativo(r):
    """Para ordenar: puesto relativo en la liga de 2025/26 (1 = primero, 0 = último); None si no jugó."""
    tp = r['temporada_pasada_2025_26']
    ligas = [f for f in (tp['fases'] if tp else []) if f['fase'].startswith('Liga') and f.get('posicion')]
    if not ligas:
        return None
    f = ligas[0]
    n = f['equipos_en_grupo'] or f['posicion']
    return 1.0 if f['posicion'] == 1 else ((n - f['posicion']) / (n - 1) if n > 1 else 0.0)


def lista(nombres):
    return (', '.join(nombres)).rstrip('.') + '.'


def lo_esencial(rivales, grupo):
    rs = [r for r in rivales if r['grupo_club'] == grupo]
    L = []
    con = sorted([r for r in rs if puesto_relativo(r) is not None], key=lambda r: -puesto_relativo(r))
    for r in con[:3]:
        f = [x for x in r['temporada_pasada_2025_26']['fases'] if x['fase'].startswith('Liga')][0]
        L.append(f"{r['rival']}: {f['posicion']}º de {f['equipos_en_grupo']} en 2025/26 ({f['g']}-{f['p']}, "
                 f"{f['pf']}-{f['pc']}), {f['distrito']}.")
    sin = [r['rival'] for r in rs if r['sin_rastro']]
    if sin:
        L.append('Sin rastro en los JDM: ' + lista(sin))
    nunca = [r['rival'] for r in rs if not r['cara_a_cara']['resumen']['pj']]
    if nunca:
        L.append('Nunca nos hemos enfrentado a: ' + lista(nunca))
    tot = resumen_h2h([p for r in rs for p in r['cara_a_cara']['partidos']])
    L.append(f"Balance total del club contra el grupo: {tot['pj']} partidos, {tot['g']}G-{tot['p']}P "
             f"({tot['pf']}-{tot['pc']}).")
    mas = max(rs, key=lambda r: r['cara_a_cara']['resumen']['pj'])
    rm = mas['cara_a_cara']['resumen']
    L.append(f"Rival más repetido: {mas['rival']}, {rm['pj']} partidos ({rm['g']}G-{rm['p']}P).")
    invictos = [r['rival'] for r in rs if r['cara_a_cara']['resumen']['pj'] and not r['cara_a_cara']['resumen']['p']]
    if invictos:
        L.append('Nunca nos han ganado: ' + lista(invictos))
    return L[:10]


# Cifras de cara a cara que Iván espera (A6). Se comprueban, no se fuerzan.
ESPERADO = {'Suanzes Motor': (11, 2), 'LOS KHINKIS RUSOS': (15, 6), 'NABUCO TD': (0, 2),
            'VALLEKAS BASKET': (0, 0), 'F.T. FLOPPERS': (0, 0)}


def esperado(rivales):
    out = []
    for r in rivales:
        if r['rival'] in ESPERADO:
            g, p = ESPERADO[r['rival']]
            res = r['cara_a_cara']['resumen']
            out.append({'rival': r['rival'], 'esperado': f'{g}G-{p}P' if g + p else 'nunca',
                        'datos': f"{res['g']}G-{res['p']}P" if res['pj'] else 'nunca',
                        'cuadra': (res['g'], res['p']) == (g, p)})
    return out


# ------------------------------------------------------------------ principal
def main():
    P, C, ficheros = cargar()
    idx = indices(P)
    cods = codigos_por_nombre(P, C)
    club, rj_ruta = construir_partidos_club(idx, P)
    partidos, fusion = fusionar_historico_propio(club)
    rj, _ = leer_rivales_jdm()
    regla = comprobar_regla_nombre(P, C, rj)

    # universo de nombres para buscar candidatos: portal (todas las temporadas) + rivales del club
    universo = collections.defaultdict(lambda: {'nombres': set(), 'distritos': set(), 'temporadas': set()})
    for t in TEMPORADAS:
        for r in C[t]:
            u = universo[norm(r['Nombre_equipo'])]
            u['nombres'].add(r['Nombre_equipo']); u['distritos'].add(r['Nombre_distrito']); u['temporadas'].add(t)
        for r in P[t]:
            for e in (r['Equipo_local'], r['Equipo_visitante']):
                if e and not es_descanso(r):
                    u = universo[norm(e)]
                    u['nombres'].add(e); u['distritos'].add(r['Distrito']); u['temporadas'].add(t)
    for p in partidos:
        u = universo[norm(p['rival'])]
        u['nombres'].add(p['rival']); u['temporadas'].add(p['temporada'])

    todos_alias = {norm(x) for v in ALIAS_CONFIRMADOS.values() for x in v['alias'] + v.get('apodos', [])}
    rivales, candidatos, descartes, descartados_ivan = [], [], [], []
    vistos_cand = set()
    for grupo_club, lista in RIVALES.items():
        for nombre in lista:
            conf = ALIAS_CONFIRMADOS.get(nombre, {})
            alias, apodos = conf.get('alias', []), conf.get('apodos', [])
            exactos = [(x, norm(x)) for x in [nombre] + alias]
            nn = {n for _, n in exactos}
            tray = trayectoria(nn, P, C, idx, cods)
            ult = next((s for s in tray if s['temporada'] == '2025-26'), None)
            cara = h2h(nn | {norm(x) for x in apodos}, partidos)
            rivales.append({
                'rival': nombre, 'grupo_2026_27': f'grupo del {grupo_club}', 'grupo_club': grupo_club,
                'nombres_anteriores_confirmados': alias, 'apodos_historico_propio': apodos,
                'temporadas_en_jdm': len(tray), 'temporadas_disponibles': len(TEMPORADAS),
                'temporada_pasada_2025_26': ({'nombre': ', '.join(ult['nombres']), 'fases': [
                    {k: f.get(k) for k in ('fase', 'distrito', 'grupo', 'posicion', 'equipos_en_grupo', 'pj', 'g', 'p', 'pf', 'pc', 'dif',
                                           'incomparecencias')}
                    | ({'eliminatoria': f['eliminatoria']['texto']} if f.get('eliminatoria') else {})
                    for i in ult['inscripciones'] for f in i['fases']]} if ult else None),
                'mejor_resultado': mejor_resultado(tray),
                'sin_rastro': None if tray else 'sin rastro en los JDM (equipo nuevo, cambio de nombre o competición externa)',
                'trayectoria': tray, 'cara_a_cara': cara,
            })
            distritos_obj = {clave_distrito(f['distrito']) for s in tray for i in s['inscripciones'] for f in i['fases']}
            fuertes, debiles = buscar_candidatos(nombre, exactos, universo, distritos_obj)
            descartados = {norm(x) for x in DESCARTADOS_POR_IVAN.get(nombre, [])}
            for x in DESCARTADOS_POR_IVAN.get(nombre, []):
                info = universo.get(norm(x))
                descartados_ivan.append({'rival_2026_27': nombre, 'nombre': x, 'fecha': HOY,
                                         'temporadas': sorted(info['temporadas']) if info else []})
            fuertes_d = {m: v for m, v in fuertes if m not in descartados and m not in todos_alias}
            for x in CANDIDATOS_PROPUESTOS_EN_CHAT.get(nombre, []):
                m = norm(x)
                fuertes_d[m] = sorted(set(fuertes_d.get(m, []) + ['propuesto en el chat']))
            for m, motivos in sorted(fuertes_d.items()):
                if (nombre, m) in vistos_cand:
                    continue
                vistos_cand.add((nombre, m))
                info = universo.get(m)
                candidatos.append({
                    'rival_2026_27': nombre, 'candidato': sorted(info['nombres'])[0] if info else next(
                        x for x in CANDIDATOS_PROPUESTOS_EN_CHAT[nombre] if norm(x) == m),
                    'variantes': sorted(info['nombres']) if info else [], 'motivo': motivos,
                    'decide': 'Iván', 'encontrado': bool(info),
                    'solo_apodo_fusionado': (not info) and m in {norm(p.get('rival_historico_propio')) for p in partidos},
                    'temporadas': sorted(info['temporadas']) if info else [],
                    'trayectoria': trayectoria({m}, P, C, idx, cods), 'cara_a_cara': h2h({m}, partidos),
                })
            for m, motivos in debiles:
                if m in fuertes_d or m in descartados or m in todos_alias:
                    continue
                info = universo[m]
                descartes.append({'rival_2026_27': nombre, 'nombre': sorted(info['nombres'])[0], 'motivo': motivos,
                                  'distritos': sorted(info['distritos']), 'temporadas': sorted(info['temporadas'])})

    rival_maccabi = h2h({'MACCABIDELEVANTAR'}, [p for p in partidos if p['codigo_rival'] == RIVAL_MACCABI_2020_21])
    ver = {'partidos_2025_26': verificar_2025_26(partidos), 'clasificaciones': verificar_clasificaciones(C, idx),
           'grupos_sin_partidos_en_el_portal': cobertura(P, C), 'dobles': comprobar_dobles(partidos, rivales),
           'cara_a_cara_esperado': esperado(rivales)}
    homonimos_club_25 = [{'codigo': c, 'nombre': r['Nombre_equipo'], 'distrito': r['Nombre_distrito'], 'grupo': r['Nombre_grupo']}
                         for r in C['2025-26'] for c in [r['Codigo_equipo']]
                         if re.search(r'mac+abi|macabi', r['Nombre_equipo'], re.I) and c not in CLUB_2025_26]

    out = {
        '_meta': {
            'generado': HOY, 'script': 'scripts/build_rivales_2026_27.py', 'fuente': FUENTE,
            'alcance': 'Baloncesto, sénior masculino, todos los distritos. Liga, segundas fases, fase de distrito, '
                       'fase final de Madrid y torneos municipales.',
            'temporadas': TEMPORADAS, 'huecos': HUECOS, 'ficheros': ficheros,
            'emparejamiento': 'Sólo nombre exacto tras normalizar mayúsculas, tildes y signos, más los alias confirmados. '
                              'Todo lo demás va a candidatos.',
            'reparacion_codificacion': 'Detección UTF-8/latin-1 por fichero; en los CSV antiguos, caracteres CP850 '
                                       '(¥→Ñ, ¦→ª, §→º…) reparados.',
            'cara_a_cara_fuentes': [rj_ruta, 'portal 211549 (2025/26)', 'data/season_*.json'],
            'cara_a_cara_fusion': fusion,
            'codigos_club_2025_26': CLUB_2025_26,
            'homonimos_del_club_2025_26_no_incluidos': homonimos_club_25,
            'regla_nombre_club': {'texto': REGLA_NOMBRE_CLUB, 'confirmada_por': 'Iván', 'fecha': HOY,
                                  'comprobacion_por_temporada': regla},
            'rivales_fuera_de_2026_27': [{
                'codigo': RIVAL_MACCABI_2020_21, 'nombre': 'MACCABI DE LEVANTAR', 'temporada': '2020-21',
                'que_es': 'Rival (regla del nombre del club). No es uno de los 20 de 2026/27: sin ficha.',
                'cara_a_cara': rival_maccabi}],
        },
        'alias_confirmados': [{'rival': k, **v} for k, v in ALIAS_CONFIRMADOS.items()],
        'lo_esencial': {g: lo_esencial(rivales, g) for g in RIVALES},
        'rivales': rivales,
        'candidatos_decide_ivan': candidatos,
        'descartados_por_ivan': descartados_ivan,
        'coincidencias_debiles_descartadas': descartes,
        'verificacion': ver,
    }
    with open(os.path.join(DATA, 'rivales_2026-27.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DOCS, 'RIVALES_2026-27.md'), 'w', encoding='utf-8') as f:
        f.write(informe(out))
    v = ver['partidos_2025_26']
    print(f"rivales: {len(rivales)} · candidatos: {len(candidatos)} · partidos cara a cara: {len(partidos)}")
    print(f"2025/26: {v['casan_fecha_y_marcador']}/{v['partidos_season_2025_26']} casan · "
          f"dobles: {len(ver['dobles']['problemas'])}")
    for e in ver['cara_a_cara_esperado']:
        print(f"  {e['rival']}: esperado {e['esperado']} · datos {e['datos']} · {'OK' if e['cuadra'] else 'DIFERENTE'}")


# ------------------------------------------------------------------ informe
def T(t):
    return t.replace('-', '/')


def balance(f):
    if f.get('pj') is None:
        return '—'
    s = f"{f['g']}-{f['p']}"
    if f.get('pf') is not None:
        s += f" ({f['pf']}-{f['pc']}, {f['dif']:+d})"
    return s


def txt_h2h(c):
    r = c['resumen']
    if not r['pj']:
        s = 'nunca'
    else:
        s = f"{r['pj']} PJ: {r['g']}G-{r['p']}P"
    return s


def txt_ultimo(c):
    u = c.get('ultimo')
    if not u:
        return '—'
    return f"{u['fecha'] or T(u['temporada'])}, {u['ficha']}, {u['pf']}-{u['pc']} ({u['res']})"


def md_trayectoria(tray):
    L = ['| Temporada | Nombre | Distrito | Competición / fase | Grupo | Puesto | PJ | G | P | PF | PC | Dif | Hasta dónde |',
         '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for s in tray:
        for i in s['inscripciones']:
            for f in i['fases']:
                pos = f"{f['posicion']}º/{f['equipos_en_grupo']}" if f.get('posicion') else '—'
                if f.get('eliminatoria'):
                    pos = '—'
                if f.get('pj') is not None and f.get('g') is not None and f['pj'] != f['g'] + f['p']:
                    pos += ' ⚠'
                ele = f['eliminatoria']['texto'] if f.get('eliminatoria') else ''
                tag = ' **(temporada pasada)**' if s['temporada_pasada'] else ''
                dif = f"{f['dif']:+d}" if f.get('dif') is not None else ''
                src = ' ¹' if f['fuente'] != 'clasificacion' else ''
                L.append(f"| {T(s['temporada'])}{tag} | {i['nombre']} | {f['distrito']} | {f['fase']} | {f['grupo']}{src} | {pos} | "
                         + ' | '.join('' if f.get(k) is None else str(f[k]) for k in ('pj', 'g', 'p', 'pf', 'pc'))
                         + f" | {dif} | {ele} |")
        if s.get('aviso_homonimos'):
            L.append(f"| {T(s['temporada'])} | ⚠ {s['aviso_homonimos']} | | | | | | | | | | | |")
    return '\n'.join(L)


def md_h2h(c):
    if not c['partidos']:
        return '_Sin enfrentamientos registrados con el club._'
    L = ['| Temporada | Fecha | Ficha del club | Rival jugó como | Fase | Marcador | |', '|---|---|---|---|---|---|---|']
    for p in c['partidos']:
        ficha = p['ficha'] + (' ⁴' if p.get('aviso_ficha') else '')
        orig = ' ²' if p['origen'].startswith('season_') else ''
        marc = f"{p['pf']}-{p['pc']}" + (' ³' if p.get('incomparecencia') else '')
        if p.get('marcador_historico_propio'):
            marc += f" (histórico propio: {p['marcador_historico_propio']})"
        L.append(f"| {T(p['temporada'])} | {p['fecha'] or '—'} | {ficha} | {p['rival']}{orig} | {p['fase'] or '—'} | "
                 f"{marc} | {p['res']} |")
    return '\n'.join(L)


def informe(o):
    m = o['_meta']
    L = [f"# Rivales 2026/27 — trayectoria en los JDM y cara a cara",
         '',
         f"_Generado por `{m['script']}` el {HOY[8:10]}/{HOY[5:7]}/{HOY[:4]} · datos en `data/rivales_2026-27.json`._",
         '',
         f"> **Fuente:** {FUENTE}",
         '>',
         '> **Alcance:** baloncesto, sénior masculino, **todos los distritos**, temporadas 2014/15–2025/26 '
         '(2013/14 y 2019/20 no están en el portal). Liga, segundas fases, fase de distrito, fase final de Madrid y torneos municipales.',
         '>',
         '> **Emparejamiento:** sólo nombre **exacto** tras normalizar mayúsculas, tildes y signos, más los alias '
         'confirmados por Iván. Los parecidos sin confirmar **no se fusionan**: van a la tabla de candidatos del final.',
         '',
         '## Lo esencial', '']
    for gc in RIVALES:
        L += [f'**Grupo del {gc}**', '']
        L += [f'- {x}' for x in o['lo_esencial'][gc]]
        L.append('')
    L += ['## Alias confirmados por Iván',
          '',
          '| Rival 2026/27 | Nombres anteriores | Apodos del histórico propio | Confirmado |',
          '|---|---|---|---|']
    for a in o['alias_confirmados']:
        L.append(f"| {a['rival']} | {', '.join(a['alias'])} | {', '.join(a.get('apodos', [])) or '—'} | "
                 f"{a['confirmado_por']}, {HOY[8:10]}/{HOY[5:7]}/{HOY[:4]} |")
    L += ['', '## Cómo leer las tablas', '',
          '- **Puesto** es `posición/equipos del grupo` según la clasificación oficial. En las eliminatorias no hay puesto: '
          'se indica **hasta dónde llegó**.',
          '- **Temporadas en los JDM** cuenta las temporadas con alguna inscripción bajo el nombre actual o un alias '
          'confirmado, de las 11 que hay en el portal.',
          '- **Mejor resultado**: fase final de Madrid > final de Madrid del torneo municipal > cuadro de eliminatorias de la '
          'fase de distrito > mejor puesto en liga, relativo al tamaño del grupo (una fase de distrito en formato liga cuenta '
          'como liga). No distingue divisiones: un 1º en 2ª división cuenta igual que un 1º en 1ª.',
          '- ⚠ marca las filas en que la clasificación oficial no cuadra (PJ ≠ G + P); se muestran tal cual, sin corregir.',
          '- **Cara a cara**: partidos oficiales del club, **sumando las dos fichas (MdL + MdA)**, de más reciente a más '
          'antiguo. #149233 "MACCABI DE LEVANTAR" (2020/21) es un **rival**, no del club (regla del nombre, D26).',
          '- Un mismo nombre en **otro distrito** cuenta como coincidencia exacta (así lo pide el criterio), pero puede ser '
          'otro equipo: se avisa con ⚠ cuando en una misma temporada hay ligas en varios distritos.',
          '']
    for gc in ('MdA', 'MdL'):
        L += [f'## Grupo del {gc} — resumen', '',
              '| Rival (nombres anteriores) | 2025/26: dónde | 2025/26: puesto y balance | Temporadas en JDM | Mejor resultado histórico | Cara a cara | Último enfrentamiento |',
              '|---|---|---|---|---|---|---|']
        for r in o['rivales']:
            if r['grupo_2026_27'] != f'grupo del {gc}':
                continue
            nom = r['rival'] + (f" (antes {', '.join(r['nombres_anteriores_confirmados'])})" if r['nombres_anteriores_confirmados'] else '')
            if r['sin_rastro']:
                L.append(f"| {nom} | — | — | 0 | {r['sin_rastro']} | {txt_h2h(r['cara_a_cara'])} | {txt_ultimo(r['cara_a_cara'])} |")
                continue
            tp = r['temporada_pasada_2025_26']
            if tp:
                ligas = [f for f in tp['fases'] if f['fase'].startswith('Liga')]
                donde = '; '.join(f"{f['distrito']} · {f['grupo']}" for f in ligas) or '—'
                pb = '; '.join(f"{f['posicion']}º/{f['equipos_en_grupo']} · {balance(f)}"
                               + (f" ⚠ PJ {f['pj']} ≠ G+P" if f['pj'] != f['g'] + f['p'] else '') for f in ligas) or '—'
                extra = [f for f in tp['fases'] if f.get('eliminatoria')]
                if extra:
                    pb += ' · ' + '; '.join(f"{f['fase']}: {f['eliminatoria']}" for f in extra)
            else:
                donde, pb = 'no jugó en 2025/26', '—'
            L.append(f"| {nom} | {donde} | {pb} | {r['temporadas_en_jdm']} de {r['temporadas_disponibles']} | "
                     f"{r['mejor_resultado']} | {txt_h2h(r['cara_a_cara'])} | {txt_ultimo(r['cara_a_cara'])} |")
        L.append('')
    L += ['## Fichas por rival', '',
          '¹ Grupo sin fila en la clasificación oficial: balance calculado de los partidos.  ',
          '² Partido que sólo está en el histórico propio (`season_*.json`); el nombre del rival es el que anotó el club.  ',
          '³ Incomparecencia: resultado administrativo según el portal (estado "N").  ',
          '⁴ Ficha dudosa: el histórico propio de esa temporada anota un partido contra el propio club (ver Huecos).',
          '']
    for r in o['rivales']:
        L += [f"### {r['rival']} — {r['grupo_2026_27']}", '']
        if r['nombres_anteriores_confirmados']:
            L += [f"Nombres anteriores confirmados: **{', '.join(r['nombres_anteriores_confirmados'])}**.", '']
        if r['sin_rastro']:
            L += [f"**{r['sin_rastro'][0].upper() + r['sin_rastro'][1:]}.**", '']
        else:
            nt = r['temporadas_en_jdm']
            L += [f"{nt} temporada{'s' if nt != 1 else ''} en los JDM. Mejor resultado: {r['mejor_resultado']}.", '',
                  md_trayectoria(r['trayectoria']), '']
        L += [f"**Cara a cara con el club:** {txt_h2h(r['cara_a_cara'])}.", '', md_h2h(r['cara_a_cara']), '']
    L += ['## Candidatos a mismo equipo — decide Iván', '',
          'Nombres **no idénticos** que podrían ser el mismo equipo. **No se han fusionado**: su trayectoria y su cara a '
          'cara van por separado. Regla de búsqueda: un nombre contiene al otro, o son muy parecidos, o comparten una '
          'palabra significativa **y** han jugado en el mismo distrito; más los propuestos en el chat (por el asistente, '
          'no por Iván).', '',
          '| Rival 2026/27 | Candidato | Variantes | Motivo | Temporadas | Cara a cara |', '|---|---|---|---|---|---|']
    for c in o['candidatos_decide_ivan']:
        tem = ', '.join(T(t) for t in c['temporadas']) or (
            'sólo como apodo en el histórico propio, en partidos que casan con el portal bajo otro nombre'
            if c['solo_apodo_fusionado'] else 'no aparece en el portal ni en el histórico')
        L.append(f"| {c['rival_2026_27']} | {c['candidato']} | {', '.join(c['variantes'])} | {'; '.join(c['motivo'])} | "
                 f"{tem} | {txt_h2h(c['cara_a_cara'])} |")
    L.append('')
    for c in o['candidatos_decide_ivan']:
        if not c['trayectoria'] and not c['cara_a_cara']['partidos']:
            continue
        L += [f"### Candidato: {c['candidato']} (¿= {c['rival_2026_27']}?)", '']
        if c['trayectoria']:
            L += [md_trayectoria(c['trayectoria']), '']
        L += [f"**Cara a cara:** {txt_h2h(c['cara_a_cara'])}.", '', md_h2h(c['cara_a_cara']), '']
    if o['descartados_por_ivan']:
        L += ['### Descartados por Iván', '',
              'Iván confirmó el 25/09/2026 que **no** son el mismo equipo. No cuentan para nada.', '',
              '| Rival 2026/27 | Nombre descartado | Temporadas en que aparece |', '|---|---|---|']
        for d in o['descartados_por_ivan']:
            L.append(f"| {d['rival_2026_27']} | {d['nombre']} | {', '.join(T(t) for t in d['temporadas']) or '—'} |")
        L.append('')
    if o['coincidencias_debiles_descartadas']:
        L += ['### Coincidencias débiles, no consideradas candidatas', '',
              'Sólo comparten una palabra y nunca coinciden en distrito. Se listan por transparencia.', '',
              '| Rival 2026/27 | Nombre | Motivo | Distritos | Temporadas |', '|---|---|---|---|---|']
        for d in o['coincidencias_debiles_descartadas']:
            L.append(f"| {d['rival_2026_27']} | {d['nombre']} | {'; '.join(d['motivo'])} | {', '.join(d['distritos']) or '—'} | "
                     f"{', '.join(T(t) for t in d['temporadas'])} |")
        L.append('')

    v = o['verificacion']
    p26 = v['partidos_2025_26']
    cl = v['clasificaciones']
    dob = v['dobles']
    L += ['## Verificación', '',
          f"**Partidos contados dos veces tras las fusiones:** {len(dob['problemas'])} "
          f"(revisados {dob['partidos_revisados']} partidos del club: ninguna clave del portal repetida, ningún partido "
          'del histórico propio con el mismo marcador que uno del portal en la misma temporada, y ningún partido asignado a '
          'dos rivales).' if not dob['problemas'] else
          f"**Partidos contados dos veces tras las fusiones: {len(dob['problemas'])}.** Detalle en `verificacion.dobles`.", '',
          '**Cara a cara esperado por Iván frente a lo que dan los datos:**', '',
          '| Rival | Esperado | Datos | |', '|---|---|---|---|']
    for e in v['cara_a_cara_esperado']:
        L.append(f"| {e['rival']} | {e['esperado']} | {e['datos']} | {'cuadra' if e['cuadra'] else '**no cuadra**'} |")
    L += ['',
          f"**Partidos 2025/26 del portal contra `season_2025-26.json`:** {p26['casan_fecha_y_marcador']} de "
          f"{p26['partidos_season_2025_26']} casan en fecha y marcador (el portal atribuye {p26['partidos_portal_club']} "
          f"partidos con resultado a los códigos del club: " + ', '.join(f"#{k} {v_}" for k, v_ in m['codigos_club_2025_26'].items()) + ').', '']
    for x in p26['mismo_partido_marcador_distinto']:
        L += [f"- **Descuadre:** mismo partido, marcador distinto. {x['fecha']}, {x['ficha']} contra {x['rival']}: "
              f"portal **{x['portal']}**" + (' (incomparecencia, estado "N")' if x['incomparecencia_en_portal'] else '')
              + f", `season_2025-26.json` **{x['season']}**. No se corrige.", '']
    if not p26['en_season_sin_portal'] and not p26['en_portal_sin_season']:
        L += ['Aparte de eso, no falta ningún partido en ninguno de los dos lados.', '']
    if p26['en_season_sin_portal'] or p26['en_portal_sin_season']:
        L += ['| Dónde falta | Fecha | Ficha | Rival | Marcador |', '|---|---|---|---|---|']
        for x in p26['en_season_sin_portal']:
            L.append(f"| no está en el portal | {x['fecha']} | {x['equipo']} | {x['rival']} | {x['pf']}-{x['pc']} |")
        for x in p26['en_portal_sin_season']:
            L.append(f"| no está en season_2025-26.json | {x['fecha']} | {x['ficha']} | {x['rival']} | {x['pf']}-{x['pc']} |")
        L.append('')
    L += [f"**Clasificaciones** (baloncesto sénior masculino, todos los distritos, 11 temporadas): "
          f"{cl['filas_revisadas']} filas y {cl['grupos_revisados']} grupos revisados.", '',
          f"- Filas con PJ ≠ G + P: **{len(cl['filas_pj_distinto_de_g_mas_p'])}**.",
          f"- Grupos con suma de PF ≠ suma de PC: **{len(cl['grupos_pf_distinto_de_pc'])}**.",
          '', 'Se informa sin corregir. Detalle completo en `verificacion` del JSON.', '']
    fl = cl['filas_pj_distinto_de_g_mas_p']
    if fl:
        porT = collections.Counter(x['temporada'] for x in fl)
        expl = [x for x in fl if x['explicado_por_incomparecencias']]
        con_e = [x for x in fl if x['e']]
        sin_p = [x for x in fl if x['incomparecencias_en_partidos'] is None]
        resto = [x for x in fl if not x['explicado_por_incomparecencias'] and not x['e'] and x['incomparecencias_en_partidos'] is not None]
        L += ['Filas con PJ ≠ G + P por temporada: ' + ', '.join(f"{T(t)}: {n}" for t, n in sorted(porT.items())) + '.', '',
              f"- **{len(expl)}** se explican exactamente por incomparecencias: desde 2021/22 el portal cuenta el partido "
              'que el equipo NO se presentó en PJ pero no en G ni en P (la diferencia coincide con sus derrotas en estado "N").',
              f"- **{len(con_e)}** tienen empates (E > 0) en temporadas antiguas.",
              f"- **{len(sin_p)}** son de grupos sin partidos en el portal: no se pueden contrastar.",
              f"- **{len(resto)}** quedan sin explicar.", '']
        if resto:
            L += ['| Temporada | Grupo | Equipo | PJ | G | E | P | Incomparecencias perdidas |', '|---|---|---|---|---|---|---|---|']
            for x in resto[:40]:
                L.append(f"| {T(x['temporada'])} | {x['grupo']} | {x['equipo']} | {x['pj']} | {x['g']} | {x['e']} | {x['p']} | {x['incomparecencias_en_partidos']} |")
            L.append('')
    if cl['grupos_pf_distinto_de_pc']:
        porT = collections.Counter(x['temporada'] for x in cl['grupos_pf_distinto_de_pc'])
        L += ['Grupos con PF ≠ PC por temporada: ' + ', '.join(f"{T(t)}: {n}" for t, n in sorted(porT.items())) + '.', '']
        rel = set()
        for r in o['rivales']:
            for s in r['trayectoria']:
                for i in s['inscripciones']:
                    for f in i['fases']:
                        rel.add((s['temporada'], f['codigo_grupo']))
        afect = [x for x in cl['grupos_pf_distinto_de_pc'] if (x['temporada'], x['codigo_grupo']) in rel]
        if afect:
            L += ['Los que afectan a grupos donde jugó algún rival de 2026/27:', '',
                  '| Temporada | Fase | Grupo | Distrito | Σ PF | Σ PC | Dif |', '|---|---|---|---|---|---|---|']
            for x in afect:
                L.append(f"| {T(x['temporada'])} | {x['fase']} | {x['grupo']} | {x['distrito']} | {x['suma_pf']} | {x['suma_pc']} | {x['diferencia']:+d} |")
            L.append('')
    L += ['## Huecos y límites de la fuente', '',
          '- **2013/14 y 2019/20 no están en el portal.** De esas temporadas sólo hay cara a cara (el histórico propio, '
          '`season_*.json`), no trayectoria de los rivales.']
    gsp = v['grupos_sin_partidos_en_el_portal']
    if gsp:
        porT = collections.defaultdict(list)
        for x in gsp:
            porT[x['temporada']].append(f"{x['distrito']} ({x['fase']})")
        L.append('- **Grupos con clasificación pero sin partidos en el portal** (la trayectoria sale de la clasificación; '
                 'lo que falta es el detalle de los partidos): ' +
                 '; '.join(f"{T(t)}: {', '.join(sorted(set(v_)))}" for t, v_ in porT.items()) + '.')
    L += ['- En las fases finales antiguas el portal deja las últimas rondas **sin resultado** (0-0 y sin equipos): '
          'se indica "la ronda siguiente no tiene resultado en el portal".',
          '- El 211549 **no trae torneos municipales** de baloncesto sénior en 2025/26: sólo los JDM.',
          f"- Cara a cara: {m['cara_a_cara_fusion']['duplicados_fusionados']} partidos del histórico propio casaron con "
          f"el portal y se fusionaron; {m['cara_a_cara_fusion']['solo_historico_propio']} sólo están en el histórico propio."
          + (f" Emparejamientos ambiguos (mismo marcador dos veces en la temporada): {len(m['cara_a_cara_fusion']['ambiguos'])}, "
             'detallados en el JSON.' if m['cara_a_cara_fusion']['ambiguos'] else '')]
    for a in m['cara_a_cara_fusion']['avisos_etiqueta']:
        L.append(f"- **{T(a['temporada'])}:** {a['aviso']}")
    rg = m['regla_nombre_club']
    conf = [(e['temporada'], c) for e in rg['comprobacion_por_temporada'] for c in e['conflictos']]
    mor = [x for x in conf if x[1]['ambito'] == 'Moratalaz']
    L.append('- **Regla del nombre del club (D26), aplicada sólo como comprobación.** '
             + ('Dentro de Moratalaz **no contradice ninguna ficha de inscripción**: "MDL" aparece en el distrito del club '
                'por primera vez en 2020/21, y ese año el "MACCABI DE LEVANTAR" (#149233) no viene de ninguna ficha. '
                if not mor else f"**Contradice fichas en Moratalaz**: {mor}. ")
             + ('Si la regla se leyera para todo Madrid, chocaría con las fichas de '
                + ', '.join(sorted({T(t) for t, _ in conf}))
                + ': esas temporadas ya existía **otro equipo llamado "MDL"** en otro distrito ('
                + '; '.join(sorted({f"{T(e['temporada'])}: #{c} en {', '.join(ds)}" for e in rg['comprobacion_por_temporada']
                                    for c, ds in e['mdl_en_otros_distritos'].items() if any(t == e['temporada'] for t, _ in conf)}))
                + ') mientras nuestras fichas se llamaban MACCABI DE LEVANTAR. No se ha cambiado nada; **decide Iván** '
                  'si la regla es sólo para el distrito del club, como se ha aplicado.' if conf else ''))
    for e in m['rivales_fuera_de_2026_27']:
        r_ = e['cara_a_cara']['resumen']
        L.append(f"- #{e['codigo']} \"{e['nombre']}\" ({T(e['temporada'])}) cuenta como **rival** del club: "
                 f"{r_['pj']} partidos, {r_['g']}G-{r_['p']}P. No es uno de los 20 de 2026/27: no tiene ficha aquí.")
    if m['homonimos_del_club_2025_26_no_incluidos']:
        L.append('- **No es el club** y no se ha incluido: ' + '; '.join(
            f"#{h['codigo']} \"{h['nombre']}\" ({h['distrito']}, {h['grupo']})" for h in m['homonimos_del_club_2025_26_no_incluidos']) + '.')
    L += ['', '---', f"Fuente: {FUENTE}", '']
    return '\n'.join(L)


if __name__ == '__main__':
    main()

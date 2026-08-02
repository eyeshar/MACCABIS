# -*- coding: utf-8 -*-
import json,re
from collections import defaultdict
rows=json.load(open('stats_raw.json'))

# --- Reglas de identidad ---
# Alias: mapear variantes/erratas al nombre canónico
ALIAS={
    'DE CARVLHO, JULIO CESAR':'DE CARVALHO RODRIGUES, JULIO CESAR',
}
# Excluir de estadísticas (no jugadores): entrenador/delegado
EXCLUIR={'BARREIRO CARBALLAL, CARLOS JOSE'}

def norm(n): return re.sub(r'\s+',' ',n).strip().upper()
def canon(n):
    k=norm(n)
    return ALIAS.get(k,k)

def parse_title(t,eq):
    m=re.search(r'Estadísticas - (.+?) vs (.+?) -',t)
    if not m: return ('?',True)
    a,b=m.group(1).strip(),m.group(2).strip()
    return (b,True) if a==eq else (a,False)

players=defaultdict(lambda:{'nombre':'','num':set(),'equipos':set(),'games':[]})
for r in rows:
    raw=r['nombre'].strip()
    if not raw or raw.upper()=='TOTALES': continue
    key=canon(raw)
    if key in EXCLUIR: continue          # fuera el entrenador
    rival,local=parse_title(r['title'],r['eq'])
    if r['pn']>=23: rival=rival+' (PO)'
    p=players[key]
    # nombre canónico "bonito": el más largo visto (evita la errata corta)
    if len(raw)>len(p['nombre']) and 'CARVLHO' not in raw.upper():
        p['nombre']=raw
    if not p['nombre']: p['nombre']=raw
    p['num'].add(r['num']); p['equipos'].add(r['eq'])
    p['games'].append({'pn':r['pn'],'eq':r['eq'],'rival':rival,'local':local,
        'sec':r['sec'],'played':r['sec']>0,'pts':r['pts'],
        'p2a':r['p2a'],'p2i':r['p2i'],'p3a':r['p3a'],'p3i':r['p3i'],
        'tla':r['tla'],'tli':r['tli'],'fc':r['fc'],'val':r['val'],'pm':r['pm']})

# fijar nombre canónico correcto para Carvalho
for k,p in players.items():
    if k=='DE CARVALHO RODRIGUES, JULIO CESAR':
        p['nombre']='DE CARVALHO RODRIGUES, JULIO CESAR'

out=[]
for key,p in players.items():
    # dedupe de games por si un jugador tuviera dos filas en el mismo pn/eq (no debería)
    seen={}
    for g in p['games']:
        kk=(g['pn'],g['eq'])
        if kk in seen:
            # sumar (caso raro), pero avisar
            pass
        seen[kk]=g
    games=list(seen.values())
    pj=[g for g in games if g['played']]; njug=len(pj)
    def S(f): return sum(g[f] for g in pj)
    tot={f:S(f) for f in ['pts','p2a','p2i','p3a','p3i','tla','tli','fc','val','pm']}
    secs=S('sec')
    rec={'nombre':p['nombre'],'dorsales':sorted(p['num']),'equipos':sorted(p['equipos']),
         'conv':len(games),'pj':njug,'min_tot':round(secs/60),'tot':tot,
         'games':sorted(games,key=lambda g:g['pn'])}
    if njug>0:
        rec['avg']={'pts':round(tot['pts']/njug,1),'min':round(secs/60/njug,1),
                    'val':round(tot['val']/njug,1),'pm':round(tot['pm']/njug,1),'fc':round(tot['fc']/njug,1)}
        rec['tl_pct']=round(tot['tla']/tot['tli']*100) if tot['tli'] else None
        rec['p2_pct']=round(tot['p2a']/tot['p2i']*100) if tot['p2i'] else None
        rec['p3_pct']=round(tot['p3a']/tot['p3i']*100) if tot['p3i'] else None
    else:
        rec['avg']=None;rec['tl_pct']=rec['p2_pct']=rec['p3_pct']=None
    out.append(rec)

out.sort(key=lambda r:-r['tot']['pts'])
json.dump(out,open('players.json','w'),ensure_ascii=False)
print('Jugadores tras fusión/exclusión:',len(out),'(antes 26)')
# comprobar que no queda duplicado de Carvalho ni Barreiro
names=[r['nombre'] for r in out]
assert not any('CARVLHO' in n.upper() for n in names),'queda errata'
assert not any('BARREIRO' in n.upper() for n in names),'queda entrenador'
carv=[r for r in out if 'CARVALHO' in r['nombre'].upper()]
print('De Carvalho ahora:',len(carv),'registro(s) ·',carv[0]['pj'],'PJ ·',carv[0]['tot']['pts'],'pts ·',carv[0]['min_tot'],'min')
print('Total jugadores en tabla:',len(out))

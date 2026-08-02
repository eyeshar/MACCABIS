# -*- coding: utf-8 -*-
import openpyxl, glob, os, re, json

UP='/mnt/user-data/uploads'
def clean(s):
    if s is None: return ''
    return re.sub(r'\s+',' ',str(s)).strip()

def min_to_sec(m):
    m=clean(m)
    if not m or m=='-': return 0
    if ':' in m:
        p=m.split(':'); 
        try: return int(p[0])*60+int(p[1])
        except: return 0
    try: return int(float(m))*60
    except: return 0

def parse_ai(x):
    x=clean(x)
    if '/' in x:
        a,i=x.split('/')
        try: return int(a),int(i)
        except: return 0,0
    return 0,0

# columnas por índice (según fila 14/29):
# 0 Num,1 Nombre,2 MIN,3 PTS,4 2P A/I,5 2P%,6 3P A/I,7 3P%,8 TL A/I,9 TL%,
# 10 DEF,11 OF,12 Tot,13 AST,14 REC,15 PER,16 TAP TC,17 TAP TR,18 FC,19 FR,20 VAL,21 +/-
COLS=['num','nombre','min','pts','p2ai','p2pc','p3ai','p3pc','tlai','tlpc',
      'reb_def','reb_of','reb_tot','ast','rec','per','tap_tc','tap_tr','fc','fr','val','pm']

def find_our_table(ws, team):
    rows=list(ws.iter_rows(values_only=True))
    # localizar la fila con el nombre exacto de nuestro equipo (MDA/MDL) como encabezado de bloque
    our=None
    for i,r in enumerate(rows):
        c0=clean(r[0]) if r else ''
        if c0==team:
            our=i; break
    if our is None: return []
    # los datos empiezan 2 filas después (cabecera de columnas en our+2, datos desde our+3)
    # pero en el ejemplo: fila 27 'MDA', 28 subcab, 29 cabecera, 31+ datos (30 vacía)
    data=[]
    for j in range(our+1, min(our+20,len(rows))):
        r=rows[j]
        if not r: continue
        c0=clean(r[0]); c1=clean(r[1])
        if c1=='TOTALES': break
        if c0 in ('','Num.') or c1 in ('','Nombre'): continue
        if not c0 and not c1: continue
        # fila de datos válida: col0 dorsal, col1 nombre
        rec={}
        for k,name in enumerate(COLS):
            rec[name]=r[k] if k<len(r) else None
        data.append(rec)
    return data

def num(x):
    x=clean(x)
    try: return int(x)
    except:
        try: return int(float(x))
        except: return 0

allrows=[]
def sortkey(f):
    m=re.search(r'_(PO)?(\d+)_',f)
    base=(22+int(m.group(2))) if m.group(1) else int(m.group(2))
    return (base,'mdl' in f)
files=sorted(glob.glob(f'{UP}/estadisticaPartido_*.xlsx'),key=sortkey)
for f in files:
    m=re.search(r'_(PO)?(\d+)_(mda|mdl)',f)
    if m.group(1):  # playoff
        pn=22+int(m.group(2)); eq=m.group(3).upper()
    else:
        pn=int(m.group(2)); eq=m.group(3).upper()
    wb=openpyxl.load_workbook(f,data_only=True)
    ws=wb.active
    # título para rival/fecha
    title=''
    for r in ws.iter_rows(min_row=1,max_row=8,values_only=True):
        for c in r:
            if c and 'vs' in str(c): title=clean(c)
    data=find_our_table(ws,eq)
    for d in data:
        d2={'pn':pn,'eq':eq,'title':title}
        d2['num']=clean(d['num']); d2['nombre']=clean(d['nombre'])
        d2['sec']=min_to_sec(d['min']); d2['pts']=num(d['pts'])
        for fld in ['p2','p3','tl']:
            a,i=parse_ai(d[fld+'ai']); d2[fld+'a']=a; d2[fld+'i']=i
        for fld in ['reb_def','reb_of','reb_tot','ast','rec','per','tap_tc','tap_tr','fc','fr','val','pm']:
            d2[fld]=num(d[fld])
        allrows.append(d2)

json.dump(allrows,open('stats_raw.json','w'),ensure_ascii=False)
print('Filas jugador-partido extraídas:',len(allrows))
print('Ficheros:',len(files))

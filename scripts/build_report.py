# -*- coding: utf-8 -*-
"""
Desglosado estadistico TPBV 2026.

Cruza "Lista Comunidades TPBV 2026 .xlsx" (132 localidades objetivo) contra:
  - "BD JULIO TPBV.xlsx"  -> fuente primaria de indicadores (POB, EDU, ECO,
    AFRO, DISC, SALUD, VIV) porque ya trae los campos exactos solicitados.
  - "ITER_2020.xlsx"      -> fuente de Latitud/Longitud y respaldo/validacion
    cuando una localidad no aparece en BD JULIO.

Genera "Diagnostico Estadistico TPBV 2026.xlsx" con:
  - Hoja "Detalle": una fila por localidad con todos los indicadores.
  - Hoja "Resumen_Region": totales/promedios por region.
  - Hoja "Resumen_Municipio": totales/promedios por municipio.
  - Hoja "Sin_Match": localidades que no pudieron emparejarse con confianza.
"""
import re
import unicodedata
import difflib
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"

# Palabras genericas que se ignoran al calcular similitud (no al mostrar)
STOPWORDS = {"colonia", "barrio", "campo", "rancho", "ampliacion", "ejido",
             "poblado", "fraccionamiento", "col", "ranchito", "predio"}

NUM_WORDS = {"uno": "1", "una": "1", "dos": "2", "tres": "3", "cuatro": "4",
             "cinco": "5", "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
             "diez": "10", "once": "11", "doce": "12"}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s)
                   if not unicodedata.combining(c))


def norm(s):
    if s is None:
        return ""
    if isinstance(s, datetime):
        s = str(s)
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_key(s):
    """Normalizado 'core' quitando stopwords, usado para similitud difusa."""
    words = [NUM_WORDS.get(w, w) for w in norm(s).split() if w not in STOPWORDS]
    return " ".join(words) if words else norm(s)


def split_alias(nombre_crudo):
    """'Tlaltetelco (San Miguel Tlaltetelco)' -> ['Tlaltetelco', 'San Miguel Tlaltetelco']"""
    if nombre_crudo is None:
        return [""]
    s = str(nombre_crudo)
    m = re.match(r"^(.*?)\((.*)\)\s*$", s.strip())
    if m:
        return [m.group(1).strip(), m.group(2).strip(), s]
    return [s]


# ---------------------------------------------------------------------------
# 1. Cargar Lista Comunidades TPBV 2026 (lista objetivo, 132 localidades)
# ---------------------------------------------------------------------------
wb_lista = openpyxl.load_workbook(BASE + r"\Lista Comunidades TPBV 2026 .xlsx", data_only=True)
ws_lista = wb_lista["Revisada"]

comunidades = []
for row in ws_lista.iter_rows(min_row=2, max_row=133, values_only=True):
    region, nom_mun, poligono, nom_loc = row[0], row[1], row[2], row[3]
    if not nom_mun or not nom_loc:
        continue
    if isinstance(nom_loc, datetime):
        # Excel convirtio un nombre tipo "3 de Mayo" en fecha; se reconstruye
        nom_loc_fix = f"{nom_loc.day} de {['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][nom_loc.month]}"
    else:
        nom_loc_fix = nom_loc
    comunidades.append({
        "region": region,
        "nom_mun": nom_mun,
        "poligono": poligono,
        "nom_loc": nom_loc_fix,
        "pob_tot_lista": row[7],
    })
print(f"Localidades objetivo cargadas: {len(comunidades)}")

# ---------------------------------------------------------------------------
# 2. Cargar BD JULIO TPBV.xlsx (fuente primaria de indicadores)
# ---------------------------------------------------------------------------
wb_bd = openpyxl.load_workbook(BASE + r"\BD JULIO TPBV.xlsx", read_only=True, data_only=True)
ws_bd = wb_bd["LocRuralInfo4 (todas)"]
bd_rows = list(ws_bd.iter_rows(values_only=True))
bd_header = [str(h).strip() if h else "" for h in bd_rows[0]]
bd_idx = {h: i for i, h in enumerate(bd_header)}

FIELDS = ["POB1", "POB42", "POB84", "EDU28", "EDU34", "ECO1", "ECO7", "ECO13",
          "ECO28", "AFRO1", "DISC4", "DISC5", "DISC6", "SALUD1", "SALUD2",
          "SALUD3", "SALUD4", "SALUD6", "VIV0", "VIV7", "VIV10", "VIV15",
          "VIV17", "VIV20", "VIV27", "VIV28", "VIV29", "VIV34", "VIV35",
          "VIV36", "VIV81"]
for f in FIELDS:
    assert f in bd_idx, f"Campo {f} no encontrado en BD JULIO"

# Mapeo campo -> columna cruda de ITER_2020, SOLO para los campos que el
# control de calidad (cruce BD JULIO vs ITER en localidades ya matcheadas)
# confirmo que coinciden 1:1. Los campos ausentes aqui (ECO7, ECO13, ECO28,
# EDU34, DISC4, DISC5, DISC6, VIV10, VIV15, VIV17, VIV20, VIV81) no tienen un
# equivalente directo confiable en ITER y se dejan en blanco para las
# localidades que solo aparecen en ITER 2020 (ver hoja Notas_y_Advertencias).
FIELD_TO_ITER = {
    "POB1": "POBTOT", "POB42": "POBFEM", "POB84": "POBMAS",
    "EDU28": "P15YM_AN",
    "ECO1": "PEA",
    "AFRO1": "POB_AFRO",
    "SALUD1": "PDER_SS", "SALUD2": "PSINDER", "SALUD3": "PDER_IMSS",
    "SALUD4": "PDER_ISTE", "SALUD6": "PAFIL_PDOM",
    "VIV0": "VIVTOT", "VIV7": "VPH_PISOTI",
    "VIV27": "VPH_REFRI", "VIV28": "VPH_LAVAD", "VIV29": "VPH_AUTOM",
    "VIV34": "VPH_PC", "VIV35": "VPH_INTER", "VIV36": "VPH_CEL",
}

bd_by_mun = {}
for r in bd_rows[1:]:
    mun = r[bd_idx["NOM_MUN"]]
    loc = r[bd_idx["NOMGEO"]]
    if not mun or not loc:
        continue
    bd_by_mun.setdefault(norm(mun), []).append((loc, r))

# ---------------------------------------------------------------------------
# 3. Cargar ITER_2020.xlsx (Latitud/Longitud + respaldo)
# ---------------------------------------------------------------------------
wb_iter = openpyxl.load_workbook(BASE + r"\ITER_2020.xlsx", read_only=True, data_only=True)
ws_iter = wb_iter["ITER MORELOS"]
iter_rows = list(ws_iter.iter_rows(values_only=True))
# Fila 1 = nombres largos, fila 2 = claves cortas (NOM_MUN, NOM_LOC, ...), fila 3 = vacia, fila 4+ = datos
iter_header = [str(h).strip() if h else "" for h in iter_rows[1]]
iter_idx = {h: i for i, h in enumerate(iter_header)}

iter_by_mun = {}
for r in iter_rows[3:]:
    mun = r[iter_idx["NOM_MUN"]]
    loc = r[iter_idx["NOM_LOC"]]
    if not mun or not loc:
        continue
    if mun in ("NOM_MUN", "Total de la entidad Morelos", "demarcacion territorial"):
        continue
    loc_s = str(loc).strip()
    if loc_s.upper().startswith("TOTAL DEL MUNICIPIO"):
        continue
    iter_by_mun.setdefault(norm(mun), []).append((loc, r))

print(f"BD JULIO: {sum(len(v) for v in bd_by_mun.values())} localidades indexadas")
print(f"ITER 2020: {sum(len(v) for v in iter_by_mun.values())} localidades indexadas")


# ---------------------------------------------------------------------------
# 4. Emparejamiento
# ---------------------------------------------------------------------------
def token_contain_score(ak, ck):
    """1.0 si todas las palabras 'informativas' de ak estan contenidas en ck (o viceversa)."""
    aw = set(ak.split())
    cw = set(ck.split())
    if not aw or not cw:
        return 0.0
    if aw <= cw or cw <= aw:
        overlap = len(aw & cw)
        smaller = min(len(aw), len(cw))
        if smaller > 0 and overlap == smaller:
            return 0.95
    return 0.0


def buscar(nombre_crudo, candidatos, umbral=0.72):
    """candidatos: lista de (nombre_original, row). Devuelve (row, metodo, score, nombre_matched)"""
    if not candidatos:
        return None, "sin_candidatos", 0.0, None
    aliases = split_alias(nombre_crudo)
    alias_keys = [norm_key(a) for a in aliases]
    cand_index = [(norm_key(c[0]), c[0], c[1]) for c in candidatos]

    # 1. Exacto (sobre alguna variante del alias)
    for ak in alias_keys:
        for ck, cname, crow in cand_index:
            if ck == ak and ak != "":
                return crow, "exacto", 1.0, cname

    # 2. Difuso: combina ratio de caracteres + contencion de palabras completas
    best = (None, 0.0, None)
    for ak in alias_keys:
        if not ak:
            continue
        for ck, cname, crow in cand_index:
            score = difflib.SequenceMatcher(None, ak, ck).ratio()
            score = max(score, token_contain_score(ak, ck))
            if score > best[1]:
                best = (crow, score, cname)
    if best[1] >= umbral:
        return best[0], "difuso", best[1], best[2]
    return None, "no_encontrado", best[1], best[2]


resultados = []
sin_match = []

for c in comunidades:
    mun_key = norm(c["nom_mun"])
    bd_cands = bd_by_mun.get(mun_key, [])
    iter_cands = iter_by_mun.get(mun_key, [])

    bd_row, bd_metodo, bd_score, bd_name = buscar(c["nom_loc"], bd_cands)
    iter_row, iter_metodo, iter_score, iter_name = buscar(c["nom_loc"], iter_cands)

    rec = dict(c)
    rec["bd_match_nombre"] = bd_name
    rec["bd_match_metodo"] = bd_metodo
    rec["bd_match_score"] = round(bd_score, 2)
    rec["iter_match_nombre"] = iter_name
    rec["iter_match_metodo"] = iter_metodo
    rec["iter_match_score"] = round(iter_score, 2)

    if bd_row is not None:
        for f in FIELDS:
            rec[f] = bd_row[bd_idx[f]]
        rec["fuente_indicadores"] = "BD JULIO TPBV"
    elif iter_row is not None:
        # Respaldo: localidad urbana/no incluida en BD JULIO (fuente "rural").
        # Solo se llenan los campos que se validaron 1:1 contra ITER en el
        # cruce de control de calidad (ver hoja Notas_y_Advertencias).
        for f in FIELDS:
            itf = FIELD_TO_ITER.get(f)
            rec[f] = iter_row[iter_idx[itf]] if itf else None
        rec["fuente_indicadores"] = "ITER 2020 (respaldo, campos limitados)"
    else:
        for f in FIELDS:
            rec[f] = None
        rec["fuente_indicadores"] = "SIN DATOS"

    if iter_row is not None:
        rec["Longitud"] = iter_row[iter_idx["LONGITUD"]]
        rec["Latitud"] = iter_row[iter_idx["LATITUD"]]
    else:
        rec["Longitud"] = None
        rec["Latitud"] = None

    resultados.append(rec)
    if bd_row is None or iter_row is None:
        sin_match.append(rec)

print(f"Emparejadas con BD JULIO: {sum(1 for r in resultados if r['bd_match_metodo'] in ('exacto', 'difuso'))}/{len(resultados)}")
print(f"Emparejadas con ITER 2020: {sum(1 for r in resultados if r['iter_match_metodo'] in ('exacto', 'difuso'))}/{len(resultados)}")
print(f"Localidades con al menos una fuente sin match: {len(sin_match)}")

# ---------------------------------------------------------------------------
# 5. Construir libro de salida
# ---------------------------------------------------------------------------
wb_out = openpyxl.Workbook()

HEADER_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
WARN_FILL = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")


def style_header(ws, ncols, row=1):
    for col in range(1, ncols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def autosize(ws, ncols, minw=10, maxw=40):
    for col in range(1, ncols + 1):
        letter = get_column_letter(col)
        maxlen = minw
        for cell in ws[letter]:
            v = cell.value
            if v is not None:
                maxlen = max(maxlen, len(str(v)))
        ws.column_dimensions[letter].width = min(maxlen + 2, maxw)


# --- Hoja Detalle -----------------------------------------------------------
ws1 = wb_out.active
ws1.title = "Detalle"

DETALLE_COLS = [
    ("region", "Region"), ("nom_mun", "Municipio"), ("poligono", "Poligono"),
    ("nom_loc", "Localidad (Lista TPBV)"), ("pob_tot_lista", "Pob. Total (Lista TPBV)"),
] + [(f, f) for f in FIELDS] + [
    ("Latitud", "Latitud"), ("Longitud", "Longitud"),
    ("fuente_indicadores", "Fuente de indicadores"),
    ("bd_match_nombre", "Coincidencia BD JULIO"), ("bd_match_metodo", "Metodo (BD)"), ("bd_match_score", "Score (BD)"),
    ("iter_match_nombre", "Coincidencia ITER 2020"), ("iter_match_metodo", "Metodo (ITER)"), ("iter_match_score", "Score (ITER)"),
]

for j, (_, label) in enumerate(DETALLE_COLS, start=1):
    ws1.cell(row=1, column=j, value=label)
style_header(ws1, len(DETALLE_COLS))

for i, r in enumerate(resultados, start=2):
    for j, (key, _) in enumerate(DETALLE_COLS, start=1):
        ws1.cell(row=i, column=j, value=r.get(key))
    if r["bd_match_nombre"] is None or r["iter_match_nombre"] is None:
        for j in range(1, len(DETALLE_COLS) + 1):
            ws1.cell(row=i, column=j).fill = WARN_FILL

ws1.freeze_panes = "A2"
autosize(ws1, len(DETALLE_COLS))

# --- Hojas resumen (por region / municipio) ---------------------------------
NUMERIC_FIELDS = FIELDS  # todos son conteos numericos

def resumen_por(clave, titulo):
    ws = wb_out.create_sheet(titulo)
    grupos = {}
    for r in resultados:
        g = r[clave]
        grupos.setdefault(g, []).append(r)

    cols = ["Localidades"] + NUMERIC_FIELDS
    ws.cell(row=1, column=1, value=clave.capitalize())
    for j, c in enumerate(cols, start=2):
        ws.cell(row=1, column=j, value=c)
    style_header(ws, len(cols) + 1)

    row_i = 2
    for g in sorted(grupos.keys(), key=lambda x: str(x)):
        recs = grupos[g]
        ws.cell(row=row_i, column=1, value=g)
        ws.cell(row=row_i, column=2, value=len(recs))
        for j, f in enumerate(NUMERIC_FIELDS, start=3):
            vals = [r[f] for r in recs if isinstance(r[f], (int, float))]
            total = sum(vals) if vals else None
            ws.cell(row=row_i, column=j, value=total)
        row_i += 1

    # fila de totales generales
    ws.cell(row=row_i, column=1, value="TOTAL GENERAL")
    ws.cell(row=row_i, column=1).font = Font(bold=True)
    ws.cell(row=row_i, column=2, value=len(resultados))
    for j, f in enumerate(NUMERIC_FIELDS, start=3):
        vals = [r[f] for r in resultados if isinstance(r[f], (int, float))]
        ws.cell(row=row_i, column=j, value=sum(vals) if vals else None)
        ws.cell(row=row_i, column=j).font = Font(bold=True)

    ws.freeze_panes = "B2"
    autosize(ws, len(cols) + 1)
    return ws

resumen_por("region", "Resumen_Region")
resumen_por("nom_mun", "Resumen_Municipio")


def resumen_poligono():
    """Resumen por #Poligono, con Region/Municipio de referencia y el listado
    de localidades incluidas (util para cuando se cargue el KML de poligonos)."""
    ws = wb_out.create_sheet("Resumen_Poligono")
    grupos = {}
    for r in resultados:
        g = r["poligono"]
        grupos.setdefault(g, []).append(r)

    cols = ["Region", "Municipio", "Localidades", "Nombres de localidades"] + NUMERIC_FIELDS
    ws.cell(row=1, column=1, value="Poligono")
    for j, c in enumerate(cols, start=2):
        ws.cell(row=1, column=j, value=c)
    style_header(ws, len(cols) + 1)

    def sort_key(g):
        return (0, g) if isinstance(g, (int, float)) else (1, str(g))

    row_i = 2
    for g in sorted(grupos.keys(), key=sort_key):
        recs = grupos[g]
        regiones = sorted(set(r["region"] for r in recs if r["region"]))
        municipios = sorted(set(r["nom_mun"] for r in recs if r["nom_mun"]))
        nombres = ", ".join(str(r["nom_loc"]) for r in recs)
        ws.cell(row=row_i, column=1, value=g)
        ws.cell(row=row_i, column=2, value=" / ".join(regiones))
        ws.cell(row=row_i, column=3, value=" / ".join(municipios))
        ws.cell(row=row_i, column=4, value=len(recs))
        ws.cell(row=row_i, column=5, value=nombres)
        for j, f in enumerate(NUMERIC_FIELDS, start=6):
            vals = [r[f] for r in recs if isinstance(r[f], (int, float))]
            ws.cell(row=row_i, column=j, value=sum(vals) if vals else None)
        row_i += 1

    ws.cell(row=row_i, column=1, value="TOTAL GENERAL")
    ws.cell(row=row_i, column=1).font = Font(bold=True)
    ws.cell(row=row_i, column=4, value=len(resultados))
    for j, f in enumerate(NUMERIC_FIELDS, start=6):
        vals = [r[f] for r in resultados if isinstance(r[f], (int, float))]
        ws.cell(row=row_i, column=j, value=sum(vals) if vals else None)
        ws.cell(row=row_i, column=j).font = Font(bold=True)

    ws.freeze_panes = "B2"
    autosize(ws, len(cols) + 1, maxw=60)
    return ws


resumen_poligono()

# --- Hoja Sin_Match -----------------------------------------------------------
ws4 = wb_out.create_sheet("Sin_Match")
cols_sm = ["Region", "Municipio", "Poligono", "Localidad (Lista TPBV)",
           "Encontrada en BD JULIO", "Encontrada en ITER 2020",
           "Mejor candidato BD (no usado)", "Score BD", "Mejor candidato ITER (no usado)", "Score ITER"]
for j, c in enumerate(cols_sm, start=1):
    ws4.cell(row=1, column=j, value=c)
style_header(ws4, len(cols_sm))
row_i = 2
for r in sin_match:
    ws4.cell(row=row_i, column=1, value=r["region"])
    ws4.cell(row=row_i, column=2, value=r["nom_mun"])
    ws4.cell(row=row_i, column=3, value=r["poligono"])
    ws4.cell(row=row_i, column=4, value=r["nom_loc"])
    ws4.cell(row=row_i, column=5, value="Si" if r["bd_match_metodo"] in ("exacto", "difuso") else "NO")
    ws4.cell(row=row_i, column=6, value="Si" if r["iter_match_metodo"] in ("exacto", "difuso") else "NO")
    ws4.cell(row=row_i, column=7, value=r["bd_match_nombre"] if r["bd_match_metodo"] != "exacto" else None)
    ws4.cell(row=row_i, column=8, value=r["bd_match_score"])
    ws4.cell(row=row_i, column=9, value=r["iter_match_nombre"] if r["iter_match_metodo"] != "exacto" else None)
    ws4.cell(row=row_i, column=10, value=r["iter_match_score"])
    row_i += 1
ws4.freeze_panes = "A2"
autosize(ws4, len(cols_sm))

# --- Hoja Notas_y_Advertencias ----------------------------------------------
ws5 = wb_out.create_sheet("Notas_y_Advertencias")
notas = [
    ("Cobertura", ""),
    ("", f"{len(comunidades)} localidades objetivo en 'Lista Comunidades TPBV 2026 .xlsx'."),
    ("", f"{sum(1 for r in resultados if r['bd_match_metodo'] in ('exacto','difuso'))} emparejadas con BD JULIO TPBV.xlsx (indicadores completos)."),
    ("", f"{sum(1 for r in resultados if r['bd_match_metodo'] not in ('exacto','difuso') and r['iter_match_metodo'] in ('exacto','difuso'))} sin match en BD JULIO pero SI encontradas en ITER 2020 (indicadores parciales, ver mas abajo)."),
    ("", f"{sum(1 for r in resultados if r['fuente_indicadores']=='SIN DATOS')} sin ningun match confiable (celdas en blanco, revisar manualmente en hoja 'Sin_Match')."),
    ("", "La mayoria de las localidades sin match en BD JULIO son las de mayor poblacion (cabeceras/localidades urbanas), "
         "porque BD JULIO TPBV.xlsx (hoja 'LocRuralInfo4') parece excluir localidades urbanas (ej. 'Barrio de San Miguel' en Hueyapan, "
         "pob. 7,352, si existe en ITER 2020 pero no en BD JULIO)."),
    ("", ""),
    ("Advertencia importante sobre BD JULIO TPBV.xlsx", ""),
    ("", "Se realizo un cruce de control de calidad comparando, localidad por localidad, los valores de BD JULIO TPBV.xlsx "
         "contra las columnas originales del censo en ITER_2020.xlsx. Se encontraron inconsistencias en varios campos:"),
    ("", ""),
    ("VIV15 / VIV17 / VIV20 (agua, drenaje, electricidad)",
     "Los valores de estas 3 columnas en BD JULIO aparecen ROTADOS entre si respecto al censo: el valor guardado bajo "
     "'VIV15' (deberia ser agua entubada) coincide exactamente con el valor de ELECTRICIDAD del ITER; el de 'VIV17' "
     "(deberia ser drenaje) coincide con AGUA; y el de 'VIV20' (deberia ser electricidad) coincide con DRENAJE. "
     "Verificado en 2 localidades de muestra (Ocoxaltepec, Ocuituco y Cajones, Amacuzac) con el mismo patron consistente. "
     "Recomendacion: verificar con quien elaboro BD JULIO TPBV.xlsx el orden real de esas 3 columnas antes de usarlas."),
    ("ECO7 / ECO28 (desocupada / ocupada)",
     "Los valores no coinciden con las columnas equivalentes del censo (PDESOCUP, POCUPADA) ni suman de forma consistente "
     "con ECO1 (PEA). Ejemplo Ocoxaltepec: BD ECO28 (ocupada)=293 vs censo=860; BD ECO7 (desocupada)=26 vs censo=1. "
     "No se pudo determinar una formula de reconciliacion; se recomienda verificar la fuente/metodologia de estos 2 campos."),
    ("DISC4 / DISC5 / DISC6 (discapacidad / limitacion / problema mental)",
     "Los valores son consistentemente mucho menores que las columnas de discapacidad y limitacion del censo (PCON_DISC, "
     "PCON_LIMI) y no corresponden a ninguna subcategoria individual del censo revisada. Se recomienda verificar la fuente."),
    ("VIV10 (un solo cuarto)",
     "Consistentemente 2.5-2.8 veces mayor que VPH_1CUART del censo en las localidades de muestra; podria incluir una "
     "definicion distinta (posible combinacion con viviendas de 2 cuartos). Verificar antes de usar en reportes oficiales."),
    ("", ""),
    ("Campos verificados como confiables (coinciden con ITER 2020 en las localidades de muestra)",
     "POB1, POB42, POB84, EDU28, ECO1, AFRO1, SALUD1, SALUD2, SALUD3, SALUD4, SALUD6, VIV0, VIV7, VIV27, VIV28, VIV29, "
     "VIV34, VIV36 (VIV35 con diferencia menor de 1-2 unidades, probablemente por corte de fecha)."),
    ("", ""),
    ("Respaldo con ITER 2020",
     "Para localidades sin match en BD JULIO pero encontradas en ITER 2020, solo se completaron los campos de la lista "
     "de 'confiables' de arriba. Los campos no reconciliados (ECO7, ECO13, ECO28, EDU34, DISC4, DISC5, DISC6, VIV10, "
     "VIV15, VIV17, VIV20, VIV81) se dejaron en blanco para esas filas en vez de arriesgar un valor incorrecto."),
    ("", ""),
    ("Otras observaciones",
     "La columna 'POB_TOT' propia de 'Lista Comunidades TPBV 2026 .xlsx' (probablemente CONAPO/indice de marginacion 2020) "
     "no siempre coincide con POB1 (censo 2020 vía BD JULIO/ITER) para la misma localidad; son fuentes/metodologias "
     "distintas aunque del mismo año. Comparar ambas columnas en la hoja 'Detalle' antes de reportar una sola cifra."),
    ("", "Algunas localidades del municipio de Tlaquiltenango en la lista original tienen 'Tlaquiltenango' en la columna "
         "Region en vez de una region real (Altos/Centro/Oriente/Sur/Tlaquiltenango); se respeto el dato tal cual venia "
         "en el archivo fuente."),
    ("", ""),
    ("Poligono / futuro cruce con KML",
     "El numero de #Poligono de 'Lista Comunidades TPBV 2026' se conservo en la hoja 'Detalle' (3ra columna) y se agrego "
     "la hoja 'Resumen_Poligono' con el total de indicadores y el listado de localidades por cada uno de los 26 poligonos, "
     "para facilitar la validacion cuando se cargue el KML. Cada numero de poligono corresponde a un solo municipio "
     "(Tlaquiltenango es el unico municipio con mas de un poligono: 14 a 18). Cuando subas el KML se puede cruzar cada "
     "localidad (con su Latitud/Longitud) contra el poligono correspondiente para verificar que coincidan geograficamente."),
]
ws5.cell(row=1, column=1, value="Tema")
ws5.cell(row=1, column=2, value="Detalle")
style_header(ws5, 2)
for i, (tema, detalle) in enumerate(notas, start=2):
    c1 = ws5.cell(row=i, column=1, value=tema)
    c2 = ws5.cell(row=i, column=2, value=detalle)
    c2.alignment = Alignment(wrap_text=True, vertical="top")
    if tema and not detalle:
        c1.font = Font(bold=True)
    elif tema:
        c1.font = Font(bold=True)
ws5.column_dimensions["A"].width = 32
ws5.column_dimensions["B"].width = 110

OUT_PATH = BASE + r"\Diagnostico Estadistico TPBV 2026.xlsx"
wb_out.save(OUT_PATH)
print("Guardado:", OUT_PATH)

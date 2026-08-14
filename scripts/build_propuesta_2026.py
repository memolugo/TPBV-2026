# -*- coding: utf-8 -*-
"""Convierte la hoja 'PROPUESTA 2026' de 'Hoja de trabajo TPBV 2026.xlsx'
(70 localidades) a dashboard/propuesta_2026.js: un array de puntos con
{localidad, municipio, pobTotal, lat, lon, coordManual} para mostrarlos como
capa de comparacion en el mapa de "Propuesta Territorial".

Coordenadas:
  - 62 de las 70 localidades tienen coincidencia confiable en ITER_2020.xlsx
    (mismo algoritmo de match difuso que build_dashboard_data.py); se usan
    esas coordenadas oficiales (LATITUD/LONGITUD en DMS -> decimal).
  - Las 8 localidades restantes no existen como localidad censal independiente
    en ITER 2020 (verificado: ningun candidato del mismo municipio pasa de
    0.70 de similitud, por debajo del umbral de match confiable de 0.72).
    Sus coordenadas fueron proporcionadas manualmente por el usuario el
    2026-08-13 y se marcan con coordManual=True.

Poblacion: se usa tal cual el valor de la columna POB_TOTAL de la hoja (no
hay estadistica censal completa disponible para las 8 localidades sin match,
asi que por consistencia se usa la misma fuente -POB_TOTAL de la hoja- para
las 70, en vez de mezclar POBTOT de ITER para unas y POB_TOTAL de la hoja
para otras)."""
import re
import unicodedata
import difflib
import json
import openpyxl

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"

STOPWORDS = {"colonia", "barrio", "campo", "rancho", "ampliacion", "ejido",
             "poblado", "fraccionamiento", "col", "ranchito", "predio"}
NUM_WORDS = {"uno": "1", "una": "1", "dos": "2", "tres": "3", "cuatro": "4",
             "cinco": "5", "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
             "diez": "10", "once": "11", "doce": "12"}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s):
    if s is None:
        return ""
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_key(s):
    words = [NUM_WORDS.get(w, w) for w in norm(s).split() if w not in STOPWORDS]
    return " ".join(words) if words else norm(s)


def split_alias(nombre_crudo):
    if nombre_crudo is None:
        return [""]
    s = str(nombre_crudo)
    m = re.match(r"^(.*?)\((.*)\)\s*$", s.strip())
    if m:
        return [m.group(1).strip(), m.group(2).strip(), s]
    return [s]


def token_contain_score(ak, ck):
    aw, cw = set(ak.split()), set(ck.split())
    if not aw or not cw:
        return 0.0
    if aw <= cw or cw <= aw:
        overlap = len(aw & cw)
        smaller = min(len(aw), len(cw))
        if smaller > 0 and overlap == smaller:
            return 0.95
    return 0.0


def buscar(nombre_crudo, candidatos, umbral=0.72):
    if not candidatos:
        return None, "sin_candidatos", 0.0, None
    alias_keys = [norm_key(a) for a in split_alias(nombre_crudo)]
    cand_index = [(norm_key(c[0]), c[0], c[1]) for c in candidatos]
    for ak in alias_keys:
        for ck, cname, crow in cand_index:
            if ck == ak and ak != "":
                return crow, "exacto", 1.0, cname
    best = (None, 0.0, None)
    for ak in alias_keys:
        if not ak:
            continue
        for ck, cname, crow in cand_index:
            score = max(difflib.SequenceMatcher(None, ak, ck).ratio(), token_contain_score(ak, ck))
            if score > best[1]:
                best = (crow, score, cname)
    if best[1] >= umbral:
        return best[0], "difuso", best[1], best[2]
    return None, "no_encontrado", best[1], best[2]


def dms_to_decimal(s):
    if not s or not isinstance(s, str):
        return None
    m = re.search(r"(\d+)[\u00b0\s]+(\d+)['\s]+([\d.]+)\"?\s*([NSEW])", s.strip())
    if not m:
        return None
    deg, mn, sec, hemi = m.groups()
    val = float(deg) + float(mn) / 60 + float(sec) / 3600
    if hemi in ("S", "W"):
        val = -val
    return round(val, 6)


def parse_promotor(v):
    """Columna 'PROMOTOR' -> numero real de poligono (es el mismo
    POLIGONO_TPBV de TPBV_nueva_propuesta ok.geojson, no un promotor de
    campo; ver build_data_propuesta_2026.py para la verificacion completa).
    'Ayala' -> 23, '23PP' -> 22 (typo en la hoja, corregido)."""
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip() if v is not None else ""
    if s == "Ayala":
        return 23
    if s.upper() == "23PP":
        return 22
    m = re.match(r"(\d+)", s)
    return int(m.group(1)) if m else None


# Coordenadas manuales/override por (municipio, localidad) -- ver nota
# completa en build_data_propuesta_2026.py (COORD_OVERRIDES). Santana/
# Cuauhtemoc/Del Sol/La Falda actualizadas el 2026-08-14; Buena Vista/
# Colonia Emiliano Zapata/El Roble son overrides nuevos (pisan la
# coordenada de ITER aunque si tengan match censal).
COORD_OVERRIDES = {
    (norm("Puente de Ixtla"), norm("Santana")): (18.49284, -99.2706),
    (norm("Puente de Ixtla"), norm("Cuauhtemoc")): (18.49241, -99.27992),
    (norm("Puente de Ixtla"), norm("Del Sol")): (18.49328, -99.26709),
    (norm("Puente de Ixtla"), norm("La Falda")): (18.48441, -99.27522),
    (norm("Puente de Ixtla"), norm("Buena Vista")): (18.49853, -99.27084),
    (norm("Puente de Ixtla"), norm("Colonia Emiliano Zapata")): (18.48337, -99.26825),
    (norm("Puente de Ixtla"), norm("El Roble")): (18.48669, -99.27936),
    (norm("Ocuituco"), norm("Colonia 5 de mayo")): (18.86706609096941, -98.77800205582561),
    (norm("Tlaltizapán de Zapata"), norm("Carlos Pacheco")): (18.694759037950032, -99.11308672471041),
    (norm("Tlaltizapán de Zapata"), norm("El Olmedo")): (18.6805, -99.1120),
    (norm("Yautepec"), norm("Arco Blanco")): (18.8953, -99.0435),
}

# --- Cargar PROPUESTA 2026 ---
wb_p = openpyxl.load_workbook(BASE + r"\Hoja de trabajo TPBV 2026.xlsx", data_only=True, read_only=True)
ws_p = wb_p["PROPUESTA 2026"]
rows_p = list(ws_p.iter_rows(values_only=True))
propuesta_todas = [r for r in rows_p[1:] if r[0]]

# Excluye Tlaquiltenango: ya esta cubierto por la propuesta actual
# (poligonos 14-18), es un duplicado, no territorio nuevo.
MUNICIPIOS_EXCLUIDOS = {"Tlaquiltenango"}
propuesta = [r for r in propuesta_todas if str(r[5]).strip() not in MUNICIPIOS_EXCLUIDOS]
print(f"Localidades en PROPUESTA 2026: {len(propuesta_todas)} | excluidas ({', '.join(MUNICIPIOS_EXCLUIDOS)}): {len(propuesta_todas) - len(propuesta)} | restantes: {len(propuesta)}")

# --- Geometria oficial de poligonos (nombre real para el tooltip) ---
with open(BASE + r"\TPBV_nueva_propuesta ok.geojson", encoding="utf-8") as f:
    geojson_poligonos = json.load(f)
poligono_info = {f["properties"]["POLIGONO"]: f["properties"] for f in geojson_poligonos["features"]}

# --- Cargar ITER 2020 (coordenadas) ---
wb_it = openpyxl.load_workbook(BASE + r"\ITER_2020.xlsx", read_only=True, data_only=True)
ws_it = wb_it["ITER MORELOS"]
it_rows = list(ws_it.iter_rows(values_only=True))
it_header = [str(h).strip() if h else "" for h in it_rows[1]]
it_idx = {h: i for i, h in enumerate(it_header)}
it_by_mun = {}
for r in it_rows[3:]:
    mun, loc = r[it_idx["NOM_MUN"]], r[it_idx["NOM_LOC"]]
    if not mun or not loc:
        continue
    if mun in ("NOM_MUN", "Total de la entidad Morelos", "demarcacion territorial"):
        continue
    if str(loc).strip().upper().startswith("TOTAL DEL MUNICIPIO"):
        continue
    it_by_mun.setdefault(norm(mun), []).append((loc, r))

resultados = []
n_iter = n_manual = n_sin = 0
for r in propuesta:
    loc, promotor, nom_mun, pob_total = r[0], r[1], r[5], r[7]
    mun_key = norm(nom_mun)
    it_row, it_metodo, it_score, it_name = buscar(loc, it_by_mun.get(mun_key, []))

    lat = lon = None
    coord_manual = False
    if it_row is not None:
        lat = dms_to_decimal(it_row[it_idx["LATITUD"]])
        lon = dms_to_decimal(it_row[it_idx["LONGITUD"]])
    override_key = (mun_key, norm(loc))
    if override_key in COORD_OVERRIDES:
        # Pisa la coordenada de ITER si la hubiera (ver COORD_OVERRIDES).
        lat, lon = COORD_OVERRIDES[override_key]
        coord_manual = True
        n_manual += 1
    elif lat is not None:
        n_iter += 1
    if lat is None:
        n_sin += 1
        print(f"  AVISO: sin coordenadas -> {loc} ({nom_mun})")
        continue

    pol_num = parse_promotor(promotor)
    info = poligono_info.get(pol_num)
    if info is None:
        print(f"  AVISO: '{loc}' ({nom_mun}) -> PROMOTOR={promotor!r} no resuelve a un poligono valido")

    resultados.append({
        "localidad": str(loc).strip(),
        "municipio": str(nom_mun).strip(),
        "poligono": pol_num,
        "nombrePoligono": info["NOMBRE"] if info else None,
        "pobTotal": int(pob_total) if isinstance(pob_total, (int, float)) else None,
        "lat": lat,
        "lon": lon,
        "coordManual": coord_manual,
    })

print(f"Con coordenadas de ITER 2020: {n_iter} | manuales: {n_manual} | sin coordenadas (excluidas): {n_sin}")
print(f"Total localidades en la capa: {len(resultados)}")

out_path = BASE + r"\dashboard\propuesta_2026.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'Hoja de trabajo TPBV 2026.xlsx' (hoja 'PROPUESTA 2026')\n")
    f.write("// 62 localidades geocodificadas via ITER 2020 + 8 con coordenadas\n")
    f.write("// manuales (coordManual:true) provistas por el usuario el 2026-08-13.\n")
    f.write("const TPBV_PROPUESTA_2026 = ")
    json.dump(resultados, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)

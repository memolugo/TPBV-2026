# -*- coding: utf-8 -*-
"""
Genera dashboard/data_nueva_propuesta.js con las 162 localidades censales
que caen dentro de los 25 poligonos de la "Nueva Propuesta Territorial"
(TPBV_nueva_propuesta_Localidades.csv), en el MISMO formato de registro que
usa dashboard/data.js (TPBV_DATA, generado por build_dashboard_data.py), para
que el dashboard pueda alternar entre ambos conjuntos de datos sin tocar la
logica de render (mismos nombres de campo).

Fuente: TPBV_nueva_propuesta_Localidades.csv, un export "Consulta interactiva
de datos" de INEGI (Censo 2020) con columnas en espanol largo, NO los codigos
cortos de ITER_2020.xlsx (POBTOT, VPH_C_ELEC, ...) que usa build_dashboard_data.py.
Por eso el mapeo de campos es distinto (por nombre de columna normalizado, no
por codigo).

Campos que este CSV no trae y quedan en None (igual que localidades "SIN
DATOS" en el dataset actual, el render ya maneja None con "-"):
  - gmMarginacion / imMarginacion (grado de marginacion): no viene en este
    export; sin esto el KPI de "Grado de Marginacion" cae automaticamente al
    conteo de localidades del poligono (ver renderKpiStrip).
  - ocupadaPrimario (ocupada en sector primario): no es una variable basica
    del censo, viene de tabulados especiales que este export no incluye.
  - hacinamiento: idem, es un indicador derivado de tabulados especiales.
"""
import csv
import json
import re
import unicodedata

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s):
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def numval(v):
    v = (v or "").strip()
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return round(float(v), 2)
        except ValueError:
            return None


with open(BASE + r"\TPBV_nueva_propuesta_Localidades.csv", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames
    rows_todas = list(reader)

# Excluye Tlaquiltenango: ese municipio ya esta cubierto por la propuesta
# actual (poligonos 14-18, ver TPBV_POLIGONOS/poligonos.js), asi que sus 5
# poligonos en la nueva propuesta son un duplicado, no territorio nuevo
# (decision del 2026-08-12; ver tambien build_propuesta_nueva.py y
# build_nuevas_localidades.py, que aplican la misma exclusion).
MUNICIPIOS_EXCLUIDOS = {"Tlaquiltenango"}
rows = [r for r in rows_todas if r["MUNICIPIO_POLIGONO_TPBV"].strip() not in MUNICIPIOS_EXCLUIDOS]

print(f"Localidades en el CSV: {len(rows_todas)} | columnas: {len(headers)}")
print(f"Excluidas ({', '.join(MUNICIPIOS_EXCLUIDOS)}): {len(rows_todas) - len(rows)} | restantes: {len(rows)}")

header_by_norm = {}
for h in headers:
    k = norm(h)
    if k in header_by_norm:
        raise SystemExit(f"Columna normalizada duplicada: '{k}' <- '{h}' y '{header_by_norm[k]}'")
    header_by_norm[k] = h


def col(key_norm):
    if key_norm not in header_by_norm:
        raise SystemExit(f"No se encontro columna para: '{key_norm}'")
    return header_by_norm[key_norm]


def get(row, key_norm):
    return numval(row[col(key_norm)])


# Mapeo campo del dashboard -> columna normalizada del CSV (ver docstring:
# nombres de columna en espanol, no codigos ITER).
FIELD_MAP = {
    "pobTotal": "poblacion total",
    "pobMujeres": "poblacion femenina",
    "pobHombres": "poblacion masculina",
    "analfabetas": "poblacion de 15 anos y mas analfabeta",
    "pea": "poblacion de 12 anos y mas economicamente activa",
    "desocupada": "poblacion de 12 anos y mas desocupada",
    "ocupada": "poblacion de 12 anos y mas ocupada",
    "afromexicana": "poblacion que se considera afromexicana o afrodescendiente",
    "conDiscapacidad": "poblacion con discapacidad",
    "conLimitacion": "poblacion con limitacion",
    "conProblemaMental": "poblacion con algun problema o condicion mental",
    "afiliada": "poblacion afiliada a servicios de salud",
    "sinAfiliacion": "poblacion sin afiliacion a servicios de salud",
    "imss": "poblacion afiliada a servicios de salud en el imss",
    "issste": "poblacion afiliada a servicios de salud en el issste",
    "otrosSalud": "poblacion afiliada a servicios de salud en otra institucion",
    "totalViviendas": "total de viviendas particulares habitadas",
    "pisoTierra": "viviendas particulares habitadas con piso de tierra",
    "unSoloCuarto": "viviendas particulares habitadas con solo un cuarto",
    "aguaEntubada": "viviendas particulares habitadas que disponen de agua entubada en el ambito de la vivienda",
    "drenaje": "viviendas particulares habitadas que disponen de drenaje",
    "electricidad": "viviendas particulares habitadas que disponen de energia electrica",
    "refrigerador": "viviendas particulares habitadas que disponen de refrigerador",
    "lavadora": "viviendas particulares habitadas que disponen de lavadora",
    "automovil": "viviendas particulares habitadas que disponen de automovil o camioneta",
    "computadora": "viviendas particulares habitadas que disponen de computadora tablet o laptop",
    "internet": "viviendas particulares habitadas que disponen de internet",
    "celular": "viviendas particulares habitadas que disponen de telefono celular",
    "hablaLenguaIndigena": "poblacion de 3 anos y mas que habla alguna lengua indigena",
    "indigenaMonolingue": "poblacion de 3 anos y mas que habla alguna lengua indigena y no habla espanol",
    "hogaresIndigenas": "poblacion en hogares censales indigenas",
    "gradoEscolaridad": "grado promedio de escolaridad",
    "ninos6a11NoAsisten": "poblacion de 6 a 11 anos que no asiste a la escuela",
    "ninos12a14NoAsisten": "poblacion de 12 a 14 anos que no asiste a la escuela",
    "pob0a14": "poblacion de 0 a 14 anos",
    "pob15a64": "poblacion de 15 a 64 anos",
    "pob65mas": "poblacion de 65 anos y mas",
}
for f in FIELD_MAP.values():
    col(f)  # valida que exista, falla fuerte si no

SIN_BASICA_COLS = [
    "poblacion de 15 anos y mas sin escolaridad",
    "poblacion de 15 anos y mas con primaria incompleta",
    "poblacion de 15 anos y mas con primaria completa",
    "poblacion de 15 anos y mas con secundaria incompleta",
]
for c in SIN_BASICA_COLS:
    col(c)

AGE_BINS = [
    ("0-2", "poblacion de 0 a 2 anos"),
    ("3-5", "poblacion de 3 a 5 anos"),
    ("6-11", "poblacion de 6 a 11 anos"),
    ("12-14", "poblacion de 12 a 14 anos"),
    ("15-17", "poblacion de 15 a 17 anos"),
    ("18-24", "poblacion de 18 a 24 anos"),
    ("60+", "poblacion de 60 anos y mas"),
]
for _, c in AGE_BINS:
    col(c)
    col("poblacion femenina de " + c[len("poblacion de "):])
    col("poblacion masculina de " + c[len("poblacion de "):])

MUNICIPIO_COL = col("municipio o demarcacion territorial")
LOCALIDAD_COL = col("localidad")
POLIGONO_COL = "POLIGONO_TPBV"
NOMBRE_POLIGONO_COL = "NOMBRE_POLIGONO_TPBV"
REGION_COL = "REGION_TPBV"

resultados = []
for r in rows:
    rec = {"fuente": "Censo INEGI 2020 (Nueva Propuesta Territorial)"}
    for dash_key, csv_key in FIELD_MAP.items():
        rec[dash_key] = get(r, csv_key)

    rec["sinBasicaCompleta"] = sum(get(r, c) or 0 for c in SIN_BASICA_COLS)
    rec["ocupadaPrimario"] = None
    rec["hacinamiento"] = None

    piramide = []
    suma_f = suma_m = 0
    for label, base_key in AGE_BINS:
        fkey = "poblacion femenina de " + base_key[len("poblacion de "):]
        mkey = "poblacion masculina de " + base_key[len("poblacion de "):]
        fv = get(r, fkey) or 0
        mv = get(r, mkey) or 0
        piramide.append({"label": label, "f": fv, "m": mv})
        suma_f += fv
        suma_m += mv
    pobf = rec["pobMujeres"] or 0
    pobm = rec["pobHombres"] or 0
    residuo_f = max(0, round(pobf - suma_f))
    residuo_m = max(0, round(pobm - suma_m))
    piramide.insert(6, {"label": "25-59", "f": residuo_f, "m": residuo_m})
    rec["piramide"] = piramide

    rec["municipio"] = r[MUNICIPIO_COL].strip()
    rec["localidad"] = r[LOCALIDAD_COL].strip()
    rec["poligono"] = int(r[POLIGONO_COL])
    rec["nombrePoligono"] = r[NOMBRE_POLIGONO_COL].strip()
    rec["region"] = r[REGION_COL].strip()
    rec["gmMarginacion"] = None
    rec["imMarginacion"] = None
    rec["pobTotLista"] = rec["pobTotal"]
    rec["coordManual"] = False
    # numval() redondea a 2 decimales (pensado para conteos/promedios censales);
    # las coordenadas necesitan la precision completa del CSV para ubicar bien
    # el marcador en el mapa (2 decimales equivalen a ~1km de error).
    lat_raw, lon_raw = r["LATITUD_DECIMAL"].strip(), r["LONGITUD_DECIMAL"].strip()
    rec["latitud"] = round(float(lat_raw), 6) if lat_raw else None
    rec["longitud"] = round(float(lon_raw), 6) if lon_raw else None

    resultados.append(rec)

print(f"Localidades procesadas: {len(resultados)}")
print(f"Poligonos representados: {sorted(set(r['poligono'] for r in resultados))}")

out_path = BASE + r"\dashboard\data_nueva_propuesta.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado por scripts/build_data_nueva_propuesta.py\n")
    f.write("// Fuente: TPBV_nueva_propuesta_Localidades.csv (INEGI, Censo 2020)\n")
    f.write("// Mismo formato de registro que TPBV_DATA (ver data.js) para poder\n")
    f.write("// alternar de conjunto de datos en el dashboard sin cambiar el render.\n")
    f.write("const TPBV_DATA_NUEVA = ")
    json.dump(resultados, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)

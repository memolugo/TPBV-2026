# -*- coding: utf-8 -*-
"""Convierte 'BANCO DE PROYECTOS_PP_TPBV_ACIUDADANAv08072026.xls' (hoja
'REGISTRO DE OBRAS ', 2,295 proyectos) a dashboard/banco_proyectos.js, para
el modulo "Banco de Proyectos": filtro en cascada Municipio -> Localidad que
despliega los proyectos de esa localidad.

Limpieza aplicada (los datos crudos vienen con inconsistencias tipicas de
captura manual en Excel):
  - MPIO: 46 valores crudos para ~34 municipios reales + "TODO EL ESTADO" /
    "Morelos " (programas estatales sin municipio especifico). Los 46 se
    normalizan a un nombre canonico correctamente acentuado (mismo criterio
    que el resto del tablero, ver MPIO_CANONICO) via MUNICIPIO_MAP, que
    ademas corrige errores de captura reales (no solo espacios/mayusculas):
    "Atlatlahuacan" -> "Atlatlahucan" (le sobra una 'a'), "Tlatizapan"/
    "Tlaltizapan" (dos variantes, una con letra faltante) -> "Tlaltizapán de
    Zapata". "TODO EL ESTADO" y "Morelos" (la fila dice el nombre del ESTADO,
    no un municipio -- son 2 programas de salud a nivel estatal) se agrupan
    en el mismo bucket "Todo el Estado".
  - LOC: 222 valores crudos -> se recortan espacios y se agrupan por
    (municipio, localidad en minusculas) tomando como texto canonico la
    grafia mas frecuente de cada grupo (evita que "Barrio De San Miguel" y
    "Barrio de San Miguel" aparezcan como dos localidades distintas en el
    filtro, sin inventar una regla de mayusculas "correcta"). No se corrigen
    errores de ortografia en LOC (a diferencia de MPIO): son 197+ valores,
    algunos son direcciones completas en vez de nombres de localidad, y no
    hay una lista oficial corta contra la cual normalizarlos con confianza.
  - ESTATUS: 'EJECUTADO'/'EJECUTADO '/'NO EJECUTADO ' -> trim alcanza (sin
    variantes de ortografia).
  - CLAVE DE LOCALIDAD: type inconsistente en el Excel (a veces string
    "170240002", a veces float 170240002.0) -> se normaliza a string sin
    decimales. Placeholder ('N/A', 17.0 en las filas "TODO EL ESTADO") o
    vacio -> None. Se conserva como dato informativo (cruce con INEGI) pero
    el filtro Municipio/Localidad usa el nombre normalizado, no la clave,
    porque 67 filas no tienen clave y las de "TODO EL ESTADO" traen un
    valor que no es una clave real.
  - AÑO: float -> int.
"""
import re
import unicodedata
from collections import Counter
import json
import xlrd

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s):
    if s is None:
        return ""
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


# Municipio crudo (normalizado) -> nombre canonico, mismo criterio de
# acentuacion que el resto del tablero (TPBV_POLIGONOS_ACTUAL_NOMBRES /
# Limites_municipales_ine.geojson). "todo el estado" y "morelos" (nombre del
# ESTADO, no un municipio -- ver docstring) comparten el mismo bucket.
MUNICIPIO_MAP = {
    "amacuzac": "Amacuzac",
    "atlatlahuacan": "Atlatlahucan",
    "axochiapan": "Axochiapan",
    "ayala": "Ayala",
    "coatetelco": "Coatetelco",
    "coatlan del rio": "Coatlán del Río",
    "cuautla": "Cuautla",
    "cuernavaca": "Cuernavaca",
    "emiliano zapata": "Emiliano Zapata",
    "hueyapan": "Hueyapan",
    "huitzilac": "Huitzilac",
    "jantetelco": "Jantetelco",
    "jiutepec": "Jiutepec",
    "jojutla": "Jojutla",
    "jonacatepec": "Jonacatepec de Leandro Valle",
    "mazatepec": "Mazatepec",
    "morelos": "Todo el Estado",
    "ocuituco": "Ocuituco",
    "puente de ixtla": "Puente de Ixtla",
    "todo el estado": "Todo el Estado",
    "temixco": "Temixco",
    "temoac": "Temoac",
    "tepalcingo": "Tepalcingo",
    "tepoztlan": "Tepoztlán",
    "tetela del volcan": "Tetela del Volcán",
    "tlalnepantla": "Tlalnepantla",
    "tlaltizapan": "Tlaltizapán de Zapata",
    "tlatizapan": "Tlaltizapán de Zapata",
    "tlaquiltenango": "Tlaquiltenango",
    "tlayacapan": "Tlayacapan",
    "totolapan": "Totolapan",
    "xochitepec": "Xochitepec",
    "xoxocotla": "Xoxocotla",
    "yautepec": "Yautepec",
    "yecapixtla": "Yecapixtla",
    "zacatepec": "Zacatepec",
    "zacualpan de amilpas": "Zacualpan de Amilpas",
}


def clave_localidad(v):
    if v is None:
        return None
    if isinstance(v, float):
        if v != v:  # NaN
            return None
        return str(int(v))
    s = str(v).strip()
    if not s or s.upper() == "N/A":
        return None
    if s.endswith(".0"):
        s = s[:-2]
    return s


wb = xlrd.open_workbook(BASE + r"\BANCO DE PROYECTOS_PP_TPBV_ACIUDADANAv08072026.xls")
ws = wb.sheet_by_name("REGISTRO DE OBRAS ")
rows_raw = [[ws.cell_value(r, c) for c in range(ws.ncols)] for r in range(1, ws.nrows)]
print(f"Filas leidas: {len(rows_raw)}")

mpios_no_mapeados = Counter()
proyectos_previos = []
for row in rows_raw:
    clave, mpio_raw, loc_raw, obra, generica, tipo_obra, estatus, estrategia, anio, indice = row

    mpio_key = norm(mpio_raw)
    municipio = MUNICIPIO_MAP.get(mpio_key)
    if municipio is None:
        mpios_no_mapeados[str(mpio_raw)] += 1
        municipio = clean_text(mpio_raw) or "Sin municipio"

    localidad = clean_text(loc_raw) or "(Sin localidad)"

    proyectos_previos.append({
        "claveLocalidad": clave_localidad(clave),
        "municipio": municipio,
        "localidad": localidad,
        "localidadKey": norm(localidad),
        "obra": clean_text(obra),
        "generica": clean_text(generica),
        "tipoObra": clean_text(tipo_obra),
        "estatus": clean_text(estatus),
        "estrategia": clean_text(estrategia),
        "anio": int(anio) if isinstance(anio, (int, float)) and anio == anio else None,
        "indice": clean_text(indice),
    })

if mpios_no_mapeados:
    print("AVISO: municipios sin mapeo explicito en MUNICIPIO_MAP (se usaron tal cual):")
    for k, v in mpios_no_mapeados.items():
        print(f"  {k!r}: {v}")

# --- Grafia canonica de LOC: la mas frecuente por (municipio, localidadKey) ---
grafias = {}
for p in proyectos_previos:
    key = (p["municipio"], p["localidadKey"])
    grafias.setdefault(key, Counter())[p["localidad"]] += 1

canon_localidad = {key: counter.most_common(1)[0][0] for key, counter in grafias.items()}

proyectos = []
for p in proyectos_previos:
    key = (p["municipio"], p["localidadKey"])
    proyectos.append({
        "claveLocalidad": p["claveLocalidad"],
        "municipio": p["municipio"],
        "localidad": canon_localidad[key],
        "obra": p["obra"],
        "generica": p["generica"],
        "tipoObra": p["tipoObra"],
        "estatus": p["estatus"],
        "estrategia": p["estrategia"],
        "anio": p["anio"],
        "indice": p["indice"],
    })

n_municipios = len({p["municipio"] for p in proyectos})
n_localidades = len({(p["municipio"], p["localidad"]) for p in proyectos})
n_ejecutado = sum(1 for p in proyectos if p["estatus"] == "EJECUTADO")
n_no_ejecutado = sum(1 for p in proyectos if p["estatus"] == "NO EJECUTADO")
print(f"\nProyectos: {len(proyectos)}")
print(f"Municipios distintos (canonicos): {n_municipios}")
print(f"Combinaciones municipio+localidad distintas: {n_localidades}")
print(f"Ejecutado: {n_ejecutado} | No ejecutado: {n_no_ejecutado} | Otro/vacio: {len(proyectos) - n_ejecutado - n_no_ejecutado}")

anios = Counter(p["anio"] for p in proyectos)
print("Por año:", dict(sorted((k, v) for k, v in anios.items() if k is not None)))

out_path = BASE + r"\dashboard\banco_proyectos.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'BANCO DE PROYECTOS_PP_TPBV_ACIUDADANAv08072026.xls'\n")
    f.write("// (hoja 'REGISTRO DE OBRAS '). Ver scripts/build_banco_proyectos.py para la\n")
    f.write("// limpieza aplicada (municipios/localidades normalizados).\n")
    f.write("const TPBV_BANCO_PROYECTOS = ")
    json.dump(proyectos, f, ensure_ascii=False)
    f.write(";\n")
print("\nGuardado:", out_path)

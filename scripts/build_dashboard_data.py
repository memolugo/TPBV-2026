# -*- coding: utf-8 -*-
"""
Genera dashboard/data.js con los datos de las 132 localidades TPBV 2026,
listos para consumir en el dashboard (Civic Insight / stitch_tpbv).

Fuente de verdad revisada respecto al primer informe (Diagnostico Estadistico
TPBV 2026.xlsx):
  - ITER_2020.xlsx (censo INEGI crudo) es la fuente PRIMARIA para todos los
    campos que tienen equivalente directo 1:1, porque el control de calidad
    previo detecto que BD JULIO TPBV.xlsx tiene columnas VIV15/VIV17/VIV20
    rotadas entre si, y que ECO7/ECO28/DISC4/DISC5/DISC6 no coinciden con el
    censo (ver Notas_y_Advertencias del informe anterior).
  - BD JULIO TPBV.xlsx solo se usa para 3 campos que NO existen en ITER:
    EDU34 (sin educacion basica completa), ECO13 (ocupada sector primario) y
    VIV81 (hacinamiento). Estos se marcan como "no verificado" en el JSON.
"""
import json
import re
import unicodedata
import difflib
from datetime import datetime
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
    if isinstance(s, datetime):
        s = str(s)
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


def numval(v):
    """INEGI oculta conteos pequenos con '*' por confidencialidad; se convierte a None
    en vez de dejar pasar el string literal (que rompia el formateo numerico en JS)."""
    if isinstance(v, str):
        v = v.strip()
        if v in ("", "*", "N/D"):
            return None
        try:
            return float(v) if "." in v else int(v)
        except ValueError:
            return None
    return v


def dms_to_decimal(s):
    """'18°58'09.866" N' -> 18.9694..., ' 98°53'30.493" W' -> -98.8918..."""
    if not s or not isinstance(s, str):
        return None
    m = re.search(r"(\d+)[°\s]+(\d+)['\s]+([\d.]+)\"?\s*([NSEW])", s.strip())
    if not m:
        return None
    deg, mn, sec, hemi = m.groups()
    val = float(deg) + float(mn) / 60 + float(sec) / 3600
    if hemi in ("S", "W"):
        val = -val
    return round(val, 6)


# ---------------------------------------------------------------------------
# 1. Lista Comunidades TPBV 2026 (132 localidades objetivo)
# ---------------------------------------------------------------------------
wb_lista = openpyxl.load_workbook(BASE + r"\Lista Comunidades TPBV 2026 .xlsx", data_only=True)
ws_lista = wb_lista["Revisada"]

MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

comunidades = []
for row in ws_lista.iter_rows(min_row=2, max_row=133, values_only=True):
    region, nom_mun, poligono, nom_loc = row[0], row[1], row[2], row[3]
    if not nom_mun or not nom_loc:
        continue
    if isinstance(nom_loc, datetime):
        nom_loc = f"{nom_loc.day} de {MESES[nom_loc.month]}"
    comunidades.append({
        "region": region, "nom_mun": nom_mun, "poligono": poligono,
        "nom_loc": nom_loc, "im_2020": row[4], "gm_2020": row[5],
        "pob_tot_lista": row[7],
    })

# ---------------------------------------------------------------------------
# 2. ITER_2020.xlsx (fuente primaria)
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 3. BD JULIO TPBV.xlsx (solo EDU34 / ECO13 / VIV81)
# ---------------------------------------------------------------------------
wb_bd = openpyxl.load_workbook(BASE + r"\BD JULIO TPBV.xlsx", read_only=True, data_only=True)
ws_bd = wb_bd["LocRuralInfo4 (todas)"]
bd_rows = list(ws_bd.iter_rows(values_only=True))
bd_header = [str(h).strip() if h else "" for h in bd_rows[0]]
bd_idx = {h: i for i, h in enumerate(bd_header)}

bd_by_mun = {}
for r in bd_rows[1:]:
    mun, loc = r[bd_idx["NOM_MUN"]], r[bd_idx["NOMGEO"]]
    if not mun or not loc:
        continue
    bd_by_mun.setdefault(norm(mun), []).append((loc, r))

# ---------------------------------------------------------------------------
# 4. Mapeo de campos ITER -> claves del dashboard
# ---------------------------------------------------------------------------
ITER_MAP = {
    "pobTotal": "POBTOT", "pobMujeres": "POBFEM", "pobHombres": "POBMAS",
    "analfabetas": "P15YM_AN",
    "pea": "PEA", "desocupada": "PDESOCUP", "ocupada": "POCUPADA",
    "afromexicana": "POB_AFRO",
    "conDiscapacidad": "PCON_DISC", "conLimitacion": "PCON_LIMI", "conProblemaMental": "PCLIM_PMEN",
    "afiliada": "PDER_SS", "sinAfiliacion": "PSINDER", "imss": "PDER_IMSS",
    "issste": "PDER_ISTE", "otrosSalud": "PAFIL_PDOM",
    "totalViviendas": "VIVTOT", "pisoTierra": "VPH_PISOTI", "unSoloCuarto": "VPH_1CUART",
    "aguaEntubada": "VPH_AGUADV", "drenaje": "VPH_DRENAJ", "electricidad": "VPH_C_ELEC",
    "refrigerador": "VPH_REFRI", "lavadora": "VPH_LAVAD", "automovil": "VPH_AUTOM",
    "computadora": "VPH_PC", "internet": "VPH_INTER", "celular": "VPH_CEL",
    # Poblacion indigena
    "hablaLenguaIndigena": "P3YM_HLI", "indigenaMonolingue": "P3HLINHE", "hogaresIndigenas": "PHOG_IND",
    # Rezago educativo ampliado
    "gradoEscolaridad": "GRAPROES", "ninos6a11NoAsisten": "P6A11_NOA", "ninos12a14NoAsisten": "P12A14NOA",
    # Estructura de edad / dependencia demografica
    "pob0a14": "POB0_14", "pob15a64": "POB15_64", "pob65mas": "POB65_MAS",
}

# Piramide poblacional simplificada: este archivo ITER Morelos NO trae los
# grupos quinquenales estandar (P_0A4...P_85YMAS no existen en esta
# exportacion), solo grupos irregulares. Se arma una piramide honesta con lo
# que si existe; el grupo 25-59 se calcula por residuo (POBTOT - resto de
# grupos), que es aritmeticamente correcto porque los demas son mutuamente
# excluyentes y cubren el resto de la poblacion.
AGE_BINS = [
    ("0-2", "P_0A2"), ("3-5", "P_3A5"), ("6-11", "P_6A11"), ("12-14", "P_12A14"),
    ("15-17", "P_15A17"), ("18-24", "P_18A24"), ("25-59", None), ("60+", "P_60YMAS"),
]

# Localidades donde el match difuso con ITER 2020 encontro una localidad
# homonima equivocada, no esta: verificado el 2026-08-15 comparando POB_TOT
# de "Lista Comunidades TPBV 2026" contra POBTOT de ITER (diferencias de 3x
# a 185x -- p.ej. Ampliacion Chinameca tiene 17 habitantes en la lista pero
# el ITER matcheado tiene 3149, el mismo que "Chinameca", señal clara de que
# emparejo con la cabecera en vez de con la ampliacion). Se identifican por
# (poligono, localidad) -- no por (municipio, localidad) como MANUAL_COORDS
# mas abajo -- porque el poligono es el dato mas confiable que se tiene de
# la lista pegada por el usuario para cruzar contra estos registros.
RECHAZAR_MATCH_ITER_POL = {
    (3, norm("Ampliación Chinameca")),
    (4, norm("Iztaccíhuatl")),
    (11, norm("La Joya")),
    (11, norm("Colonia Buenos Aires")),
    (11, norm("Colonia Emiliano Zapata")),
    (19, norm("Tres de mayo")),
    (18, norm("Palo Grande")),
    (20, norm("Colonia las Flores")),
    (24, norm("Campo la Tehuixtlera")),
}

resultados = []
for c in comunidades:
    mun_key = norm(c["nom_mun"])
    it_row, it_metodo, it_score, it_name = buscar(c["nom_loc"], it_by_mun.get(mun_key, []))
    bd_row, bd_metodo, bd_score, bd_name = buscar(c["nom_loc"], bd_by_mun.get(mun_key, []))
    if (int(c["poligono"]), norm(c["nom_loc"])) in RECHAZAR_MATCH_ITER_POL:
        it_row = None

    rec = {
        "region": c["region"], "municipio": c["nom_mun"], "poligono": c["poligono"],
        "localidad": c["nom_loc"], "imMarginacion": c["im_2020"], "gmMarginacion": c["gm_2020"],
        "pobTotLista": c["pob_tot_lista"],
        "fuente": "ITER 2020" if it_row is not None else "SIN DATOS",
        "matchMetodo": it_metodo, "matchScore": round(it_score, 2),
        "coordManual": False,
    }

    if it_row is not None:
        for key, itf in ITER_MAP.items():
            rec[key] = numval(it_row[it_idx[itf]])
        rec["latitud"] = dms_to_decimal(it_row[it_idx["LATITUD"]])
        rec["longitud"] = dms_to_decimal(it_row[it_idx["LONGITUD"]])

        # Piramide poblacional (ver comentario junto a AGE_BINS)
        piramide = []
        suma_f = suma_m = 0
        for label, itf in AGE_BINS:
            if itf is None:
                continue
            f = numval(it_row[it_idx[itf + "_F"]])
            m = numval(it_row[it_idx[itf + "_M"]])
            piramide.append({"label": label, "f": f, "m": m})
            suma_f += f or 0
            suma_m += m or 0
        pobf = rec.get("pobMujeres") or 0
        pobm = rec.get("pobHombres") or 0
        residuo_f = max(0, round(pobf - suma_f))
        residuo_m = max(0, round(pobm - suma_m))
        # Insertar "25-59" en su posicion (index 6, entre 18-24 y 60+)
        piramide.insert(6, {"label": "25-59", "f": residuo_f, "m": residuo_m})
        rec["piramide"] = piramide
    else:
        for key in ITER_MAP:
            rec[key] = None
        rec["latitud"] = None
        rec["longitud"] = None
        rec["piramide"] = None

    # Poblacion: se usa la de "Lista Comunidades TPBV 2026" (pobTotLista) como
    # fuente unica para pobTotal en vez de la de ITER 2020 -- decision del
    # 2026-08-15, mismo criterio aplicado a data_propuesta_2026.js (ver
    # build_data_propuesta_2026.py). Se aplica DESPUES del bloque de ITER
    # para pisar el pobTotal que haya puesto ITER_MAP; el resto de las
    # estadisticas SI sigue viniendo de ITER donde hay match.
    if isinstance(c["pob_tot_lista"], (int, float)):
        rec["pobTotal"] = int(c["pob_tot_lista"])

    if bd_row is not None:
        rec["sinBasicaCompleta"] = numval(bd_row[bd_idx["EDU34"]])
        rec["ocupadaPrimario"] = numval(bd_row[bd_idx["ECO13"]])
        rec["hacinamiento"] = numval(bd_row[bd_idx["VIV81"]])
    else:
        rec["sinBasicaCompleta"] = None
        rec["ocupadaPrimario"] = None
        rec["hacinamiento"] = None

    resultados.append(rec)

# ---------------------------------------------------------------------------
# 6. Coordenadas capturadas manualmente para localidades sin match en ITER
#    2020 (no existen como localidad censal independiente, ver "fuente" ==
#    "SIN DATOS"). Provistas por el usuario el 2026-08-06; solo se aplican si
#    la localidad todavia no tiene coordenadas (no pisa datos del censo).
# ---------------------------------------------------------------------------
MANUAL_COORDS = {
    ("Tepalcingo", "Barrio Palo Revuelto"): (18.592603908050833, -98.84845163082153),
    ("Tetela del Volcán", "Barrio Santiago"): (18.901983622265153, -98.73027557586245),
    ("Tetela del Volcán", "Xochicalco"): (18.887552484931422, -98.73565782639069),
    ("Tlaquiltenango", "Centro"): (18.630025710530443, -99.16142574752857),
    ("Tlaquiltenango", "Gabriel Tepepa"): (18.639582050048215, -99.16288482999653),
    ("Tlaquiltenango", "Miguel Hidalgo"): (18.64254550457902, -99.16073110466893),
    ("Tlayacapan", "Barrio de Texcalpan"): (18.95350860247261, -98.9759093141489),
    ("Tlayacapan", "Colonia del Señor santiago"): (18.953001268346082, -98.97095263695748),
    ("Zacatepec", "Emiliano Zapata"): (18.65374332209217, -99.19499499033442),
    ("Zacatepec", "Tetelpa"): (18.665026395393628, -99.20477966372283),
    # 2026-10-12: localidades de RECHAZAR_MATCH_ITER_POL. Coordenada del CSV
    # completo del censo (iter_17_cpv2020, clave LOC entre parentesis),
    # validada dentro del poligono. Excepciones: Iztaccihuatl es aproximada
    # (calle "Camino a Iztaccihuatl" de OpenStreetMap, CP 62743) y Tres de
    # mayo (LOC 0054, POBTOT 25 = lista) queda 0.4 km fuera del poligono 19.
    ("Ayala", "Ampliación Chinameca"): (18.611187, -99.016804),  # 0106
    ("Cuautla", "Iztaccíhuatl"): (18.788234, -98.902323),  # OSM, aproximada
    ("Tepalcingo", "La Joya"): (18.588022, -98.839349),  # 0051
    ("Tepalcingo", "Colonia Buenos Aires"): (18.583739, -98.845695),  # 0031
    ("Tepalcingo", "Colonia Emiliano Zapata"): (18.588799, -98.854231),  # 0043
    ("Tlaquiltenango", "Palo Grande"): (18.594695, -99.147836),  # 0053
    ("Tlayacapan", "Tres de mayo"): (18.949466, -98.983352),  # 0054
    ("Xochitepec", "Colonia las Flores"): (18.809918, -99.252455),  # 0111
    ("Yautepec", "Campo la Tehuixtlera"): (18.842899, -99.104523),  # 0133
}
n_manual = 0
for r in resultados:
    key = (r["municipio"], r["localidad"])
    if key in MANUAL_COORDS and r["latitud"] is None:
        r["latitud"], r["longitud"] = MANUAL_COORDS[key]
        r["coordManual"] = True
        n_manual += 1
print(f"Coordenadas manuales aplicadas: {n_manual}/{len(MANUAL_COORDS)}")
faltantes = [k for k in MANUAL_COORDS if not any(r['municipio'] == k[0] and r['localidad'] == k[1] for r in resultados)]
if faltantes:
    print("AVISO: claves de MANUAL_COORDS sin localidad correspondiente:", faltantes)

# ---------------------------------------------------------------------------
# 7. Grado de marginacion para localidades que la lista trae sin GM_2020
#    (2026-10-16). Fuente: CONAPO, Indices de marginacion 2020 (copia de
#    github.com/IndiceMx/IM_2020, validada: coincide con la lista en las 92
#    localidades comparables). Los barrios/colonias salen del indice urbano
#    por COLONIA (IMC), cuya poblacion coincide exacto con POB_TOT de la
#    lista; Loma Bonita sale del indice por LOCALIDAD (IML). Solo se asigna
#    el grado: el IM de colonia usa otra escala (~145-150) que el de
#    localidad (~17-25), asi que imMarginacion se deja vacio para no
#    mezclarlas. Colonia Las Rosas (Temixco, 6 hab.) no aparece en el IML
#    (CONAPO omite localidades muy pequenas) y se queda sin grado.
#    2026-10-19: Tres Marias (Huitzilac) venia como "ZAP Urbana"; sus 3 AGEB
#    en el indice urbano por AGEB (IMU) suman 4,124 hab. (igual que el
#    tablero): 0092 Alto (325), 0105 Alto (3,700), 0124 Muy alto (99). Se
#    asigna Alto (98% de su poblacion); la colonia Tres Marias del IMC
#    tambien es Alto.
# ---------------------------------------------------------------------------
GRADOS_A_REEMPLAZAR = {None, "", "ZAP Urbana"}
MARGINACION_COMPLEMENTO = {
    ("Tepalcingo", "Barrio Palo Revuelto"): ("Alto", "CONAPO IMC 2020 (colonia Palo Revuelto)"),
    ("Tetela del Volcán", "Barrio Santiago"): ("Alto", "CONAPO IMC 2020 (colonia Santiago)"),
    ("Tlaquiltenango", "Miguel Hidalgo"): ("Medio", "CONAPO IMC 2020 (colonia Miguel Hidalgo)"),
    ("Tlaquiltenango", "Gabriel Tepepa"): ("Medio", "CONAPO IMC 2020 (colonia Gabriel Tepepa)"),
    ("Tlaquiltenango", "Centro"): ("Medio", "CONAPO IMC 2020 (colonia Centro)"),
    ("Tlayacapan", "Colonia del Señor santiago"): ("Muy alto", "CONAPO IMC 2020 (colonia Del Señor Santiago)"),
    ("Tlayacapan", "Barrio de Texcalpan"): ("Alto", "CONAPO IMC 2020 (colonia De Texcalpan)"),
    ("Zacatepec", "Tetelpa"): ("Bajo", "CONAPO IMC 2020 (colonia Tetelpa)"),
    ("Xochitepec", "Colonia Loma Bonita (Xochitepec)"): ("Muy bajo", "CONAPO IML 2020 (localidad 0085)"),
    ("Huitzilac", "Tres Marías/ AGEB's 92, 105 Y 124 (Cristo Rey)"): (
        "Alto", "CONAPO IMU 2020 (AGEB 0092 y 0105 Alto, 0124 Muy alto; 98% de la población en Alto)"),
}
n_gm = 0
for r in resultados:
    key = (r["municipio"], r["localidad"])
    if key in MARGINACION_COMPLEMENTO and r["gmMarginacion"] in GRADOS_A_REEMPLAZAR:
        r["gmMarginacion"], r["fuenteMarginacion"] = MARGINACION_COMPLEMENTO[key]
        r["imMarginacion"] = None
        n_gm += 1
print(f"Grados de marginacion complementados: {n_gm}/{len(MARGINACION_COMPLEMENTO)}")

n_iter = sum(1 for r in resultados if r["fuente"] == "ITER 2020")
n_bd = sum(1 for r in resultados if r["sinBasicaCompleta"] is not None)
print(f"Localidades: {len(resultados)} | con datos ITER 2020: {n_iter} | con EDU34/ECO13/VIV81 (BD JULIO): {n_bd}")

sin_iter = [r["localidad"] for r in resultados if r["fuente"] == "SIN DATOS"]
if sin_iter:
    print("SIN match en ITER 2020 (sin datos):", sin_iter)

# ---------------------------------------------------------------------------
# 5. Escribir dashboard/data.js
# ---------------------------------------------------------------------------
import os
os.makedirs(BASE + r"\dashboard", exist_ok=True)
out_path = BASE + r"\dashboard\data.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado automaticamente por scripts/build_dashboard_data.py\n")
    f.write("// Fuente: ITER_2020.xlsx (primaria) + BD JULIO TPBV.xlsx (EDU34/ECO13/VIV81)\n")
    f.write("const TPBV_DATA = ")
    json.dump(resultados, f, ensure_ascii=False, indent=None ,default=str)
    f.write(";\n")

print("Guardado:", out_path)

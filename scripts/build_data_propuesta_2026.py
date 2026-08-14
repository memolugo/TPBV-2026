# -*- coding: utf-8 -*-
"""
Genera dashboard/data_propuesta_2026.js con las 70 localidades de la hoja
'PROPUESTA 2026' (Hoja de trabajo TPBV 2026.xlsx), en el MISMO formato de
registro que TPBV_DATA (ver data.js / build_dashboard_data.py), para que el
switch "Nueva Propuesta Territorial" de Analisis Demografico use esta lista
de 70 en vez de las 118 localidades del CSV anterior (decision del
2026-08-13: la hoja 'PROPUESTA 2026' es la version vigente).

Fuente de estadisticas: ITER_2020.xlsx (misma logica de match difuso y mismo
ITER_MAP que build_dashboard_data.py) para las 62 localidades con
coincidencia censal, + BD JULIO TPBV.xlsx solo para los 3 campos que no
existen en ITER (EDU34/ECO13/VIV81). Las 8 localidades sin match censal (ver
build_propuesta_2026.py) quedan con fuente='SIN DATOS': el dashboard ya
sabe renderizar ese caso (tarjeta reducida con poblacion + mapa via
coordenada manual, en vez de las tarjetas completas de indicadores).

Poligono: la columna "PROMOTOR" de la hoja NO es un promotor de campo --es
literalmente el numero de poligono real de TPBV_nueva_propuesta ok.geojson
(el mismo POLIGONO_TPBV que usa TPBV_nueva_propuesta_Localidades.csv),
verificado el 2026-08-13 cruzando cada localidad contra la geometria oficial
(0 de 68 sin coincidencia). Dos valores de texto en esa columna son casos
especiales, tambien verificados por nombre de poligono:
  - "Ayala"  -> poligono 23 ("Ayala Nuevo"), el nombre del poligono en vez
    del numero.
  - "23PP"   -> poligono 22 ("Yautepec-Tlayacapan PP"); es un typo en la
    hoja (el "PP" si corresponde a ese poligono, pero el numero esta mal).
  - "Tlaquiltenango" (Las Bovedas / Las Carpas) -> ya excluidas arriba junto
    con el resto de Tlaquiltenango.
nombrePoligono y region se toman de esa misma geometria oficial (Nom_pol /
Region), no del municipio de la hoja -- son mas precisos porque un poligono
puede abarcar localidades de mas de un municipio (p.ej. poligono 15
"Temixco-Xochitepec" incluye localidades de Temixco, Coatetelco y
Xochitepec).
"""
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


def numval(v):
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
    """Columna 'PROMOTOR' -> numero real de poligono (ver docstring del
    modulo). Devuelve None si no se puede resolver (no deberia pasar; se
    revisa con un AVISO mas abajo si ocurre)."""
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip() if v is not None else ""
    if s == "Ayala":
        return 23
    if s.upper() == "23PP":
        return 22
    m = re.match(r"(\d+)", s)
    return int(m.group(1)) if m else None


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
    "hablaLenguaIndigena": "P3YM_HLI", "indigenaMonolingue": "P3HLINHE", "hogaresIndigenas": "PHOG_IND",
    "gradoEscolaridad": "GRAPROES", "ninos6a11NoAsisten": "P6A11_NOA", "ninos12a14NoAsisten": "P12A14NOA",
    "pob0a14": "POB0_14", "pob15a64": "POB15_64", "pob65mas": "POB65_MAS",
}
AGE_BINS = [
    ("0-2", "P_0A2"), ("3-5", "P_3A5"), ("6-11", "P_6A11"), ("12-14", "P_12A14"),
    ("15-17", "P_15A17"), ("18-24", "P_18A24"), ("25-59", None), ("60+", "P_60YMAS"),
]

# Coordenadas manuales/override por (municipio, localidad) -- normalizadas
# para no depender de acentos/mayusculas exactas de la hoja. Dos usos:
#   1. Fallback para localidades sin match censal en ITER 2020 (quedan con
#      fuente='SIN DATOS' pero si con coordenada, ver mas abajo).
#   2. Override explicito de coordenada aunque SI haya match censal (la
#      estadistica sigue viniendo de ITER, solo se corrige lat/lon) -- para
#      el resto del poligono 3 "Puente de Ixtla" (Buena Vista, Colonia
#      Emiliano Zapata, El Roble) el usuario proveyo coordenadas mas precisas
#      el 2026-08-14 y quiere que reemplacen a las de ITER.
# Santana/Cuauhtemoc/Del Sol/La Falda: coordenadas actualizadas el
# 2026-08-14 (reemplazan las provistas el 2026-08-13).
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
    # Actualizadas el 2026-08-15 (reemplazan coordenadas anteriores).
    (norm("Yautepec"), norm("Arco Blanco")): (18.91672, -99.03622),
    (norm("Tlayacapan"), norm("Colonia el Partidor (El Capulín)")): (18.91897, -99.02467),
    (norm("Xochitepec"), norm("Campo los San Juanes")): (18.73065, -99.18727),
    (norm("Tlaltizapán de Zapata"), norm("Campo el Escape")): (18.6971, -99.1145),
    # Actualizadas el 2026-08-15: quedaban fuera del poligono de la Nueva
    # Propuesta que les corresponde (verificado con shapely, ver sesion).
    (norm("Tlaltizapán de Zapata"), norm("El Olmedo")): (18.70194, -99.11238),
    (norm("Jantetelco"), norm("Gabriel Tepepa Amayuca")): (18.72172, -98.80484),
}

# Localidades donde el match difuso con ITER 2020 encontro una localidad
# homonima equivocada, no esta: verificado el 2026-08-15 comparando POB_TOTAL
# de la hoja contra POBTOT de ITER (diferencias de 3x a 60x -- p.ej. Metepec
# en la hoja tiene 49 habitantes pero el ITER matcheado tiene 2942, señal
# clara de que emparejo con el Metepec grande de otro lado, no con esta
# colonia de Ocuituco). Se fuerza fuente='SIN DATOS' para estas 4 (quedan
# solo con la poblacion de la hoja, sin viviendas/salud/educacion de un
# lugar que no es este) en vez de aceptar estadisticas de otro sitio.
RECHAZAR_MATCH_ITER = {
    (norm("Ocuituco"), norm("Metepec")),
    (norm("Tlaltizapán de Zapata"), norm("Palo Prieto")),
    (norm("Zacualpan de Amilpas"), norm("Mariano Escobedo")),
    (norm("Jantetelco"), norm("Gabriel Tepepa Amayuca")),
}

# --- Cargar PROPUESTA 2026 ---
wb_p = openpyxl.load_workbook(BASE + r"\Hoja de trabajo TPBV 2026.xlsx", data_only=True, read_only=True)
ws_p = wb_p["PROPUESTA 2026"]
rows_p = list(ws_p.iter_rows(values_only=True))
propuesta_todas = [r for r in rows_p[1:] if r[0]]

# Excluye Tlaquiltenango: ese municipio ya esta cubierto por la propuesta
# actual (poligonos 14-18, ver TPBV_POLIGONOS/poligonos.js), asi que es un
# duplicado, no territorio nuevo (misma decision aplicada a
# build_propuesta_nueva.py / build_nuevas_localidades.py / build_propuesta_2026.py
# el 2026-08-12/13).
MUNICIPIOS_EXCLUIDOS = {"Tlaquiltenango"}
propuesta = [r for r in propuesta_todas if str(r[5]).strip() not in MUNICIPIOS_EXCLUIDOS]
print(f"Localidades en PROPUESTA 2026: {len(propuesta_todas)} | excluidas ({', '.join(MUNICIPIOS_EXCLUIDOS)}): {len(propuesta_todas) - len(propuesta)} | restantes: {len(propuesta)}")

# --- Geometria oficial de poligonos (fuente de verdad para nombre/region) ---
with open(BASE + r"\TPBV_nueva_propuesta ok.geojson", encoding="utf-8") as f:
    geojson_poligonos = json.load(f)
poligono_info = {f["properties"]["POLIGONO"]: f["properties"] for f in geojson_poligonos["features"]}
print(f"Poligonos en la geometria oficial: {len(poligono_info)}")

# --- ITER 2020 (primaria) ---
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

# --- BD JULIO (solo EDU34 / ECO13 / VIV81) ---
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

resultados = []
n_iter = n_sin = 0
for r in propuesta:
    loc, promotor, nom_mun, pob_total = r[0], r[1], r[5], r[7]
    mun_key = norm(nom_mun)
    it_row, it_metodo, it_score, it_name = buscar(loc, it_by_mun.get(mun_key, []))
    bd_row, bd_metodo, bd_score, bd_name = buscar(loc, bd_by_mun.get(mun_key, []))
    if (mun_key, norm(loc)) in RECHAZAR_MATCH_ITER:
        it_row = None

    pol_num = parse_promotor(promotor)
    info = poligono_info.get(pol_num)
    if info is None:
        print(f"  AVISO: '{loc}' ({nom_mun}) -> PROMOTOR={promotor!r} no resuelve a un poligono valido")

    rec = {
        "region": info["REGION"] if info else None,
        "municipio": str(nom_mun).strip(),
        "poligono": pol_num,
        "nombrePoligono": info["NOMBRE"] if info else str(nom_mun).strip(),
        "localidad": str(loc).strip(),
        "imMarginacion": None,
        "gmMarginacion": None,
        "pobTotLista": int(pob_total) if isinstance(pob_total, (int, float)) else None,
        "coordManual": False,
    }

    if it_row is not None:
        n_iter += 1
        for key, itf in ITER_MAP.items():
            rec[key] = numval(it_row[it_idx[itf]])
        rec["fuente"] = "ITER 2020"
        rec["latitud"] = dms_to_decimal(it_row[it_idx["LATITUD"]])
        rec["longitud"] = dms_to_decimal(it_row[it_idx["LONGITUD"]])

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
        piramide.insert(6, {"label": "25-59", "f": max(0, round(pobf - suma_f)), "m": max(0, round(pobm - suma_m))})
        rec["piramide"] = piramide

        if bd_row is not None:
            rec["sinBasicaCompleta"] = numval(bd_row[bd_idx["EDU34"]])
            rec["ocupadaPrimario"] = numval(bd_row[bd_idx["ECO13"]])
            rec["hacinamiento"] = numval(bd_row[bd_idx["VIV81"]])
        else:
            rec["sinBasicaCompleta"] = None
            rec["ocupadaPrimario"] = None
            rec["hacinamiento"] = None
    else:
        n_sin += 1
        for key in ITER_MAP:
            rec[key] = None
        rec["sinBasicaCompleta"] = None
        rec["ocupadaPrimario"] = None
        rec["hacinamiento"] = None
        rec["piramide"] = None
        rec["fuente"] = "SIN DATOS"
        rec["latitud"] = None
        rec["longitud"] = None

    # Poblacion: se usa la de la hoja "PROPUESTA 2026" (columna POB_TOTAL,
    # ya en pob_total/pobTotLista) como fuente unica para pobTotal, pisando
    # la de ITER 2020 cuando hay match. Decision del 2026-08-15: al comparar
    # ambas fuentes se encontraron 18 localidades con match censal donde la
    # poblacion de ITER difiere mucho de la de la hoja (p.ej. Metepec: 49 en
    # la hoja vs 2942 en ITER, ~60x -- señal de que el match difuso emparejo
    # con una localidad homonima equivocada, no con esta). El resto de las
    # estadisticas (vivienda, salud, educacion...) SI sigue viniendo de ITER
    # donde hay match; solo pobTotal se pisa. Para las localidades SIN
    # DATOS esto no cambia nada visible (ya mostraban esta misma cifra via
    # pobTotLista), pero se deja pobTotal consistente con propuesta_2026.js.
    if isinstance(pob_total, (int, float)):
        rec["pobTotal"] = int(pob_total)

    # Override de coordenada (ver COORD_OVERRIDES): se aplica DESPUES del
    # match censal y pisa lat/lon aunque ya vinieran de ITER -- la
    # estadistica (fuente='ITER 2020') no cambia, solo la ubicacion.
    override_key = (mun_key, norm(loc))
    if override_key in COORD_OVERRIDES:
        rec["latitud"], rec["longitud"] = COORD_OVERRIDES[override_key]
        rec["coordManual"] = True
    elif rec["latitud"] is None:
        print(f"  AVISO: '{loc}' ({nom_mun}) sin match ITER y sin coordenada manual")

    resultados.append(rec)

print(f"\nCon estadistica completa (ITER 2020): {n_iter}")
print(f"SIN DATOS censales (solo poblacion + coordenada manual): {n_sin}")
print(f"Total: {len(resultados)}")

out_path = BASE + r"\dashboard\data_propuesta_2026.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado por scripts/build_data_propuesta_2026.py\n")
    f.write("// Fuente: hoja 'PROPUESTA 2026' de 'Hoja de trabajo TPBV 2026.xlsx' (70\n")
    f.write("// localidades) + ITER 2020 / BD JULIO para estadisticas. Mismo formato de\n")
    f.write("// registro que TPBV_DATA; reemplaza a TPBV_DATA_NUEVA como fuente del\n")
    f.write("// switch 'Nueva Propuesta Territorial' en Analisis Demografico (ver app.js).\n")
    f.write("const TPBV_DATA_PROPUESTA_2026 = ")
    json.dump(resultados, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)

"""
Genera dashboard/red_ltqnu.js: dependencias del Gobierno de Morelos con la
red Wi-Fi publica "La tierra que nos une" (ATDEM), a partir de
'Agentes_dependencias La Tierra Que Nos Une.xlsx'.

  - Solo filas con Red_la_tierra_que_nos_une = "SI" (hoja principal).
  - Las coordenadas vienen sin punto decimal (18932191 -> 18.932191,
    -9923503 -> -99.23503): se reinserta el punto despues de los 2 primeros
    digitos (todo Morelos esta en lat 18.x / lon -99.x / -98.x).
  - Puntos de acceso: los de la hoja principal y, si faltan, los de la hoja
    "Agentes - LTQNU" (por nombre de dependencia).
  - NO se exportan nombres de agentes/titulares ni notas tecnicas internas
    (pendientes, firewall, VPN): el tablero es publico.
"""
import json
import re
import unicodedata
from pathlib import Path

import openpyxl

BASE = Path(__file__).resolve().parent.parent
XLSX = BASE / "Agentes_dependencias La Tierra Que Nos Une.xlsx"
OUT = BASE / "dashboard" / "red_ltqnu.js"

PALACIO = (18.921984, -99.234977)

# Dependencias con red sin coordenada (o con la de Palacio de Gobierno como
# relleno pese a otra direccion en la hoja de agentes): ubicacion buscada en
# OpenStreetMap/Nominatim el 2026-10-16 a partir de esa direccion.
COORDENADAS_CORREGIDAS = {
    "servicios de salud": ((18.919844, -99.237184), "Borda 3, Centro, Cuernavaca (OpenStreetMap: Servicios de Salud de Morelos)"),
    "instituto de credito para los trabajadores al servicio del gobierno del estado de morelos":
        ((18.923237, -99.236891), "Dwight W. Morrow 20, Centro, Cuernavaca (OpenStreetMap: aproximada a nivel de calle)"),
    "coordinacion general de movilidad y transporte":
        ((18.915824, -99.234091), "Calle Cuauhtemotzin 01, Club de Golf, Cuernavaca (OpenStreetMap: aproximada a nivel de calle)"),
    "instituto de servicios registrales y catastrales":
        ((18.912175, -99.234527), "Zapote 2, Miguel Hidalgo, Cuernavaca (OpenStreetMap: aproximada a nivel de calle)"),
}

# Filas con Red_la_tierra_que_nos_une vacio que SI tienen red (confirmado por
# el usuario el 2026-10-16; la hoja de agentes la marca "V2 - Completo").
INCLUIR_AUNQUE_VACIO = {"instituto de servicios registrales y catastrales"}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"\(.*?\)", "", s)).strip()


def limpiar(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def coord(valor):
    """18932191.0 -> 18.932191 ; -9923503.0 -> -99.23503 (None si vacio)."""
    if valor in (None, ""):
        return None
    signo = -1 if float(valor) < 0 else 1
    digitos = str(int(abs(float(valor))))
    return signo * float(digitos[:2] + "." + digitos[2:])


def en_morelos(lat, lon):
    return lat is not None and lon is not None and 18.3 < lat < 19.2 and -99.6 < lon < -98.6


def correccion(dependencia):
    n = norm(dependencia)
    return next((v for k, v in COORDENADAS_CORREGIDAS.items() if n.startswith(k)), None)


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    principal = wb.worksheets[0]          # "La tierra que nos une "
    agentes = wb.worksheets[2]            # "Agentes - LTQNU (...)"

    # Hoja de agentes: direccion y puntos de acceso por dependencia
    info_agentes = {}
    for r in agentes.iter_rows(min_row=2, values_only=True):
        if r[2]:
            info_agentes.setdefault(norm(r[2]), []).append({"direccion": limpiar(r[3]), "ap": r[5]})

    registros, avisos = [], []
    for r in principal.iter_rows(min_row=2, values_only=True):
        tiene_red = str(r[9] or "").strip().upper() == "SI"
        if not tiene_red and not (not r[9] and any(norm(r[2]).startswith(k) for k in INCLUIR_AUNQUE_VACIO)):
            continue
        secretaria, dependencia = limpiar(r[1]), limpiar(r[2])
        lat, lon = coord(r[4]), coord(r[5])
        fuente_coord = "Hoja de dependencias"
        fix = correccion(dependencia)
        if fix and (lat is None or (round(lat, 6), round(lon, 6)) == PALACIO):
            (lat, lon), fuente_coord = fix
        if not en_morelos(lat, lon):
            avisos.append(f"sin coordenada valida: {dependencia} ({lat}, {lon})")
            lat = lon = None

        agentes_dep = info_agentes.get(norm(dependencia), [])
        ap = int(r[11]) if isinstance(r[11], (int, float)) else None
        if ap is None and len(agentes_dep) == 1 and isinstance(agentes_dep[0]["ap"], (int, float)):
            ap = int(agentes_dep[0]["ap"])
        es_palacio = lat is not None and (round(lat, 6), round(lon, 6)) == PALACIO
        direccion = "Palacio de Gobierno, Cuernavaca" if es_palacio else (
            agentes_dep[0]["direccion"] if len(agentes_dep) == 1 and agentes_dep[0]["direccion"] else "")
        # La hoja de agentes dice "Palacio de Gobierno" pero la coordenada
        # esta en otra sede: no se muestra una direccion que la contradiga.
        if not es_palacio and norm(direccion).startswith("palacio de gobierno"):
            direccion = ""
        if fix and fuente_coord != "Hoja de dependencias":
            direccion = fix[1].split(" (")[0]

        registros.append({
            "secretaria": secretaria,
            "dependencia": dependencia,
            "direccion": direccion,
            "lat": round(lat, 6) if lat is not None else None,
            "lon": round(lon, 6) if lon is not None else None,
            "puntosAcceso": ap,
            "fuenteCoordenada": fuente_coord if fuente_coord == "Hoja de dependencias" else fix[1],
        })

    OUT.write_text(
        "// Generado automaticamente por scripts/build_red_ltqnu.py\n"
        "// Fuente: 'Agentes_dependencias La Tierra Que Nos Une.xlsx' (dependencias con Red_la_tierra_que_nos_une = SI)\n"
        f"const TPBV_RED_LTQNU = {json.dumps(registros, ensure_ascii=False)};\n", encoding="utf-8")

    sedes = {(x["lat"], x["lon"]) for x in registros if x["lat"] is not None}
    print(f"Registros con red: {len(registros)} | dependencias unicas: {len({norm(x['dependencia']) for x in registros})} | sedes: {len(sedes)}")
    print(f"Puntos de acceso conocidos: {sum(x['puntosAcceso'] or 0 for x in registros)} ({sum(1 for x in registros if x['puntosAcceso'])} con dato)")
    for a in avisos:
        print("AVISO", a)


if __name__ == "__main__":
    main()

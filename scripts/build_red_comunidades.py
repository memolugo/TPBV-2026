"""
Genera dashboard/red_comunidades.js: puntos de la red Wi-Fi publica
"La tierra que nos une" (ATDEM) instalados o en proceso en comunidades,
a partir de 'la tierra que nos une memo.xlsx' (Sheet1).

  - Se publican: localidad, municipio, coordenada, estatus (Instalado / En
    proceso) y, si la localidad es comunidad TPBV, su poligono.
  - NO se exportan el numero de ticket ni la fecha (registro interno; algunas
    fechas son de programacion y no coinciden con el estatus).
  - Nombre y municipio: si la localidad esta en TPBV_DATA se usan los del
    tablero (acentos y municipio vigente, p. ej. Amialtenco -> Hueyapan); si
    no, los del Excel con formato de nombre propio.
  - Valida que cada coordenada caiga dentro de Morelos y reporta si cae en un
    municipio distinto al declarado. Si cae FUERA de Morelos y la localidad es
    comunidad TPBV, usa la coordenada de la localidad (TPBV_DATA) y la marca
    como aproximada (p. ej. Francisco Javier Mina venia con lon -99.535, al
    oeste del estado): corregir el Excel y volver a generar.

Uso: python scripts/build_red_comunidades.py ; luego scripts/embed_dashboard.py
"""
import json
import re
import unicodedata
from pathlib import Path

import openpyxl

BASE = Path(__file__).resolve().parent.parent
XLSX = BASE / "la tierra que nos une memo.xlsx"
OUT = BASE / "dashboard" / "red_comunidades.js"
DATA_JS = BASE / "dashboard" / "data.js"
POLIGONOS_JS = BASE / "dashboard" / "poligonos_actual_nombres.js"
LIMITES_JS = BASE / "dashboard" / "limites_municipales.js"

ESTATUS = {"INSTALADO": "Instalado", "EN PROCESO": "En proceso"}
MINUSCULAS = {"de", "del", "la", "las", "los", "y"}


def norm(texto):
    t = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t).strip().lower()


def nombre_propio(texto):
    palabras = re.sub(r"\s+", " ", str(texto).replace("\xa0", " ")).strip().lower().split(" ")
    return " ".join(p if (i and p in MINUSCULAS) else p.capitalize() for i, p in enumerate(palabras))


def leer_constante_js(ruta):
    """Extrae el JSON de `const X = {...};` o `const X = [...];`."""
    texto = ruta.read_text(encoding="utf-8")
    inicio = min(i for i in (texto.find("= ["), texto.find("= {")) if i >= 0) + 2
    fin = max(texto.rfind("];"), texto.rfind("};")) + 1
    return json.loads(texto[inicio:fin])


def dentro(lon, lat, anillo):
    adentro = False
    for (x1, y1), (x2, y2) in zip(anillo, anillo[1:] + anillo[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            adentro = not adentro
    return adentro


def municipio_de(lon, lat, limites):
    for f in limites["features"]:
        geom = f["geometry"]
        poligonos = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        if any(dentro(lon, lat, [tuple(p) for p in pol[0]]) for pol in poligonos):
            return f["properties"]["NOMGEO"]
    return None


def localidad_tpbv(alias, tpbv):
    """Coincidencia por nombre: exacta o contenida (Colonia Francisco Javier Mina)."""
    a = norm(alias)
    exactas = [r for r in tpbv if norm(r["localidad"]) == a]
    if exactas:
        return exactas[0]
    contiene = [r for r in tpbv if re.search(rf"\b{re.escape(a)}\b", norm(r["localidad"]))]
    return contiene[0] if len(contiene) == 1 else None


def main():
    tpbv = leer_constante_js(DATA_JS)
    nombres_poligono = leer_constante_js(POLIGONOS_JS)
    limites = leer_constante_js(LIMITES_JS)
    ws = openpyxl.load_workbook(XLSX, data_only=True).active
    filas = list(ws.iter_rows(values_only=True))
    cab = [norm(c) for c in filas[0]]
    col = {k: cab.index(k) for k in ("alias", "ciudad", "latitud", "longitud", "estatus")}

    salida, avisos = [], []
    for f in filas[1:]:
        if not f[col["alias"]]:
            continue
        alias = str(f[col["alias"]]).replace("\xa0", " ").strip()
        lat, lon = float(f[col["latitud"]]), float(f[col["longitud"]])
        estatus = ESTATUS.get(norm(f[col["estatus"]]).upper())
        if not estatus:
            raise SystemExit(f"Estatus desconocido para {alias}: {f[col['estatus']]!r}")
        rec = localidad_tpbv(alias, tpbv)
        municipio_excel = nombre_propio(f[col["ciudad"]])
        municipio = rec["municipio"] if rec else municipio_excel
        geo = municipio_de(lon, lat, limites)
        aproximada = False
        if geo is None and rec:
            avisos.append(f"{alias}: coordenada del Excel fuera de Morelos ({lat}, {lon}); "
                          f"se usa la de la localidad TPBV ({rec['latitud']}, {rec['longitud']})")
            lat, lon, aproximada = rec["latitud"], rec["longitud"], True
            geo = municipio_de(lon, lat, limites)
        if geo is None:
            raise SystemExit(f"Coordenada fuera de Morelos: {alias} ({lat}, {lon})")
        if norm(geo) != norm(municipio):
            avisos.append(f"{alias}: declarado {municipio} (Excel: {municipio_excel}), la coordenada cae en {geo}")
        salida.append({
            "localidad": rec["localidad"] if rec else nombre_propio(alias),
            "municipio": municipio,
            "lat": round(lat, 6), "lon": round(lon, 6),
            "estatus": estatus,
            "coordenadaAproximada": aproximada,
            "poligono": rec["poligono"] if rec else None,
            "nombrePoligono": nombres_poligono.get(str(rec["poligono"])) if rec else None,
        })

    salida.sort(key=lambda r: (r["estatus"] != "Instalado", r["municipio"], r["localidad"]))
    OUT.write_text(
        "// Generado automaticamente por scripts/build_red_comunidades.py\n"
        "// Fuente: 'la tierra que nos une memo.xlsx' (ATDEM). Sin numero de ticket ni fecha.\n"
        f"const TPBV_RED_COMUNIDADES = {json.dumps(salida, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    instalados = sum(r["estatus"] == "Instalado" for r in salida)
    print(f"{OUT.relative_to(BASE)}: {len(salida)} puntos ({instalados} instalados, "
          f"{len(salida) - instalados} en proceso; {sum(r['poligono'] is not None for r in salida)} en comunidades TPBV)")
    for a in avisos:
        print("  AVISO", a)


if __name__ == "__main__":
    main()

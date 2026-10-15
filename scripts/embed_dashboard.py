"""
Actualiza dashboard/TPBV_2026_COMPLETO_PRO.html (version autocontenida que se
publica en GitHub Pages) con el contenido actual de los .js de dashboard/.

El HTML guarda cada archivo en un bloque:
    <script>
    /* EMBEBIDO: <archivo>.js */
    ...contenido...
    </script>
Este script reemplaza el contenido de cada bloque por el del archivo y, para
los archivos de NUEVOS_BLOQUES que aun no esten embebidos, inserta su bloque
despues del indicado. El markup (nav, contenedores de vistas, CSS) se edita a
mano en el HTML.

Uso: python scripts/embed_dashboard.py [--check]
  --check  solo informa que bloques cambiarian, sin escribir.
"""
import re
import sys
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parent.parent / "dashboard"
HTML = DASHBOARD / "TPBV_2026_COMPLETO_PRO.html"

# archivo nuevo -> bloque despues del cual se inserta (orden de carga)
NUEVOS_BLOQUES = {
    "aulas_tecnologicas.js": "banco_proyectos.js",
    "mapa_morelos.js": "app.js",
    "aulas_mapa.js": "mapa_morelos.js",
    "aulas_contexto.js": "aulas_mapa.js",
    "aulas_view.js": "aulas_contexto.js",
}

BLOQUE_RE = re.compile(r"(<script>\r\n/\* EMBEBIDO: ([\w.]+) \*/\r\n)(.*?)(\r\n</script>)", re.S)


def contenido(nombre):
    texto = (DASHBOARD / nombre).read_text(encoding="utf-8")
    return texto.replace("\r\n", "\n").rstrip("\n").replace("\n", "\r\n")


def bloque(nombre):
    return f"<script>\r\n/* EMBEBIDO: {nombre} */\r\n{contenido(nombre)}\r\n</script>"


def main():
    check = "--check" in sys.argv
    html = HTML.read_bytes().decode("utf-8")
    cambios = []

    def reemplazar(m):
        nombre = m.group(2)
        nuevo = contenido(nombre)
        if nuevo == m.group(3).rstrip("\r\n"):
            return m.group(0)  # igual salvo saltos de linea finales: no tocar
        cambios.append(f"actualizado: {nombre}")
        return m.group(1) + nuevo + m.group(4)

    html = BLOQUE_RE.sub(reemplazar, html)

    embebidos = {m.group(2): m for m in BLOQUE_RE.finditer(html)}
    for nombre, despues_de in NUEVOS_BLOQUES.items():
        if nombre in embebidos:
            continue
        ancla = next((m for m in BLOQUE_RE.finditer(html) if m.group(2) == despues_de), None)
        if not ancla:
            raise SystemExit(f"No se encontro el bloque '{despues_de}' para insertar '{nombre}'")
        html = html[:ancla.end()] + "\r\n" + bloque(nombre) + html[ancla.end():]
        cambios.append(f"insertado: {nombre} (despues de {despues_de})")

    print("\n".join(cambios) if cambios else "Sin cambios: el HTML ya esta al dia.")
    if not check and cambios:
        HTML.write_bytes(html.encode("utf-8"))


if __name__ == "__main__":
    main()

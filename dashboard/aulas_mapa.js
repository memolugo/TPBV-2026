// ---------------------------------------------------------------------------
// Mapa de "Aulas Tecnológicas" sobre la base "solo Morelos" de
// mapa_morelos.js (paleta ATD, contorno del estado, municipios opacos):
//   - Vino institucional (#773357) = color de acción -> marcadores de escuela
//     y botón de la ficha.
//   - Municipios con aula en tinte verde Morelos; filtro por municipio lo
//     resalta y atenúa el resto.
// Extensiones NO normadas por el manual: tamaños de marcador y leyenda.
// Se carga después de mapa_morelos.js y antes de aulas_view.js (que define
// AULAS, aulasMunicipioFiltro y el estado aulasMap / aulasMarkersLayer).
// ---------------------------------------------------------------------------

// Radio del marcador segun computadoras (area ~ proporcional al equipo).
const aulasRadio = (computadoras) => 5 + Math.sqrt(computadoras) * 1.35;

const AULAS_MARCADOR_BASE = { color: '#ffffff', weight: 2, fillColor: ATD.vino, fillOpacity: 0.92 };
const AULAS_MARCADOR_HOVER = { color: ATD.oro, weight: 3 };

const MUNICIPIO_CON_AULA = { ...MUNICIPIO_BASE, fillColor: TINTE_VERDE };
const MUNICIPIO_SIN_AULA = MUNICIPIO_BASE;
const MUNICIPIO_RESALTADO = { color: ATD.verdeOscuro, weight: 2, opacity: 1, fillOpacity: 1, fillColor: TINTE_VERDE_RESALTADO };
const MUNICIPIO_ATENUADO = { ...MUNICIPIO_BASE, fillColor: '#F1F1EC' };

let aulasMunicipiosLayer = null;
let aulasContornoLayer = null;

function aulasResumenMunicipio(nombreGeo) {
    const lista = AULAS.filter((a) => mismoMunicipio(nombreGeo, a.municipio));
    return { escuelas: lista.length, computadoras: lista.reduce((s, a) => s + a.computadoras, 0) };
}

function crearAulasMapa(contenedorId) {
    const leafletMap = crearMapaMorelos(contenedorId);
    agregarAulasLeyenda(leafletMap);
    return leafletMap;
}

function estiloMunicipio(feature) {
    const nombre = feature.properties.NOMGEO;
    const tieneAula = aulasResumenMunicipio(nombre).escuelas > 0;
    if (!tieneAula) return MUNICIPIO_SIN_AULA;
    if (!aulasMunicipioFiltro) return MUNICIPIO_CON_AULA;
    return mismoMunicipio(nombre, aulasMunicipioFiltro) ? MUNICIPIO_RESALTADO : MUNICIPIO_ATENUADO;
}

function ensureAulasMunicipiosLayer(leafletMap) {
    if (aulasMunicipiosLayer) return;
    const base = agregarBaseMorelos(leafletMap, {
        estilo: estiloMunicipio,
        onEachFeature: (f, layer) => {
            const r = aulasResumenMunicipio(f.properties.NOMGEO);
            const detalle = r.escuelas ? ` · ${r.escuelas} esc. · ${fmtInt(r.computadoras)} equipos` : '';
            layer.bindTooltip(`${esc(f.properties.NOMGEO)}${detalle}`, { sticky: true, className: 'atd-tooltip' });
            if (!r.escuelas) return;
            layer.on('mouseover', () => layer.setStyle({ fillColor: TINTE_VERDE_HOVER }));
            layer.on('mouseout', () => aulasMunicipiosLayer.resetStyle(layer));
        }
    });
    aulasContornoLayer = base.contorno;
    aulasMunicipiosLayer = base.municipios;
}

// Encuadre: todo Morelos, o el municipio filtrado.
function aulasLimitesEncuadre(municipio) {
    if (!aulasMunicipiosLayer) return null;
    if (!municipio) return aulasContornoLayer.getBounds();
    const capa = aulasMunicipiosLayer.getLayers().find((l) => mismoMunicipio(l.feature.properties.NOMGEO, municipio));
    return capa ? capa.getBounds() : aulasContornoLayer.getBounds();
}

function restyleAulasMunicipios() {
    if (aulasMunicipiosLayer) aulasMunicipiosLayer.setStyle(estiloMunicipio);
}

function aulasPopupHtml(a) {
    const ubicacion = (typeof aulasUbicacionTexto === 'function') ? aulasUbicacionTexto(a) : '';
    return `
    <div class="cab">
        <div class="nom">${esc(a.escuela)}</div>
        <div class="sub">CCT ${esc(a.cct)} · ${esc(a.nivel)}</div>
    </div>
    <div class="cuerpo">
        <div class="equipos"><b>${fmtInt(a.computadoras)}</b><span>computadoras instaladas</span></div>
        <div class="dato"><span class="material-symbols-outlined">location_on</span><span>${esc(a.localidad)}, ${esc(a.municipio)}</span></div>
        <div class="dato"><span class="material-symbols-outlined">event</span><span>Instalación ATDEM: ${esc(a.fechaInstalacion || 'Sin fecha')}</span></div>
        ${ubicacion ? `<div class="dato"><span class="material-symbols-outlined">map</span><span>${esc(ubicacion)}</span></div>` : ''}
        <a class="cta" href="${esc(a.mapsUrl)}" target="_blank" rel="noopener">Ver en Google Maps <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span></a>
    </div>`;
}

function crearAulaMarcador(a) {
    const radio = aulasRadio(a.computadoras);
    const m = L.circleMarker([a.lat, a.lon], { ...AULAS_MARCADOR_BASE, radius: radio })
        .bindPopup(aulasPopupHtml(a), { className: 'atd-popup', maxWidth: 300, autoPanPadding: [24, 24] })
        .bindTooltip(`${esc(a.escuela)} · ${fmtInt(a.computadoras)} equipos`, { direction: 'top', offset: [0, -radio], className: 'atd-tooltip' });
    m.on('mouseover', () => m.setStyle({ ...AULAS_MARCADOR_HOVER, radius: radio + 2 }));
    m.on('mouseout', () => { if (!m.isPopupOpen()) m.setStyle({ ...AULAS_MARCADOR_BASE, radius: radio }); });
    m.on('popupopen', () => m.setStyle({ ...AULAS_MARCADOR_HOVER, radius: radio + 2 }));
    m.on('popupclose', () => m.setStyle({ ...AULAS_MARCADOR_BASE, radius: radio }));
    return m;
}

function agregarAulasLeyenda(leafletMap) {
    const leyenda = L.control({ position: 'bottomright' });
    leyenda.onAdd = () => {
        const div = L.DomUtil.create('div', 'atd-leyenda');
        const muestras = [2, 10, 20].map((n) => {
            const d = aulasRadio(n) * 2;
            return `<div><div class="circulo" style="width:${d}px;height:${d}px;margin:0 auto"></div><div class="etq">${n}</div></div>`;
        }).join('');
        div.innerHTML = `
            <h4>Computadoras por aula</h4>
            <div class="circulos">${muestras}</div>
            <div class="fila"><span class="muestra"></span>Municipio con aula</div>
            <div class="fila"><span class="muestra sin"></span>Otros municipios</div>`;
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    leyenda.addTo(leafletMap);
}

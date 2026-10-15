// ---------------------------------------------------------------------------
// Base compartida de los mapas "solo Morelos" (Aulas Tecnológicas y
// Propuesta Territorial), con la identidad del Manual de Lineamientos de Marca
// Morelos 2024-2030 / ATD (skill "skillatd", tokens.css):
//   - Sin mosaicos de calles/satélite: la silueta del estado (36 municipios)
//     sobre fondo #F4F2EC (tinte de piedra).
//   - Contorno del estado en verde oscuro (#2E3B2B), división entre
//     municipios en oro (#BC9B73), rellenos opacos claros.
//   - Encuadre y paneo limitados al estado.
// Extensiones NO normadas por el manual: los tintes de relleno, la sombra del
// estado y los controles flotantes.
// Se carga después de app.js y antes de aulas_mapa.js / aulas_view.js; las
// funciones de app.js que lo usan (renderPropuestaView) solo lo llaman en
// tiempo de ejecución, no al cargar.
// ---------------------------------------------------------------------------

const ATD = {
    verde: '#71785B',
    verdeOscuro: '#2E3B2B',
    oro: '#BC9B73',
    vino: '#773357',
    terracota: '#7C4A36',
    piedra: '#CBCABE',
    fondoSuave: '#F4F2EC',
    textoSecundario: '#5B6058',
};

// Rellenos opacos (fillOpacity 1): ademas de verse limpios sobre el fondo
// sin mosaicos, tapan la mitad interior del trazo grueso del contorno, que
// asi solo queda visible en el borde del estado (ver agregarBaseMorelos).
const TINTE_VERDE = '#DCDDD2';          // verde Morelos ~20% sobre blanco
const TINTE_VERDE_HOVER = '#C9CCBC';
const TINTE_VERDE_RESALTADO = '#B4B9A1';
const MUNICIPIO_BASE = { color: ATD.oro, weight: 0.9, opacity: 0.9, fillOpacity: 1, fillColor: '#FFFFFF' };
const CONTORNO_MORELOS = { color: ATD.verdeOscuro, weight: 5, opacity: 1, fill: false, lineJoin: 'round' };

function normMunicipio(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Las hojas de trabajo usan nombres cortos ("Jonacatepec", "Tlaltizapan") y
// el geojson los oficiales ("Jonacatepec de Leandro Valle", "Tlaltizapán de
// Zapata"): se emparejan sin acentos y por prefijo.
function mismoMunicipio(nombreGeo, nombreCorto) {
    const g = normMunicipio(nombreGeo);
    const a = normMunicipio(nombreCorto);
    return g === a || g.startsWith(a + ' ') || a.startsWith(g + ' ');
}

// Estilos de Leaflet que no se pueden pasar por opciones (controles, ficha,
// leyenda, tooltip). Se inyectan una sola vez; todo va bajo .mapa-morelos /
// .atd-* para no afectar el mapa de Análisis Demográfico.
function ensureEstilosMapaMorelos() {
    if (document.getElementById('mapa-morelos-estilos')) return;
    const css = `
    .mapa-morelos { background: ${ATD.fondoSuave} !important; font-family: inherit; }
    .mapa-morelos .leaflet-overlay-pane svg { filter: drop-shadow(0 8px 14px rgba(46,59,43,.16)); }
    .mapa-morelos .leaflet-control-zoom { border: none; box-shadow: 0 4px 16px rgba(46,59,43,.14); border-radius: 12px; overflow: hidden; }
    .mapa-morelos .leaflet-control-zoom a { color: ${ATD.verdeOscuro}; width: 36px; height: 36px; line-height: 36px; font-size: 20px; }
    .mapa-morelos .leaflet-control-zoom a:hover { background: ${ATD.fondoSuave}; color: ${ATD.vino}; }
    .mapa-morelos .leaflet-control-attribution { background: rgba(244,242,236,.85); color: ${ATD.textoSecundario}; border-top-left-radius: 8px; }
    .leaflet-tooltip.atd-tooltip { background: ${ATD.verdeOscuro}; color: #fff; border: none; border-radius: 8px; padding: 6px 10px; box-shadow: 0 4px 12px rgba(46,59,43,.25); font-weight: 600; }
    .leaflet-tooltip.atd-tooltip::before { border-top-color: ${ATD.verdeOscuro}; }
    .leaflet-tooltip-left.atd-tooltip::before { border-left-color: ${ATD.verdeOscuro}; border-top-color: transparent; }
    .leaflet-tooltip-right.atd-tooltip::before { border-right-color: ${ATD.verdeOscuro}; border-top-color: transparent; }
    .atd-leyenda { background: rgba(255,255,255,.96); border-radius: 14px; padding: 12px 14px; box-shadow: 0 4px 16px rgba(46,59,43,.14); color: ${ATD.verdeOscuro}; border-top: 3px solid ${ATD.oro}; min-width: 168px; }
    .atd-leyenda h4 { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${ATD.textoSecundario}; }
    .atd-leyenda .fila { display: flex; align-items: center; gap: 10px; font-size: 13px; margin-top: 6px; }
    .atd-leyenda .circulos { display: flex; align-items: flex-end; gap: 10px; }
    .atd-leyenda .circulo { border-radius: 50%; background: ${ATD.vino}; border: 2px solid #fff; box-shadow: 0 0 0 1px ${ATD.vino}; }
    .atd-leyenda .etq { font-size: 11px; color: ${ATD.textoSecundario}; text-align: center; margin-top: 2px; }
    .atd-leyenda .muestra { width: 18px; height: 12px; border-radius: 3px; background: ${TINTE_VERDE}; border: 1.5px solid ${ATD.oro}; }
    .atd-leyenda .muestra.sin { background: #fff; }
    .atd-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(46,59,43,.25); }
    .atd-popup .leaflet-popup-content { margin: 0; width: 272px !important; color: ${ATD.verdeOscuro}; line-height: 1.4; }
    .atd-popup .leaflet-popup-tip { background: #fff; }
    .atd-popup a.leaflet-popup-close-button { color: #fff; top: 8px; right: 8px; }
    .atd-popup .cab { background: ${ATD.verdeOscuro}; color: #fff; padding: 14px 34px 12px 16px; border-bottom: 3px solid ${ATD.oro}; }
    .atd-popup .cab .nom { font-size: 15px; font-weight: 700; line-height: 1.25; }
    .atd-popup .cab .sub { font-size: 12px; color: ${ATD.oro}; margin-top: 3px; font-weight: 600; }
    .atd-popup .cuerpo { padding: 12px 16px 14px; }
    .atd-popup .equipos { display: flex; align-items: baseline; gap: 6px; }
    .atd-popup .equipos b { font-size: 28px; color: ${ATD.vino}; line-height: 1; }
    .atd-popup .dato { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-top: 8px; color: ${ATD.textoSecundario}; }
    .atd-popup .dato .material-symbols-outlined { font-size: 18px; color: ${ATD.verde}; }
    .atd-popup .cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; background: ${ATD.vino}; color: #fff !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 999px; }
    .atd-popup .cta:hover, .atd-popup .cta:focus-visible { background: #5e2845; outline: 2px solid ${ATD.oro}; outline-offset: 2px; }
    `;
    const style = document.createElement('style');
    style.id = 'mapa-morelos-estilos';
    style.textContent = css;
    document.head.appendChild(style);
}

function crearMapaMorelos(contenedorId) {
    ensureEstilosMapaMorelos();
    document.getElementById(contenedorId).classList.add('mapa-morelos');
    const leafletMap = L.map(contenedorId, { attributionControl: true, zoomSnap: 0.1, maxZoom: 14 });
    leafletMap.attributionControl.setPrefix(false).addAttribution('Límites municipales: INE');
    return leafletMap;
}

// Agrega contorno del estado + municipios a un mapa y limita el paneo al
// estado. El contorno va primero (debajo): los municipios, con relleno opaco,
// tapan su mitad interior. `estilo` y `onEachFeature` permiten a cada vista
// colorear/etiquetar los municipios a su manera.
// Devuelve { contorno, municipios } (instancias propias de este mapa).
function agregarBaseMorelos(leafletMap, { estilo = () => MUNICIPIO_BASE, onEachFeature = null } = {}) {
    if (typeof TPBV_LIMITES_MUNICIPALES === 'undefined') return { contorno: null, municipios: null };
    const contorno = L.geoJSON(TPBV_LIMITES_MUNICIPALES, { style: CONTORNO_MORELOS, interactive: false }).addTo(leafletMap);
    const municipios = L.geoJSON(TPBV_LIMITES_MUNICIPALES, {
        style: estilo,
        onEachFeature: onEachFeature || ((f, layer) => layer.bindTooltip(esc(f.properties.NOMGEO), { sticky: true, className: 'atd-tooltip' }))
    }).addTo(leafletMap);
    leafletMap.setMaxBounds(contorno.getBounds().pad(0.25));
    return { contorno, municipios };
}

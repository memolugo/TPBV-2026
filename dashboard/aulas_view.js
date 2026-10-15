// ---------------------------------------------------------------------------
// Vista "Aulas Tecnológicas": mapa de las aulas de cómputo que ATDEM instaló
// en escuelas de los polígonos TPBV (boletín 06206, 30/04/2026), con filtro
// por municipio, resumen por municipio y listado de escuelas.
// Datos: TPBV_AULAS_TECNOLOGICAS (dashboard/aulas_tecnologicas.js, generado
// por scripts/build_aulas_tecnologicas.py). Se carga DESPUÉS de app.js y
// reutiliza sus helpers (esc, fmtInt, card, cardHeader, kpiCount,
// sectionLabel, iconChip, animateEntrances, REDUCED_MOTION) y el mapa con
// estilo ATD de aulas_mapa.js (crearAulasMapa, crearAulaMarcador,
// ensureAulasMunicipiosLayer...). showView('aulas') en app.js llama a
// renderAulasView().
// ---------------------------------------------------------------------------

const AULAS = (typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined') ? TPBV_AULAS_TECNOLOGICAS : [];

let aulasMunicipioFiltro = '';
let aulasViewBuilt = false;
let aulasMap = null;
let aulasMarkersLayer = null;
const aulasMarkerPorN = new Map();

function aulasFiltradas() {
    return AULAS.filter((a) => !aulasMunicipioFiltro || a.municipio === aulasMunicipioFiltro);
}

function aulasMunicipios() {
    return [...new Set(AULAS.map((a) => a.municipio))].sort((a, b) => a.localeCompare(b, 'es'));
}

function aulasUbicacionTexto(a) {
    if (a.poligono === null) return 'Sin ubicación';
    const nombre = `Polígono ${a.poligono} · ${a.nombrePoligono}`;
    return a.dentroPoligono ? `Dentro del ${nombre}` : `A ${a.kmPoligono} km del ${nombre}`;
}

function aulasKpisHtml(lista) {
    const computadoras = lista.reduce((s, a) => s + a.computadoras, 0);
    const municipios = new Set(lista.map((a) => a.municipio)).size;
    const dentro = lista.filter((a) => a.dentroPoligono).length;
    return `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('school', 'Escuelas equipadas', lista.length, 'primary')}
        ${kpiCount('computer', 'Computadoras', computadoras, 'blue')}
        ${kpiCount('location_city', 'Municipios', municipios, 'teal')}
        ${kpiCount('map', 'En polígono TPBV', dentro, 'warning')}
    </div>`;
}

function aulasPorMunicipioHtml(lista) {
    const porMun = {};
    lista.forEach((a) => {
        const m = porMun[a.municipio] || { escuelas: 0, computadoras: 0 };
        porMun[a.municipio] = { escuelas: m.escuelas + 1, computadoras: m.computadoras + a.computadoras };
    });
    const filas = Object.entries(porMun).sort((x, y) => y[1].computadoras - x[1].computadoras);
    const max = Math.max(1, ...filas.map(([, v]) => v.computadoras));
    if (!filas.length) return '<p class="font-body-md text-body-md text-on-surface-variant">Sin escuelas con estos filtros.</p>';
    return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-2.5">` + filas.map(([mun, v]) => `
        <div class="flex items-center gap-3">
            <span class="w-36 shrink-0 font-label-bold text-label-bold text-on-surface-variant truncate" title="${esc(mun)}">${esc(mun)}</span>
            <div class="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full bg-primary" style="width:${(v.computadoras / max * 100).toFixed(1)}%"></div>
            </div>
            <span class="w-24 shrink-0 text-right font-body-md text-body-md text-on-surface"><b>${fmtInt(v.computadoras)}</b> eq. · ${v.escuelas} esc.</span>
        </div>`).join('') + `</div>`;
}

function aulasTablaHtml(lista) {
    if (!lista.length) return '<p class="font-body-md text-body-md text-on-surface-variant">Sin escuelas con estos filtros.</p>';
    const filas = lista.map((a) => `
        <tr class="border-b border-outline-variant hover:bg-surface-container-low cursor-pointer" data-aula="${a.n}" tabindex="0" aria-label="Ver ${esc(a.escuela)} en el mapa">
            <td class="py-2 pr-3 align-top">
                <p class="font-label-bold text-label-bold text-on-surface">${esc(a.escuela)}</p>
                <p class="font-body-md text-body-md text-on-surface-variant">${esc(a.cct)} · ${esc(a.nivel)}</p>
            </td>
            <td class="py-2 pr-3 align-top font-body-md text-body-md text-on-surface">${esc(a.localidad)}<br><span class="text-on-surface-variant">${esc(a.municipio)}</span></td>
            <td class="py-2 align-top text-right font-data-display text-data-display text-on-surface">${fmtInt(a.computadoras)}</td>
        </tr>`).join('');
    return `<div class="overflow-x-auto -mx-1 px-1">
        <table class="w-full text-left min-w-[480px]">
            <thead>
                <tr class="border-b-2 border-outline-variant font-label-bold text-label-bold text-on-surface-variant">
                    <th class="py-2 pr-3">Escuela</th><th class="py-2 pr-3">Localidad</th><th class="py-2 text-right">Equipos</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    </div>`;
}

function dibujarAulasMarcadores(lista) {
    if (aulasMarkersLayer) aulasMap.removeLayer(aulasMarkersLayer);
    aulasMarkerPorN.clear();
    const marcadores = lista.filter((a) => a.lat !== null).map((a) => {
        const m = crearAulaMarcador(a);
        aulasMarkerPorN.set(a.n, m);
        return m;
    });
    aulasMarkersLayer = L.featureGroup(marcadores).addTo(aulasMap);
    return aulasMarkersLayer;
}

function encuadrarAulas() {
    const limites = aulasLimitesEncuadre(aulasMunicipioFiltro);
    if (limites) aulasMap.fitBounds(limites, { padding: [24, 24] });
    else aulasMap.setView([18.75, -99.05], 9);
}

function renderAulasResultados() {
    const lista = aulasFiltradas();
    $('#aulas-kpis').innerHTML = aulasKpisHtml(lista);
    $('#aulas-municipios-resumen').innerHTML = aulasPorMunicipioHtml(lista);
    $('#aulas-tabla').innerHTML = aulasTablaHtml(lista);
    $('#aulas-tabla-total').textContent = String(lista.length);
    animateEntrances($('#aulas-kpis'));
    if (aulasMap) {
        restyleAulasMunicipios();
        dibujarAulasMarcadores(lista);
        encuadrarAulas();
    }
}

function aulasVistaHtml() {
    // Presentacion, "que incluye", cita y niveles: aulas_contexto.js.
    return `
    ${aulasContextoHtml()}
    <div class="w-full bg-surface-container-lowest rounded-xl p-4 card-shadow">
        <div class="w-full md:max-w-md">
            <label for="sel-aulas-municipio" class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Municipio</label>
            <select id="sel-aulas-municipio" class="w-full border-outline-variant rounded-lg p-2 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface">
                <option value="">Todos los municipios</option>
                ${aulasMunicipios().map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
            </select>
        </div>
    </div>
    <div id="aulas-kpis"></div>
    <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 flex flex-col" style="border-top-color:${ATD.oro}">
        <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-outline-variant flex-wrap">
            <div class="flex items-center gap-2.5">
                ${iconChip('computer')}
                <h2 class="font-headline-md text-headline-md text-on-surface">Mapa de Aulas</h2>
            </div>
        </div>
        <p class="font-body-md text-body-md text-on-surface-variant mb-3">El tamaño del círculo indica el número de computadoras. Haz clic en una escuela para ver su detalle.</p>
        <div class="overflow-hidden relative w-full mx-auto" style="max-width:820px;aspect-ratio:1/0.9;max-height:78vh;min-height:360px;border-radius:16px;border:1px solid ${ATD.piedra}">
            <div id="aulas-map" style="width:100%;height:100%"></div>
        </div>
    </div>
    <div class="grid grid-cols-1 gap-gutter-grid">
        ${card(`${cardHeader('bar_chart', 'Equipos por Municipio')}<div id="aulas-municipios-resumen"></div>`)}
        ${card(`
            <div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-outline-variant">
                <div class="flex items-center gap-2.5">${iconChip('list')}<h2 class="font-headline-md text-headline-md text-on-surface">Escuelas</h2></div>
                <span id="aulas-tabla-total" class="font-label-bold text-label-bold bg-surface-container-high text-on-surface-variant rounded-full px-2.5 py-0.5"></span>
            </div>
            <div id="aulas-tabla"></div>`)}
    </div>
    <p class="font-body-md text-body-md text-on-surface-variant">
        Fuente: ATDEM, "Proyecto Escuelas entrega Computadoras" (hoja Concentrado). Ubicación según el enlace de Google Maps capturado por escuela.
    </p>`;
}

function renderAulasView() {
    const view = $('#aulas-view');
    if (!aulasViewBuilt) {
        view.innerHTML = aulasVistaHtml();
        aulasViewBuilt = true;
    }
    if (!aulasMap) {
        aulasMap = crearAulasMapa('aulas-map');
        ensureAulasMunicipiosLayer(aulasMap);
        renderAulasResultados();
    }
    // El contenedor estaba oculto (display:none) hasta este momento.
    setTimeout(() => {
        if (!aulasMap) return;
        aulasMap.invalidateSize();
        if (!aulasMap._tpbvFitted) {
            encuadrarAulas();
            aulasMap._tpbvFitted = true;
        }
    }, 150);
}

function enfocarAula(n) {
    const a = AULAS.find((x) => x.n === Number(n));
    const m = aulasMarkerPorN.get(Number(n));
    if (!a || !m || !aulasMap) return;
    $('#aulas-map').scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
    aulasMap.setView([a.lat, a.lon], 12);
    m.openPopup();
}

// Delegados sobre #aulas-view: sus controles se crean recién la primera vez
// que se abre la vista (mismo patrón que #banco-proyectos-view).
$('#aulas-view').addEventListener('change', (e) => {
    if (e.target.id === 'sel-aulas-municipio') {
        aulasMunicipioFiltro = e.target.value;
        renderAulasResultados();
    }
});
$('#aulas-view').addEventListener('click', (e) => {
    const fila = e.target.closest('[data-aula]');
    if (fila) enfocarAula(fila.dataset.aula);
});
$('#aulas-view').addEventListener('keydown', (e) => {
    const fila = e.target.closest && e.target.closest('[data-aula]');
    if (fila && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        enfocarAula(fila.dataset.aula);
    }
});

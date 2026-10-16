// Dashboard TPBV 2026 - logica de render, filtros y mapa.
// Consume TPBV_DATA (definido en data.js), generado por scripts/build_dashboard_data.py

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const selPoligono = $('#sel-poligono');
// "Seleccionar Localidad" es un campo de busqueda (combobox), no un <select>
// nativo: con 132/68 localidades, escanear una lista larga es mas lento que
// escribir el nombre. Ver buildLocalidadOptions/openLocalidadSuggestions
// mas abajo -- localidadOptions es el "candidate set" vigente (ya filtrado
// por poligono si aplica) del que sale tanto la lista de sugerencias como
// la validacion de que idx elegir.
const inputLocalidad = $('#input-localidad');
let localidadOptions = [];
let localidadOptionsFiltradas = [];
let localidadActiveIndex = -1;

// Conjunto de datos activo en "Análisis Demográfico": 'actual' (TPBV_DATA,
// 132 localidades / 26 poligonos vigentes) o 'nueva' (TPBV_DATA_PROPUESTA_2026,
// 68 localidades de la hoja "PROPUESTA 2026" -- ver activeData() mas abajo).
// El dataset anterior (TPBV_DATA_NUEVA, 118 localidades del CSV viejo) ya NO
// se usa en ningun lado del dashboard (decision del usuario 2026-08-13:
// "olvida las 118 que teniamos, enfocate solo en las 68").
let DATASET_MODE = 'actual';
// La Nueva Propuesta Territorial aun no es informacion oficial: en
// produccion sus datos (propuesta_nueva.js, propuesta_2026.js,
// data_propuesta_2026.js) NO se incrustan en el HTML (BLOQUES_RETIRADOS en
// scripts/embed_dashboard.py) y todo lo que depende de ellos se oculta:
// interruptor de Analisis, vista Propuesta Territorial, bloques de Inicio y
// conjuntos de Datos Abiertos. Para volver a mostrarla basta con incrustar
// de nuevo esos datos. Respaldo completo: tag git
// respaldo-2026-10-16-con-nueva-propuesta.
const HAY_NUEVA_PROPUESTA = typeof TPBV_DATA_PROPUESTA_2026 !== 'undefined';
// Banco de Proyectos: mismo esquema. Retirado de produccion el 2026-10-16
// (banco_proyectos.js en BLOQUES_RETIRADOS de scripts/embed_dashboard.py);
// sin sus datos se ocultan su pildora, su vista, su tarjeta de Inicio, su
// cifra en la landing y su conjunto en Datos Abiertos.
const HAY_BANCO_PROYECTOS = typeof TPBV_BANCO_PROYECTOS !== 'undefined';

let map = null;
let marker = null;
let polygonLayer = null;
let markersLayer = null;
// Base "solo Morelos" del mapa de Analisis (agregarBaseMorelos); se recrea
// con cada mapa (el contenedor #map se regenera en cada render).
let mapaBaseMorelos = null;
// Poligonos TPBV en el mapa de Analisis: todos encendidos en verde Morelos
// suave; la seleccion actual mas intensa y con borde verde oscuro.
const POLIGONO_TPBV = { color: '#2E3B2B', weight: 1.1, opacity: 0.85, fillColor: '#71785B', fillOpacity: 0.62 };
const POLIGONO_SELECCIONADO = { color: '#2E3B2B', weight: 2.5, opacity: 1, fillColor: '#5D6449', fillOpacity: 0.8 };
// Filtro personalizado del "Analisis Demografico": conjunto de numeros de
// poligono elegidos via la lista de checkboxes (#custom-poligonos-panel),
// para agregar/comparar solo esos poligonos en vez de uno solo o todos (ver
// aggregateCustom, applyCustomPoligonosSelection). Se limpia al cambiar de
// dataset (setDatasetMode) porque los numeros de poligono no son comparables
// entre 'actual' y 'nueva'.
let customPoligonos = new Set();
// Capas de comparacion territorial: ver seccion dedicada "Propuesta
// Territorial" (renderPropuestaView), con su propio mapa independiente del
// mapa de "Análisis Demográfico".
let propuestaMap = null;
let propuestaActualLayer = null;
let showPropuestaActual = false;
// Contorno de los 20 poligonos de la Nueva Propuesta Territorial
// (TPBV_PROPUESTA_NUEVA / poligono_nueva.js): la geometria sigue siendo
// valida y util para comparar contra la Propuesta Actual (el usuario
// confirmo el 2026-08-13 que quiere conservar esta capa en el mapa).
let propuestaNuevaLayer = null;
let showPropuestaNueva = false;
// Base "solo Morelos" (contorno + municipios, ver agregarBaseMorelos en
// mapa_morelos.js): siempre visible, instancia propia de este mapa.
let basePropuesta = null;
// Localidades de la hoja "PROPUESTA 2026" (Hoja de trabajo TPBV 2026.xlsx),
// ver TPBV_PROPUESTA_2026 en propuesta_2026.js: 60 geocodificadas via ITER
// 2020 + 8 con coordenadas manuales (coordManual:true), 68 en total. Es la
// unica capa de comparacion visible por defecto.
let propuesta2026Layer = null;
let showPropuesta2026 = true;
// circleMarker por localidad de TPBV_PROPUESTA_2026, mismo orden/indice que
// el array de datos -- ver ensurePropuestaLayers y el buscador de localidad
// de esta vista (choosePropuesta2026Locality).
let propuesta2026Markers = [];
let lastMapRec = null;

// El mapa es "sticky" (ver CSS .map-sticky): se queda fijo en pantalla
// mientras se hace scroll por las tarjetas vecinas, en vez de moverse con el
// documento. Esto evita por completo el bug de Chrome/Leaflet donde el mapa
// no se repinta correctamente al hacer scroll de la pagina (invalidateSize()
// y hasta recrear el mapa desde cero no lo resolvian de forma confiable).
// El offset "top" se calcula segun la altura real del header sticky, para
// que el mapa quede pegado justo debajo sin importar cuantas lineas ocupen
// los filtros en pantallas angostas.
function updateHeaderHeightVar() {
    const header = document.querySelector('header');
    if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
}
window.addEventListener('resize', updateHeaderHeightVar);
if (window.ResizeObserver) {
    new ResizeObserver(updateHeaderHeightVar).observe(document.querySelector('header'));
} else {
    updateHeaderHeightVar();
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
function fmtInt(n) {
    if (n === null || n === undefined || n === '') return '—';
    return Math.round(n).toLocaleString('es-MX');
}

function pct(part, base) {
    if (part === null || part === undefined || !base) return null;
    return (part / base) * 100;
}

function pctLabel(part, base) {
    const p = pct(part, base);
    return p === null ? '' : `(${p.toFixed(1)}%)`;
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Construccion de filas de datos (replican el patron "data-row" del diseño)
// ---------------------------------------------------------------------------
function dataRow({ label, value, base = null, colorClass = 'text-on-surface', colorStyle = '', indent = false, bar = false, barColor = 'bg-primary', asterisk = false, suffix = '' }) {
    const p = base !== null ? pct(value, base) : null;
    const pctHtml = base !== null ? `<span class="font-body-md text-body-md text-secondary">${p === null ? '—' : '(' + p.toFixed(1) + '%)'}</span>` : '';
    const labelClasses = indent ? 'font-body-md text-body-md text-on-surface-variant pl-4 border-l-2 border-primary-container' : 'font-body-md text-body-md text-on-surface-variant';
    const displayVal = suffix ? (value === null || value === undefined ? '—' : `${(Math.round(value * 10) / 10).toLocaleString('es-MX')}${suffix}`) : fmtInt(value);
    const valueHtml = `<span class="font-data-display text-data-display ${colorClass} min-w-[5rem] whitespace-nowrap text-right" style="${colorStyle}">${displayVal}${asterisk ? '<span class=\"text-warning\">*</span>' : ''}</span>`;

    if (bar) {
        const width = p === null ? 0 : Math.min(100, p).toFixed(1);
        return `
        <div class="data-row"><div class="flex flex-col w-full">
            <div class="flex justify-between items-center w-full">
                <span class="${labelClasses}">${esc(label)}</span>
                <div class="flex items-center gap-4">${pctHtml}${valueHtml}</div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill ${barColor}" style="--fill-w:${width}%"></div></div>
        </div></div>`;
    }
    return `
    <div class="data-row">
        <span class="${labelClasses}">${esc(label)}</span>
        <div class="flex items-center gap-4">${pctHtml}${valueHtml}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Piramide poblacional (grupos irregulares disponibles en ITER Morelos; ver
// nota en scripts/build_dashboard_data.py junto a AGE_BINS)
// ---------------------------------------------------------------------------
function renderPyramid(rec) {
    if (!rec.piramide) {
        return `<p class="font-body-md text-body-md text-on-surface-variant">Sin datos de estructura de edad para esta localidad.</p>`;
    }
    const maxVal = Math.max(1, ...rec.piramide.flatMap((b) => [b.f || 0, b.m || 0]));
    const rows = rec.piramide.slice().reverse().map((b) => {
        const wF = ((b.f || 0) / maxVal * 100).toFixed(1);
        const wM = ((b.m || 0) / maxVal * 100).toFixed(1);
        return `
        <div class="pyramid-row" title="${esc(b.label)} años · Mujeres: ${fmtInt(b.f)} · Hombres: ${fmtInt(b.m)}">
            <div class="flex-1 flex justify-end"><div class="pyramid-bar pyramid-bar-f" style="width:${wF}%"></div></div>
            <div class="w-14 shrink-0 text-center font-label-bold text-label-bold text-on-surface-variant border-x border-outline-variant/60">${esc(b.label)}</div>
            <div class="flex-1 flex justify-start"><div class="pyramid-bar pyramid-bar-m" style="width:${wM}%"></div></div>
        </div>`;
    }).join('');

    let dependenciaHtml = '';
    if (rec.pob0a14 !== null && rec.pob65mas !== null && rec.pob15a64) {
        const razon = ((rec.pob0a14 + rec.pob65mas) / rec.pob15a64 * 100);
        dependenciaHtml = `
        <div class="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between">
            <span class="font-body-md text-body-md text-on-surface-variant">Razón de dependencia demográfica</span>
            <span class="font-data-display text-data-display text-on-surface">${razon.toFixed(1)}</span>
        </div>
        <p class="font-body-md text-body-md text-secondary mt-1">Personas dependientes (0-14 y 65+) por cada 100 en edad de trabajar (15-64: ${fmtInt(rec.pob15a64)})</p>`;
    }

    return `
    <div class="flex items-center justify-center gap-6 mb-3">
        <span class="flex items-center gap-2 font-label-bold text-label-bold" style="color:var(--series-f)"><span class="inline-block w-3 h-3 rounded" style="background:var(--series-f)"></span>Mujeres</span>
        <span class="flex items-center gap-2 font-label-bold text-label-bold" style="color:var(--series-m)"><span class="inline-block w-3 h-3 rounded" style="background:var(--series-m)"></span>Hombres</span>
    </div>
    <div class="space-y-1.5">${rows}</div>
    ${dependenciaHtml}`;
}

function iconChip(icon, size = 'w-8 h-8', textSize = 'text-[20px]') {
    return `<span class="${size} shrink-0 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center">
        <span class="material-symbols-outlined ${textSize}">${icon}</span>
    </span>`;
}

function cardHeader(icon, title, borderClass = 'border-outline-variant') {
    return `<div class="flex items-center gap-2.5 mb-stack-md pb-3 border-b-2 ${borderClass}">
        ${iconChip(icon)}
        <h2 class="font-headline-md text-headline-md text-on-surface">${esc(title)}</h2>
    </div>`;
}

// Colores fijos de la comparacion territorial (ver seccion dedicada
// "Propuesta Territorial" / renderPropuestaView), compartidos entre el
// checkbox/legend y el estilo real de las capas en ensurePropuestaLayers.
// Paleta del manual ATD (ver mapa_morelos.js): verde Morelos para la
// delimitacion vigente, terracota (discontinuo) para la nueva propuesta y
// vino institucional para las localidades 2026.
const COLOR_PROPUESTA_ACTUAL = '#71785B';
const COLOR_PROPUESTA_NUEVA = '#7C4A36';
const COLOR_PROPUESTA_2026 = '#773357';

function mapCardHeader() {
    // Mapa "solo Morelos" (ver renderMap): municipios siempre visibles, asi
    // que en lugar del checkbox de limites va una leyenda breve.
    const punto = (color, size) => `<span class="inline-block rounded-full shrink-0" style="width:${size}px;height:${size}px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color}"></span>`;
    return `<div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-secondary-container flex-wrap">
        <div class="flex items-center gap-2.5">
            ${iconChip('map')}
            <h2 class="font-headline-md text-headline-md text-on-surface">Ubicación Geográfica</h2>
        </div>
        <div class="flex items-center gap-4 flex-wrap font-body-md text-body-md text-on-surface-variant">
            <span class="flex items-center gap-1.5">${punto('#773357', 11)}Localidad</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded-sm" style="background:#C8CCB6;border:1.5px solid #71785B"></span>Polígono TPBV</span>
        </div>
    </div>`;
}

function card(innerHtml, extraClasses = '') {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow ${extraClasses}">${innerHtml}</div>`;
}

// Etiqueta de agrupacion visual entre clusters de tarjetas tematicas. Es un
// rotulo puramente visual (no un encabezado real: cada tarjeta ya tiene su
// propio h2, y anadir h2/h3 aqui rompería la jerarquia de encabezados que
// usan los lectores de pantalla para saltar entre secciones). Cada cluster
// tiene su propio icono + color de acento para que sea mas facil ubicarse
// durante el scroll largo del dashboard.
function sectionLabel(title, icon, accentKey = 'primary') {
    const a = KPI_ACCENTS[accentKey] || KPI_ACCENTS.primary;
    // El acento 'primary' usa texto blanco (va sobre el chip mora de las
    // KPI); como rotulo sobre fondo blanco se usa el verde bosque.
    const color = accentKey === 'primary' ? 'text-primary' : a.chipText;
    return `<div class="md:col-span-2 flex items-center gap-3 pt-2 ${color}">
        <span class="flex items-center gap-2 shrink-0">
            <span class="material-symbols-outlined text-[20px]">${icon}</span>
            <span class="font-label-bold text-label-bold uppercase tracking-wider whitespace-nowrap">${esc(title)}</span>
        </span>
        <div class="h-px flex-1" style="background:linear-gradient(to right, currentColor, transparent); opacity:0.35;"></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Franja de KPIs: 4 indicadores clave a todo lo ancho, arriba de las tarjetas
// de detalle. Los conteos (poblacion/viviendas) animan de 0 al valor final
// (data-target) via animateEntrances(); los demas se muestran ya resueltos.
// ---------------------------------------------------------------------------
const MARGINACION_COLOR = {
    'Muy alto': 'text-error', 'Alto': 'text-warning', 'Medio': 'text-on-surface',
    'Bajo': 'text-primary', 'Muy bajo': 'text-primary', 'ZAP Urbana': 'text-on-surface-variant'
};

// Acento por tile: cada metrica clave tiene una identidad de color propia
// (borde superior + chip de icono) en vez del gris neutro plano, para que la
// franja de KPI se lea de un vistazo como "lo mas importante de la pagina".
// Los tokens accent-blue/accent-teal se definen en el config de Tailwind
// (ver dashboard/design-tokens.md para la capa semantica completa).
const KPI_ACCENTS = {
    primary: { border: 'border-primary', chipBg: 'bg-primary-container', chipText: 'text-on-primary-container' },
    blue: { border: 'border-accent-blue', chipBg: 'bg-accent-blue/10', chipText: 'text-accent-blue' },
    teal: { border: 'border-accent-teal', chipBg: 'bg-accent-teal/10', chipText: 'text-accent-teal' },
    warning: { border: 'border-warning', chipBg: 'bg-warning/10', chipText: 'text-warning' },
    error: { border: 'border-error', chipBg: 'bg-error-container', chipText: 'text-error' },
    neutral: { border: 'border-outline-variant', chipBg: 'bg-surface-container-high', chipText: 'text-secondary' },
};
const MARGINACION_ACCENT = {
    'Muy alto': 'error', 'Alto': 'warning', 'Medio': 'neutral',
    'Bajo': 'primary', 'Muy bajo': 'primary', 'ZAP Urbana': 'neutral'
};

// Orden de peor a mejor (mas util para la vista de Inicio, donde interesa ver
// primero cuantas localidades estan en la situacion mas vulnerable) + colores
// de barra solida (bg-*, no solo texto) para el mini-grafico de Inicio (ver
// marginacionBreakdown/marginacionBarsHtml).
const ORDEN_MARGINACION = ['Muy alto', 'Alto', 'Medio', 'Bajo', 'Muy bajo', 'ZAP Urbana'];
const MARGINACION_BAR_COLOR = {
    'Muy alto': 'bg-error', 'Alto': 'bg-warning', 'Medio': 'bg-secondary',
    'Bajo': 'bg-primary', 'Muy bajo': 'bg-accent-teal', 'ZAP Urbana': 'bg-accent-blue',
    'Comunidades prioritarias': 'bg-primary', 'Sin grado de marginación': 'bg-outline'
};

// Agrupacion de la grafica de Inicio (pedida 2026-10-16): Medio, Bajo y Muy
// bajo se suman en una sola barra "Comunidades prioritarias".
const MARGINACION_AGRUPADA = { 'Medio': 'Comunidades prioritarias', 'Bajo': 'Comunidades prioritarias', 'Muy bajo': 'Comunidades prioritarias' };
// Las localidades sin grado en la lista (GM_2020 vacio) se cuentan aparte
// para que la grafica sume todas las localidades del programa.
const ORDEN_MARGINACION_AGRUPADA = ['Muy alto', 'Alto', 'Comunidades prioritarias', 'ZAP Urbana', 'Sin grado de marginación'];

// Cuenta localidades por grado de marginacion (solo las que tienen match
// censal, ver renderAggregateInfoCard para el mismo criterio) y devuelve la
// distribucion ordenada de peor a mejor, con porcentaje sobre el total con
// dato disponible.
function marginacionBreakdown(data, { agrupar = false } = {}) {
    const counts = {};
    data.forEach((r) => {
        if (!r.gmMarginacion && !agrupar) return;
        const grado = !r.gmMarginacion ? 'Sin grado de marginación'
            : agrupar ? (MARGINACION_AGRUPADA[r.gmMarginacion] || r.gmMarginacion) : r.gmMarginacion;
        counts[grado] = (counts[grado] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (agrupar ? ORDEN_MARGINACION_AGRUPADA : ORDEN_MARGINACION)
        .filter((g) => counts[g])
        .map((g) => ({ grado: g, n: counts[g], pct: total ? (counts[g] / total * 100) : 0 }));
}

function marginacionBarsHtml(data, opciones = {}) {
    const rows = marginacionBreakdown(data, opciones);
    if (!rows.length) {
        return `<p class="font-body-md text-body-md text-on-surface-variant flex items-start gap-2">
            <span class="material-symbols-outlined text-lg shrink-0">info</span>
            La hoja fuente de esta propuesta no incluye grado de marginación por localidad.
        </p>`;
    }
    return `<div class="space-y-2.5">` + rows.map((r) => `
        <div class="flex items-center gap-3">
            <span class="w-28 sm:w-44 shrink-0 font-label-bold text-label-bold text-on-surface-variant">${esc(r.grado)}</span>
            <div class="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full ${MARGINACION_BAR_COLOR[r.grado] || 'bg-secondary'}" style="width:${r.pct.toFixed(1)}%"></div>
            </div>
            <span class="w-9 shrink-0 text-right font-data-display text-data-display text-on-surface">${r.n}</span>
        </div>`).join('') + `</div>`;
}

function kpiTile(icon, label, valueHtml, accentKey = 'neutral') {
    const a = KPI_ACCENTS[accentKey] || KPI_ACCENTS.neutral;
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 ${a.border} flex items-center gap-4">
        <span class="w-12 h-12 shrink-0 rounded-lg ${a.chipBg} ${a.chipText} flex items-center justify-center">
            <span class="material-symbols-outlined text-[26px]">${icon}</span>
        </span>
        <div class="min-w-0">
            <p class="font-label-bold text-label-bold text-on-surface-variant truncate">${esc(label)}</p>
            ${valueHtml}
        </div>
    </div>`;
}

function kpiCount(icon, label, value, accentKey) {
    return kpiTile(icon, label, `<p class="font-kpi-value text-kpi-value text-on-surface leading-none kpi-value" data-target="${value || 0}">0</p>`, accentKey);
}

function kpiStatic(icon, label, text, colorClass = 'text-on-surface', accentKey) {
    return kpiTile(icon, label, `<p class="font-kpi-value text-kpi-value ${colorClass} leading-none truncate">${esc(text)}</p>`, accentKey);
}

function renderKpiStrip(rec) {
    const tasa = pct(rec.afiliada, rec.pobTotal);
    const margAccent = MARGINACION_ACCENT[rec.gmMarginacion] || 'neutral';
    const etiquetaLocalidades = rec.fuente !== 'AGREGADO'
        ? 'Localidades en el Polígono'
        : rec.customPoligonos ? 'Localidades Seleccionadas' : rec.poligono === null ? 'Localidades Totales' : 'Localidades en el Polígono';
    const cuartaTile = rec.gmMarginacion
        ? kpiStatic('signal_cellular_alt', 'Grado de Marginación', rec.gmMarginacion, MARGINACION_COLOR[rec.gmMarginacion] || 'text-on-surface', margAccent)
        : kpiCount('location_city', etiquetaLocalidades, rec.nLocalidades ?? 1, 'primary');

    return `<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-gutter-grid">
        ${kpiCount('groups', 'Población Total', rec.pobTotal, 'primary')}
        ${kpiCount('home', 'Viviendas Totales', rec.totalViviendas, 'blue')}
        ${kpiStatic('health_and_safety', 'Afiliación a Salud', tasa === null ? '—' : `${tasa.toFixed(1)}%`, 'text-on-surface', 'teal')}
        ${cuartaTile}
    </div>`;
}

// ---------------------------------------------------------------------------
// Anima el conteo de las tarjetas KPI y el relleno de las barras de progreso
// despues de cada re-render (ver render()/renderAggregateView() para #canvas,
// renderInicioView() para #inicio-view). Recibe el contenedor porque no
// siempre es #canvas: la franja de KPIs de Inicio vive en #inicio-view.
// ---------------------------------------------------------------------------
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateEntrances(container = canvas) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
        container.querySelectorAll('.progress-bar-fill').forEach((el) => el.classList.add('fill-in'));
    }));

    container.querySelectorAll('.kpi-value[data-target]').forEach((el) => {
        const target = parseFloat(el.dataset.target);
        if (!isFinite(target)) return;
        if (REDUCED_MOTION) { el.textContent = fmtInt(target); return; }
        const duration = 900;
        const start = performance.now();
        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = fmtInt(target * eased);
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

// ---------------------------------------------------------------------------
// Poblado de selects
// ---------------------------------------------------------------------------
// El numero de poligono es solo un id interno sin significado para el
// usuario; el select "Filtrar por Poligono" muestra el nombre real del
// poligono en ambos datasets:
//  - 'actual': TPBV_POLIGONOS_ACTUAL_NOMBRES (ver poligonos_actual_nombres.js),
//    generado desde "Lista Comunidades TPBV 2026 - Revisada.csv" (columna
//    Nombre_Poligono).
//  - 'nueva': campo "nombrePoligono" de cada registro (NOMBRE_POLIGONO_TPBV).
function poligonoLabel(p) {
    if (DATASET_MODE === 'nueva') {
        const rec = activeData().find((r) => r.poligono === p);
        return rec ? rec.nombrePoligono : `Polígono ${p}`;
    }
    const nombre = (typeof TPBV_POLIGONOS_ACTUAL_NOMBRES !== 'undefined') ? TPBV_POLIGONOS_ACTUAL_NOMBRES[p] : null;
    return nombre || `Polígono ${p}`;
}

function buildPoligonoOptions() {
    const poligonos = [...new Set(activeData().map((r) => r.poligono))].sort((a, b) => a - b);
    selPoligono.innerHTML = '<option value="all">Todos los Polígonos</option>' +
        poligonos.map((p) => `<option value="${p}">${esc(poligonoLabel(p))}</option>`).join('');
}

function buildLocalidadOptions(poligonoFilter) {
    localidadOptions = indexedActiveData()
        .filter((r) => poligonoFilter === 'all' || String(r.poligono) === String(poligonoFilter))
        .sort((a, b) => (a.municipio + a.localidad).localeCompare(b.municipio + b.localidad, 'es'));
    return localidadOptions;
}

// ---------------------------------------------------------------------------
// Buscador de localidad (#input-localidad + #localidad-suggestions): filtra
// localidadOptions en vivo mientras se escribe, ignorando acentos/mayusculas
// (normalizeSearch), y arma el HTML de la lista de sugerencias. El panel
// vive fuera de #global-filters y usa position:fixed calculado en JS por la
// misma razon que #custom-poligonos-panel (ver su comentario en el HTML):
// #global-filters tiene overflow:hidden que lo recortaria si quedara
// anidado adentro.
// ---------------------------------------------------------------------------
function normalizeSearch(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function filterLocalidadOptions(query) {
    const q = normalizeSearch(query);
    if (!q) return localidadOptions;
    return localidadOptions.filter((r) =>
        normalizeSearch(r.localidad).includes(q) || normalizeSearch(r.municipio).includes(q)
    );
}

function localidadSuggestionsHtml(items) {
    if (!items.length) {
        return `<div class="px-3 py-2.5 font-body-md text-body-md text-on-surface-variant">Sin resultados.</div>`;
    }
    return items.map((r, i) => `
        <div class="loc-suggestion px-3 py-2.5 rounded-lg font-body-md text-body-md cursor-pointer transition-colors ${i === localidadActiveIndex ? 'bg-primary-container text-on-primary-container' : 'text-on-surface hover:bg-surface-container-low'}" data-idx="${r.idx}" role="option" aria-selected="${i === localidadActiveIndex}">
            ${esc(r.localidad)} <span class="${i === localidadActiveIndex ? '' : 'text-on-surface-variant'}">— ${esc(r.municipio)}</span>
        </div>`).join('');
}

function positionLocalidadSuggestions() {
    const panel = $('#localidad-suggestions');
    if (!panel || !inputLocalidad) return;
    const r = inputLocalidad.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    const availableHeight = window.innerHeight - r.bottom - 16;
    panel.style.left = `${left}px`;
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.width = `${r.width}px`;
    panel.style.maxHeight = `${Math.max(160, Math.min(360, availableHeight))}px`;
}

// Se re-renderiza el HTML completo en cada tecla/apertura (barato: como
// mucho 132 localidades) en vez de mantener estado incremental -- mas simple
// y consistente con como el resto del tablero re-renderiza vistas completas.
function renderLocalidadSuggestions() {
    const panel = $('#localidad-suggestions');
    if (!panel) return;
    panel.innerHTML = localidadSuggestionsHtml(localidadOptionsFiltradas);
}

// query=undefined => usa el texto actual del input (caso normal, mientras se
// escribe). query='' explicito (ver el listener de 'focus') muestra el
// candidate set completo sin filtrar: al enfocar el campo, su valor no es
// una busqueda en curso sino la etiqueta "Municipio — Localidad" de la
// ultima seleccion, que filtrada tal cual casi siempre da "sin resultados"
// (ningun campo individual contiene el separador " — ").
function openLocalidadSuggestions(query) {
    const panel = $('#localidad-suggestions');
    if (!panel || !inputLocalidad || inputLocalidad.disabled) return;
    localidadOptionsFiltradas = filterLocalidadOptions(query === undefined ? inputLocalidad.value : query);
    localidadActiveIndex = -1;
    renderLocalidadSuggestions();
    panel.classList.remove('hidden');
    positionLocalidadSuggestions();
    inputLocalidad.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', positionLocalidadSuggestions);
    window.addEventListener('scroll', positionLocalidadSuggestions, { passive: true, capture: true });
}

function closeLocalidadSuggestions() {
    const panel = $('#localidad-suggestions');
    if (panel) panel.classList.add('hidden');
    inputLocalidad?.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', positionLocalidadSuggestions);
    window.removeEventListener('scroll', positionLocalidadSuggestions, { capture: true });
}

function chooseLocalidad(idx) {
    closeLocalidadSuggestions();
    selectLocalidad(idx);
    inputLocalidad.blur();
}

// ---------------------------------------------------------------------------
// Filtro personalizado: lista de checkboxes (#custom-poligonos-panel) para
// elegir varios poligonos del dataset activo y ver un agregado de solo esa
// seleccion (ver aggregateCustom). Mientras haya al menos un poligono
// marcado, este filtro tiene prioridad sobre "Filtrar por Poligono" /
// "Seleccionar Localidad" (ver applyCustomPoligonosSelection), que se
// deshabilitan visualmente para dejar claro cual filtro esta activo.
function buildCustomPoligonosPanel() {
    const panel = $('#custom-poligonos-panel');
    if (!panel) return;
    const poligonos = [...new Set(activeData().map((r) => r.poligono))].sort((a, b) => a - b);
    const items = poligonos.map((p) => `
        <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer">
            <input type="checkbox" class="custom-poligono-check w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" value="${p}" ${customPoligonos.has(p) ? 'checked' : ''}>
            <span class="font-body-md text-body-md text-on-surface">${esc(poligonoLabel(p))}</span>
        </label>`).join('');
    panel.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-outline-variant">
            <span class="font-label-bold text-label-bold text-on-surface-variant">Elige los polígonos a comparar</span>
            <button type="button" onclick="clearCustomPoligonos()" class="font-label-bold text-label-bold text-primary hover:underline shrink-0">Limpiar</button>
        </div>
        <div class="space-y-0.5">${items}</div>`;
}

function updateCustomPoligonosButtonLabel() {
    const label = $('#custom-poligonos-label');
    const btn = $('#btn-custom-poligonos');
    if (!label || !btn) return;
    const n = customPoligonos.size;
    label.innerHTML = n > 0
        ? `<span class="material-symbols-outlined text-lg text-primary">checklist</span>${n} polígono${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`
        : `<span class="material-symbols-outlined text-lg text-secondary">checklist</span>Comparar polígonos…`;
    btn.classList.toggle('border-primary', n > 0);
    btn.classList.toggle('text-primary', n > 0);
}

// El panel vive fuera de #global-filters (ver comentario junto a su <div> en
// el HTML: #global-filters tiene overflow:hidden para recortar su franja
// decorativa, lo que recortaba el panel si quedaba anidado adentro). Por eso
// es position:fixed y su posicion se calcula aqui a partir del boton, en vez
// de dejar que un ancestro con position:relative la resuelva via CSS.
function positionCustomPoligonosPanel() {
    const panel = $('#custom-poligonos-panel');
    const btn = $('#btn-custom-poligonos');
    if (!panel || !btn) return;
    const r = btn.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 320;
    const left = Math.max(8, Math.min(r.right - panelWidth, window.innerWidth - panelWidth - 8));
    const availableHeight = window.innerHeight - r.bottom - 16;
    panel.style.left = `${left}px`;
    panel.style.top = `${r.bottom + 8}px`;
    panel.style.maxHeight = `${Math.max(160, Math.min(420, availableHeight))}px`;
}

// Reencuadra el panel si la ventana cambia de tamaño o si se hace scroll
// mientras esta abierto (el header es sticky, pero durante la transicion de
// scroll el boton se mueve antes de que el sticky "enganche"). Los listeners
// solo se enganchan mientras el panel esta realmente abierto (ver
// toggleCustomPoligonosPanel/closeCustomPoligonosPanel), en vez de quedar
// permanentemente activos: el de scroll va en fase de captura, asi que sin
// este on/off correria en CADA scroll de CUALQUIER contenedor de la pagina
// (la lista de localidades, el propio panel, etc.), no solo el de la ventana.
function toggleCustomPoligonosPanel() {
    const panel = $('#custom-poligonos-panel');
    const btn = $('#btn-custom-poligonos');
    if (!panel || !btn) return;
    if (panel.classList.contains('hidden')) {
        buildCustomPoligonosPanel();
        panel.classList.remove('hidden');
        positionCustomPoligonosPanel();
        window.addEventListener('resize', positionCustomPoligonosPanel);
        window.addEventListener('scroll', positionCustomPoligonosPanel, { passive: true, capture: true });
        btn.setAttribute('aria-expanded', 'true');
    } else {
        closeCustomPoligonosPanel();
    }
}

function closeCustomPoligonosPanel() {
    const panel = $('#custom-poligonos-panel');
    const btn = $('#btn-custom-poligonos');
    if (panel) panel.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', positionCustomPoligonosPanel);
    window.removeEventListener('scroll', positionCustomPoligonosPanel, { capture: true });
}

// Mientras customPoligonos no este vacio, es el filtro activo: se deshabilitan
// los selects de "Filtrar por Poligono"/"Seleccionar Localidad" (no tiene
// sentido combinarlos) y se renderiza el agregado de la seleccion. Al vaciarse
// (clearCustomPoligonos o desmarcar el ultimo checkbox) se vuelve a "Todos
// los Poligonos", el estado por defecto del panel de Analisis Demografico.
function applyCustomPoligonosSelection() {
    updateCustomPoligonosButtonLabel();
    const active = customPoligonos.size > 0;
    selPoligono.disabled = active;
    inputLocalidad.disabled = active;
    if (active) {
        renderCustomAggregate();
    } else {
        selPoligono.value = 'all';
        inputLocalidad.value = '';
        buildLocalidadOptions('all');
        renderAggregate(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearCustomPoligonos() {
    if (customPoligonos.size === 0) return;
    customPoligonos.clear();
    buildCustomPoligonosPanel();
    applyCustomPoligonosSelection();
}

// ---------------------------------------------------------------------------
// Conjunto de datos activo (ver DATASET_MODE / setDatasetMode). El geojson de
// la nueva propuesta (TPBV_PROPUESTA_NUEVA) usa nombres de propiedad
// distintos (POLIGONO/NOMBRE/REGION) a los del actual (Pol/Nom_pol/Region);
// se normaliza una sola vez aqui para que el resto del codigo del mapa
// (findPoligonoFeature, renderMap) no necesite saber cual esta activo.
// ---------------------------------------------------------------------------
const TPBV_POLIGONOS_NUEVA_NORM = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? {
    type: 'FeatureCollection',
    features: TPBV_PROPUESTA_NUEVA.features.map((f) => ({
        type: 'Feature',
        properties: { Pol: f.properties.POLIGONO, Nom_pol: f.properties.NOMBRE, Region: f.properties.REGION },
        geometry: f.geometry
    }))
} : null;

// 'nueva' usa TPBV_DATA_PROPUESTA_2026 (68 localidades, hoja "PROPUESTA
// 2026" de "Hoja de trabajo TPBV 2026.xlsx", sin Tlaquiltenango). El
// dataset anterior (TPBV_DATA_NUEVA, 118 localidades del CSV viejo) ya no se
// usa en ningun lado del dashboard.
function activeData() {
    if (DATASET_MODE !== 'nueva') return TPBV_DATA;
    return TPBV_DATA_PROPUESTA_2026;
}

// activeData() con el indice original de cada registro adjunto (r.idx):
// necesario en todos lados donde hay que volver de un registro filtrado a su
// posicion real en el array (selectLocalidad(idx), data-idx en la lista de
// localidades, "es esta la localidad activa" en el mapa). Se recalcula en
// cada llamada a proposito -- no se cachea -- porque activeData() cambia con
// DATASET_MODE y el resultado se usa siempre inmediatamente despues de un
// filter/sort, nunca se retiene entre renders.
function indexedActiveData() {
    return activeData().map((r, idx) => ({ ...r, idx }));
}

// La columna "PROMOTOR" de la hoja "PROPUESTA 2026" resulto ser el numero
// real de poligono (POLIGONO_TPBV), no un promotor de campo -- verificado
// el 2026-08-13 cruzando las 68 localidades contra la geometria oficial (ver
// build_data_propuesta_2026.py). Por eso 'nueva' SI tiene contorno de
// poligono: es la misma geometria que TPBV_PROPUESTA_NUEVA (normalizada en
// TPBV_POLIGONOS_NUEVA_NORM, arriba).
function activePoligonosGeoJSON() {
    if (DATASET_MODE === 'nueva') return TPBV_POLIGONOS_NUEVA_NORM;
    return (typeof TPBV_POLIGONOS !== 'undefined') ? TPBV_POLIGONOS : null;
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------
function findPoligonoFeature(polNum) {
    const fc = activePoligonosGeoJSON();
    if (!fc) return null;
    return fc.features.find((f) => f.properties.Pol === Number(polNum)) || null;
}

// Agrega/quita una capa opcional de un mapa Leaflet segun el estado de su
// checkbox, sin tocar nada mas (no reconstruye la capa ni mueve el
// zoom/paneo). Centraliza el patron "if (show && !hasLayer) add; else if
// (!show && hasLayer) remove" de renderPropuestaView/su listener de
// checkboxes (capas de comparacion).
function syncLayerVisibility(layer, show, targetMap) {
    if (!layer || !targetMap) return;
    if (show && !targetMap.hasLayer(layer)) layer.addTo(targetMap);
    else if (!show && targetMap.hasLayer(layer)) targetMap.removeLayer(layer);
}

// Capas de comparacion territorial (checkboxes de Propuesta Territorial): se
// construyen una sola vez y se agregan/quitan
// del mapa sin re-renderizar nada mas, para poder superponerlas sobre
// cualquier vista (localidad, poligono o "Todos los Poligonos"). El color
// discontinuo (dashArray) en la nueva propuesta ademas de su color propio
// evita depender solo del color para distinguirlas (accesible a daltonismo
// y se mantiene legible en una impresion en blanco y negro).
function ensurePropuestaLayers() {
    if (!propuestaActualLayer && typeof TPBV_POLIGONOS !== 'undefined') {
        propuestaActualLayer = L.geoJSON(TPBV_POLIGONOS, {
            style: { color: COLOR_PROPUESTA_ACTUAL, weight: 2.5, fillColor: COLOR_PROPUESTA_ACTUAL, fillOpacity: 0.28 },
            onEachFeature: (f, layer) => {
                layer.bindTooltip(`Actual · Polígono ${esc(f.properties.Pol)} — ${esc(f.properties.Nom_pol)}`, { sticky: true, className: 'atd-tooltip' });
            }
        });
    }
    if (!propuestaNuevaLayer && typeof TPBV_PROPUESTA_NUEVA !== 'undefined') {
        propuestaNuevaLayer = L.geoJSON(TPBV_PROPUESTA_NUEVA, {
            style: { color: COLOR_PROPUESTA_NUEVA, weight: 2.5, dashArray: '7,5', fillColor: COLOR_PROPUESTA_NUEVA, fillOpacity: 0.16 },
            onEachFeature: (f, layer) => {
                const p = f.properties;
                layer.bindTooltip(`Nueva Propuesta · Polígono ${esc(p.POLIGONO)} — ${esc(p.NOMBRE)} (${esc(p.MUNICIPIO)})`, { sticky: true, className: 'atd-tooltip' });
            }
        });
    }
    if (!propuesta2026Layer && typeof TPBV_PROPUESTA_2026 !== 'undefined') {
        // propuesta2026Markers guarda los circleMarker en el mismo orden que
        // TPBV_PROPUESTA_2026, para poder saltar de "localidad elegida en el
        // buscador" (ver choosePropuesta2026Locality) al marcador real sin
        // tener que recorrer las capas del mapa buscandolo.
        propuesta2026Markers = TPBV_PROPUESTA_2026.map((loc) => {
            const m = L.circleMarker([loc.lat, loc.lon], {
                radius: 5.5,
                color: '#fff',
                weight: 1.5,
                fillColor: COLOR_PROPUESTA_2026,
                fillOpacity: 0.92
            });
            const poligonoTxt = loc.nombrePoligono ? ` · Polígono ${esc(loc.poligono)} (${esc(loc.nombrePoligono)})` : '';
            const nota = loc.coordManual ? '<br><span style="color:#8a5a00">Coordenada capturada manualmente</span>' : '';
            m.bindTooltip(`<b>${esc(loc.localidad)}</b><br>${esc(loc.municipio)}${poligonoTxt}<br>Población Total: ${fmtInt(loc.pobTotal)}${nota}`, { sticky: true, className: 'atd-tooltip' });
            m.on('mouseover', () => m.setStyle({ color: '#BC9B73', weight: 3, radius: 7 }));
            m.on('mouseout', () => m.setStyle({ color: '#fff', weight: 1.5, radius: 5.5 }));
            return m;
        });
        propuesta2026Layer = L.featureGroup(propuesta2026Markers);
    }
}

// Aplica los checkboxes a las capas y deja las localidades (puntos) siempre
// por encima de los poligonos, sin importar en que orden se activaron.
function syncPropuestaCapas() {
    syncLayerVisibility(propuestaActualLayer, showPropuestaActual, propuestaMap);
    syncLayerVisibility(propuestaNuevaLayer, showPropuestaNueva, propuestaMap);
    syncLayerVisibility(propuesta2026Layer, showPropuesta2026, propuestaMap);
    if (propuesta2026Layer && propuestaMap.hasLayer(propuesta2026Layer)) propuesta2026Layer.bringToFront();
}

function propuestaControlsHTML() {
    const nActual = (typeof TPBV_POLIGONOS !== 'undefined') ? TPBV_POLIGONOS.features.length : 0;
    const nNueva = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? TPBV_PROPUESTA_NUEVA.features.length : 0;
    const nPropuesta2026 = (typeof TPBV_PROPUESTA_2026 !== 'undefined') ? TPBV_PROPUESTA_2026.length : 0;
    return `<div class="flex items-center flex-wrap gap-x-5 gap-y-2">
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-propuesta-2026" ${showPropuesta2026 ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_PROPUESTA_2026}" />
            <span class="inline-block w-3.5 h-3.5 rounded-full shrink-0" style="background:${COLOR_PROPUESTA_2026}; border:1.5px solid #fff; box-shadow:0 0 0 1px ${COLOR_PROPUESTA_2026}"></span>
            Propuesta 2026 (${nPropuesta2026})
        </label>
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-propuesta-actual" ${showPropuestaActual ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_PROPUESTA_ACTUAL}" />
            <span class="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style="background:${COLOR_PROPUESTA_ACTUAL}"></span>
            Propuesta Actual (${nActual} polígonos)
        </label>
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-propuesta-nueva" ${showPropuestaNueva ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_PROPUESTA_NUEVA}" />
            <span class="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style="background:${COLOR_PROPUESTA_NUEVA}; border:1.5px dashed #fff"></span>
            Nueva Propuesta (${nNueva} polígonos)
        </label>
    </div>`;
}

// Vista dedicada "Propuesta Territorial" (ver nav lateral): mapa
// independiente del de "Análisis Demográfico", enfocado unicamente en
// comparar la delimitacion actual de los poligonos TPBV contra la nueva
// propuesta de ampliacion. El HTML de la tarjeta se construye una sola vez
// (propuestaViewBuilt); en cada visita solo se refrescan los checkboxes y
// las capas, para no perder el zoom/paneo que el usuario ya tenia.
let propuestaViewBuilt = false;

function renderPropuestaView() {
    const view = $('#propuesta-view');
    if (!propuestaViewBuilt) {
        view.innerHTML = `
        <div>
            <h2 class="font-headline-lg text-headline-lg text-primary">Propuesta Territorial 2026</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant mt-1">Compara la delimitación vigente de los polígonos TPBV contra la nueva propuesta de ampliación territorial. Activa o desactiva cada capa para verlas por separado o superpuestas.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col">
            <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-secondary-container flex-wrap">
                <div class="flex items-center gap-2.5">
                    ${iconChip('layers')}
                    <h2 class="font-headline-md text-headline-md text-on-surface">Comparación de Polígonos</h2>
                </div>
                <div class="flex items-center gap-4 flex-wrap">
                    <div class="relative w-full sm:w-64">
                        <input type="text" id="input-localidad-propuesta" placeholder="Buscar localidad…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="localidad-suggestions-propuesta" aria-autocomplete="list" class="w-full border-outline-variant rounded-lg p-2 pr-9 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface" />
                        <span class="material-symbols-outlined absolute right-2.5 bottom-2.5 text-on-surface-variant pointer-events-none text-xl">search</span>
                    </div>
                    <div id="propuesta-controls"></div>
                </div>
            </div>
            <!-- Mismo encuadre que el mapa de Aulas: angosto, centrado y con la
                 proporcion de Morelos (el mapa solo muestra el estado). -->
            <div class="overflow-hidden relative w-full mx-auto" id="propuesta-map-container" style="max-width:900px;aspect-ratio:1/0.9;max-height:80vh;border-radius:16px;border:1px solid #CBCABE">
                <div id="propuesta-map"></div>
            </div>
        </div>`;
        propuestaViewBuilt = true;
    }
    $('#propuesta-controls').innerHTML = propuestaControlsHTML();

    // Mapa "solo Morelos" (crearMapaMorelos/agregarBaseMorelos en
    // mapa_morelos.js, cargado despues de este archivo).
    if (!propuestaMap) {
        propuestaMap = crearMapaMorelos('propuesta-map');
        basePropuesta = agregarBaseMorelos(propuestaMap);
    }

    ensurePropuestaLayers();
    syncPropuestaCapas();

    // invalidateSize primero: el contenedor pudo estar oculto (display:none,
    // sin layout) hasta este mismo momento. El encuadre solo se recalcula la
    // primera vez que se abre la vista (evita saltos de zoom si el usuario ya
    // habia paneado/hecho zoom manualmente y vuelve a esta pestana).
    const isFirstOpen = !propuestaMap._tpbvFitted;
    setTimeout(() => {
        if (!propuestaMap) return;
        propuestaMap.invalidateSize();
        if (!isFirstOpen) return;
        // Siempre todo Morelos (el mapa solo muestra el estado).
        if (basePropuesta && basePropuesta.contorno) {
            propuestaMap.fitBounds(basePropuesta.contorno.getBounds(), { padding: [24, 24] });
            propuestaMap._tpbvFitted = true;
        } else {
            propuestaMap.setView([18.75, -99.15], 9);
        }
    }, 150);
}

// ---------------------------------------------------------------------------
// Buscador de localidad de "Propuesta Territorial" (#input-localidad-propuesta):
// busca sobre TPBV_PROPUESTA_2026 (las 68 localidades geocodificadas de la
// hoja "PROPUESTA 2026", la unica capa de este mapa con un punto por
// localidad -- Propuesta Actual/Nueva Propuesta son solo contornos de
// poligono). Elegir un resultado hace zoom al punto y abre su tooltip. Mismo
// patron (position:fixed fuera del contenedor, listeners solo mientras esta
// abierto) que el buscador de Analisis Demografico y el filtro personalizado
// de poligonos -- ver sus comentarios para el porque.
// ---------------------------------------------------------------------------
let propuestaLocalidadFiltradas = [];
let propuestaLocalidadActiveIndex = -1;

function filterPropuesta2026(query) {
    const q = normalizeSearch(query);
    const items = (typeof TPBV_PROPUESTA_2026 !== 'undefined') ? TPBV_PROPUESTA_2026 : [];
    if (!q) return items.map((loc, i) => ({ ...loc, i }));
    return items
        .map((loc, i) => ({ ...loc, i }))
        .filter((loc) => normalizeSearch(loc.localidad).includes(q) || normalizeSearch(loc.municipio).includes(q));
}

function propuestaLocalidadSuggestionsHtml(items) {
    if (!items.length) {
        return `<div class="px-3 py-2.5 font-body-md text-body-md text-on-surface-variant">Sin resultados.</div>`;
    }
    return items.map((loc, i) => `
        <div class="loc-suggestion-propuesta px-3 py-2.5 rounded-lg font-body-md text-body-md cursor-pointer transition-colors ${i === propuestaLocalidadActiveIndex ? 'bg-primary-container text-on-primary-container' : 'text-on-surface hover:bg-surface-container-low'}" data-i="${loc.i}" role="option" aria-selected="${i === propuestaLocalidadActiveIndex}">
            ${esc(loc.localidad)} <span class="${i === propuestaLocalidadActiveIndex ? '' : 'text-on-surface-variant'}">— ${esc(loc.municipio)}</span>
        </div>`).join('');
}

function positionPropuestaLocalidadSuggestions() {
    const panel = $('#localidad-suggestions-propuesta');
    const input = $('#input-localidad-propuesta');
    if (!panel || !input) return;
    const r = input.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    const availableHeight = window.innerHeight - r.bottom - 16;
    panel.style.left = `${left}px`;
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.width = `${r.width}px`;
    panel.style.maxHeight = `${Math.max(160, Math.min(360, availableHeight))}px`;
}

function renderPropuestaLocalidadSuggestions() {
    const panel = $('#localidad-suggestions-propuesta');
    if (panel) panel.innerHTML = propuestaLocalidadSuggestionsHtml(propuestaLocalidadFiltradas);
}

function openPropuestaLocalidadSuggestions(query) {
    const panel = $('#localidad-suggestions-propuesta');
    const input = $('#input-localidad-propuesta');
    if (!panel || !input) return;
    propuestaLocalidadFiltradas = filterPropuesta2026(query === undefined ? input.value : query);
    propuestaLocalidadActiveIndex = -1;
    renderPropuestaLocalidadSuggestions();
    panel.classList.remove('hidden');
    positionPropuestaLocalidadSuggestions();
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', positionPropuestaLocalidadSuggestions);
    window.addEventListener('scroll', positionPropuestaLocalidadSuggestions, { passive: true, capture: true });
}

function closePropuestaLocalidadSuggestions() {
    const panel = $('#localidad-suggestions-propuesta');
    const input = $('#input-localidad-propuesta');
    if (panel) panel.classList.add('hidden');
    input?.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', positionPropuestaLocalidadSuggestions);
    window.removeEventListener('scroll', positionPropuestaLocalidadSuggestions, { capture: true });
}

// Hace zoom al punto elegido y abre su tooltip; si la capa "Propuesta 2026"
// estaba apagada la reactiva (buscar algo invisible seria confuso), tanto en
// el estado (showPropuesta2026) como en el checkbox visible.
function choosePropuesta2026Locality(i) {
    closePropuestaLocalidadSuggestions();
    const loc = TPBV_PROPUESTA_2026[i];
    const marker = propuesta2026Markers[i];
    if (!loc || !marker || !propuestaMap) return;

    const input = $('#input-localidad-propuesta');
    if (input) input.value = `${loc.localidad} — ${loc.municipio}`;

    if (!showPropuesta2026) {
        showPropuesta2026 = true;
        const chk = $('#chk-propuesta-2026');
        if (chk) chk.checked = true;
        syncPropuestaCapas();
    }
    propuestaMap.setView([loc.lat, loc.lon], 12);
    marker.openTooltip();
}

// ---------------------------------------------------------------------------
// Vista "Banco de Proyectos": filtro en cascada Municipio -> Localidad sobre
// TPBV_BANCO_PROYECTOS (2,295 proyectos, ver banco_proyectos.js /
// scripts/build_banco_proyectos.py para la limpieza de nombres aplicada).
// No usa mapa (esta fuente no trae coordenadas por proyecto), asi que a
// diferencia de Analisis Demografico/Propuesta Territorial es una vista
// puramente de filtro + lista de tarjetas.
// ---------------------------------------------------------------------------
const BANCO_ESTATUS_STYLE = {
    'EJECUTADO': { badge: 'bg-primary-container text-on-primary-container', border: 'border-primary', icon: 'check_circle' },
    'NO EJECUTADO': { badge: 'bg-surface-container-high text-on-surface-variant', border: 'border-outline-variant', icon: 'schedule' },
};

// Filtro de estatus (#banco-estatus-toggle): 'todos' | 'EJECUTADO' | 'NO
// EJECUTADO'. Se aplica en bancoDataset(), el punto unico de entrada a
// TPBV_BANCO_PROYECTOS para todo lo que se calcula/renderiza (lista de
// proyectos de una localidad, resumen de un municipio, informe general de
// "Todo el Estado") -- asi el filtro afecta parejo a las tres vistas sin
// tocar cada una por separado. Los selects de Municipio/Localidad SI se
// siguen poblando desde TPBV_BANCO_PROYECTOS sin filtrar (bancoMunicipios/
// bancoLocalidades mas abajo): que el filtro de estatus vacie los
// resultados de un municipio no debe hacer que ese municipio desaparezca
// del desplegable.
let bancoEstatusFiltro = 'todos';

function bancoDataset() {
    return bancoEstatusFiltro === 'todos'
        ? TPBV_BANCO_PROYECTOS
        : TPBV_BANCO_PROYECTOS.filter((p) => p.estatus === bancoEstatusFiltro);
}

function bancoMunicipios() {
    const municipios = [...new Set(TPBV_BANCO_PROYECTOS.map((p) => p.municipio))];
    // "Todo el Estado" agrupa programas sin municipio especifico (ver
    // build_banco_proyectos.py): va primero, no le corresponde un lugar
    // alfabetico entre municipios reales.
    municipios.sort((a, b) => {
        if (a === 'Todo el Estado') return -1;
        if (b === 'Todo el Estado') return 1;
        return a.localeCompare(b, 'es');
    });
    return municipios;
}

function bancoLocalidades(municipio) {
    return [...new Set(TPBV_BANCO_PROYECTOS.filter((p) => p.municipio === municipio).map((p) => p.localidad))]
        .sort((a, b) => a.localeCompare(b, 'es'));
}

function bancoProyectosDe(municipio, localidad) {
    return bancoDataset().filter((p) => p.municipio === municipio && p.localidad === localidad);
}

function bancoMetaItem(icon, label, value) {
    return `<div class="flex items-start gap-1.5 min-w-0">
        <span class="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5 shrink-0">${icon}</span>
        <div class="min-w-0">
            <p class="font-label-bold text-label-bold text-on-surface-variant">${esc(label)}</p>
            <p class="font-body-md text-body-md text-on-surface truncate" title="${esc(value ?? '')}">${esc(value ?? '—')}</p>
        </div>
    </div>`;
}

// mostrarUbicacion=true (ver bancoResultadosBusquedaTextoHtml): el buscador
// de texto libre devuelve proyectos de cualquier municipio/localidad
// mezclados, asi que cada tarjeta necesita decir de donde es -- a
// diferencia del resto de las vistas de este modulo, donde el municipio y
// la localidad ya estan fijados por los selects y serian redundantes.
function bancoProyectoCard(p, mostrarUbicacion) {
    const style = BANCO_ESTATUS_STYLE[p.estatus] || BANCO_ESTATUS_STYLE['NO EJECUTADO'];
    const chips = [p.generica, p.tipoObra].filter(Boolean)
        .map((c) => `<span class="font-label-bold text-label-bold text-secondary bg-surface-container-high px-2.5 py-1 rounded-full">${esc(c)}</span>`)
        .join('');
    const ubicacion = mostrarUbicacion
        ? `<p class="flex items-center gap-1 font-label-bold text-label-bold text-primary mb-2">
            <span class="material-symbols-outlined text-[16px]">location_on</span>${esc(p.localidad)} — ${esc(p.municipio)}
        </p>`
        : '';
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 ${style.border}">
        ${ubicacion}
        <div class="flex items-start justify-between gap-3 mb-3">
            <h3 class="font-headline-md text-headline-md text-on-surface">${esc(p.obra || 'Proyecto sin descripción')}</h3>
            <span class="shrink-0 flex items-center gap-1.5 font-label-bold text-label-bold px-2.5 py-1 rounded-full ${style.badge}">
                <span class="material-symbols-outlined text-[16px]">${style.icon}</span>${esc(p.estatus || '—')}
            </span>
        </div>
        ${chips ? `<div class="flex flex-wrap gap-2 mb-3">${chips}</div>` : ''}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 pt-3 border-t border-outline-variant">
            ${bancoMetaItem('flag', 'Estrategia', p.estrategia)}
            ${bancoMetaItem('priority_high', 'Prioridad', p.indice)}
            ${bancoMetaItem('event', 'Año', p.anio)}
            ${bancoMetaItem('tag', 'Clave de localidad', p.claveLocalidad)}
        </div>
    </div>`;
}

function bancoEstadoVacio() {
    const dataset = bancoDataset();
    const total = dataset.length;
    const nMun = new Set(dataset.map((p) => p.municipio)).size;
    const nEjecutado = dataset.filter((p) => p.estatus === 'EJECUTADO').length;
    return `<div class="flex flex-col items-center justify-center text-center gap-2 py-16 px-4 bg-surface-container-lowest rounded-xl card-shadow">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant opacity-40">inventory_2</span>
        <p class="font-headline-sm text-headline-sm text-on-surface mt-2">Elige un municipio y una localidad</p>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-md">Selecciona ambos filtros arriba para ver los proyectos de esa localidad, elige <b>Todas las Localidades</b> para un resumen del municipio, o <b>Todo el Estado</b> para un informe general.</p>
        <p class="font-body-md text-body-md text-secondary mt-2">${fmtInt(total)} proyectos en total · ${nMun} municipios · ${fmtInt(nEjecutado)} ejecutados</p>
    </div>`;
}

// Barra horizontal ranqueada (mismo patron que marginacionBarsHtml en
// Inicio): usada en el informe general de "Todo el Estado" para las 3
// distribuciones (municipio/categoria/año), ordenadas de mayor a menor.
function bancoRankingHtml(counts, colorClass, max) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<p class="font-body-md text-body-md text-on-surface-variant">Sin datos.</p>`;
    const tope = max || entries[0][1];
    return `<div class="space-y-2.5">` + entries.map(([label, n]) => `
        <div class="flex items-center gap-3">
            <span class="w-44 shrink-0 font-body-md text-body-md text-on-surface truncate" title="${esc(label)}">${esc(label)}</span>
            <div class="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full ${colorClass}" style="width:${(n / tope * 100).toFixed(1)}%"></div>
            </div>
            <span class="w-10 shrink-0 text-right font-data-display text-data-display text-on-surface">${fmtInt(n)}</span>
        </div>`).join('') + `</div>`;
}

function bancoContarPor(campo, excluir) {
    const counts = {};
    TPBV_BANCO_PROYECTOS.forEach((p) => {
        if (excluir && excluir(p)) return;
        const key = p[campo] || 'Sin dato';
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

// Informe general de "Todo el Estado": en vez de pedir una localidad (que
// para este "municipio" especial son solo los 7 programas sin municipio
// propio, ver build_banco_proyectos.py), muestra un panorama completo --
// principalmente pensado para responder "¿donde se han hecho mas obras?".
// Informe compartido por "Todo el Estado" (ranking por municipio) y por el
// resumen de un municipio especifico (ranking por localidad, ver
// bancoResumenMunicipioHtml): KPIs + 3 rankings (campo elegido / categoria /
// año). proyectosTotal se usa para los KPIs y para categoria/año; puede
// diferir de proyectosRanking (el primero incluye todo, el segundo puede
// excluir filas que no tengan un valor real para el campo que se rankea --
// ver el caso "Todo el Estado", que excluye sus propios 7 registros sin
// municipio del ranking por municipio).
function bancoResumenHtml(proyectosTotal, proyectosRanking, opts) {
    const nEjecutado = proyectosTotal.filter((p) => p.estatus === 'EJECUTADO').length;
    const porCampo = {};
    proyectosRanking.forEach((p) => { const k = p[opts.campoRanking] || 'Sin dato'; porCampo[k] = (porCampo[k] || 0) + 1; });
    const porCategoria = {};
    proyectosTotal.forEach((p) => { const k = p.generica || 'Sin categoría'; porCategoria[k] = (porCategoria[k] || 0) + 1; });
    const topCategorias = Object.fromEntries(Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 10));
    const porAnio = {};
    proyectosTotal.forEach((p) => { const k = p.anio ? String(p.anio) : 'Sin año'; porAnio[k] = (porAnio[k] || 0) + 1; });

    const parts = [];
    parts.push(`<div class="grid grid-cols-2 md:grid-cols-4 gap-gutter-grid">
        ${kpiCount('inventory_2', 'Proyectos', proyectosTotal.length, 'primary')}
        ${kpiCount('check_circle', 'Ejecutados', nEjecutado, 'primary')}
        ${kpiCount('schedule', 'No Ejecutados', proyectosTotal.length - nEjecutado, 'neutral')}
        ${kpiCount(opts.kpiIcon, opts.kpiLabel, Object.keys(porCampo).length, 'blue')}
    </div>`);

    parts.push(`<div class="grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">`);
    parts.push(card(`
        <h3 class="font-headline-md text-headline-md text-on-surface mb-1">${esc(opts.tituloRanking)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-4">${esc(opts.subtituloRanking)}</p>
        <div class="max-h-[420px] overflow-y-auto pr-1">${bancoRankingHtml(porCampo, opts.colorRanking)}</div>
    `));
    parts.push(`<div class="flex flex-col gap-gutter-grid">
        ${card(`
            <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Categorías más frecuentes</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-4">Top 10 tipos de programa (GENERICA).</p>
            ${bancoRankingHtml(topCategorias, 'bg-accent-blue')}
        `)}
        ${card(`
            <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Proyectos por año</h3>
            ${bancoRankingHtml(porAnio, 'bg-accent-teal')}
        `)}
    </div>`);
    parts.push(`</div>`);
    return parts.join('');
}

function bancoInformeGeneralHtml() {
    const proyectos = bancoDataset();
    const proyectosRankeables = proyectos.filter((p) => p.municipio !== 'Todo el Estado');
    const nSinMunicipio = proyectos.length - proyectosRankeables.length;

    const parts = [bancoResumenHtml(proyectos, proyectosRankeables, {
        tituloRanking: 'Municipios con más obras',
        subtituloRanking: 'Total de proyectos registrados por municipio.',
        campoRanking: 'municipio',
        colorRanking: 'bg-primary',
        kpiIcon: 'location_city',
        kpiLabel: 'Municipios con obras',
    })];

    if (nSinMunicipio > 0) {
        const sinMunicipio = proyectos.filter((p) => p.municipio === 'Todo el Estado');
        parts.push(sectionLabel(`Programas estatales sin municipio específico (${fmtInt(nSinMunicipio)})`, 'public', 'neutral'));
        parts.push(`<p class="font-body-md text-body-md text-on-surface-variant -mt-2">No tienen un municipio capturado en la hoja original; no se incluyen en el ranking de arriba.</p>`);
        parts.push(`<div class="flex flex-col gap-gutter-grid">${sinMunicipio.map(bancoProyectoCard).join('')}</div>`);
    }

    return parts.join('');
}

// Resumen de "Todas las Localidades" dentro de un municipio (ver la opcion
// del mismo nombre en #sel-banco-localidad): mismo formato que el informe
// general de "Todo el Estado", pero rankeando localidades en vez de
// municipios y sin la seccion de "sin municipio" (no aplica aqui).
function bancoResumenMunicipioHtml(municipio) {
    const proyectos = bancoDataset().filter((p) => p.municipio === municipio);
    return bancoResumenHtml(proyectos, proyectos, {
        tituloRanking: 'Localidades con más obras',
        subtituloRanking: `Total de proyectos por localidad en ${municipio}.`,
        campoRanking: 'localidad',
        colorRanking: 'bg-primary',
        kpiIcon: 'location_on',
        kpiLabel: 'Localidades con obras',
    });
}

function bancoSinProyectos() {
    return `<div class="flex flex-col items-center justify-center text-center gap-2 py-16 px-4 bg-surface-container-lowest rounded-xl card-shadow">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant opacity-40">search_off</span>
        <p class="font-body-md text-body-md text-on-surface-variant">No hay proyectos registrados para esta localidad.</p>
    </div>`;
}

// Busca en descripcion (obra), categoria (generica) y tipo de obra -- no
// solo en "obra": muchos proyectos de una categoria (p.ej. GENERICA="RED DE
// AGUA POTABLE") tienen una descripcion que no repite el nombre de la
// categoria (p.ej. "Ampliación de red"), y buscar solo en obra los dejaria
// fuera de un resultado como "agua potable" que claramente los deberia
// incluir.
function filterBancoPorTexto(query) {
    const q = normalizeSearch(query);
    if (!q) return [];
    return bancoDataset().filter((p) =>
        normalizeSearch(p.obra).includes(q) ||
        normalizeSearch(p.tipoObra).includes(q) ||
        normalizeSearch(p.generica).includes(q)
    );
}

function bancoResultadosBusquedaTextoHtml(query) {
    const proyectos = filterBancoPorTexto(query);
    if (!proyectos.length) {
        return `<div class="flex flex-col items-center justify-center text-center gap-2 py-16 px-4 bg-surface-container-lowest rounded-xl card-shadow">
            <span class="material-symbols-outlined text-5xl text-on-surface-variant opacity-40">search_off</span>
            <p class="font-body-md text-body-md text-on-surface-variant">Ningún proyecto coincide con "${esc(query)}".</p>
        </div>`;
    }
    const nEjecutado = proyectos.filter((p) => p.estatus === 'EJECUTADO').length;
    const nMunicipios = new Set(proyectos.map((p) => p.municipio)).size;
    const parts = [];
    parts.push(`<div class="grid grid-cols-2 md:grid-cols-4 gap-gutter-grid">
        ${kpiCount('inventory_2', 'Proyectos', proyectos.length, 'primary')}
        ${kpiCount('check_circle', 'Ejecutados', nEjecutado, 'primary')}
        ${kpiCount('schedule', 'No Ejecutados', proyectos.length - nEjecutado, 'neutral')}
        ${kpiCount('location_city', 'Municipios', nMunicipios, 'blue')}
    </div>`);

    // Un termino comun (p.ej. "pavimentacion") puede devolver 200+
    // proyectos: mostrarlos todos como tarjeta completa vuelve la pagina
    // kilometrica. Se limita la lista (los KPI de arriba SI reflejan el
    // total real, no el limite) y se avisa que hay mas.
    const LIMITE = 60;
    const mostrados = proyectos.slice(0, LIMITE);
    parts.push(`<div class="flex flex-col gap-gutter-grid">${mostrados.map((p) => bancoProyectoCard(p, true)).join('')}</div>`);
    if (proyectos.length > LIMITE) {
        parts.push(`<p class="font-body-md text-body-md text-on-surface-variant text-center">Mostrando ${fmtInt(LIMITE)} de ${fmtInt(proyectos.length)} proyectos. Escribe una búsqueda más específica para acotar el resultado.</p>`);
    }
    return parts.join('');
}

function renderBancoResultados() {
    const container = $('#banco-resultados');
    if (!container) return;

    // Buscador de texto libre (#input-banco-texto) tiene prioridad sobre los
    // filtros de Municipio/Localidad: busca en TODO el estado sin importar
    // que este seleccionado abajo (ver el listener de 'input', que ademas
    // limpia esos selects para que no quede una combinacion confusa de
    // "Xochitepec elegido" + "resultados de todos lados").
    const texto = $('#input-banco-texto')?.value.trim() || '';
    if (texto) {
        container.innerHTML = bancoResultadosBusquedaTextoHtml(texto);
        animateEntrances(container);
        return;
    }

    const municipio = $('#sel-banco-municipio').value;
    const localidad = $('#sel-banco-localidad').value;

    // "Todo el Estado" sin localidad elegida: informe general (ranking de
    // municipios/categorias/años) en vez del mensaje "elige una localidad" --
    // ver bancoInformeGeneralHtml. Si el usuario SI elige una localidad
    // dentro de "Todo el Estado" (los 7 programas estatales sin municipio
    // propio: "Morelos"/"OTRO"), se sigue mostrando esa lista puntual mas
    // abajo, como con cualquier otro municipio.
    if (municipio === 'Todo el Estado' && !localidad) {
        container.innerHTML = bancoInformeGeneralHtml();
        animateEntrances(container);
        return;
    }

    // "Todas las Localidades" (opcion agregada en el select junto a las
    // localidades reales del municipio, ver el listener de 'change' mas
    // abajo): mismo tipo de resumen que "Todo el Estado" pero rankeando las
    // localidades de ESTE municipio en vez de todos los municipios.
    if (municipio && localidad === '__todas__') {
        container.innerHTML = bancoResumenMunicipioHtml(municipio);
        animateEntrances(container);
        return;
    }

    if (!municipio || !localidad) {
        container.innerHTML = bancoEstadoVacio();
        return;
    }

    const proyectos = bancoProyectosDe(municipio, localidad);
    if (!proyectos.length) {
        container.innerHTML = bancoSinProyectos();
        return;
    }
    const nEjecutado = proyectos.filter((p) => p.estatus === 'EJECUTADO').length;

    const parts = [];
    parts.push(`<div class="grid grid-cols-2 md:grid-cols-3 gap-gutter-grid">
        ${kpiCount('inventory_2', 'Proyectos', proyectos.length, 'primary')}
        ${kpiCount('check_circle', 'Ejecutados', nEjecutado, 'primary')}
        ${kpiCount('schedule', 'No Ejecutados', proyectos.length - nEjecutado, 'neutral')}
    </div>`);
    parts.push(`<div class="flex flex-col gap-gutter-grid">${proyectos.map(bancoProyectoCard).join('')}</div>`);
    container.innerHTML = parts.join('');
    animateEntrances(container);
}

// ---------------------------------------------------------------------------
// Buscador de localidad (#input-banco-buscar): atajo directo a un municipio+
// localidad sin tener que saber de antemano en que municipio esta -- busca
// por nombre en TODAS las combinaciones (municipio, localidad) del dataset
// filtrado (bancoDataset(), respeta el filtro de Estatus), ignorando
// acentos/mayusculas (normalizeSearch, definida junto al buscador de
// Analisis Demografico). Al elegir un resultado ajusta los selects de
// Municipio/Localidad exactamente como si el usuario los hubiera usado a
// mano, para que ambos caminos queden sincronizados. "Todo el Estado" queda
// fuera de este buscador: sus "localidades" (OTRO/Morelos) no son
// localidades reales, ya se muestran directo en el informe general.
// ---------------------------------------------------------------------------
let bancoBuscarFiltradas = [];
let bancoBuscarActiveIndex = -1;

function bancoLocalidadesTodas() {
    const counts = new Map();
    bancoDataset().forEach((p) => {
        if (p.municipio === 'Todo el Estado') return;
        const key = p.municipio + '|' + p.localidad;
        if (!counts.has(key)) counts.set(key, { municipio: p.municipio, localidad: p.localidad, n: 0 });
        counts.get(key).n += 1;
    });
    return [...counts.values()].sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'));
}

function filterBancoLocalidades(query) {
    const q = normalizeSearch(query);
    const items = bancoLocalidadesTodas();
    if (!q) return items;
    return items.filter((it) => normalizeSearch(it.localidad).includes(q) || normalizeSearch(it.municipio).includes(q));
}

function bancoBuscarSuggestionsHtml(items) {
    if (!items.length) {
        return `<div class="px-3 py-2.5 font-body-md text-body-md text-on-surface-variant">Sin resultados.</div>`;
    }
    return items.map((it, i) => `
        <div class="loc-suggestion-banco px-3 py-2.5 rounded-lg font-body-md text-body-md cursor-pointer transition-colors ${i === bancoBuscarActiveIndex ? 'bg-primary-container text-on-primary-container' : 'text-on-surface hover:bg-surface-container-low'}" data-municipio="${esc(it.municipio)}" data-localidad="${esc(it.localidad)}" role="option" aria-selected="${i === bancoBuscarActiveIndex}">
            ${esc(it.localidad)} <span class="${i === bancoBuscarActiveIndex ? '' : 'text-on-surface-variant'}">— ${esc(it.municipio)} (${it.n})</span>
        </div>`).join('');
}

function positionBancoBuscarSuggestions() {
    const panel = $('#banco-buscar-suggestions');
    const input = $('#input-banco-buscar');
    if (!panel || !input) return;
    const r = input.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    const availableHeight = window.innerHeight - r.bottom - 16;
    panel.style.left = `${left}px`;
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.width = `${r.width}px`;
    panel.style.maxHeight = `${Math.max(160, Math.min(360, availableHeight))}px`;
}

function renderBancoBuscarSuggestions() {
    const panel = $('#banco-buscar-suggestions');
    if (panel) panel.innerHTML = bancoBuscarSuggestionsHtml(bancoBuscarFiltradas);
}

function openBancoBuscarSuggestions(query) {
    const panel = $('#banco-buscar-suggestions');
    const input = $('#input-banco-buscar');
    if (!panel || !input) return;
    bancoBuscarFiltradas = filterBancoLocalidades(query === undefined ? input.value : query);
    bancoBuscarActiveIndex = -1;
    renderBancoBuscarSuggestions();
    panel.classList.remove('hidden');
    positionBancoBuscarSuggestions();
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', positionBancoBuscarSuggestions);
    window.addEventListener('scroll', positionBancoBuscarSuggestions, { passive: true, capture: true });
}

function closeBancoBuscarSuggestions() {
    const panel = $('#banco-buscar-suggestions');
    const input = $('#input-banco-buscar');
    if (panel) panel.classList.add('hidden');
    input?.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', positionBancoBuscarSuggestions);
    window.removeEventListener('scroll', positionBancoBuscarSuggestions, { capture: true });
}

// Sincroniza los selects de Municipio/Localidad con lo elegido en el
// buscador (mismo resultado que si el usuario los hubiera usado a mano) y
// dispara el render normal.
function elegirBancoLocalidad(municipio, localidad) {
    closeBancoBuscarSuggestions();
    const input = $('#input-banco-buscar');
    if (input) input.value = `${localidad} — ${municipio}`;

    const selMun = $('#sel-banco-municipio');
    const selLoc = $('#sel-banco-localidad');
    selMun.value = municipio;
    selLoc.disabled = false;
    selLoc.innerHTML = '<option value="">Selecciona una localidad…</option>' +
        '<option value="__todas__">Todas las Localidades</option>' +
        bancoLocalidades(municipio).map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    selLoc.value = localidad;
    renderBancoResultados();
}

let bancoProyectosViewBuilt = false;

function renderBancoProyectosView() {
    const view = $('#banco-proyectos-view');
    if (!bancoProyectosViewBuilt) {
        view.innerHTML = `
        <div>
            <h2 class="font-headline-lg text-headline-lg text-primary">Banco de Proyectos</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant mt-1">Consulta los proyectos y obras registrados por municipio y localidad (Banco de Proyectos PP TPBV).</p>
        </div>
        <div class="w-full bg-surface-container-lowest rounded-xl p-4 card-shadow flex flex-col md:flex-row gap-4">
            <div class="flex-1 w-full">
                <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Buscar en descripción de obra</label>
                <div class="relative">
                    <input type="text" id="input-banco-texto" placeholder="Ej. &quot;agua potable&quot;, &quot;pavimentación&quot;, &quot;gallinas&quot;…" autocomplete="off" class="w-full border-outline-variant rounded-lg p-2 pr-9 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface" />
                    <span class="material-symbols-outlined absolute right-2.5 bottom-2.5 text-on-surface-variant pointer-events-none text-xl">search</span>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant mt-1">Busca en todos los municipios a la vez (sí respeta el filtro de Estatus).</p>
            </div>
            <div class="flex-1 w-full relative">
                <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Buscar Localidad</label>
                <div class="relative">
                    <input type="text" id="input-banco-buscar" placeholder="Escribe el nombre de una localidad…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="banco-buscar-suggestions" aria-autocomplete="list" class="w-full border-outline-variant rounded-lg p-2 pr-9 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface" />
                    <span class="material-symbols-outlined absolute right-2.5 bottom-2.5 text-on-surface-variant pointer-events-none text-xl">search</span>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant mt-1">Salta directo a una localidad sin saber antes su municipio.</p>
            </div>
        </div>
        <div class="w-full bg-surface-container-lowest rounded-xl p-4 card-shadow flex flex-col md:flex-row gap-4 items-end">
            <div class="flex-1 w-full">
                <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Municipio</label>
                <select id="sel-banco-municipio" class="w-full border-outline-variant rounded-lg p-2 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface">
                    <option value="">Selecciona un municipio…</option>
                </select>
            </div>
            <div class="flex-1 w-full">
                <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Localidad</label>
                <select id="sel-banco-localidad" class="w-full border-outline-variant rounded-lg p-2 font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface disabled:opacity-50 disabled:bg-surface-container-low disabled:cursor-not-allowed" disabled>
                    <option value="">Selecciona una localidad…</option>
                </select>
            </div>
            <div class="w-full md:w-auto">
                <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Estatus</label>
                <div id="banco-estatus-toggle" class="inline-flex rounded-full bg-surface-container-high p-1 gap-1" role="group" aria-label="Filtrar por estatus">
                    <button type="button" data-estatus="todos" class="${DATASET_BTN_ACTIVE}" aria-pressed="true">Todos</button>
                    <button type="button" data-estatus="EJECUTADO" class="${DATASET_BTN_INACTIVE}" aria-pressed="false">Ejecutado</button>
                    <button type="button" data-estatus="NO EJECUTADO" class="${DATASET_BTN_INACTIVE}" aria-pressed="false">No Ejecutado</button>
                </div>
            </div>
        </div>
        <div id="banco-resultados" class="flex flex-col gap-gutter-grid"></div>`;
        bancoProyectosViewBuilt = true;

        $('#sel-banco-municipio').innerHTML = '<option value="">Selecciona un municipio…</option>' +
            bancoMunicipios().map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');

        // Por defecto, la primera vez que se abre esta vista ya se ve el
        // informe general de "Todo el Estado" (ver bancoInformeGeneralHtml)
        // en vez de la pantalla vacia "elige un municipio" -- el usuario
        // pidio que la vista no arranque sin informacion. Localidad se deja
        // deshabilitada, igual que cuando se elige "Todo el Estado" a mano
        // (ver el listener de 'change' de sel-banco-municipio).
        $('#sel-banco-municipio').value = 'Todo el Estado';
        $('#sel-banco-localidad').disabled = true;

        renderBancoResultados();
    }
}

// Delegado sobre #banco-proyectos-view: los selects se crean recien la
// primera vez que se abre esta vista (ver renderBancoProyectosView), no
// existen en el HTML estatico -- mismo patron que #propuesta-view.
$('#banco-proyectos-view').addEventListener('change', (e) => {
    if (e.target && (e.target.id === 'sel-banco-municipio' || e.target.id === 'sel-banco-localidad')) {
        // Elegir Municipio/Localidad "a mano" cancela una busqueda de texto
        // libre en curso -- ver renderBancoResultados, que le da prioridad
        // al texto si sigue presente, lo que dejaria estos selects sin
        // efecto visible y confundiria al usuario.
        const inputTexto = $('#input-banco-texto');
        if (inputTexto) inputTexto.value = '';
    }
    if (e.target && e.target.id === 'sel-banco-municipio') {
        const municipio = e.target.value;
        const selLoc = $('#sel-banco-localidad');
        // "Todo el Estado" no necesita el paso de Localidad: su unico
        // contenido ademas del informe general son 7 filas sin municipio
        // real capturado en la hoja original ("TODO EL ESTADO"/"Morelos ",
        // ver build_banco_proyectos.py), cuyas localidades "OTRO"/"Morelos"
        // no significan nada para el usuario. Esos 7 se muestran directo
        // dentro del informe general (ver bancoInformeGeneralHtml) en vez de
        // obligar a elegir una de esas dos opciones confusas.
        const esTodoElEstado = municipio === 'Todo el Estado';
        selLoc.disabled = !municipio || esTodoElEstado;
        selLoc.innerHTML = '<option value="">Selecciona una localidad…</option>' +
            (municipio && !esTodoElEstado
                ? '<option value="__todas__">Todas las Localidades</option>' +
                  bancoLocalidades(municipio).map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('')
                : '');
        renderBancoResultados();
    }
    if (e.target && e.target.id === 'sel-banco-localidad') {
        renderBancoResultados();
    }
});

// Filtro de estatus (#banco-estatus-toggle): igual que Municipio/Localidad,
// no afecta a que Municipio/Localidad esten seleccionados, solo recalcula
// bancoDataset() y vuelve a renderizar con lo que ya estaba elegido.
function updateBancoEstatusToggleUI() {
    document.querySelectorAll('#banco-estatus-toggle [data-estatus]').forEach((btn) => {
        const active = btn.dataset.estatus === bancoEstatusFiltro;
        btn.className = active ? DATASET_BTN_ACTIVE : DATASET_BTN_INACTIVE;
        btn.setAttribute('aria-pressed', String(active));
    });
}

$('#banco-proyectos-view').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-estatus]');
    if (!btn) return;
    bancoEstatusFiltro = btn.dataset.estatus;
    updateBancoEstatusToggleUI();
    renderBancoResultados();
});

// Buscador de localidad de "Banco de Proyectos" (#input-banco-buscar):
// delegado sobre #banco-proyectos-view (el input se crea recien la primera
// vez que se abre esta vista) -- mismo patron que el buscador de "Propuesta
// Territorial".
$('#banco-proyectos-view').addEventListener('input', (e) => {
    if (e.target && e.target.id === 'input-banco-buscar') openBancoBuscarSuggestions();
    if (e.target && e.target.id === 'input-banco-texto') {
        // Escribir aqui reemplaza (visualmente) la seleccion de Municipio/
        // Localidad, para no dejar un estado mixto confuso -- ver el
        // comentario junto al listener de 'change' de esos selects.
        const selMun = $('#sel-banco-municipio');
        if (selMun && selMun.value) {
            selMun.value = '';
            const selLoc = $('#sel-banco-localidad');
            selLoc.disabled = true;
            selLoc.innerHTML = '<option value="">Selecciona una localidad…</option>';
        }
        renderBancoResultados();
    }
});
$('#banco-proyectos-view').addEventListener('focusin', (e) => {
    if (!e.target || e.target.id !== 'input-banco-buscar') return;
    e.target.select();
    openBancoBuscarSuggestions('');
});
$('#banco-proyectos-view').addEventListener('keydown', (e) => {
    if (!e.target || e.target.id !== 'input-banco-buscar') return;
    const panel = $('#banco-buscar-suggestions');
    if (!panel) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (panel.classList.contains('hidden')) { openBancoBuscarSuggestions(); return; }
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        bancoBuscarActiveIndex = Math.max(0, Math.min(bancoBuscarActiveIndex + delta, bancoBuscarFiltradas.length - 1));
        renderBancoBuscarSuggestions();
        panel.querySelector('.loc-suggestion-banco[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        if (panel.classList.contains('hidden')) return;
        e.preventDefault();
        const chosen = bancoBuscarFiltradas[bancoBuscarActiveIndex] ?? bancoBuscarFiltradas[0];
        if (chosen) elegirBancoLocalidad(chosen.municipio, chosen.localidad);
    } else if (e.key === 'Escape') {
        closeBancoBuscarSuggestions();
    }
});
document.addEventListener('click', (e) => {
    const item = e.target.closest('.loc-suggestion-banco');
    if (item) { elegirBancoLocalidad(item.dataset.municipio, item.dataset.localidad); return; }
    const panel = $('#banco-buscar-suggestions');
    const input = $('#input-banco-buscar');
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || (input && input.contains(e.target))) return;
    closeBancoBuscarSuggestions();
});

// ---------------------------------------------------------------------------
// Vista "Inicio": bienvenida + guia rapida del tablero. Se reconstruye cada
// vez que se abre (es barata: no toca mapas ni Leaflet) para que las cifras
// resumen siempre reflejen los datos embebidos actuales.
// ---------------------------------------------------------------------------
function homeStepItem(n, title, desc) {
    return `<li class="flex gap-4">
        <span class="w-9 h-9 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md text-headline-md">${n}</span>
        <div class="pt-1">
            <p class="font-label-bold text-label-bold text-on-surface">${esc(title)}</p>
            <p class="font-body-md text-body-md text-on-surface-variant mt-0.5">${desc}</p>
        </div>
    </li>`;
}

function homeSectionCard(icon, title, desc, ctaLabel, ctaView) {
    return card(`
        ${cardHeader(icon, title)}
        <p class="font-body-md text-body-md text-on-surface-variant mb-4">${desc}</p>
        <button onclick="showView('${ctaView}')" class="font-label-bold text-label-bold text-primary hover:underline inline-flex items-center gap-1">
            ${esc(ctaLabel)} <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
    `);
}

function renderInicioView() {
    const view = $('#inicio-view');

    const nLocActual = TPBV_DATA.length;
    const nPolActual = new Set(TPBV_DATA.map((r) => r.poligono)).size;
    // pobTotal ?? pobTotLista: mismo respaldo que aggregateRecords (ver su
    // comentario) para que el total de Inicio coincida con el de "Todos los
    // Poligonos" en Analisis Demografico -- sin esto, las localidades SIN
    // DATOS restaban su poblacion del total aqui pero no alla.
    const pobActual = TPBV_DATA.reduce((s, r) => s + (r.pobTotal ?? r.pobTotLista ?? 0), 0);
    const nPolNueva = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? TPBV_PROPUESTA_NUEVA.features.length : 0;
    const nLocNueva = (typeof TPBV_DATA_PROPUESTA_2026 !== 'undefined') ? TPBV_DATA_PROPUESTA_2026.length : 0;
    const pobNueva = (typeof TPBV_DATA_PROPUESTA_2026 !== 'undefined')
        ? TPBV_DATA_PROPUESTA_2026.reduce((s, r) => s + (r.pobTotal ?? r.pobTotLista ?? 0), 0)
        : 0;
    // La Nueva Propuesta Territorial ya esta curada para representar solo
    // cobertura NUEVA (Tlaquiltenango se excluyo justamente por duplicar
    // poligonos de la Propuesta Actual, ver build_propuesta_nueva.py), asi
    // que sumar ambos datasets da la cobertura total combinada real.
    const crecimientoLoc = nLocActual ? (nLocNueva / nLocActual * 100) : 0;
    const crecimientoPob = pobActual ? (pobNueva / pobActual * 100) : 0;

    const impactoHtml = !HAY_NUEVA_PROPUESTA ? '' : `
    <div class="rounded-3xl p-6 bg-secondary-container/50 border border-outline-variant flex flex-col md:flex-row items-center gap-5">
        <span class="shrink-0 w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-3xl">trending_up</span>
        </span>
        <div class="flex-1 text-center md:text-left">
            <p class="font-label-bold text-label-bold text-primary uppercase tracking-wider">Impacto de la ampliación territorial</p>
            <p class="font-headline-sm text-headline-sm text-on-surface mt-1 leading-snug">
                Con la Nueva Propuesta Territorial, la cobertura del programa pasaría de <b>${fmtInt(nLocActual)}</b> a
                <b>${fmtInt(nLocActual + nLocNueva)}</b> localidades
                (<span class="text-primary font-bold">+${crecimientoLoc.toFixed(0)}%</span>) y de
                <b>${fmtInt(pobActual)}</b> a <b>${fmtInt(pobActual + pobNueva)}</b> habitantes atendidos
                (<span class="text-primary font-bold">+${crecimientoPob.toFixed(0)}%</span>).
            </p>
        </div>
    </div>`;
    const kpisNuevaHtml = !HAY_NUEVA_PROPUESTA ? '' : `
        ${sectionLabel('Nueva Propuesta Territorial', 'layers', 'teal')}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-gutter-grid">
            ${kpiCount('groups', 'Localidades', nLocNueva, 'primary')}
            ${kpiCount('layers', 'Polígonos', nPolNueva, 'blue')}
            ${kpiCount('groups', 'Población', pobNueva, 'warning')}
        </div>`;
    const tituloActual = `${HAY_NUEVA_PROPUESTA ? 'Propuesta Actual' : 'Localidades'} (${fmtInt(nLocActual)})`;
    const textoAnalisis = HAY_NUEVA_PROPUESTA
        ? `Indicadores de población, vivienda, tecnologías de la información, salud, educación y economía por localidad o por polígono completo. Alterna entre la <b>Propuesta Actual</b> (${fmtInt(nLocActual)} localidades) y la <b>Nueva Propuesta Territorial</b> (${fmtInt(nLocNueva)} localidades) con un solo clic.`
        : `Indicadores de población, vivienda, tecnologías de la información, salud, educación y economía de las <b>${fmtInt(nLocActual)} localidades</b> de los ${fmtInt(nPolActual)} polígonos vigentes, por localidad o por polígono completo.`;
    const pasos = HAY_NUEVA_PROPUESTA ? [
        ['Elige el conjunto de datos', 'En Análisis Demográfico, usa el interruptor "Propuesta Actual / Nueva Propuesta Territorial" para decidir qué delimitación quieres explorar.'],
        ['Filtra por polígono o localidad', 'Usa los selectores de la parte superior, o entra directo a un polígono desde el mapa o la lista de localidades.'],
        ['Explora los indicadores', 'Revisa las tarjetas de población, vivienda, salud, educación, economía y la pirámide poblacional, además del mapa de ubicación.'],
        ['Compara ambas propuestas', 'Ve a "Propuesta Territorial" para ver la delimitación actual y la nueva superpuestas, con las localidades que se incorporarían.'],
        ['Genera tu reporte', 'Usa el botón "Reporte Institucional" para exportar un documento formal en PDF de lo que estés viendo.']
    ] : [
        ['Filtra por polígono o localidad', 'En Análisis Demográfico, usa los selectores de la parte superior, o entra directo a un polígono desde el mapa o la lista de localidades.'],
        ['Explora los indicadores', 'Revisa las tarjetas de población, vivienda, salud, educación, economía y la pirámide poblacional, además del mapa de ubicación.'],
        HAY_BANCO_PROYECTOS
            ? ['Consulta proyectos y aulas', 'Revisa el Banco de Proyectos por municipio y localidad, y el mapa de Aulas Tecnológicas instaladas en los polígonos.']
            : ['Consulta las aulas', 'Revisa el mapa de Aulas Tecnológicas instaladas en las escuelas de los polígonos.'],
        ['Descarga los datos', 'En Datos Abiertos encontrarás las bases de datos del tablero en CSV y KML.'],
        ['Genera tu reporte', 'Usa el botón "Reporte Institucional" para exportar un documento formal en PDF de lo que estés viendo.']
    ];

    // Landing: presentacion, cita, como funciona, cifras e hitos viven en
    // inicio_contexto.js (textos de los boletines oficiales).
    view.innerHTML = `
    ${inicioHeroHtml()}

    ${inicioCitaHtml()}

    ${inicioComoFuncionaHtml()}

    ${inicioCifrasHtml(nLocActual, nPolActual, pobActual)}

    ${impactoHtml}
    ${HAY_NUEVA_PROPUESTA ? `<div class="grid grid-cols-1 gap-gutter-grid">${kpisNuevaHtml}</div>` : ''}

    ${inicioHitosHtml(nLocActual, nPolActual)}

    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">Grados de marginación</h2>
        <div class="grid grid-cols-1 ${HAY_NUEVA_PROPUESTA ? 'md:grid-cols-2' : ''} gap-gutter-grid mt-3">
            ${card(`<h3 class="font-headline-md text-headline-md text-on-surface mb-4">${tituloActual}</h3>${marginacionBarsHtml(TPBV_DATA, { agrupar: true })}`)}
            ${HAY_NUEVA_PROPUESTA ? card(`<h3 class="font-headline-md text-headline-md text-on-surface mb-4">Nueva Propuesta Territorial</h3>${marginacionBarsHtml(TPBV_DATA_PROPUESTA_2026, { agrupar: true })}`) : ''}
        </div>
    </div>

    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">¿Qué encontrarás en este tablero?</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-grid mt-3">
            ${homeSectionCard('analytics', 'Análisis Demográfico', textoAnalisis, 'Ir a Análisis Demográfico', 'analisis')}
            ${HAY_NUEVA_PROPUESTA ? homeSectionCard('layers', 'Propuesta Territorial',
                `Compara la delimitación vigente de los polígonos TPBV contra la nueva propuesta de ampliación: polígonos, límites municipales y localidades nuevas, todo superponible en un mismo mapa interactivo.`,
                'Ir a Propuesta Territorial', 'propuesta') : ''}
            ${!HAY_BANCO_PROYECTOS ? '' : homeSectionCard('inventory_2', 'Banco de Proyectos',
                `Consulta los ${fmtInt(typeof TPBV_BANCO_PROYECTOS !== 'undefined' ? TPBV_BANCO_PROYECTOS.length : 0)} proyectos y obras del Banco de Proyectos PP TPBV: filtra por municipio y localidad para ver descripción, categoría, estatus y prioridad de cada uno.`,
                'Ir al Banco de Proyectos', 'banco')}
            ${homeSectionCard('computer', 'Aulas Tecnológicas',
                `Mapa de las ${fmtInt(typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined' ? TPBV_AULAS_TECNOLOGICAS.length : 0)} escuelas donde ATDEM instaló aulas de cómputo en los polígonos TPBV: computadoras, nivel educativo y ubicación de cada una.`,
                'Ir a Aulas Tecnológicas', 'aulas')}
            ${typeof TPBV_RED_LTQNU === 'undefined' ? '' : homeSectionCard('wifi', 'Red La tierra que nos une',
                `Mapa de las dependencias estatales que ya cuentan con la red Wi-Fi pública y gratuita de la ATDEM: sedes, secretarías y puntos de acceso.`,
                'Ir a Red La tierra que nos une', 'red')}
            ${typeof TPBV_TELECOM === 'undefined' ? '' : homeSectionCard('cell_tower', 'Infraestructura de Telecomunicaciones',
                `Sitios y torres de la red estatal por municipio y sector (gobierno, educación, salud y seguridad). Por seguridad se muestran solo de forma agregada.`,
                'Ir a Telecomunicaciones', 'telecom')}
            ${homeSectionCard('database', 'Datos Abiertos',
                `Descarga en CSV y KML las bases de datos del tablero: localidades y polígonos${HAY_NUEVA_PROPUESTA ? ' de ambas propuestas' : ' vigentes'},${HAY_BANCO_PROYECTOS ? ' Banco de Proyectos,' : ''} Aulas Tecnológicas y límites municipales.`,
                'Ir a Datos Abiertos', 'datos')}
            ${homeSectionCard('description', 'Reportes Institucionales',
                `Genera, para la localidad o el polígono que estés viendo, un documento formal con portada y todas las tablas de indicadores, listo para imprimir o exportar a PDF.`,
                'Ir a generar un reporte', 'analisis')}
        </div>
    </div>

    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">Cómo empezar</h2>
        ${card(`
            <ol class="space-y-5">
                ${pasos.map(([titulo, texto], i) => homeStepItem(i + 1, titulo, texto)).join('')}
            </ol>
        `, 'mt-3')}
    </div>`;
    animateEntrances(view);
}

// Dibuja un circleMarker por localidad (con popup + link "Ver detalle") en
// markersLayer, usado tanto en el modo overview (una localidad activa
// resaltada, ver activeRec) como en el filtro personalizado (activeRec null,
// ninguna localidad resaltada sobre las demas). Comparte la logica de estilo
// para que ambos modos se vean consistentes en el mapa.
// Ficha de una localidad en el mapa (mismo estilo .atd-popup que Aulas).
function localidadPopupHtml(r, conEnlace) {
    const nota = r.coordManual ? '<div class="dato"><span class="material-symbols-outlined">edit_location_alt</span><span>Coordenada capturada manualmente</span></div>' : '';
    const enlace = conEnlace
        ? `<a class="cta" href="#" onclick="selectLocalidad(${r.idx}); return false;">Ver detalle <span class="material-symbols-outlined" style="font-size:16px">arrow_forward</span></a>` : '';
    return `<div class="cab"><div class="nom">${esc(r.localidad)}</div><div class="sub">${esc(r.municipio)}, Morelos</div></div>
        <div class="cuerpo">
            <div class="dato"><span class="material-symbols-outlined">map</span><span>Polígono ${esc(r.poligono)} · ${esc(poligonoLabel(r.poligono))}</span></div>
            ${r.gmMarginacion ? `<div class="dato"><span class="material-symbols-outlined">signal_cellular_alt</span><span>Marginación: ${esc(r.gmMarginacion)}</span></div>` : ''}
            ${nota}${enlace}
        </div>`;
}

const LOCALIDAD_MARCADOR = { radius: 6, color: '#ffffff', weight: 1.5, fillColor: '#773357', fillOpacity: 0.9 };
const LOCALIDAD_MARCADOR_ACTIVO = { radius: 10, color: '#BC9B73', weight: 3.5, fillColor: '#773357', fillOpacity: 1 };
// Vista de todo el estado: punto mas chico para que las 100+ localidades no
// se encimen a escala estatal.
const LOCALIDAD_MARCADOR_ESTADO = { radius: 3.6, color: '#ffffff', weight: 1, fillColor: '#773357', fillOpacity: 0.95 };

// Dibuja un circleMarker por localidad (con ficha + "Ver detalle") en
// markersLayer, usado tanto en el modo overview (una localidad activa
// resaltada, ver activeRec) como en el filtro personalizado (activeRec null).
function drawLocalidadMarkers(records, activeRec, boundsOut, estiloBase = LOCALIDAD_MARCADOR) {
    const data = activeData();
    markersLayer = L.featureGroup().addTo(map);
    records.forEach((r) => {
        const isActive = !!activeRec && r.idx === data.indexOf(activeRec);
        const estilo = isActive ? LOCALIDAD_MARCADOR_ACTIVO : estiloBase;
        const m = L.circleMarker([r.latitud, r.longitud], estilo).addTo(markersLayer);
        m.bindPopup(localidadPopupHtml(r, true), { className: 'atd-popup', maxWidth: 300 });
        m.bindTooltip(esc(r.localidad), { direction: 'top', offset: [0, -estilo.radius], className: 'atd-tooltip' });
        if (!isActive) {
            m.on('mouseover', () => m.setStyle({ color: '#BC9B73', weight: 3, radius: estiloBase.radius + 2.5 }));
            m.on('mouseout', () => m.setStyle(estiloBase));
        }
        boundsOut.push(L.latLngBounds([[r.latitud, r.longitud]]));
    });
}

function renderMap(rec, mapMode) {
    lastMapRec = rec;
    const container = $('#map-container');
    const feature = findPoligonoFeature(rec.poligono);
    const hasPoint = rec.latitud !== null && rec.longitud !== null;
    const showAll = selPoligono.value === 'all';
    const overview = mapMode === 'overview' && !showAll;

    // En modo overview (agregado de poligono/municipio) siempre hay algo que
    // intentar dibujar -- las localidades hermanas con coordenadas -- aunque
    // el agregado en si no tenga feature/hasPoint propios (los datasets sin
    // geometria de poligono, ver activePoligonosGeoJSON, nunca tienen
    // feature). El mensaje de "sin datos" solo aplica a una localidad
    // individual sin poligono y sin coordenada.
    if (!overview && !rec.customPoligonos && !feature && !hasPoint && !showAll) {
        container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-on-surface-variant flex-col gap-2">
            <span class="material-symbols-outlined text-4xl opacity-50">location_off</span>
            <span class="font-body-md text-center px-4">No hay datos geográficos disponibles para esta localidad</span>
        </div>`;
        map = null;
        return;
    }

    if (!$('#map')) {
        container.innerHTML = '<div id="map"></div>';
        map = null;
    }
    // Mapa "solo Morelos" (crearMapaMorelos/agregarBaseMorelos en
    // mapa_morelos.js): sin mosaicos, municipios siempre visibles. El
    // contenedor se recrea en cada render, asi que la base va con el mapa.
    if (!map) {
        map = crearMapaMorelos('map');
        mapaBaseMorelos = agregarBaseMorelos(map);
    }

    if (marker) { marker.remove(); marker = null; }
    if (polygonLayer) { polygonLayer.remove(); polygonLayer = null; }
    if (markersLayer) { markersLayer.remove(); markersLayer = null; }

    // Todos los poligonos TPBV siempre encendidos; los de la seleccion actual
    // (poligono de la localidad/agregado o los del filtro personalizado) van
    // resaltados. polygonLayer se reutiliza para encuadrar la seleccion.
    const seleccion = rec.customPoligonos
        ? rec.customPoligonos.map(Number)
        : (rec.poligono !== null && rec.poligono !== undefined && !showAll ? [Number(rec.poligono)] : []);
    const fcTodos = activePoligonosGeoJSON();
    if (fcTodos) {
        polygonLayer = L.geoJSON(fcTodos, {
            style: (f) => (seleccion.includes(Number(f.properties.Pol)) ? POLIGONO_SELECCIONADO : POLIGONO_TPBV),
            onEachFeature: (f, layer) => {
                layer.bindTooltip(`Polígono ${esc(f.properties.Pol)} — ${esc(poligonoLabel(f.properties.Pol))}`, { sticky: true, className: 'atd-tooltip' });
                if (seleccion.includes(Number(f.properties.Pol))) return;
                layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.55 }));
                layer.on('mouseout', () => layer.setStyle(POLIGONO_TPBV));
            }
        }).addTo(map);
    }
    const capasSeleccion = polygonLayer
        ? polygonLayer.getLayers().filter((l) => seleccion.includes(Number(l.feature.properties.Pol))) : [];
    capasSeleccion.forEach((l) => l.bringToFront());
    const boundsSeleccion = capasSeleccion.length ? L.featureGroup(capasSeleccion).getBounds() : null;

    const bounds = [];

    if (rec.customPoligonos) {
        // Filtro personalizado (ver aggregateCustom): poligonos elegidos
        // resaltados + las localidades de todos ellos, sin "localidad activa".
        if (boundsSeleccion) bounds.push(boundsSeleccion);
        const hermanas = indexedActiveData()
            .filter((r) => rec.customPoligonos.includes(r.poligono) && r.latitud !== null && r.longitud !== null);
        drawLocalidadMarkers(hermanas, null, bounds);
    } else if (overview) {
        // Poligono/grupo seleccionado con TODAS sus localidades marcadas.
        if (boundsSeleccion) bounds.push(boundsSeleccion);
        const hermanas = indexedActiveData()
            .filter((r) => r.poligono === rec.poligono && r.latitud !== null && r.longitud !== null);
        drawLocalidadMarkers(hermanas, rec, bounds);
    } else if (showAll) {
        // "Todos los Poligonos": todo el estado con todas las localidades
        // (el encuadre es el contorno de Morelos, ver abajo).
        const todas = indexedActiveData().filter((r) => r.latitud !== null && r.longitud !== null);
        drawLocalidadMarkers(todas, null, [], LOCALIDAD_MARCADOR_ESTADO);
    } else if (boundsSeleccion && !hasPoint) {
        bounds.push(boundsSeleccion);
    }

    if (hasPoint && !overview) {
        // Localidad elegida: sus vecinas del mismo poligono en pequeno y ella
        // resaltada con su ficha abierta.
        const data = activeData();
        const vecinas = indexedActiveData()
            .filter((r) => r.poligono === rec.poligono && r.latitud !== null && r.longitud !== null);
        drawLocalidadMarkers(vecinas, rec, []);
        const recIdx = data.indexOf(rec);
        marker = markersLayer.getLayers().find((m) => {
            const ll = m.getLatLng();
            return ll.lat === rec.latitud && ll.lng === rec.longitud;
        }) || L.circleMarker([rec.latitud, rec.longitud], LOCALIDAD_MARCADOR_ACTIVO).addTo(markersLayer);
        marker.bindPopup(localidadPopupHtml({ ...rec, idx: recIdx }, false), { className: 'atd-popup', maxWidth: 300 });
        marker.bringToFront();
        bounds.push(L.latLngBounds([[rec.latitud, rec.longitud]]));
    }

    // invalidateSize primero: el contenedor #map recien insertado puede no
    // tener aun sus dimensiones finales de layout (flex) en este mismo tick,
    // lo que hace que fitBounds calcule un zoom incorrecto si se llama antes.
    const encuadrar = () => {
        if (bounds.length) {
            let combined = bounds[0];
            bounds.slice(1).forEach((b) => { combined = combined.extend(b); });
            map.fitBounds(combined, { padding: [28, 28], maxZoom: hasPoint && !overview ? 12 : 13 });
        } else if (mapaBaseMorelos && mapaBaseMorelos.contorno) {
            // "Todos los Poligonos" (o nada que encuadrar): todo el estado.
            map.fitBounds(mapaBaseMorelos.contorno.getBounds(), { padding: [20, 20] });
        } else {
            map.setView([18.75, -99.15], 9);
        }
        if (marker && hasPoint && !overview) marker.openPopup();
    };
    setTimeout(() => {
        if (!map) return;
        map.invalidateSize();
        // Si #canvas esta oculto (carga inicial detras de Inicio) el mapa
        // mide 0x0 y fitBounds daria el zoom maximo: el encuadre queda
        // pendiente y lo aplica showView('analisis') al mostrarse.
        // La vista provisional "carga" el mapa: Leaflet ignora
        // invalidateSize() en un mapa sin vista y se quedaria con 0x0.
        if (map.getSize().x === 0) {
            map.setView([18.75, -99.15], 9);
            map._encuadrePendiente = encuadrar;
        } else {
            map._encuadrePendiente = null;
            encuadrar();
        }
    }, 150);
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------
function render(idx, mapMode) {
    const rec = activeData()[idx];

    if (rec.fuente === 'SIN DATOS') {
        canvas.innerHTML = `<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">` +
            `<div class="flex flex-col gap-gutter-grid">` + renderInfoCard(rec) + renderLocalidadesCard(rec) + `</div>` +
            `<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
                ${mapCardHeader()}
                <div class="relative w-full overflow-hidden" id="map-container" style="aspect-ratio:1/0.9;min-height:320px;max-height:calc(100vh - var(--header-h, 180px) - 8rem);border-radius:16px;border:1px solid #CBCABE"></div>
            </div>` +
            `</div>` +
            `<div class="col-span-1 md:col-span-2 xl:col-span-12">` + card(`
            ${cardHeader('report', 'Sin Datos Censales Disponibles', 'border-error')}
            <p class="font-body-md text-body-md text-on-surface-variant">
                No se encontró una coincidencia confiable para <b>${esc(rec.localidad)}</b> en el Censo INEGI 2020 (ITER Morelos).
                Esto ocurre principalmente con colonias/barrios urbanos que no se registran como localidad censal independiente.
                ${rec.latitud !== null
                    ? 'El mapa muestra su ubicación (coordenada capturada manualmente) dentro de ' + esc(rec.nombrePoligono || `polígono ${rec.poligono}`) + '.'
                    : 'El mapa muestra ' + esc(rec.nombrePoligono || `el polígono ${rec.poligono}`) + ' al que pertenece, pero no la ubicación exacta de la localidad.'}
            </p>
            <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Población reportada (Lista TPBV 2026)</span>
            <span class="font-data-display text-data-display text-on-surface">${fmtInt(rec.pobTotLista)}</span></div>
        `) + `</div>`;
        renderMap(rec, mapMode);
        return;
    }

    const parts = [];

    parts.push(renderKpiStrip(rec));

    // Fila de contexto: Info General + Localidades (apiladas) + Mapa (sticky)
    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">`);
    parts.push(`<div class="flex flex-col gap-gutter-grid">` + renderInfoCard(rec) + renderLocalidadesCard(rec) + `</div>`);
    parts.push(`<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
        ${mapCardHeader()}
        <div class="relative w-full overflow-hidden" id="map-container" style="aspect-ratio:1/0.9;min-height:320px;max-height:calc(100vh - var(--header-h, 180px) - 8rem);border-radius:16px;border:1px solid #CBCABE"></div>
    </div>`);
    parts.push(`</div>`);

    parts.push(renderDataCards(rec));

    canvas.innerHTML = parts.join('');
    renderMap(rec, mapMode);
    animateEntrances();
}

// Tarjetas de indicadores (Poblacion, Piramide, Vivienda, ...). Se usa tanto
// para una localidad individual como para el agregado de un poligono
// completo (renderAggregate) porque ambos son objetos con las mismas claves.
//
// Agrupadas en 4 clusters tematicos (Demografia / Vivienda / Salud /
// Educacion y Economia) en vez de una secuencia plana: las tarjetas que se
// leen juntas (p.ej. Vivienda + Bienes y Servicios en la Vivienda) quedan
// contiguas, y cada fila del grid de 2 columnas se llena por completo (sin
// huecos accidentales que dejaba el orden anterior al intercalar tarjetas
// de 1 y 2 columnas).
function renderDataCards(rec) {
    const parts = [];

    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-gutter-grid">`);

    // ---- Demografía --------------------------------------------------
    parts.push(sectionLabel('Demografía', 'groups', 'primary'));

    const pMuj = pct(rec.pobMujeres, rec.pobTotal) ?? 0;
    const pHom = pct(rec.pobHombres, rec.pobTotal) ?? 0;
    parts.push(card(`
        ${cardHeader('group', 'Población')}
        <div class="space-y-1">
        ${dataRow({ label: 'Población Total', value: rec.pobTotal, base: rec.pobTotal })}
        ${dataRow({ label: 'Mujeres', value: rec.pobMujeres, base: rec.pobTotal, colorStyle: 'color:var(--series-f)' })}
        ${dataRow({ label: 'Hombres', value: rec.pobHombres, base: rec.pobTotal, colorStyle: 'color:var(--series-m)' })}
        <div class="pt-2">
            <div class="flex h-4 rounded-full overflow-hidden w-full bg-surface-container-high">
                <div style="width:${pMuj.toFixed(1)}%; background:var(--series-f)"></div>
                <div style="width:${pHom.toFixed(1)}%; background:var(--series-m)"></div>
            </div>
            <div class="flex justify-between mt-1 px-1">
                <span class="font-label-bold text-label-bold" style="color:var(--series-f)">Mujeres</span>
                <span class="font-label-bold text-label-bold" style="color:var(--series-m)">Hombres</span>
            </div>
        </div>
        </div>`));

    parts.push(card(`
        ${cardHeader('diversity_1', 'Población Indígena y Afromexicana')}
        <div class="space-y-1">
        ${dataRow({ label: 'Habla Lengua Indígena', value: rec.hablaLenguaIndigena, base: rec.pobTotal })}
        ${dataRow({ label: 'Monolingüe (no habla español)', value: rec.indigenaMonolingue, base: rec.hablaLenguaIndigena, colorClass: 'text-warning', indent: true })}
        ${dataRow({ label: 'Hogares Censales Indígenas', value: rec.hogaresIndigenas })}
        ${dataRow({ label: 'Pob. Afromexicana', value: rec.afromexicana })}
        </div>`));

    // Piramide poblacional (a todo lo ancho por la cantidad de filas/etiquetas)
    parts.push(card(`
        ${cardHeader('bar_chart', 'Estructura de Población por Edad y Sexo')}
        ${renderPyramid(rec)}
        `, 'md:col-span-2'));

    // ---- Vivienda y Servicios -----------------------------------------
    parts.push(sectionLabel('Vivienda y Servicios', 'home_work', 'blue'));

    parts.push(card(`
        ${cardHeader('home', 'Vivienda')}
        <div class="space-y-1">
        ${dataRow({ label: 'Total Viviendas', value: rec.totalViviendas, base: rec.totalViviendas })}
        ${dataRow({ label: 'Piso de Tierra', value: rec.pisoTierra, base: rec.totalViviendas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Un Solo Cuarto', value: rec.unSoloCuarto, base: rec.totalViviendas, colorClass: 'text-warning', bar: true, barColor: 'bg-warning' })}
        ${dataRow({ label: 'Con Hacinamiento', value: rec.hacinamiento, base: rec.totalViviendas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('devices', 'Tecnologías de Información (TIC)')}
        <div class="space-y-1">
        ${dataRow({ label: 'Con Celular', value: rec.celular, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Computadora', value: rec.computadora, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Internet', value: rec.internet, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('kitchen', 'Bienes y Servicios en la Vivienda')}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-gutter-grid gap-y-1">
        ${dataRow({ label: 'Refrigerador', value: rec.refrigerador, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Lavadora', value: rec.lavadora, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Automóvil', value: rec.automovil, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Agua Entubada', value: rec.aguaEntubada, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Drenaje', value: rec.drenaje, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Energía Eléctrica', value: rec.electricidad, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`, 'md:col-span-2'));

    // ---- Salud y Bienestar ----------------------------------------------
    parts.push(sectionLabel('Salud y Bienestar', 'health_and_safety', 'teal'));

    parts.push(card(`
        ${cardHeader('local_hospital', 'Servicios de Salud')}
        <div class="space-y-1">
        ${dataRow({ label: 'Total Afiliados', value: rec.afiliada, base: rec.pobTotal, colorClass: 'text-primary', bar: true, barColor: 'bg-primary' })}
        ${dataRow({ label: 'Sin Afiliación', value: rec.sinAfiliacion, base: rec.pobTotal, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Afiliados al IMSS', value: rec.imss, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Afiliados al ISSSTE', value: rec.issste, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Otros Servicios de Salud', value: rec.otrosSalud, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('diversity_3', 'Discapacidad y Condiciones de Salud')}
        <div class="space-y-1">
        ${dataRow({ label: 'Con Discapacidad', value: rec.conDiscapacidad, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Limitación', value: rec.conLimitacion, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Problema o Condición Mental', value: rec.conProblemaMental, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    // ---- Educación y Economía -------------------------------------------
    parts.push(sectionLabel('Educación y Economía', 'school', 'warning'));

    // Base de poblacion 15+ (pobTotal menos 0-14) para los indicadores de
    // Educacion que se definen sobre esa poblacion (analfabetismo, rezago
    // educativo); si falta pob0a14 se omite el % en vez de usar pobTotal,
    // que sobrestimaria el denominador.
    const base15Mas = (rec.pobTotal !== null && rec.pob0a14 !== null && rec.pobTotal !== undefined && rec.pob0a14 !== undefined)
        ? rec.pobTotal - rec.pob0a14
        : null;

    parts.push(card(`
        ${cardHeader('school', 'Educación')}
        <div class="space-y-1">
        ${dataRow({ label: 'Grado Promedio de Escolaridad', value: rec.gradoEscolaridad, suffix: ' años', colorClass: 'text-primary' })}
        ${dataRow({ label: 'Analfabetas (15+)', value: rec.analfabetas, base: base15Mas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Sin Educación Básica Completa (15+)', value: rec.sinBasicaCompleta, base: base15Mas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Niñas/os 6-11 años sin asistir a la escuela', value: rec.ninos6a11NoAsisten, colorClass: 'text-error', indent: true })}
        ${dataRow({ label: 'Adolescentes 12-14 años sin asistir a la escuela', value: rec.ninos12a14NoAsisten, colorClass: 'text-error', indent: true })}
        </div>`));

    parts.push(card(`
        ${cardHeader('work', 'Economía')}
        <div class="space-y-1">
        ${dataRow({ label: 'Económicamente Activa (PEA)', value: rec.pea, base: rec.pobTotal, colorClass: 'text-primary', bar: true, barColor: 'bg-primary' })}
        ${dataRow({ label: 'Ocupada', value: rec.ocupada, base: rec.pea, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Desocupada', value: rec.desocupada, base: rec.pea, colorClass: 'text-error', indent: true, bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Ocupada en Sector Primario', value: rec.ocupadaPrimario, base: rec.ocupada, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(`</div>`);
    return parts.join('');
}

function renderInfoCard(rec) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-primary">
        ${cardHeader('info', 'Información General')}
        <div class="space-y-1">
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Municipio</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.municipio)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Región</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.region || '—')}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígono</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.nombrePoligono || rec.poligono)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Grado de Marginación</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.gmMarginacion || '—')}</span></div>
        </div>
    </div>`;
}

function renderLocalidadesCard(rec) {
    // rec.customPoligonos (filtro personalizado, ver aggregateCustom) o
    // rec.poligono === null sin customPoligonos ("Todos los Poligonos", ver
    // aggregateTodos): en ambos casos se listan varias localidades de mas de
    // un poligono, agrupadas visualmente por municipio (mas facil de escanear
    // que muchos nombres sueltos en orden alfabetico plano).
    const esCustom = !!rec.customPoligonos;
    const esTodos = !esCustom && rec.poligono === null;
    const agrupar = esCustom || esTodos;
    const hermanos = indexedActiveData()
        .filter((r) => inAggScope(r, rec))
        .sort((a, b) => agrupar
            ? (a.municipio + a.localidad).localeCompare(b.municipio + b.localidad, 'es')
            : a.localidad.localeCompare(b.localidad, 'es'));

    const listItems = hermanos.map((r) => {
        const isActive = r.localidad === rec.localidad && r.municipio === rec.municipio;
        const etiqueta = agrupar ? `${esc(r.localidad)} <span class="text-on-surface-variant">— ${esc(r.municipio)}</span>` : esc(r.localidad);
        return `<li class="loc-item px-3 py-2.5 rounded-lg font-body-md text-body-md transition-colors ${isActive ? 'active' : 'text-on-surface-variant hover:bg-surface-container-low'}" data-idx="${r.idx}" role="button" tabindex="0" aria-current="${isActive ? 'true' : 'false'}">${etiqueta}</li>`;
    }).join('');

    const titulo = esCustom ? 'Localidades Seleccionadas' : esTodos ? 'Todas las Localidades' : 'Localidades en este Polígono';
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col">
        <div class="flex items-center gap-2 mb-stack-md pb-2 border-b-2 border-secondary-container">
            <span class="material-symbols-outlined text-secondary">location_city</span>
            <h2 class="font-headline-md text-headline-md text-on-surface">${titulo}</h2>
            <span class="ml-auto font-label-bold text-label-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full">${hermanos.length}</span>
        </div>
        <ul class="space-y-1 max-h-[420px] overflow-y-auto pr-1">${listItems}</ul>
    </div>`;
}

// ---------------------------------------------------------------------------
// Agregado por poligono: suma los indicadores de todas sus localidades para
// dar un analisis conjunto, en vez de mostrar solo la primera localidad.
// ---------------------------------------------------------------------------
const AGG_SUM_FIELDS = [
    'pobMujeres', 'pobHombres', 'analfabetas', 'pea', 'desocupada', 'ocupada',
    'afromexicana', 'conDiscapacidad', 'conLimitacion', 'conProblemaMental', 'afiliada', 'sinAfiliacion',
    'imss', 'issste', 'otrosSalud', 'totalViviendas', 'pisoTierra', 'unSoloCuarto', 'aguaEntubada', 'drenaje',
    'electricidad', 'refrigerador', 'lavadora', 'automovil', 'computadora', 'internet', 'celular',
    'hablaLenguaIndigena', 'indigenaMonolingue', 'hogaresIndigenas', 'ninos6a11NoAsisten', 'ninos12a14NoAsisten',
    'pob0a14', 'pob15a64', 'pob65mas', 'sinBasicaCompleta', 'ocupadaPrimario', 'hacinamiento'
];

// Suma/promedia los campos de AGG_SUM_FIELDS sobre una lista de registros ya
// filtrada; el llamador solo aporta los metadatos especificos del grupo
// (municipio, poligono, nombre, etc. -- ver aggregatePoligono/aggregateTodos).
function aggregateRecords(todas, meta) {
    const conDatos = todas.filter((r) => r.fuente !== 'SIN DATOS');

    const agg = {};
    AGG_SUM_FIELDS.forEach((f) => {
        const vals = conDatos.map((r) => r[f]).filter((v) => v !== null && v !== undefined);
        agg[f] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    });

    // Poblacion Total: a diferencia del resto de AGG_SUM_FIELDS, se suma
    // sobre TODAS las localidades (no solo conDatos), usando pobTotLista
    // (poblacion reportada en la Lista TPBV 2026) como respaldo cuando una
    // localidad no tiene coincidencia censal. Sin esto, el total de un
    // poligono/seleccion "desaparecia" silenciosamente la poblacion de sus
    // localidades SIN DATOS -- p.ej. Puente de Ixtla Oriente+Poniente suman
    // 3,352 habitantes segun la Lista TPBV 2026, pero solo 1,351 tenian
    // coincidencia censal; el resto de los indicadores (vivienda, salud...)
    // siguen sin poder calcularse para esas localidades, asi que esos SI
    // siguen sumando solo sobre conDatos.
    agg.pobTotal = todas.reduce((s, r) => s + (r.pobTotal ?? r.pobTotLista ?? 0), 0) || null;

    // Grado de escolaridad: promedio ponderado por poblacion (no se puede sumar)
    const escVals = conDatos.filter((r) => r.gradoEscolaridad !== null && r.pobTotal);
    agg.gradoEscolaridad = escVals.length
        ? Math.round(escVals.reduce((s, r) => s + r.gradoEscolaridad * r.pobTotal, 0) / escVals.reduce((s, r) => s + r.pobTotal, 0) * 10) / 10
        : null;

    // Piramide: suma bin a bin
    const conPiramide = conDatos.filter((r) => r.piramide);
    agg.piramide = conPiramide.length
        ? conPiramide[0].piramide.map((bin, i) => ({
            label: bin.label,
            f: conPiramide.reduce((s, r) => s + (r.piramide[i].f || 0), 0),
            m: conPiramide.reduce((s, r) => s + (r.piramide[i].m || 0), 0),
        }))
        : null;

    agg.pobTotLista = todas.reduce((s, r) => s + (r.pobTotLista || 0), 0);
    agg.latitud = null;
    agg.longitud = null;
    agg.fuente = 'AGREGADO';
    agg.nLocalidades = todas.length;
    agg.nConDatos = conDatos.length;
    agg.nSinDatos = todas.length - conDatos.length;
    agg.gmMarginacion = null;
    Object.assign(agg, meta);
    return agg;
}

function aggregatePoligono(polNum) {
    const todas = indexedActiveData().filter((r) => r.poligono === polNum);
    const nombrePoligono = todas.length ? todas[0].nombrePoligono : null;
    return aggregateRecords(todas, {
        region: todas.length ? todas[0].region : null,
        municipio: todas.length ? todas[0].municipio : null,
        poligono: polNum,
        nombrePoligono,
        localidad: `${nombrePoligono || `Polígono ${polNum}`} — todas las localidades`,
    });
}

// Totales generales: suma TODAS las localidades del dataset activo, sin
// filtrar por poligono (rec.poligono queda en null -- ver renderMap,
// renderLocalidadesCard y renderAggregateInfoCard, que ya saben tratar null
// como "sin filtro" en vez de "sin poligono valido").
function aggregateTodos() {
    const todas = indexedActiveData();
    const nPoligonos = new Set(todas.map((r) => r.poligono)).size;
    const nMunicipios = new Set(todas.map((r) => r.municipio)).size;
    return aggregateRecords(todas, {
        region: null,
        municipio: `${nMunicipios} municipios`,
        poligono: null,
        nombrePoligono: 'Todos los Polígonos',
        localidad: 'Todos los Polígonos — Vista General',
        nPoligonos,
    });
}

// Filtro personalizado (#custom-poligonos-panel): agrega solo los poligonos
// elegidos por el usuario, en vez de uno solo (aggregatePoligono) o todos
// (aggregateTodos). agg.poligono se deja en null (igual que aggregateTodos,
// "sin un unico poligono") y se agrega agg.customPoligonos con la lista
// elegida -- ver inAggScope, que es el que realmente decide que localidades
// entran en el agregado en los tres casos.
function aggregateCustom(polNums) {
    const set = new Set(polNums);
    const todas = indexedActiveData().filter((r) => set.has(r.poligono));
    const regiones = [...new Set(todas.map((r) => r.region).filter(Boolean))];
    const municipios = new Set(todas.map((r) => r.municipio));
    return aggregateRecords(todas, {
        region: regiones.length === 1 ? regiones[0] : regiones.length > 1 ? `${regiones.length} regiones` : null,
        municipio: `${municipios.size} municipio${municipios.size === 1 ? '' : 's'}`,
        poligono: null,
        customPoligonos: polNums,
        nombrePoligono: `Selección personalizada (${polNums.length} polígonos)`,
        localidad: `Selección personalizada — ${polNums.map((p) => poligonoLabel(p)).join(', ')}`,
        nPoligonos: polNums.length,
    });
}

// Decide si una localidad "pertenece" al agregado que se esta mostrando,
// para las tres variantes que puede tomar un agg (ver aggregatePoligono /
// aggregateTodos / aggregateCustom): un solo poligono, todo el dataset
// activo, o la seleccion personalizada del panel de checkboxes.
function inAggScope(r, agg) {
    if (agg.customPoligonos) return agg.customPoligonos.includes(r.poligono);
    if (agg.poligono === null) return true;
    return r.poligono === agg.poligono;
}

function renderAggregateInfoCard(agg) {
    const grados = activeData()
        .filter((r) => inAggScope(r, agg) && r.gmMarginacion)
        .reduce((acc, r) => { acc[r.gmMarginacion] = (acc[r.gmMarginacion] || 0) + 1; return acc; }, {});
    const gradosHtml = Object.entries(grados)
        .map(([g, n]) => `${esc(g)} (${n})`)
        .join(', ') || '—';
    const poligonosRow = agg.nPoligonos !== undefined
        ? `<div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígonos incluidos</span><span class="font-data-display text-data-display text-on-surface">${fmtInt(agg.nPoligonos)}</span></div>`
        : '';
    const poligonoRow = agg.customPoligonos
        ? `<div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígonos seleccionados</span><span class="font-data-display text-data-display text-on-surface text-right">${agg.customPoligonos.map((p) => esc(poligonoLabel(p))).join(', ')}</span></div>`
        : `<div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígono</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.nombrePoligono || agg.poligono)}</span></div>`;

    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-primary">
        ${cardHeader('info', 'Información General')}
        <div class="space-y-1">
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Municipio</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.municipio)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Región</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.region || '—')}</span></div>
        ${poligonoRow}
        ${poligonosRow}
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Localidades incluidas</span><span class="font-data-display text-data-display text-on-surface">${agg.nConDatos} de ${agg.nLocalidades}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Grados de Marginación</span><span class="font-data-display text-data-display text-on-surface text-right">${gradosHtml}</span></div>
        </div>
    </div>`;
}

// Cuerpo compartido por las tres formas de ver un agregado: un solo poligono,
// todos los poligonos (renderAggregate(null)) o la seleccion personalizada
// (renderCustomAggregate). Recibe el objeto agg ya armado (aggregatePoligono
// / aggregateTodos / aggregateCustom) para no repetir el markup del canvas.
function renderAggregateView(agg) {
    const parts = [];
    parts.push(renderKpiStrip(agg));
    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">`);
    parts.push(`<div class="flex flex-col gap-gutter-grid">` + renderAggregateInfoCard(agg) + renderLocalidadesCard(agg) + `</div>`);
    parts.push(`<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
        ${mapCardHeader()}
        <div class="relative w-full overflow-hidden" id="map-container" style="aspect-ratio:1/0.9;min-height:320px;max-height:calc(100vh - var(--header-h, 180px) - 8rem);border-radius:16px;border:1px solid #CBCABE"></div>
    </div>`);
    parts.push(`</div>`);

    if (agg.nSinDatos > 0) {
        parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12">` + card(`
            <div class="flex items-center gap-3 text-on-surface-variant">
                <span class="material-symbols-outlined text-2xl text-warning">info</span>
                <p class="font-body-md text-body-md">
                    <b>${agg.nSinDatos} de ${agg.nLocalidades}</b> localidades${agg.poligono === null && !agg.customPoligonos ? '' : ' de este polígono'} no tienen coincidencia en el Censo INEGI 2020
                    (suelen ser colonias/barrios dentro de una cabecera urbana). Su población sí está incluida en el total (vía la Lista TPBV 2026), pero
                    <b>vivienda, salud, educación y economía no</b> — esos indicadores solo suman las localidades con coincidencia censal. Revísalas en la lista de localidades.
                </p>
            </div>
        `) + `</div>`);
    }

    parts.push(renderDataCards(agg));

    canvas.innerHTML = parts.join('');
    renderMap(agg, 'overview');
    animateEntrances();
}

// polNum === null => totales generales de todo el dataset activo (ver
// aggregateTodos); se usa cuando "Filtrar por Poligono" esta en "Todos los
// Poligonos" y no hay una localidad especifica elegida.
function renderAggregate(polNum) {
    renderAggregateView(polNum === null ? aggregateTodos() : aggregatePoligono(polNum));
}

// Filtro personalizado (ver applyCustomPoligonosSelection): agrega y
// renderiza solo los poligonos marcados en #custom-poligonos-panel.
function renderCustomAggregate() {
    renderAggregateView(aggregateCustom([...customPoligonos].sort((a, b) => a - b)));
}

// ---------------------------------------------------------------------------
// Reporte institucional: documento formal (portada + secciones en tablas)
// para imprimir/exportar a PDF, separado del tablero interactivo. Se arma
// sobre lo que este visible en ese momento (localidad individual o agregado
// de poligono, via lastMapRec).
// ---------------------------------------------------------------------------
function reportRow(label, value, base, indent, formatter) {
    const v = formatter ? formatter(value) : fmtInt(value);
    const pctStr = base ? pctLabel(value, base) : '';
    return `<tr><td${indent ? ' class="indent"' : ''}>${esc(label)}</td><td class="num">${v}</td><td class="num">${esc(pctStr)}</td></tr>`;
}

function reportTable(rowsHtml) {
    return `<table class="report-table"><tbody>${rowsHtml}</tbody></table>`;
}

function reportFooter(fecha) {
    return `<div class="report-footer">
        <span>Fuente: INEGI, Censo de Población y Vivienda 2020 (ITER Morelos).</span>
        <span>Generado el ${esc(fecha)} — Dashboard TPBV 2026</span>
    </div>`;
}

function buildReportHTML(rec) {
    const isAgg = rec.fuente === 'AGREGADO';
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const titulo = isAgg ? `${rec.nombrePoligono || `Polígono ${rec.poligono}`} — Todas las localidades` : rec.localidad;

    let metaHtml = `
        <div>Localidad / Ámbito: <b>${esc(titulo)}</b></div>
        <div>Municipio: <b>${esc(rec.municipio)}</b></div>
        <div>Región: <b>${esc(rec.region || '—')}</b></div>
        <div>Polígono: <b>${esc(rec.nombrePoligono || rec.poligono)}</b></div>`;
    metaHtml += isAgg
        ? `<div>Localidades incluidas: <b>${rec.nConDatos} de ${rec.nLocalidades}</b></div>`
        : `<div>Grado de Marginación: <b>${esc(rec.gmMarginacion || '—')}</b></div>`;
    metaHtml += `<div>Fecha de generación: <b>${esc(fecha)}</b></div>`;

    let html = `<div class="report-page">
        <div class="report-cover">
            <div class="report-logos">
                <img class="report-logo-gob" src="assets/logo-gobierno-morelos-print.svg" alt="Gobierno del Estado de Morelos" />
                <img class="report-logo-tpbv" src="assets/logo-tpbv.svg" alt="Territorios de Paz y Buen Vivir" />
            </div>
            <div class="report-eyebrow">Gobierno del Estado de Morelos &middot; Agencia de Transformación Digital</div>
            <h1>Reporte de Análisis Sociodemográfico</h1>
            <h2>Territorios de Paz y Buen Vivir 2026</h2>
            <div class="report-meta">${metaHtml}</div>
        </div>`;

    if (rec.fuente === 'SIN DATOS') {
        html += `<div class="report-warn-box">No se encontró una coincidencia confiable para <b>${esc(rec.localidad)}</b> en el Censo INEGI 2020 (ITER Morelos).
            No hay indicadores estadísticos disponibles para esta localidad. Población reportada en la Lista TPBV 2026: <b>${fmtInt(rec.pobTotLista)}</b>.</div>`;
        html += reportFooter(fecha) + `</div>`;
        return html;
    }

    if (isAgg && rec.nSinDatos > 0) {
        html += `<div class="report-warn-box"><b>${rec.nSinDatos} de ${rec.nLocalidades}</b> localidades de este polígono no tienen coincidencia en el Censo INEGI 2020.
            Su población sí está incluida en el total (vía la Lista TPBV 2026), pero vivienda, salud, educación y economía solo suman las localidades con coincidencia censal.</div>`;
    }

    html += `<div class="report-section-title">Población</div>` + reportTable(
        reportRow('Población Total', rec.pobTotal, rec.pobTotal) +
        reportRow('Mujeres', rec.pobMujeres, rec.pobTotal) +
        reportRow('Hombres', rec.pobHombres, rec.pobTotal)
    );

    if (rec.piramide) {
        html += `<div class="report-section-title">Estructura de Población por Edad y Sexo</div>`;
        const rows = rec.piramide.slice().reverse().map((b) =>
            `<tr><td>${esc(b.label)} años</td><td class="num">${fmtInt(b.f)}</td><td class="num">${fmtInt(b.m)}</td><td class="num">${fmtInt((b.f || 0) + (b.m || 0))}</td></tr>`
        ).join('');
        html += `<table class="report-table"><thead><tr><th>Grupo de edad</th><th class="num">Mujeres</th><th class="num">Hombres</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>`;
        if (rec.pob0a14 !== null && rec.pob65mas !== null && rec.pob15a64) {
            const razon = ((rec.pob0a14 + rec.pob65mas) / rec.pob15a64 * 100).toFixed(1);
            html += `<p class="report-note">Razón de dependencia demográfica: ${razon} personas dependientes (0-14 y 65+) por cada 100 en edad de trabajar (15-64: ${fmtInt(rec.pob15a64)}).</p>`;
        }
    }

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Vivienda</div>` + reportTable(
            reportRow('Total Viviendas', rec.totalViviendas, rec.totalViviendas) +
            reportRow('Piso de Tierra', rec.pisoTierra, rec.totalViviendas) +
            reportRow('Un Solo Cuarto', rec.unSoloCuarto, rec.totalViviendas) +
            reportRow('Con Hacinamiento', rec.hacinamiento, rec.totalViviendas)
        ) + `</div>
        <div><div class="report-section-title">Discapacidad y Grupos Vulnerables</div>` + reportTable(
            reportRow('Pob. Afromexicana', rec.afromexicana) +
            reportRow('Con Discapacidad', rec.conDiscapacidad, null, true) +
            reportRow('Con Limitación', rec.conLimitacion, null, true) +
            reportRow('Con Problema o Condición Mental', rec.conProblemaMental, null, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Servicios de Salud</div>` + reportTable(
            reportRow('Total Afiliados', rec.afiliada, rec.pobTotal) +
            reportRow('Sin Afiliación', rec.sinAfiliacion, rec.pobTotal) +
            reportRow('Afiliados al IMSS', rec.imss, rec.pobTotal, true) +
            reportRow('Afiliados al ISSSTE', rec.issste, rec.pobTotal, true) +
            reportRow('Otros Servicios de Salud', rec.otrosSalud, rec.pobTotal, true)
        ) + `</div>
        <div><div class="report-section-title">Educación</div>` + reportTable(
            reportRow('Grado Promedio de Escolaridad', rec.gradoEscolaridad, null, false, (v) => v === null ? '—' : v.toFixed(1) + ' años') +
            reportRow('Analfabetas (15+)', rec.analfabetas) +
            reportRow('Sin Educación Básica Completa (15+)', rec.sinBasicaCompleta) +
            reportRow('Niñas/os 6-11 sin asistir a la escuela', rec.ninos6a11NoAsisten, null, true) +
            reportRow('Adolescentes 12-14 sin asistir a la escuela', rec.ninos12a14NoAsisten, null, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Población Indígena</div>` + reportTable(
            reportRow('Habla Lengua Indígena', rec.hablaLenguaIndigena, rec.pobTotal) +
            reportRow('Monolingüe (no habla español)', rec.indigenaMonolingue, rec.hablaLenguaIndigena, true) +
            reportRow('Hogares Censales Indígenas', rec.hogaresIndigenas)
        ) + `</div>
        <div><div class="report-section-title">Economía</div>` + reportTable(
            reportRow('Económicamente Activa (PEA)', rec.pea, rec.pobTotal) +
            reportRow('Ocupada', rec.ocupada, rec.pea, true) +
            reportRow('Desocupada', rec.desocupada, rec.pea, true) +
            reportRow('Ocupada en Sector Primario', rec.ocupadaPrimario, rec.ocupada, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Tecnologías de Información</div>` + reportTable(
            reportRow('Con Celular', rec.celular, rec.totalViviendas) +
            reportRow('Con Computadora', rec.computadora, rec.totalViviendas) +
            reportRow('Con Internet', rec.internet, rec.totalViviendas)
        ) + `</div>
        <div><div class="report-section-title">Bienes y Servicios en la Vivienda</div>` + reportTable(
            reportRow('Refrigerador', rec.refrigerador, rec.totalViviendas) +
            reportRow('Lavadora', rec.lavadora, rec.totalViviendas) +
            reportRow('Automóvil', rec.automovil, rec.totalViviendas) +
            reportRow('Agua Entubada', rec.aguaEntubada, rec.totalViviendas) +
            reportRow('Drenaje', rec.drenaje, rec.totalViviendas) +
            reportRow('Energía Eléctrica', rec.electricidad, rec.totalViviendas)
        ) + `</div>
    </div>`;

    html += reportFooter(fecha);
    html += `</div>`;
    return html;
}

function printReport() {
    if (!lastMapRec) {
        alert('Selecciona un polígono o una localidad antes de generar el reporte.');
        return;
    }
    const reportView = document.getElementById('report-view');
    reportView.innerHTML = buildReportHTML(lastMapRec);

    // Los logos de la portada no siempre estan precargados/cacheados (a
    // diferencia de los que ya se muestran en el sidebar/header): si se
    // llama a print() antes de que terminen de cargar, Chrome genera la
    // vista de impresion sin ellos. Se espera a que carguen (o fallen, con
    // un tope de 1.5s) antes de abrir el dialogo de impresion.
    const images = Array.from(reportView.querySelectorAll('img'));
    const whenReady = Promise.all(images.map((img) => img.complete
        ? Promise.resolve()
        : new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })
    ));
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));

    Promise.race([whenReady, timeout]).then(() => window.print());
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function selectLocalidad(idx) {
    const rec = activeData()[idx];
    selPoligono.value = String(rec.poligono);
    buildLocalidadOptions(selPoligono.value);
    inputLocalidad.value = `${rec.municipio} — ${rec.localidad}`;
    render(idx, 'zoom');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

canvas.addEventListener('click', (e) => {
    const item = e.target.closest('.loc-item');
    if (item) selectLocalidad(parseInt(item.dataset.idx, 10));
});

// La lista de localidades vive dentro de <li> clicables (role="button"); sin
// esto, seleccionar una localidad hermana no seria posible desde el teclado.
canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.loc-item');
    if (!item) return;
    e.preventDefault();
    selectLocalidad(parseInt(item.dataset.idx, 10));
});

// ---------------------------------------------------------------------------
// Menu en movil/tablet (drawer fuera de pantalla via transform, ver
// #sidebar-nav en TPBV_2026_COMPLETO_PRO.html). En escritorio (xl+, ver
// NAV_BREAKPOINT) el mismo nav se muestra como fila de pildoras en el
// encabezado (xl:translate-x-0, xl:static) y estos controles quedan ocultos.
// ---------------------------------------------------------------------------
function openNav() {
    const nav = $('#sidebar-nav');
    const backdrop = $('#nav-backdrop');
    const toggleBtn = $('#nav-toggle-btn');
    nav.classList.remove('-translate-x-full');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    const firstFocusable = nav.querySelector('a, button');
    if (firstFocusable) firstFocusable.focus();
}

function closeNav() {
    const nav = $('#sidebar-nav');
    const backdrop = $('#nav-backdrop');
    const toggleBtn = $('#nav-toggle-btn');
    nav.classList.add('-translate-x-full');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggleBtn.focus();
}

function toggleNav() {
    const nav = $('#sidebar-nav');
    if (nav.classList.contains('-translate-x-full')) openNav(); else closeNav();
}

// ---------------------------------------------------------------------------
// Cambio entre las dos "vistas" del nav lateral: Analisis Demografico (el
// dashboard de siempre, con filtros + tarjetas) y Propuesta Territorial (el
// mapa de comparacion dedicado). No es un router real: solo oculta/muestra
// los contenedores correspondientes y actualiza el estado activo del nav.
// ---------------------------------------------------------------------------
// Pildoras del menu superior, mismo patron que digital.morelos.gob.mx: la
// activa con fondo verde claro (accent-secondary-low), el resto transparente
// con hover verde tierra al 10%.
// Ancho desde el que el menu se muestra como fila de pildoras (Tailwind xl);
// debajo es drawer. Debe coincidir con las clases xl: de #sidebar-nav.
const NAV_BREAKPOINT = 1280;
const NAV_LINK_ACTIVE = 'nav-pill nav-pill-active';
const NAV_LINK_INACTIVE = 'nav-pill';

// Cada vista declara que contenedores le pertenecen (el resto se oculta) y
// que enlace del nav queda activo. La carga inicial de la pagina sigue
// aterrizando en 'analisis' (ver Init al final del archivo); 'inicio' solo
// se muestra si el usuario hace clic en el nav.
const VIEW_CONTAINERS = ['#inicio-view', '#hero-analisis', '#global-filters', '#canvas', '#propuesta-view', '#banco-proyectos-view', '#aulas-view', '#datos-view', '#red-view', '#telecom-view'];
const VIEWS = {
    inicio: { shown: ['#inicio-view'], navId: 'nav-inicio' },
    analisis: { shown: ['#hero-analisis', '#global-filters', '#canvas'], navId: 'nav-analisis' },
    propuesta: { shown: ['#propuesta-view'], navId: 'nav-propuesta' },
    banco: { shown: ['#banco-proyectos-view'], navId: 'nav-banco' },
    aulas: { shown: ['#aulas-view'], navId: 'nav-aulas' },
    datos: { shown: ['#datos-view'], navId: 'nav-datos' },
    red: { shown: ['#red-view'], navId: 'nav-red' },
    telecom: { shown: ['#telecom-view'], navId: 'nav-telecom' }
};

function showView(view) {
    // Sin datos de la Nueva Propuesta la vista Propuesta Territorial no existe.
    if (view === 'propuesta' && !HAY_NUEVA_PROPUESTA) view = 'inicio';
    if (view === 'banco' && !HAY_BANCO_PROYECTOS) view = 'inicio';
    const target = VIEWS[view] || VIEWS.analisis;

    VIEW_CONTAINERS.forEach((sel) => {
        const el = $(sel);
        if (!el) return;
        el.classList.toggle('hidden', !target.shown.includes(sel));
    });

    Object.values(VIEWS).forEach(({ navId }) => {
        const link = $('#' + navId);
        if (!link) return;
        const isActive = navId === target.navId;
        // classList (no className): el enlace de Inicio lleva ademas
        // "nav-home" (pildora solo con icono en escritorio), que no se debe
        // perder al cambiar de vista.
        link.classList.add(...NAV_LINK_INACTIVE.split(' '));
        link.classList.toggle(NAV_LINK_ACTIVE.split(' ').pop(), isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    if (view === 'inicio') renderInicioView();
    if (view === 'propuesta') renderPropuestaView();
    if (view === 'banco') renderBancoProyectosView();
    // renderAulasView vive en aulas_view.js (cargado despues de este archivo).
    if (view === 'aulas' && typeof renderAulasView === 'function') renderAulasView();
    // renderDatosAbiertosView vive en datos_abiertos.js.
    if (view === 'datos' && typeof renderDatosAbiertosView === 'function') renderDatosAbiertosView();
    // renderRedView vive en red_view.js.
    if (view === 'red' && typeof renderRedView === 'function') renderRedView();
    // renderTelecomView vive en telecom_view.js.
    if (view === 'telecom' && typeof renderTelecomView === 'function') renderTelecomView();
    if (view === 'analisis' && map) {
        // El mapa de Analisis Demografico pudo quedar con tamano 0 mientras
        // #canvas estaba oculto (display:none no tiene layout); si su encuadre
        // quedo pendiente por eso (ver renderMap), se aplica ahora.
        setTimeout(() => {
            if (!map) return;
            map.invalidateSize();
            if (map._encuadrePendiente) {
                const encuadrar = map._encuadrePendiente;
                map._encuadrePendiente = null;
                encuadrar();
            }
        }, 50);
    }
    // Solo si el drawer esta abierto: closeNav() enfoca el boton de menu, lo
    // que en la carga inicial (showView('inicio')) dejaba ese boton marcado.
    const navAbierto = !$('#sidebar-nav').classList.contains('-translate-x-full');
    if (window.innerWidth < NAV_BREAKPOINT && navAbierto) closeNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Switch "Conjunto de datos" en Analisis Demografico: alterna entre
// TPBV_DATA (Propuesta Actual, 132 localidades / 26 poligonos vigentes) y
// TPBV_DATA_PROPUESTA_2026 (Nueva Propuesta Territorial, 68 localidades / 20
// poligonos, hoja "PROPUESTA 2026"), ver activeData()/activePoligonosGeoJSON()
// y DATASET_MODE. Al cambiar se reconstruyen los selects y se vuelve al
// estado "sin seleccion" en vez de intentar preservar la localidad elegida:
// los dos datasets no comparten indices ni, en general, las mismas
// localidades/poligonos.
// ---------------------------------------------------------------------------
const DATASET_BTN_ACTIVE = 'px-4 py-1.5 rounded-full font-label-bold text-label-bold transition-colors bg-primary text-on-primary';
const DATASET_BTN_INACTIVE = 'px-4 py-1.5 rounded-full font-label-bold text-label-bold transition-colors text-on-surface-variant hover:bg-surface-container-highest';

function updateDatasetToggleUI() {
    const btnActual = $('#btn-dataset-actual');
    const btnNueva = $('#btn-dataset-nueva');
    if (!btnActual || !btnNueva) return;
    const isNueva = DATASET_MODE === 'nueva';
    btnActual.className = isNueva ? DATASET_BTN_INACTIVE : DATASET_BTN_ACTIVE;
    btnActual.setAttribute('aria-pressed', String(!isNueva));
    btnNueva.className = isNueva ? DATASET_BTN_ACTIVE : DATASET_BTN_INACTIVE;
    btnNueva.setAttribute('aria-pressed', String(isNueva));
}

function setDatasetMode(mode) {
    if (DATASET_MODE === mode) return;
    if (mode === 'nueva' && !HAY_NUEVA_PROPUESTA) return;
    DATASET_MODE = mode;
    // Los numeros de poligono no son comparables entre datasets (ver
    // aggregateCustom / TPBV_POLIGONOS_NUEVA_NORM), asi que el filtro
    // personalizado se limpia y sus selects vuelven a habilitarse.
    customPoligonos.clear();
    closeCustomPoligonosPanel();
    selPoligono.disabled = false;
    inputLocalidad.disabled = false;
    updateCustomPoligonosButtonLabel();
    updateDatasetToggleUI();
    buildPoligonoOptions();
    buildLocalidadOptions('all');
    selPoligono.value = 'all';
    inputLocalidad.value = '';
    renderAggregate(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const nav = $('#sidebar-nav');
    if (nav && !nav.classList.contains('-translate-x-full') && window.innerWidth < NAV_BREAKPOINT) closeNav();
});

window.addEventListener('resize', () => {
    if (window.innerWidth < NAV_BREAKPOINT) return;
    document.body.style.overflow = '';
    $('#nav-backdrop')?.classList.add('opacity-0', 'pointer-events-none');
    $('#nav-toggle-btn')?.setAttribute('aria-expanded', 'false');
});

// Checkboxes de la vista "Propuesta Territorial":
// se aplican directo sobre propuestaMap sin re-renderizar la vista completa.
$('#propuesta-view').addEventListener('change', (e) => {
    if (e.target && e.target.id === 'chk-propuesta-actual') showPropuestaActual = e.target.checked;
    if (e.target && e.target.id === 'chk-propuesta-nueva') showPropuestaNueva = e.target.checked;
    if (e.target && e.target.id === 'chk-propuesta-2026') showPropuesta2026 = e.target.checked;
    syncPropuestaCapas();
});

// Buscador de localidad de "Propuesta Territorial" (#input-localidad-propuesta):
// delegado sobre #propuesta-view (igual que los checkboxes de arriba) porque
// el input se crea recien la primera vez que se abre esa vista, no existe
// en el HTML estatico. 'focusin' en vez de 'focus': a diferencia de 'focus',
// si burbujea, que es lo que necesita la delegacion.
$('#propuesta-view').addEventListener('input', (e) => {
    if (e.target && e.target.id === 'input-localidad-propuesta') openPropuestaLocalidadSuggestions();
});
$('#propuesta-view').addEventListener('focusin', (e) => {
    if (!e.target || e.target.id !== 'input-localidad-propuesta') return;
    e.target.select();
    openPropuestaLocalidadSuggestions('');
});
$('#propuesta-view').addEventListener('keydown', (e) => {
    if (!e.target || e.target.id !== 'input-localidad-propuesta') return;
    const panel = $('#localidad-suggestions-propuesta');
    if (!panel) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (panel.classList.contains('hidden')) { openPropuestaLocalidadSuggestions(); return; }
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        propuestaLocalidadActiveIndex = Math.max(0, Math.min(propuestaLocalidadActiveIndex + delta, propuestaLocalidadFiltradas.length - 1));
        renderPropuestaLocalidadSuggestions();
        panel.querySelector('.loc-suggestion-propuesta[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        if (panel.classList.contains('hidden')) return;
        e.preventDefault();
        const chosen = propuestaLocalidadFiltradas[propuestaLocalidadActiveIndex] ?? propuestaLocalidadFiltradas[0];
        if (chosen) choosePropuesta2026Locality(chosen.i);
    } else if (e.key === 'Escape') {
        closePropuestaLocalidadSuggestions();
    }
});
document.addEventListener('click', (e) => {
    const item = e.target.closest('.loc-suggestion-propuesta');
    if (item) { choosePropuesta2026Locality(parseInt(item.dataset.i, 10)); return; }
    const panel = $('#localidad-suggestions-propuesta');
    const input = $('#input-localidad-propuesta');
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || (input && input.contains(e.target))) return;
    closePropuestaLocalidadSuggestions();
});

// Checkboxes del filtro personalizado (#custom-poligonos-panel): cada
// cambio actualiza customPoligonos y re-renderiza el agregado de la
// seleccion (ver applyCustomPoligonosSelection). Delegado sobre document
// (no sobre #global-filters: el panel vive fuera de el a proposito, ver el
// comentario junto a su <div> en el HTML) porque el panel se reconstruye
// por completo cada vez que se abre (buildCustomPoligonosPanel), lo que
// perderia un listener puesto directo sobre los <input>.
document.addEventListener('change', (e) => {
    if (!e.target.classList || !e.target.classList.contains('custom-poligono-check')) return;
    const p = Number(e.target.value);
    if (e.target.checked) customPoligonos.add(p); else customPoligonos.delete(p);
    applyCustomPoligonosSelection();
});

// Cierra el panel de seleccion personalizada al hacer clic fuera de el (y
// fuera del boton que lo abre), igual que cualquier otro menu desplegable.
document.addEventListener('click', (e) => {
    const panel = $('#custom-poligonos-panel');
    const btn = $('#btn-custom-poligonos');
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || (btn && btn.contains(e.target))) return;
    closeCustomPoligonosPanel();
});

// Al cambiar el poligono se muestra la vista general (poligono + todas sus
// localidades); el zoom a una localidad especifica solo ocurre cuando el
// usuario la selecciona explicitamente (buscador, lista lateral o popup).
// "Todos los Poligonos" ya no deja un estado neutro/vacio: muestra los
// totales generales de todo el dataset activo (ver aggregateTodos).
selPoligono.addEventListener('change', () => {
    buildLocalidadOptions(selPoligono.value);
    inputLocalidad.value = '';
    if (selPoligono.value === 'all') {
        renderAggregate(null);
    } else {
        renderAggregate(Number(selPoligono.value));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Buscador de localidad: cada tecla re-filtra localidadOptions (ver
// filterLocalidadOptions) y vuelve a pintar la lista de sugerencias; foco
// la vuelve a abrir con el filtro vigente para poder retomar la busqueda sin
// perder lo ya escrito. La eleccion final ocurre por click (delegado en
// document, igual que el filtro personalizado) o por teclado.
inputLocalidad.addEventListener('input', () => openLocalidadSuggestions());
inputLocalidad.addEventListener('focus', () => {
    inputLocalidad.select();
    openLocalidadSuggestions('');
});

inputLocalidad.addEventListener('keydown', (e) => {
    const panel = $('#localidad-suggestions');
    if (!panel) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (panel.classList.contains('hidden')) { openLocalidadSuggestions(); return; }
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        localidadActiveIndex = Math.max(0, Math.min(localidadActiveIndex + delta, localidadOptionsFiltradas.length - 1));
        renderLocalidadSuggestions();
        panel.querySelector('.loc-suggestion[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        if (panel.classList.contains('hidden')) return;
        e.preventDefault();
        const chosen = localidadOptionsFiltradas[localidadActiveIndex] ?? localidadOptionsFiltradas[0];
        if (chosen) chooseLocalidad(chosen.idx);
    } else if (e.key === 'Escape') {
        closeLocalidadSuggestions();
    }
});

document.addEventListener('click', (e) => {
    const item = e.target.closest('.loc-suggestion');
    if (item) { chooseLocalidad(parseInt(item.dataset.idx, 10)); return; }
    const panel = $('#localidad-suggestions');
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || inputLocalidad.contains(e.target)) return;
    closeLocalidadSuggestions();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
// Sin Nueva Propuesta (produccion): fuera el interruptor "Conjunto de datos"
// de Analisis y la pildora "Propuesta Territorial" del menu.
if (!HAY_NUEVA_PROPUESTA) {
    $('#dataset-switch')?.parentElement?.remove();
    $('#nav-propuesta')?.closest('li')?.remove();
}
if (!HAY_BANCO_PROYECTOS) $('#nav-banco')?.closest('li')?.remove();
updateDatasetToggleUI();
buildPoligonoOptions();
buildLocalidadOptions('all');
// Analisis Demografico arranca en "Todos los Poligonos": el mapa muestra
// Morelos completo con los 26 poligonos y todas las localidades, y las
// tarjetas el agregado estatal (se precarga aunque #canvas arranque oculto
// detras de Inicio, ver showView mas abajo).
selPoligono.value = 'all';
renderAggregate(null);
// La primera pantalla que ve el usuario es "Inicio" (bienvenida + guia),
// no el analisis de una localidad al azar.
showView('inicio');

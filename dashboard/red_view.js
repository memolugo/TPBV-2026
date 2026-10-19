// ---------------------------------------------------------------------------
// Vista "Red La tierra que nos une": red Wi-Fi pública de la ATDEM en
// oficinas de gobierno y en comunidades.
//   - Oficinas: TPBV_RED_LTQNU (red_ltqnu.js, scripts/build_red_ltqnu.py; solo
//     dependencias con red). Un marcador mora por sede (varias dependencias
//     comparten edificio, p. ej. Palacio de Gobierno).
//   - Comunidades: TPBV_RED_COMUNIDADES (red_comunidades.js,
//     scripts/build_red_comunidades.py). Marcador verde = instalado, aro oro
//     = en proceso.
// Mapa sobre la base "solo Morelos" (mapa_morelos.js), encuadrado al estado.
// Sección "Internet gratuito en comunidades prioritarias" con carrusel de
// fotos (carrusel.js) de la nota de Prensa del 07/08/2026, copiadas a
// dashboard/assets/red-comunidades/.
// Se carga después de app.js; showView('red') llama a renderRedView().
// ---------------------------------------------------------------------------

const RED = (typeof TPBV_RED_LTQNU !== 'undefined') ? TPBV_RED_LTQNU : [];
const RED_COMUNIDADES = (typeof TPBV_RED_COMUNIDADES !== 'undefined') ? TPBV_RED_COMUNIDADES : [];
const RED_COLOR_SEDE = '#773357';
const RED_COLOR_INSTALADO = '#71785B';
const RED_COLOR_EN_PROCESO = '#BC9B73';
// El tablero TPBV define RED_MOSTRAR_OFICINAS = false (app.js) para mostrar
// solo el WiFi en comunidades; conectividad.html no lo define y muestra todo.
const redConOficinas = () => typeof RED_MOSTRAR_OFICINAS === 'undefined' || RED_MOSTRAR_OFICINAS;

let redViewBuilt = false;
let redMap = null;
let redMarcadores = null;
const redMarcadorPorSede = new Map();
const redMarcadorPorComunidad = new Map();

const RED_NOTA_URL = 'https://www.morelos.gob.mx/ultimas-noticias/lleva-agencia-de-transformacion-digital-internet-gratuito-a-comunidades-prioritarias-de-morelos';
const RED_FOTOS = [
    ['red-01.jpg', 'Personal técnico de la ATDEM durante un recorrido de campo.'],
    ['red-02.jpg', 'Visita de la ATDEM a un centro comunitario.'],
    ['red-03.jpg', 'Infraestructura de telecomunicaciones para llevar la red a las comunidades.'],
    ['red-04.jpg', 'Estudios de factibilidad tecnológica en zonas prioritarias del estado.'],
];

const redClaveSede = (r) => `${r.lat},${r.lon}`;
const redPuntos = (n) => `${fmtInt(n)} ${n === 1 ? 'punto' : 'puntos'} de acceso`;
let redBase = null;

// Agrupa los registros por sede (coordenada) para el mapa.
function redSedes() {
    const sedes = new Map();
    RED.filter((r) => r.lat !== null).forEach((r) => {
        const k = redClaveSede(r);
        const s = sedes.get(k) || { lat: r.lat, lon: r.lon, direccion: r.direccion, registros: [] };
        if (!s.direccion && r.direccion) s.direccion = r.direccion;
        s.registros.push(r);
        sedes.set(k, s);
    });
    return [...sedes.values()];
}

function redResumen() {
    const dependencias = new Set(RED.map((r) => r.dependencia.toLowerCase()));
    const secretarias = new Set(RED.map((r) => r.secretaria.toLowerCase()));
    const puntos = RED.reduce((s, r) => s + (r.puntosAcceso || 0), 0);
    return { dependencias: dependencias.size, secretarias: secretarias.size, sedes: redSedes().length, puntos };
}

const redEsInstalado = (c) => c.estatus === 'Instalado';

function redEstiloComunidad(c) {
    return redEsInstalado(c)
        ? { radius: 9, color: '#ffffff', weight: 2, fillColor: RED_COLOR_INSTALADO, fillOpacity: 0.95 }
        : { radius: 8, color: RED_COLOR_EN_PROCESO, weight: 3.5, fillColor: '#ffffff', fillOpacity: 0.95 };
}

function redEstatusHtml(c) {
    const color = redEsInstalado(c) ? RED_COLOR_INSTALADO : RED_COLOR_EN_PROCESO;
    const fondo = redEsInstalado(c) ? '#DFE6C3' : '#F3EADF';
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-bold text-label-bold whitespace-nowrap" style="background:${fondo};color:#2E3B2B">
        <span class="inline-block rounded-full" style="width:8px;height:8px;background:${color}"></span>${esc(c.estatus)}</span>`;
}

function redComunidadPopupHtml(c) {
    const tpbv = c.poligono
        ? `<div class="dato"><span class="material-symbols-outlined">layers</span><span>Comunidad de Territorios de Paz y Buen Vivir · Polígono ${esc(c.nombrePoligono || String(c.poligono))}</span></div>` : '';
    const aprox = c.coordenadaAproximada
        ? '<div class="dato"><span class="material-symbols-outlined">info</span><span>Ubicación aproximada de la localidad</span></div>' : '';
    return `<div class="cab"><div class="nom">${esc(c.localidad)}</div><div class="sub">${esc(c.municipio)}</div></div>
        <div class="cuerpo"><div class="dato"><span class="material-symbols-outlined">wifi</span><span>WiFi gratuito: <b style="color:#2E3B2B">${esc(c.estatus.toLowerCase())}</b></span></div>${tpbv}${aprox}</div>`;
}

function redLeyendaItem(estilo, texto) {
    return `<span class="flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant">
        <span class="inline-block rounded-full" style="${estilo}"></span>${texto}</span>`;
}

// Nota del 07/08/2026: expansión de la red a comunidades prioritarias.
function redComunidadesNotaHtml() {
    const instaladas = RED_COMUNIDADES.filter(redEsInstalado).length;
    const enProceso = RED_COMUNIDADES.length - instaladas;
    return `
    <section class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center rounded-3xl p-6 md:p-10 border border-outline-variant bg-surface-container-lowest" aria-labelledby="red-nota-titulo">
        <div class="lg:col-span-2 flex flex-col gap-4">
            <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">7 de agosto de 2026 · Comunidades prioritarias</span>
            <h3 id="red-nota-titulo" class="font-headline-lg text-headline-lg text-on-surface" style="font-size:28px;line-height:34px">Internet gratuito en comunidades prioritarias</h3>
            <p class="font-body-lg text-body-lg text-on-surface-variant">
                La ATDEM amplía la red «La tierra que nos une» a zonas históricamente vulnerables. El servicio opera al cien por
                ciento en El Zapote (Puente de Ixtla) y en Villa Nicolás Zapata (Totolapan), con puntos Wi-Fi en plazas
                principales, centros comunitarios y planteles educativos, y personal técnico realiza estudios de factibilidad en
                Tlaquiltenango y otras localidades de Territorios de Paz y Buen Vivir.
            </p>
            ${RED_COMUNIDADES.length ? `<div class="grid grid-cols-2 gap-4 py-1">
                ${cifraDestacada(instaladas, 'comunidades con red instalada')}
                ${cifraDestacada(enProceso, 'comunidades en proceso de instalación')}
            </div>` : ''}
            <blockquote class="font-body-lg text-body-lg text-on-surface pl-4" style="border-left:3px solid #BC9B73">
                “El internet no puede seguir siendo un privilegio de pocos; es una herramienta de equidad social.”
                <span class="block font-body-md text-body-md text-on-surface-variant mt-1">Samuel Rivera Muciño, titular de la ATDEM</span>
            </blockquote>
            ${enlaceNota(RED_NOTA_URL)}
        </div>
        <div class="lg:col-span-3 flex flex-col gap-2">
            ${carruselHtml({ id: 'carrusel-red', etiqueta: 'Fotos de la red en comunidades prioritarias', carpeta: 'red-comunidades', fotos: RED_FOTOS })}
            <p class="font-label-bold text-label-bold text-on-surface-variant">Fotos: Gobierno del Estado de Morelos</p>
        </div>
    </section>`;
}

function redTarjetaInfo(icon, titulo, texto) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-3">
        <span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${icon}</span>
        </span>
        <h3 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h3>
        <div class="font-body-md text-body-md text-on-surface-variant">${texto}</div>
    </div>`;
}

function redPopupHtml(sede) {
    const filas = sede.registros.map((r) => `
        <div class="dato"><span class="material-symbols-outlined">wifi</span><span><b style="color:#2E3B2B">${esc(r.dependencia)}</b>${r.puntosAcceso ? ` · ${redPuntos(r.puntosAcceso)}` : ''}</span></div>`).join('');
    const titulo = sede.registros.length > 1 ? `${sede.registros.length} dependencias en esta sede` : esc(sede.registros[0].secretaria);
    return `<div class="cab"><div class="nom">${sede.direccion ? esc(sede.direccion) : 'Sede de dependencia estatal'}</div><div class="sub">${titulo}</div></div>
        <div class="cuerpo">${filas}</div>`;
}

function redVistaHtml() {
    const r = redResumen();
    const oficinas = redConOficinas();
    return `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Conectividad pública · Agencia de Transformación Digital</span>
        <h2 class="font-headline-xl text-headline-xl text-primary">Red La tierra que nos une</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Red de Wi-Fi pública, gratuita y abierta impulsada por la Agencia de Transformación Digital del Gobierno del Estado de
            Morelos (ATDEM). Busca reducir la brecha digital y que la ciudadanía pueda comunicarse sin costo, consultar la programación
            cultural, realizar trámites y acceder a las plataformas digitales institucionales.
        </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid">
        ${redTarjetaInfo('wifi', 'Internet gratuito y abierto', 'Conexión Wi-Fi sin costo para la ciudadanía en espacios públicos y oficinas de gobierno.')}
        ${redTarjetaInfo('diversity_3', 'Reducir la brecha digital', 'Comunicarse sin costo, consultar programación cultural y realizar trámites en plataformas digitales institucionales.')}
        ${redTarjetaInfo('location_on', 'Puntos de conexión', `<ul class="list-disc pl-5 space-y-1">
            <li>Plazas públicas y espacios de alta concurrencia, como la Plaza de Armas Emiliano Zapata (Zócalo de Cuernavaca).</li>
            <li>Eventos especiales, como el Festival Internacional Cervantino en Cuernavaca.</li>
            <li>Dependencias estatales, ayudantías municipales y escuelas.</li>
        </ul>`)}
    </div>
    ${redComunidadesNotaHtml()}
    ${!oficinas ? '' : `<h3 class="font-headline-lg text-headline-lg text-on-surface pt-2" style="font-size:28px;line-height:34px">Dependencias con red</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('apartment', 'Dependencias con red', r.dependencias, 'primary')}
        ${kpiCount('account_balance', 'Secretarías y órganos', r.secretarias, 'teal')}
        ${kpiCount('location_on', 'Sedes conectadas', r.sedes, 'blue')}
        ${kpiCount('router', 'Puntos de acceso', r.puntos, 'warning')}
    </div>`}
    ${RED_COMUNIDADES.length ? `
    <h3 class="font-headline-lg text-headline-lg text-on-surface pt-2" style="font-size:28px;line-height:34px">WiFi gratuito en comunidades</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('location_on', 'Comunidades', RED_COMUNIDADES.length, 'primary')}
        ${kpiCount('wifi', 'Con red instalada', RED_COMUNIDADES.filter(redEsInstalado).length, 'teal')}
        ${kpiCount('construction', 'En proceso de instalación', RED_COMUNIDADES.filter((c) => !redEsInstalado(c)).length, 'warning')}
        ${kpiCount('layers', 'En comunidades TPBV', RED_COMUNIDADES.filter((c) => c.poligono).length, 'blue')}
    </div>` : ''}
    <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col">
        <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-outline-variant flex-wrap">
            <div class="flex items-center gap-2.5">${iconChip('wifi')}<h2 class="font-headline-md text-headline-md text-on-surface">Mapa de la red</h2></div>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                ${oficinas ? redLeyendaItem(`width:12px;height:12px;background:${RED_COLOR_SEDE};border:2px solid #fff;box-shadow:0 0 0 1px ${RED_COLOR_SEDE}`, 'Oficina de gobierno (el tamaño indica cuántas dependencias)') : ''}
                ${RED_COMUNIDADES.length ? redLeyendaItem(`width:12px;height:12px;background:${RED_COLOR_INSTALADO};border:2px solid #fff;box-shadow:0 0 0 1px ${RED_COLOR_INSTALADO}`, 'Comunidad: instalado') : ''}
                ${RED_COMUNIDADES.length ? redLeyendaItem(`width:12px;height:12px;background:#fff;border:3px solid ${RED_COLOR_EN_PROCESO}`, 'Comunidad: en proceso') : ''}
            </div>
        </div>
        <div class="overflow-hidden relative w-full mx-auto" style="max-width:900px;aspect-ratio:1/0.8;max-height:75vh;min-height:340px;border-radius:16px;border:1px solid #CBCABE">
            <div id="red-map" style="position:absolute;inset:0"></div>
        </div>
    </div>
    ${RED_COMUNIDADES.length ? card(`
        <div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-outline-variant">
            <div class="flex items-center gap-2.5">${iconChip('location_on')}<h2 class="font-headline-md text-headline-md text-on-surface">WiFi gratuito en comunidades</h2></div>
            <span class="font-label-bold text-label-bold bg-surface-container-high text-on-surface-variant rounded-full px-2.5 py-0.5">${RED_COMUNIDADES.length}</span>
        </div>
        ${redComunidadesListaHtml()}`) : ''}
    ${!oficinas ? '' : card(`
        <div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-outline-variant">
            <div class="flex items-center gap-2.5">${iconChip('list')}<h2 class="font-headline-md text-headline-md text-on-surface">Disponibilidad de WiFi gratuito en oficinas de gobierno</h2></div>
            <span class="font-label-bold text-label-bold bg-surface-container-high text-on-surface-variant rounded-full px-2.5 py-0.5">${RED.length}</span>
        </div>
        <div id="red-lista"></div>`)}
    <p class="font-body-md text-body-md text-on-surface-variant">${oficinas ? `
        Fuente: ATDEM, "Agentes_dependencias La Tierra Que Nos Une" (dependencias con red La tierra que nos une) y registro de
        instalaciones en comunidades. Puntos de acceso según el registro de la ATDEM; algunas dependencias no tienen el dato capturado.`
        : 'Fuente: ATDEM, registro de instalaciones de WiFi gratuito en comunidades.'}
    </p>`;
}

function redComunidadesListaHtml() {
    return `<ul class="flex flex-col">${RED_COMUNIDADES.map((c, i) => `
        <li class="flex items-center justify-between gap-4 px-2 py-2.5 border-b border-outline-variant last:border-b-0 cursor-pointer hover:bg-surface-container-low rounded-lg"
            data-red-comunidad="${i}" tabindex="0" role="button" aria-label="Ver ${esc(c.localidad)} en el mapa">
            <span class="min-w-0">
                <span class="font-body-md text-body-md text-on-surface font-semibold">${esc(c.localidad)}</span>
                <span class="block font-body-md text-body-md text-on-surface-variant">${esc(c.municipio)}${c.poligono ? ' · Comunidad TPBV' : ''}</span>
            </span>
            ${redEstatusHtml(c)}
        </li>`).join('')}</ul>`;
}

function redListaHtml() {
    const porSecretaria = new Map();
    RED.forEach((r) => {
        const lista = porSecretaria.get(r.secretaria) || [];
        lista.push(r);
        porSecretaria.set(r.secretaria, lista);
    });
    return [...porSecretaria.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([secretaria, lista]) => `
        <div class="py-3 border-b border-outline-variant last:border-b-0">
            <p class="font-label-bold text-label-bold uppercase tracking-wider text-secondary mb-2">${esc(secretaria)}</p>
            <ul class="flex flex-col gap-1.5">
                ${lista.map((r) => `
                <li class="flex items-start justify-between gap-4 ${r.lat !== null ? 'cursor-pointer hover:bg-surface-container-low rounded-lg' : ''} px-2 py-1.5" ${r.lat !== null ? `data-red-sede="${redClaveSede(r)}" tabindex="0" role="button" aria-label="Ver ${esc(r.dependencia)} en el mapa"` : ''}>
                    <span class="min-w-0">
                        <span class="font-body-md text-body-md text-on-surface font-semibold">${esc(r.dependencia)}</span>
                        ${r.direccion ? `<span class="block font-body-md text-body-md text-on-surface-variant">${esc(r.direccion)}</span>` : ''}
                    </span>
                    <span class="shrink-0 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">${r.puntosAcceso ? redPuntos(r.puntosAcceso) : ''}</span>
                </li>`).join('')}
            </ul>
        </div>`).join('');
}

function dibujarRedMarcadores() {
    redMarcadores = L.featureGroup().addTo(redMap);
    if (!redConOficinas()) return;
    redSedes().forEach((s) => {
        const n = s.registros.length;
        const radio = 7 + Math.sqrt(n) * 3.2;
        const base = { radius: radio, color: '#ffffff', weight: 2, fillColor: '#773357', fillOpacity: 0.92 };
        const m = L.circleMarker([s.lat, s.lon], base)
            .bindPopup(redPopupHtml(s), { className: 'atd-popup', maxWidth: 320 })
            .bindTooltip(n > 1 ? `${n} dependencias` : esc(s.registros[0].dependencia), { direction: 'top', offset: [0, -radio], className: 'atd-tooltip' })
            .addTo(redMarcadores);
        m.on('mouseover', () => m.setStyle({ color: '#BC9B73', weight: 3 }));
        m.on('mouseout', () => { if (!m.isPopupOpen()) m.setStyle(base); });
        m.on('popupclose', () => m.setStyle(base));
        redMarcadorPorSede.set(`${s.lat},${s.lon}`, m);
    });
}

function dibujarRedComunidades() {
    RED_COMUNIDADES.forEach((c, i) => {
        const base = redEstiloComunidad(c);
        const m = L.circleMarker([c.lat, c.lon], base)
            .bindPopup(redComunidadPopupHtml(c), { className: 'atd-popup', maxWidth: 320 })
            .bindTooltip(`${esc(c.localidad)} · ${esc(c.estatus.toLowerCase())}`, { direction: 'top', offset: [0, -base.radius], className: 'atd-tooltip' })
            .addTo(redMarcadores);
        m.on('mouseover', () => m.setStyle({ weight: base.weight + 1, color: redEsInstalado(c) ? RED_COLOR_EN_PROCESO : RED_COLOR_SEDE }));
        m.on('mouseout', () => { if (!m.isPopupOpen()) m.setStyle(base); });
        m.on('popupclose', () => m.setStyle(base));
        redMarcadorPorComunidad.set(String(i), m);
    });
}

function renderRedView() {
    if (!redViewBuilt) {
        $('#red-view').innerHTML = redVistaHtml();
        if ($('#red-lista')) $('#red-lista').innerHTML = redListaHtml();
        redViewBuilt = true;
        iniciarCarrusel('carrusel-red');
        animateEntrances($('#red-view'));
    }
    if (!redMap) {
        redMap = crearMapaMorelos('red-map');
        // Las oficinas estan en Cuernavaca (municipio resaltado); las
        // comunidades, en todo el estado: el encuadre inicial es Morelos.
        redBase = agregarBaseMorelos(redMap, {
            estilo: (f) => (redConOficinas() && normMunicipio(f.properties.NOMGEO) === 'cuernavaca' ? { ...MUNICIPIO_BASE, fillColor: TINTE_VERDE } : MUNICIPIO_BASE)
        });
        dibujarRedMarcadores();
        dibujarRedComunidades();
    }
    // El contenedor estaba oculto hasta este momento (ver renderAulasView).
    setTimeout(() => {
        if (!redMap) return;
        redMap.invalidateSize();
        if (!redMap._encuadrado && redMarcadores.getLayers().length) {
            const limites = (redBase && redBase.contorno) ? redBase.contorno.getBounds().extend(redMarcadores.getBounds()) : redMarcadores.getBounds();
            redMap.fitBounds(limites, { padding: [24, 24] });
            redMap._encuadrado = true;
        }
    }, 150);
}

function enfocarSedeRed(clave, porComunidad = false) {
    const m = (porComunidad ? redMarcadorPorComunidad : redMarcadorPorSede).get(clave);
    if (!m || !redMap) return;
    $('#red-map').scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
    redMap.setView(m.getLatLng(), 14);
    m.openPopup();
}

$('#red-view').addEventListener('click', (e) => {
    const item = e.target.closest('[data-red-sede]');
    if (item) enfocarSedeRed(item.dataset.redSede);
    const com = e.target.closest('[data-red-comunidad]');
    if (com) enfocarSedeRed(com.dataset.redComunidad, true);
});
$('#red-view').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest && e.target.closest('[data-red-sede]');
    const com = e.target.closest && e.target.closest('[data-red-comunidad]');
    if (item) { e.preventDefault(); enfocarSedeRed(item.dataset.redSede); }
    if (com) { e.preventDefault(); enfocarSedeRed(com.dataset.redComunidad, true); }
});

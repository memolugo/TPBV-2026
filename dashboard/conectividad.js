// ---------------------------------------------------------------------------
// Página "Conectividad" (dashboard/conectividad.html): reúne la
// Infraestructura de Telecomunicaciones (telecom_view.js, sitios REEM
// agregados por municipio) y la Red La tierra que nos une (red_view.js, Wi-Fi
// gratuito en oficinas y comunidades). Tres vistas: Inicio (resumen),
// Telecomunicaciones y Red. La vista activa va en el hash (#telecom, #red)
// para poder compartir el enlace directo.
// Se carga después de telecom_view.js y red_view.js.
// ---------------------------------------------------------------------------

const CONECT_VISTAS = {
    inicio: { contenedor: '#conect-inicio-view', render: renderConectInicio },
    telecom: { contenedor: '#telecom-view', render: renderTelecomView },
    red: { contenedor: '#red-view', render: renderRedView },
};

let conectInicioBuilt = false;

function conectTarjetaSeccion({ vista, icono, titulo, texto, cifras }) {
    return `<div class="card-enlace bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-4">
        <span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${icono}</span>
        </span>
        <h2 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">${texto}</p>
        <div class="grid grid-cols-2 gap-4">${cifras}</div>
        <a href="#${vista}" data-conect-vista="${vista}" class="card-enlace-cta mt-auto inline-flex items-center gap-1 font-body-md text-body-md text-primary-container w-fit">
            <span class="enlace">Ver ${esc(titulo.toLowerCase())}</span><span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span></a>
    </div>`;
}

function conectInicioHtml() {
    const red = redResumen();
    const instaladas = RED_COMUNIDADES.filter(redEsInstalado).length;
    return `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Agencia de Transformación Digital</span>
        <h1 class="font-headline-xl text-headline-xl text-primary">Conectividad</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Infraestructura de telecomunicaciones de la red estatal e internet gratuito de la red «La tierra que nos une» en
            oficinas de gobierno y comunidades de Morelos.
        </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('cell_tower', 'Sitios de telecomunicaciones', TELECOM.total, 'primary')}
        ${kpiCount('location_city', 'Municipios con sitios', TELECOM.municipios.length, 'teal')}
        ${kpiCount('apartment', 'Dependencias con WiFi gratuito', red.dependencias, 'blue')}
        ${kpiCount('wifi', 'Comunidades con WiFi gratuito', RED_COMUNIDADES.length, 'warning')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid">
        ${conectTarjetaSeccion({
            vista: 'telecom', icono: 'cell_tower', titulo: 'Infraestructura de Telecomunicaciones',
            texto: 'Sitios y torres de la red estatal que dan servicio a dependencias, escuelas, unidades de salud e instalaciones de seguridad. Por seguridad, se presentan agregados por municipio y sector.',
            cifras: cifraDestacada(fmtInt(TELECOM.total), 'sitios de telecomunicaciones') + cifraDestacada(Object.keys(TELECOM.porSector).length, 'sectores atendidos'),
        })}
        ${conectTarjetaSeccion({
            vista: 'red', icono: 'wifi', titulo: 'Red La tierra que nos une',
            texto: 'Wi-Fi público, gratuito y abierto de la ATDEM en oficinas de gobierno y en comunidades prioritarias del estado.',
            cifras: cifraDestacada(fmtInt(red.puntos), 'puntos de acceso en oficinas') + cifraDestacada(instaladas, 'comunidades con red instalada'),
        })}
    </div>`;
}

function renderConectInicio() {
    if (conectInicioBuilt) return;
    $('#conect-inicio-view').innerHTML = conectInicioHtml();
    conectInicioBuilt = true;
    animateEntrances($('#conect-inicio-view'));
}

function conectVistaDeHash() {
    const nombre = location.hash.replace('#', '');
    return CONECT_VISTAS[nombre] ? nombre : 'inicio';
}

function showConectView(nombre, { actualizarHash = true } = {}) {
    const vista = CONECT_VISTAS[nombre] ? nombre : 'inicio';
    Object.entries(CONECT_VISTAS).forEach(([clave, v]) => {
        $(v.contenedor).classList.toggle('hidden', clave !== vista);
    });
    document.querySelectorAll('#conect-nav [data-conect-nav]').forEach((a) => {
        const activa = a.dataset.conectNav === vista;
        a.classList.toggle('nav-pill-active', activa);
        if (activa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    CONECT_VISTAS[vista].render();
    if (actualizarHash) {
        const hash = vista === 'inicio' ? location.pathname + location.search : `#${vista}`;
        history.replaceState(null, '', hash);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
}

document.addEventListener('click', (e) => {
    const enlace = e.target.closest('[data-conect-vista], [data-conect-nav]');
    if (!enlace) return;
    e.preventDefault();
    showConectView(enlace.dataset.conectVista || enlace.dataset.conectNav);
});
window.addEventListener('hashchange', () => showConectView(conectVistaDeHash(), { actualizarHash: false }));

showConectView(conectVistaDeHash(), { actualizarHash: false });

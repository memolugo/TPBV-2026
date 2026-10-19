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

// Nota de Prensa: boletín 01559 (03/04/2025). Fotos copiadas a
// dashboard/assets/conectividad/ (verticales, carrusel 3:4). Los pies los
// redactamos nosotros: la nota no los trae y no nombra a quien aparece.
const CONECT_NOTA_URL = 'https://www.morelos.gob.mx/ultimas-noticias/impulsa-gobierno-estatal-conectividad-digital-para-las-y-los-morelenses';
const CONECT_FOTOS = [
    ['conectividad-01.jpg', 'Estación de carga con internet gratuito de «La tierra que nos une» en un espacio público.'],
    ['conectividad-02.jpg', 'Entrevista con medios sobre la red pública de internet gratuito.'],
];

function conectNotaHtml() {
    return `
    <section class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center rounded-3xl p-6 md:p-10 border border-outline-variant bg-surface-container-lowest" aria-labelledby="conect-nota-titulo">
        <div class="lg:col-span-3 flex flex-col gap-4">
            <h2 id="conect-nota-titulo" class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">Conectividad digital para las y los morelenses</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant">
                Para reducir la brecha digital y garantizar el acceso equitativo a la tecnología, el Gobierno del Estado, a través de
                la Agencia de Transformación Digital, instala puntos de conectividad gratuita en espacios públicos y comunidades.
                En una primera etapa, la red pública «La tierra que nos une» ya opera en el centro de Cuernavaca, abierta a la
                ciudadanía y visitantes; el objetivo es llevarla a zonas rurales, comunidades marginadas y espacios educativos.
            </p>
            <ul class="flex flex-col gap-2 font-body-md text-body-md text-on-surface-variant">
                ${[['wifi', 'Zonas Wi-Fi en puntos estratégicos del estado.'],
                    ['description', 'Acceso a servicios en línea y trámites gubernamentales.'],
                    ['school', 'Educación a distancia y productividad de estudiantes y trabajadores.']].map(([icono, texto]) => `
                <li class="flex items-start gap-2.5"><span class="material-symbols-outlined text-secondary text-[20px] shrink-0" aria-hidden="true">${icono}</span><span>${texto}</span></li>`).join('')}
            </ul>
            <blockquote class="font-body-lg text-body-lg text-on-surface pl-4" style="border-left:3px solid #BC9B73">
                “La conectividad digital no es un privilegio, es una necesidad que estamos garantizando para todas y todos.”
                <span class="block font-body-md text-body-md text-on-surface-variant mt-1">Samuel Rivera Muciño, titular de la ATDEM</span>
            </blockquote>
            ${enlaceNota(CONECT_NOTA_URL)}
        </div>
        <div class="lg:col-span-2 flex flex-col gap-2">
            ${carruselHtml({ id: 'carrusel-conectividad', etiqueta: 'Fotos de la red pública de internet gratuito', carpeta: 'conectividad', fotos: CONECT_FOTOS, vertical: true })}
            <p class="font-label-bold text-label-bold text-on-surface-variant text-center">Fotos: Gobierno del Estado de Morelos</p>
        </div>
    </section>`;
}

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
    ${conectNotaHtml()}
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
    iniciarCarrusel('carrusel-conectividad');
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

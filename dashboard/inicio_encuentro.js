// ---------------------------------------------------------------------------
// Sección de Inicio "Segundo Encuentro Estatal de Consejos Comunitarios" con
// carrusel de fotos. Textos y cifras tomados de la nota oficial (Prensa,
// morelos.gob.mx, 10/10/2026); fotos de esa misma nota (Gobierno del Estado
// de Morelos), copiadas a dashboard/assets/encuentro/.
//
// Las fotos se sirven desde GitHub Pages con URL absoluta: el proxy de
// tpbv.morelos.gob.mx no sirve archivos nuevos de assets/ (ver CLAUDE.md).
// Solo en local (servidor de pruebas o archivo abierto) se usa la ruta
// relativa, para ver fotos nuevas antes de publicarlas.
//
// Carrusel sin librerías: pista con scroll-snap, flechas, puntos y avance
// automático (se pausa con el cursor encima, con el foco dentro, con la
// pestaña oculta y si la persona prefiere menos movimiento).
// Se carga ANTES de app.js; renderInicioView() inserta el HTML y llama a
// iniciarCarruselEncuentro().
// ---------------------------------------------------------------------------

const ENCUENTRO_NOTA_URL = 'https://www.morelos.gob.mx/ultimas-noticias/consolida-margarita-gonzalez-saravia-territorios-de-paz-y-buen-vivir-en-132-comunidades-de-morelos';
const ENCUENTRO_FOTOS_BASE = (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname))
    ? 'assets/encuentro/'
    : 'https://memolugo.github.io/TPBV-2026/dashboard/assets/encuentro/';
const ENCUENTRO_FOTOS = [
    ['encuentro-01.jpg', 'Segundo Encuentro Estatal de Consejos Comunitarios en el Centro de Convenciones Morelos, Xochitepec.'],
    ['encuentro-02.jpg', 'Mesa principal del encuentro, con más de mil representantes comunitarios.'],
    ['encuentro-03.jpg', 'Representantes de las comunidades durante el encuentro.'],
    ['encuentro-04.jpg', 'Consejeras y consejeros comunitarios de Territorios de Paz y Buen Vivir.'],
    ['encuentro-05.jpg', 'Participantes del encuentro.'],
    ['encuentro-06.jpg', 'Las comunidades en el centro de las decisiones.'],
    ['encuentro-07.jpg', 'Promotoras y promotores que acompañan a las comunidades.'],
];
const ENCUENTRO_AVANCE_MS = 6000;

function encuentroCifra(valor, texto) {
    return `<div><p class="font-kpi-value text-kpi-value text-primary-container leading-none">${valor}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">${texto}</p></div>`;
}

function encuentroCarruselHtml() {
    const total = ENCUENTRO_FOTOS.length;
    const slides = ENCUENTRO_FOTOS.map(([archivo, pie], i) => `
        <figure class="carrusel-slide" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${total}">
            <img src="${ENCUENTRO_FOTOS_BASE}${archivo}" alt="${esc(pie)}" ${i ? 'loading="lazy"' : ''} width="1280" height="854">
            <figcaption>${esc(pie)}</figcaption>
        </figure>`).join('');
    const puntos = ENCUENTRO_FOTOS.map((_, i) =>
        `<button type="button" class="carrusel-punto" data-ir="${i}" aria-label="Ver foto ${i + 1} de ${total}"></button>`).join('');
    return `
    <div class="carrusel" id="carrusel-encuentro" role="region" aria-roledescription="carrusel" aria-label="Fotos del Segundo Encuentro Estatal">
        <div class="carrusel-pista" tabindex="0">${slides}</div>
        <button type="button" class="carrusel-flecha izq" data-mover="-1" aria-label="Foto anterior"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
        <button type="button" class="carrusel-flecha der" data-mover="1" aria-label="Foto siguiente"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
        <div class="carrusel-puntos">${puntos}</div>
    </div>`;
}

function inicioEncuentroHtml() {
    return `
    <section class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center rounded-3xl p-6 md:p-10 border border-outline-variant bg-surface-container-lowest" aria-labelledby="encuentro-titulo">
        <div class="lg:col-span-2 flex flex-col gap-4">
            <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">10 de octubre de 2026 · Xochitepec</span>
            <h2 id="encuentro-titulo" class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">Segundo Encuentro Estatal de Consejos Comunitarios</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant">
                Más de mil representantes de las comunidades se reunieron con la gobernadora Margarita González Saravia
                para fortalecer la organización comunitaria, que coloca a las comunidades en el centro de las decisiones.
            </p>
            <div class="grid grid-cols-3 gap-4 py-2">
                ${encuentroCifra('132', 'comunidades (eran 103 al inicio)')}
                ${encuentroCifra('148', 'millones de pesos de inversión interinstitucional')}
                ${encuentroCifra('+1,000', 'representantes comunitarios')}
            </div>
            <a href="${ENCUENTRO_NOTA_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-body-md text-body-md text-primary-container underline underline-offset-2 w-fit">
                Leer la nota completa <span class="material-symbols-outlined text-[18px]" aria-hidden="true">north_east</span>
            </a>
        </div>
        <div class="lg:col-span-3 flex flex-col gap-2">
            ${encuentroCarruselHtml()}
            <p class="font-label-bold text-label-bold text-on-surface-variant">Fotos: Gobierno del Estado de Morelos</p>
        </div>
    </section>`;
}

function iniciarCarruselEncuentro() {
    const raiz = document.getElementById('carrusel-encuentro');
    if (!raiz) return;
    const pista = raiz.querySelector('.carrusel-pista');
    const puntos = [...raiz.querySelectorAll('.carrusel-punto')];
    const total = ENCUENTRO_FOTOS.length;
    const actual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    let ultimoManual = 0;   // tras usar flechas/puntos/teclado, el avance automático espera un ciclo completo
    const ir = (i) => pista.scrollTo({ left: ((i + total) % total) * pista.clientWidth, behavior: 'smooth' });
    const marcar = () => puntos.forEach((p, i) => p.setAttribute('aria-current', i === actual() ? 'true' : 'false'));

    raiz.addEventListener('click', (e) => {
        const mover = e.target.closest('[data-mover]');
        const punto = e.target.closest('[data-ir]');
        if (mover || punto) ultimoManual = Date.now();
        if (mover) ir(actual() + parseInt(mover.dataset.mover, 10));
        if (punto) ir(parseInt(punto.dataset.ir, 10));
    });
    pista.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') ultimoManual = Date.now();
        if (e.key === 'ArrowRight') { e.preventDefault(); ir(actual() + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual() - 1); }
    });
    pista.addEventListener('scroll', () => requestAnimationFrame(marcar), { passive: true });
    marcar();

    // Avance automático, solo si nadie está interactuando y se permite movimiento.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let pausado = false;
    ['mouseenter', 'focusin'].forEach((ev) => raiz.addEventListener(ev, () => { pausado = true; }));
    ['mouseleave', 'focusout'].forEach((ev) => raiz.addEventListener(ev, () => { pausado = false; }));
    const temporizador = setInterval(() => {
        if (!document.body.contains(raiz)) { clearInterval(temporizador); return; }   // Inicio se volvió a pintar
        if (!pausado && !document.hidden && raiz.offsetParent && Date.now() - ultimoManual >= ENCUENTRO_AVANCE_MS) ir(actual() + 1);
    }, ENCUENTRO_AVANCE_MS);
}

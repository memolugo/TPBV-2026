// ---------------------------------------------------------------------------
// Carrusel de fotos reutilizable (Inicio: Segundo Encuentro Estatal; Aulas
// Tecnológicas: entrega en Temixco). Sin librerías: pista con scroll-snap,
// flechas, puntos, teclado (← →) y avance automático que se pausa con el
// cursor encima, con el foco dentro, con la pestaña oculta, tras usarlo a
// mano (espera un ciclo completo) y si la persona prefiere menos movimiento.
// Estilos: .carrusel* en el <style> del shell.
//
// Las fotos viven en dashboard/assets/<carpeta>/ y se sirven desde GitHub
// Pages con URL absoluta: el proxy de tpbv.morelos.gob.mx no sirve archivos
// nuevos de assets/ (ver CLAUDE.md). Solo en local (servidor de pruebas o
// archivo abierto) se usa la ruta relativa, para verlas antes de publicar.
//
// Uso: carruselHtml({ id, etiqueta, carpeta, fotos: [[archivo, pie], ...] })
// devuelve el HTML; iniciarCarrusel(id) conecta los controles una vez que el
// HTML está en el DOM. Se carga ANTES de app.js (Inicio se pinta al arrancar).
// ---------------------------------------------------------------------------

const CARRUSEL_AVANCE_MS = 6000;
const CARRUSEL_PAGES_URL = 'https://memolugo.github.io/TPBV-2026/dashboard/';

function carruselBase(carpeta) {
    const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    return `${local ? '' : CARRUSEL_PAGES_URL}assets/${carpeta}/`;
}

function carruselHtml({ id, etiqueta, carpeta, fotos }) {
    const base = carruselBase(carpeta);
    const total = fotos.length;
    const slides = fotos.map(([archivo, pie], i) => `
        <figure class="carrusel-slide" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${total}">
            <img src="${base}${archivo}" alt="${esc(pie)}" ${i ? 'loading="lazy"' : ''} width="1280" height="854">
            <figcaption>${esc(pie)}</figcaption>
        </figure>`).join('');
    const puntos = fotos.map((_, i) =>
        `<button type="button" class="carrusel-punto" data-ir="${i}" aria-label="Ver foto ${i + 1} de ${total}"></button>`).join('');
    return `
    <div class="carrusel" id="${id}" role="region" aria-roledescription="carrusel" aria-label="${esc(etiqueta)}">
        <div class="carrusel-pista" tabindex="0">${slides}</div>
        <button type="button" class="carrusel-flecha izq" data-mover="-1" aria-label="Foto anterior"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
        <button type="button" class="carrusel-flecha der" data-mover="1" aria-label="Foto siguiente"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
        <div class="carrusel-puntos">${puntos}</div>
    </div>`;
}

function iniciarCarrusel(id) {
    const raiz = document.getElementById(id);
    if (!raiz || raiz.dataset.iniciado) return;
    raiz.dataset.iniciado = '1';
    const pista = raiz.querySelector('.carrusel-pista');
    const puntos = [...raiz.querySelectorAll('.carrusel-punto')];
    const total = puntos.length;
    let ultimoManual = 0;
    const actual = () => Math.round(pista.scrollLeft / pista.clientWidth);
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
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        ultimoManual = Date.now();
        ir(actual() + (e.key === 'ArrowRight' ? 1 : -1));
    });
    pista.addEventListener('scroll', () => requestAnimationFrame(marcar), { passive: true });
    marcar();

    if (total < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let pausado = false;
    ['mouseenter', 'focusin'].forEach((ev) => raiz.addEventListener(ev, () => { pausado = true; }));
    ['mouseleave', 'focusout'].forEach((ev) => raiz.addEventListener(ev, () => { pausado = false; }));
    const temporizador = setInterval(() => {
        if (!document.body.contains(raiz)) { clearInterval(temporizador); return; }   // la vista se volvió a pintar
        const libre = !pausado && !document.hidden && raiz.offsetParent && Date.now() - ultimoManual >= CARRUSEL_AVANCE_MS;
        if (libre) ir(actual() + 1);
    }, CARRUSEL_AVANCE_MS);
}

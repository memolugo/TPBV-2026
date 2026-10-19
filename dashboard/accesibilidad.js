// ---------------------------------------------------------------------------
// accesibilidad.js — ajustes de accesibilidad del Morelos Design System
// (Componentes > Button > Accesibilidad) aplicados a todo el tablero, también
// a lo que las vistas pintan después:
//
// 1. Enlaces que abren pestaña nueva (target="_blank"): se les agrega un texto
//    solo para lectores de pantalla que lo avisa.
// 2. Íconos de Material Symbols: son decorativos (el texto del botón o enlace
//    ya describe la acción), así que se ocultan a los lectores de pantalla;
//    si no, se leería su nombre en inglés ("download", "arrow_forward").
// ---------------------------------------------------------------------------

const A11Y_AVISO_PESTANA = '(se abre en una pestaña nueva)';

function a11yAvisarPestanaNueva(enlace) {
    if (enlace.querySelector('[data-aviso-pestana]')) return;
    const aviso = document.createElement('span');
    aviso.className = 'sr-only';
    aviso.dataset.avisoPestana = '';
    aviso.textContent = ` ${A11Y_AVISO_PESTANA}`;
    enlace.appendChild(aviso);
}

function a11yAjustar(raiz) {
    if (!(raiz instanceof Element)) return;
    const buscar = (selector) => [
        ...(raiz.matches(selector) ? [raiz] : []),
        ...raiz.querySelectorAll(selector),
    ];
    buscar('a[target="_blank"]').forEach(a11yAvisarPestanaNueva);
    buscar('.material-symbols-outlined:not([aria-hidden])')
        .forEach((icono) => icono.setAttribute('aria-hidden', 'true'));
}

function iniciarAccesibilidad() {
    a11yAjustar(document.body);
    const observador = new MutationObserver((cambios) => {
        cambios.forEach((cambio) => cambio.addedNodes.forEach(a11yAjustar));
    });
    observador.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarAccesibilidad);
} else {
    iniciarAccesibilidad();
}

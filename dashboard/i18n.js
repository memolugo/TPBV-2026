// ---------------------------------------------------------------------------
// Versión en náhuatl del tablero (selector "Náhuatl / Español", como en
// morelos.gob.mx/nahuatl). Funciona sobre el DOM ya dibujado: no hay que
// tocar el código de cada vista.
//
//   - Diccionario: TPBV_TRADUCCIONES_NA = { "texto en español": "náhuatl" }
//     (dashboard/traducciones_na.js, generado por
//     scripts/build_traducciones_na.py desde la plantilla del traductor
//     traducciones/Traduccion_nahuatl_tablero.xlsx).
//   - Clave = texto normalizado (espacios colapsados) con los números
//     reemplazados por {n}: "Mapa de las 45 escuelas…" -> "Mapa de las {n}
//     escuelas…"; al traducir se reinsertan los números en orden.
//   - Textos con un dato dentro (nombre de escuela, localidad…) usan {d}:
//     "Ver {d} en el mapa". Esas claves se aplican como patrón; los {n}/{d}
//     de la traducción se llenan en el mismo orden que en el español.
//   - Unidad de traducción: un elemento cuyo contenido es solo texto con
//     formato en línea (b, strong, em, i, br, span sin iconos) se traduce
//     COMPLETO (el orden de palabras del náhuatl no coincide con el del
//     español); si contiene enlaces/botones/iconos, se traducen sus nodos de
//     texto por separado.
//   - Lo que no esté en el diccionario se queda en español (los datos:
//     nombres de localidades, escuelas, dependencias, nunca se traducen).
//   - Las vistas se re-dibujan con innerHTML: un MutationObserver traduce lo
//     nuevo mientras el idioma activo es náhuatl.
//   - tpbvExtraerTextos() recorre el DOM con las mismas reglas y devuelve las
//     claves: así la plantilla del traductor coincide 1:1 con el motor.
//
// Idioma: ?lang=na en la URL o la elección guardada (localStorage). El
// selector solo se muestra cuando MOSTRAR_SELECTOR_NAHUATL es true (mientras
// la traducción esté incompleta se revisa con ?lang=na).
// ---------------------------------------------------------------------------

const MOSTRAR_SELECTOR_NAHUATL = true;
const I18N_DICC = (typeof TPBV_TRADUCCIONES_NA !== 'undefined') ? TPBV_TRADUCCIONES_NA : {};
const I18N_CLAVE_ALMACEN = 'tpbv-idioma';

// Elementos que nunca se traducen ni se extraen.
const I18N_EXCLUIR = 'script, style, noscript, svg, .material-symbols-outlined, .leaflet-tile-pane, .leaflet-control-attribution, [data-no-traducir]';
// Formato en línea que se traduce junto con su párrafo. SPAN no cuenta: suele
// separar etiqueta y valor (p. ej. "Municipio" | "Ayala").
const I18N_INLINE = new Set(['B', 'STRONG', 'EM', 'I', 'BR', 'SMALL', 'SUP', 'SUB']);
const I18N_ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];

let i18nIdioma = 'es';
let i18nAplicando = false;
let i18nTituloOriginal = null;   // título de la pestaña en español
const i18nOriginalTexto = new WeakMap();    // Text -> texto original
const i18nOriginalHtml = new WeakMap();     // Element (unidad) -> innerHTML original
const i18nOriginalAttr = new WeakMap();     // Element -> {attr: valor original}

const NUM_RE = /\d[\d,.]*\d|\d/g;

function i18nNormalizar(texto) {
    return String(texto || '').replace(/\s+/g, ' ').trim();
}

// "Mapa de las 45 escuelas" -> { clave: "Mapa de las {n} escuelas", numeros: ["45"] }
function i18nClave(texto) {
    const limpio = i18nNormalizar(texto);
    const numeros = limpio.match(NUM_RE) || [];
    return { clave: limpio.replace(NUM_RE, '{n}'), numeros };
}

// Claves con {d} (dato variable) se usan como patrón: regex anclada.
const I18N_PATRONES = Object.keys(I18N_DICC).filter((k) => k.includes('{d}')).map((k) => {
    const marcas = k.match(/\{[nd]\}/g);
    const fuente = k.split(/(\{[nd]\})/).map((parte) => (parte === '{n}' ? '(\\d[\\d,.]*\\d|\\d)' : parte === '{d}' ? '(.+?)'
        : parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
    return { clave: k, marcas, re: new RegExp('^' + fuente + '$') };
});

function i18nLlenar(destino, marcas, valores) {
    const porTipo = { '{n}': [], '{d}': [] };
    marcas.forEach((m, i) => porTipo[m].push(valores[i]));
    const usados = { '{n}': 0, '{d}': 0 };
    return destino.replace(/\{[nd]\}/g, (m) => porTipo[m][usados[m]++] ?? '');
}

function i18nTraducir(texto) {
    const { clave, numeros } = i18nClave(texto);
    const destino = I18N_DICC[clave];
    if (destino) return i18nLlenar(destino, numeros.map(() => '{n}'), numeros);
    const limpio = i18nNormalizar(texto);
    for (const p of I18N_PATRONES) {
        const m = limpio.match(p.re);
        if (m) return i18nLlenar(I18N_DICC[p.clave], p.marcas, m.slice(1));
    }
    return null;
}

function i18nEsTraducible(texto) {
    const t = i18nNormalizar(texto);
    return t.length > 1 && /\p{L}/u.test(t);
}

// Unidad = elemento con texto propio y solo hijos de formato en línea (sin
// iconos ni enlaces). Se traduce entero.
function i18nEsUnidad(el) {
    if (!el.childNodes.length || el.matches('a, button, select, option, input, textarea') && el.children.length) return false;
    let tieneTexto = false;
    for (const hijo of el.childNodes) {
        if (hijo.nodeType === Node.TEXT_NODE) { if (i18nNormalizar(hijo.nodeValue)) tieneTexto = true; continue; }
        if (hijo.nodeType !== Node.ELEMENT_NODE) continue;
        if (!I18N_INLINE.has(hijo.tagName) || hijo.matches(I18N_EXCLUIR) || hijo.querySelector('*:not(b):not(strong):not(em):not(i):not(br):not(small):not(sup):not(sub)')) return false;
        if (i18nNormalizar(hijo.textContent)) tieneTexto = true;
    }
    return tieneTexto && el.children.length > 0;
}

// Recorre el subárbol y llama visitar(tipo, nodo, texto) para cada pieza traducible.
function i18nRecorrer(raiz, visitar) {
    if (raiz.nodeType === Node.TEXT_NODE) {
        if (i18nEsTraducible(raiz.nodeValue) && !(raiz.parentElement && raiz.parentElement.closest(I18N_EXCLUIR))) visitar('texto', raiz, raiz.nodeValue);
        return;
    }
    if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.matches(I18N_EXCLUIR)) return;
    I18N_ATRIBUTOS.forEach((a) => { if (raiz.hasAttribute(a) && i18nEsTraducible(raiz.getAttribute(a))) visitar('atributo:' + a, raiz, raiz.getAttribute(a)); });
    if (i18nEsUnidad(raiz)) { visitar('unidad', raiz, raiz.textContent); return; }
    raiz.childNodes.forEach((h) => i18nRecorrer(h, visitar));
}

function i18nAplicarEn(raiz) {
    i18nRecorrer(raiz, (tipo, nodo, texto) => {
        const original = tipo === 'texto' ? (i18nOriginalTexto.get(nodo) ?? texto)
            : tipo === 'unidad' ? (i18nOriginalHtml.has(nodo) ? null : texto) : texto;
        if (tipo === 'texto') {
            const t = i18nTraducir(original);
            if (!t) return;
            if (!i18nOriginalTexto.has(nodo)) i18nOriginalTexto.set(nodo, nodo.nodeValue);
            // conserva espacios iniciales/finales del nodo original
            const pre = nodo.nodeValue.match(/^\s*/)[0], post = nodo.nodeValue.match(/\s*$/)[0];
            nodo.nodeValue = pre + t + post;
        } else if (tipo === 'unidad') {
            if (original === null) return;     // ya traducida
            const t = i18nTraducir(original);
            if (!t) return;
            i18nOriginalHtml.set(nodo, nodo.innerHTML);
            nodo.textContent = t;
        } else {
            const attr = tipo.split(':')[1];
            const previos = i18nOriginalAttr.get(nodo) || {};
            const base = previos[attr] ?? texto;
            const t = i18nTraducir(base);
            if (!t) return;
            previos[attr] = base;
            i18nOriginalAttr.set(nodo, previos);
            nodo.setAttribute(attr, t);
        }
    });
}

// Regresa todo lo traducido a su texto original en español.
function i18nRestaurar(raiz = document.body) {
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const pendientes = [];
    for (let n = walker.currentNode; n; n = walker.nextNode()) pendientes.push(n);
    pendientes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && i18nOriginalTexto.has(n)) { n.nodeValue = i18nOriginalTexto.get(n); i18nOriginalTexto.delete(n); }
        if (n.nodeType === Node.ELEMENT_NODE) {
            if (i18nOriginalHtml.has(n)) { n.innerHTML = i18nOriginalHtml.get(n); i18nOriginalHtml.delete(n); }
            const attrs = i18nOriginalAttr.get(n);
            if (attrs) { Object.entries(attrs).forEach(([a, v]) => n.setAttribute(a, v)); i18nOriginalAttr.delete(n); }
        }
    });
}

const i18nObservador = new MutationObserver((mutaciones) => {
    if (i18nIdioma !== 'na' || i18nAplicando) return;
    i18nAplicando = true;
    try {
        mutaciones.forEach((m) => m.addedNodes.forEach((n) => i18nAplicarEn(n)));
    } finally {
        i18nAplicando = false;
    }
});

function i18nActualizarSelector() {
    const btn = document.getElementById('btn-idioma');
    if (!btn) return;
    const etiqueta = btn.querySelector('[data-etiqueta-idioma]') || btn;
    etiqueta.textContent = i18nIdioma === 'na' ? 'Español' : 'Náhuatl';
    etiqueta.setAttribute('lang', i18nIdioma === 'na' ? 'es' : 'nah');
    btn.setAttribute('aria-label', i18nIdioma === 'na' ? 'Ver en español' : 'Ver en náhuatl');
    btn.closest('[data-selector-idioma]')?.classList.toggle('hidden', !(MOSTRAR_SELECTOR_NAHUATL || i18nIdioma === 'na'));
}

function tpbvCambiarIdioma(idioma) {
    i18nIdioma = idioma === 'na' ? 'na' : 'es';
    try { localStorage.setItem(I18N_CLAVE_ALMACEN, i18nIdioma); } catch (e) { /* sin almacenamiento: solo esta visita */ }
    document.documentElement.lang = i18nIdioma === 'na' ? 'nah' : 'es';
    if (i18nTituloOriginal === null) i18nTituloOriginal = document.title;
    document.title = (i18nIdioma === 'na' && i18nTraducir(i18nTituloOriginal)) || i18nTituloOriginal;
    i18nAplicando = true;
    try {
        if (i18nIdioma === 'na') i18nAplicarEn(document.body);
        else i18nRestaurar();
    } finally {
        i18nAplicando = false;
    }
    i18nActualizarSelector();
}

// Claves traducibles del DOM actual (mismas reglas que el motor), para la
// plantilla del traductor. Devuelve [{clave, tipo}] sin duplicados.
function tpbvExtraerTextos(raiz = document.body) {
    const vistas = new Map();
    i18nRecorrer(raiz, (tipo, nodo, texto) => {
        const original = tipo === 'texto' ? (i18nOriginalTexto.get(nodo) ?? texto)
            : tipo === 'unidad' && i18nOriginalHtml.has(nodo) ? (() => { const d = document.createElement('div'); d.innerHTML = i18nOriginalHtml.get(nodo); return d.textContent; })()
            : tipo.startsWith('atributo:') ? ((i18nOriginalAttr.get(nodo) || {})[tipo.split(':')[1]] ?? texto) : texto;
        const { clave } = i18nClave(original);
        if (!vistas.has(clave)) vistas.set(clave, tipo.startsWith('atributo:') ? tipo.replace('atributo:', 'atributo ') : 'texto');
    });
    return [...vistas.entries()].map(([clave, tipo]) => ({ clave, tipo }));
}

(function iniciarI18n() {
    i18nObservador.observe(document.body, { childList: true, subtree: true });
    document.getElementById('btn-idioma')?.addEventListener('click', (e) => {
        e.preventDefault();
        tpbvCambiarIdioma(i18nIdioma === 'na' ? 'es' : 'na');
    });
    let inicial = 'es';
    const param = new URLSearchParams(location.search).get('lang');
    if (param) inicial = param === 'na' ? 'na' : 'es';
    else { try { inicial = localStorage.getItem(I18N_CLAVE_ALMACEN) || 'es'; } catch (e) { /* sin almacenamiento */ } }
    if (inicial === 'na') tpbvCambiarIdioma('na');
    else i18nActualizarSelector();
})();

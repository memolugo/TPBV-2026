// Extrae todos los textos traducibles del tablero para la plantilla del
// traductor al náhuatl. Usa tpbvExtraerTextos() (dashboard/i18n.js), así que
// las claves coinciden 1:1 con las que usa el motor de traducción.
//
// Requisitos: un servidor local con el tablero y playwright-core con Chrome:
//   python -m http.server 8080 --bind 127.0.0.1 --directory dashboard
//   npm install playwright-core   (en una carpeta de trabajo)
//   node scripts/extraer_textos_nahuatl.js http://127.0.0.1:8080/TPBV_2026_COMPLETO_PRO.html traducciones/textos_extraidos.json
// Luego: python scripts/build_plantilla_nahuatl.py
const path = require('path');
const fs = require('fs');

// playwright-core puede estar instalado fuera del repo: NODE_PATH lo resuelve.
const { chromium } = require('playwright-core');

const URL = process.argv[2] || 'http://127.0.0.1:8080/TPBV_2026_COMPLETO_PRO.html';
const SALIDA = process.argv[3] || path.join(__dirname, '..', 'traducciones', 'textos_extraidos.json');

// Recorrido: [vista, preparación opcional, etiqueta de sección]
const RECORRIDO = [
    ['inicio', null, 'Inicio'],
    ['analisis', null, 'Análisis Demográfico (todos los polígonos)'],
    ['analisis', "selPoligono.value='1'; selPoligono.dispatchEvent(new Event('change'))", 'Análisis Demográfico (un polígono)'],
    ['analisis', "selectLocalidad(activeData().findIndex(r => r.fuente === 'ITER 2020'))", 'Análisis Demográfico (una localidad)'],
    ['analisis', "selectLocalidad(activeData().findIndex(r => r.fuente === 'SIN DATOS'))", 'Análisis Demográfico (localidad sin datos censales)'],
    ['analisis', "toggleCustomPoligonosPanel()", 'Análisis Demográfico (filtro personalizado)'],
    ['aulas', null, 'Aulas Tecnológicas'],
    ['red', null, 'Red La tierra que nos une'],
    ['telecom', null, 'Infraestructura de Telecomunicaciones'],
    ['datos', null, 'Datos Abiertos'],
];

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });

    // Valores de datos (no se traducen): se descartan de la plantilla.
    const datos = await page.evaluate(() => {
        const valores = new Set();
        const agregar = (v) => { if (typeof v === 'string' && v.trim()) valores.add(v.replace(/\s+/g, ' ').trim()); };
        const fuentes = [
            typeof TPBV_DATA !== 'undefined' ? TPBV_DATA : [],
            typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined' ? TPBV_AULAS_TECNOLOGICAS : [],
            typeof TPBV_RED_LTQNU !== 'undefined' ? TPBV_RED_LTQNU : [],
            typeof TPBV_TELECOM !== 'undefined' ? TPBV_TELECOM.municipios : [],
        ];
        fuentes.forEach((lista) => lista.forEach((r) => Object.values(r).forEach(agregar)));
        if (typeof TPBV_LIMITES_MUNICIPALES !== 'undefined') TPBV_LIMITES_MUNICIPALES.features.forEach((f) => agregar(f.properties.NOMGEO));
        if (typeof TPBV_POLIGONOS_ACTUAL_NOMBRES !== 'undefined') Object.values(TPBV_POLIGONOS_ACTUAL_NOMBRES).forEach(agregar);
        return [...valores];
    });
    // Mismo formato que las claves: números -> {n}. Más largos primero para
    // que "Emiliano Zapata Salazar" gane a "Emiliano Zapata".
    // Términos que también son valores de datos pero aparecen en textos fijos
    // (prosa): no se convierten en {d}.
    const NO_ES_DATO = new Set(['Morelos', 'Agencia de Transformación Digital', 'ITER {n}', 'Cuernavaca',
        'Emiliano Zapata', 'Guanajuato', 'Secretaría de Educación', 'Gobierno del Estado',
        'Jefatura de la Oficina de la Gubernatura', 'Servicios de Salud', 'Jojutla']);
    const datosClave = [...new Set(datos.map((d) => d.replace(/\d[\d,.]*\d|\d/g, '{n}')))]
        .filter((d) => d.replace(/\{n\}/g, '').length > 3 && !NO_ES_DATO.has(d)).sort((a, b) => b.length - a.length);
    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Sustituye los datos dentro de la clave por {d} (palabra completa).
    // Devuelve null si solo quedan datos, números o puntuación.
    const plantillaDe = (clave) => {
        let resto = clave;
        datosClave.forEach((d) => {
            if (!resto.includes(d)) return;
            resto = resto.replace(new RegExp(`(^|[^\\p{L}])${escRe(d)}(?![\\p{L}])`, 'gu'), '$1{d}');
        });
        resto = resto.replace(/(\{[nd]\})(\s*\{[nd]\})+/g, '{d}');   // datos pegados -> uno
        return /\p{L}{2,}/u.test(resto.replace(/\{[nd]\}/g, '')) ? resto : null;
    };

    const textos = new Map();   // clave -> {tipo, seccion}
    const agregar = (lista, seccion) => lista.forEach(({ clave, tipo }) => {
        const k = plantillaDe(clave);
        if (k && !textos.has(k)) textos.set(k, { tipo, seccion });
    });

    // Encabezado, barra de utilidad y footer (comunes a todas las vistas)
    agregar(await page.evaluate(() => tpbvExtraerTextos(document.querySelector('header'))), 'Encabezado y menú');
    agregar(await page.evaluate(() => tpbvExtraerTextos(document.querySelector('.util-bar'))), 'Encabezado y menú');
    agregar(await page.evaluate(() => tpbvExtraerTextos(document.getElementById('site-footer'))), 'Pie de página');

    for (const [vista, prep, seccion] of RECORRIDO) {
        await page.evaluate((v) => showView(v), vista);
        await page.waitForTimeout(1800);
        if (prep) { await page.evaluate(prep); await page.waitForTimeout(1500); }
        agregar(await page.evaluate(() => tpbvExtraerTextos(document.getElementById('main-content'))), seccion);
        agregar(await page.evaluate(() => tpbvExtraerTextos(document.getElementById('custom-poligonos-panel'))), seccion);
    }
    agregar([{ clave: await page.evaluate(() => i18nClave(i18nTituloOriginal ?? document.title).clave), tipo: 'título de la página' }], 'Encabezado y menú');

    const salida = [...textos.entries()].map(([clave, v]) => ({ clave, ...v }));
    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1), 'utf8');
    console.log(`Textos extraidos: ${salida.length} -> ${SALIDA}`);
    await browser.close();
})().catch((e) => { console.error('FALLO', e); process.exit(1); });

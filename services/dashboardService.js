const inventoryRepo = require('../repositories/inventoryRepository');
const firebirdService = require('../services/firebirdService');

/**
 * Orquestación de la métrica de Asertividad Cíclica.
 * Combina datos locales de productos contados con el análisis de la API externa.
 */
const getAsertividadCiclica = async (inventarioId, localInventarioId) => {
    localInventarioId = localInventarioId || inventarioId;

    console.log('\n🔍 [ORQUESTADOR] =========================================');
    console.log(`🔍 [ORQUESTADOR] Iniciando proceso para InventarioID: "${inventarioId}"`);
    if (localInventarioId !== inventarioId) {
        console.log(`🔍 [ORQUESTADOR] Usando ID local: "${localInventarioId}"`);
    }

    // 1. Obtener productos contados localmente para ese inventario
    console.log('⏳ [ORQUESTADOR] Paso 1: Consultando Base de Datos Local (MySQL)...');
    const productosLocales = await inventoryRepo.getContadosByInventario(localInventarioId);
    
    console.log(`📦 [ORQUESTADOR] Paso 1 Resultado: ${productosLocales.length} productos locales encontrados.`);
    if (productosLocales.length > 0) {
        console.log('   Ejemplo Local:', productosLocales.slice(0, 2));
    }

    if (productosLocales.length === 0) {
        console.warn('⛔ [ORQUESTADOR] ¡ALERTA! No hay productos locales. Abortando y devolviendo [].');
        console.warn('   👉 Revisa si el InventarioID en MySQL coincide exactamente con "062026-1"');
        return [];
    }

    // 2. Extraer solo las claves para la API externa (Agregamos .trim() por seguridad)
    const claves = productosLocales.map(p => (p.Clave || '').trim());
    console.log(`🔑 [ORQUESTADOR] Paso 2: ${claves.length} claves listas para enviar a Firebird.`);

    // 3. Consultar API externa (Firebird)
    console.log('🚀 [ORQUESTADOR] Paso 3: Llamando a API Firebird (esto puede tardar ~40s)...');
    let dataExterna = [];
    try {
        dataExterna = await firebirdService.getAsertividadCiclica(inventarioId, claves);
        console.log(`🔥 [ORQUESTADOR] Paso 3 Resultado: Firebird devolvió ${dataExterna ? dataExterna.length : 0} registros.`);
        if (dataExterna && dataExterna.length > 0) {
            console.log('   Ejemplo Firebird:', dataExterna.slice(0, 2));
        }
    } catch (error) {
        console.error('❌ [ORQUESTADOR] ¡ERROR CRÍTICO llamando a Firebird!', error.message);
        console.error('   👉 Posible Timeout de Axios. Firebird tardó 44s en responder.');
        return []; // Devolvemos vacío si la API externa falla
    }

    if (!dataExterna || dataExterna.length === 0) {
        console.warn('⛔ [ORQUESTADOR] ¡ALERTA! Firebird no devolvió datos.');
        return [];
    }

    // 4. Combinar la información
    console.log('🔗 [ORQUESTADOR] Paso 4: Cruzando datos locales con Firebird...');
    const resultadoCombinado = dataExterna.map(itemExterno => {
        // 🔧 CORRECCIÓN: Usamos .trim() en ambos lados para evitar que los espacios 
        // de MySQL (CHAR) rompan el match con Firebird (ya limpio).
        const local = productosLocales.find(p => (p.Clave || '').trim() === (itemExterno.CVE_ART || '').trim());

        return {
            ...itemExterno,
            CANT_CONTADA: local ? local.Existencia : 0, 
            DESCRIPCION_LOCAL: local ? local.Descripcion : '',
            UNIDAD_LOCAL: local ? local.Unidad : '',
            AUDITOR: local ? local.Auditor : 'N/A',
            LINEA: local ? local.Linea : 'N/A'
        };
    });

    console.log(`✅ [ORQUESTADOR] ¡ÉXITO! Enviando ${resultadoCombinado.length} registros al Frontend.`);
    console.log('==========================================================\n');
    
    return resultadoCombinado;
};

const calcularHorasActivas = (inicio, fin) => {
    if (!inicio || !fin || fin <= inicio) return 0;

    const HORA_MS = 3600000;
    const CST_OFFSET_MS = -6 * HORA_MS;

    let startMs = inicio.getTime() + CST_OFFSET_MS;
    let endMs = fin.getTime() + CST_OFFSET_MS;

    if (startMs >= endMs) return 0;

    let startOfDay = new Date(startMs);
    startOfDay.setUTCHours(0, 0, 0, 0);
    let cursor = startOfDay.getTime();

    let totalHoras = 0;

    while (cursor < endMs) {
        let dow = new Date(cursor).getUTCDay();

        if (dow === 0) {
            cursor += 24 * HORA_MS;
            continue;
        }

        let workFin = (dow === 6) ? 13 : 19;

        let dayBegin = cursor + 9 * HORA_MS;
        let dayEnd = cursor + workFin * HORA_MS;

        let segStart = Math.max(startMs, dayBegin);
        let segEnd = Math.min(endMs, dayEnd);

        if (segEnd > segStart) {
            totalHoras += (segEnd - segStart) / HORA_MS;
        }

        cursor += 24 * HORA_MS;
    }

    return Math.round(totalHoras * 100) / 100;
};

const getSkuPorHora = async (inventarioId) => {
    console.log(`\n📊 [SKU/hr] Iniciando para InventarioID: "${inventarioId}"`);

    const lineas = await inventoryRepo.getLineasConTimestamp(inventarioId);

    if (!lineas || lineas.length === 0) {
        console.warn('⛔ [SKU/hr] No se encontraron líneas para este inventario.');
        return [];
    }

    console.log(`📦 [SKU/hr] ${lineas.length} líneas encontradas.`);

    const HORA_MS = 3600000;
    const detalle = [];

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        const current = new Date(linea.createdAt);

        let horasActivas = null;
        let skuHr = null;

        if (i > 0) {
            const prev = new Date(lineas[i - 1].createdAt);
            const horasLaborales = calcularHorasActivas(prev, current);
            const horasRaw = (current - prev) / HORA_MS;

            if (horasLaborales > 0) {
                horasActivas = horasLaborales;
            } else if (horasRaw > 0.0167) {
                horasActivas = Math.round(horasRaw * 100) / 100;
            }

            if (horasActivas > 0) {
                skuHr = Math.round((linea.productos / horasActivas) * 100) / 100;
            }
        }

        detalle.push({
            linea: linea.Linea,
            productos: linea.productos,
            timestamp: lineas[i].createdAt,
            horasActivas,
            skuHr
        });
    }

    return detalle;
};

module.exports = {
    getAsertividadCiclica,
    getSkuPorHora
};
